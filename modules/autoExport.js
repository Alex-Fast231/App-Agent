import { exportBackup } from "./backup.js";
import { mutateRuntimeData, queuePersistRuntimeData } from "../core/app-core.js";

// TEMPORÄR auf 1 Tag gesetzt, um den automatischen Export im laufenden
// Testbetrieb zu prüfen. Nach abgeschlossenem Test wieder auf 28 (4 Wochen)
// zurücksetzen.
const AUTO_EXPORT_INTERVAL_DAYS = 1;
const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

// TEMPORÄRES Testpasswort für die Verschlüsselung des automatischen Exports.
// Bewusst getrennt vom Praxispasswort, damit eine abgefangene E-Mail auch
// ohne Kenntnis des echten Praxispassworts nicht lesbar ist. Wird in einer
// späteren Session durch ein vom Nutzer im Viewer festlegbares Passwort
// ersetzt (siehe HANDOFF_SUMMARY.md).
const AUTO_EXPORT_TEST_PASSWORD = "FaSt-AutoExport-Test-2026!";

// Fest hinterlegte EmailJS-Zugangsdaten. Bewusst nicht in den Einstellungen
// sichtbar/änderbar (Vorgabe: kein Therapeut soll diese sehen oder ändern
// können). Der Public Key ist bei EmailJS dafür vorgesehen, client-seitig
// eingebettet zu werden (Absicherung erfolgt über Domain-Restriktion im
// EmailJS-Dashboard, nicht über Geheimhaltung).
const EMAILJS_SERVICE_ID = "service_85uo2dr";
const EMAILJS_TEMPLATE_ID = "template_ffghrgk";
const EMAILJS_PUBLIC_KEY = "nVDBHTKSRFftRdE9v";

export function isAutoExportDue(data) {
  const lastAt = data?.ui?.lastAutoExportAt;
  if (!lastAt) return true;

  const lastDate = new Date(lastAt);
  if (Number.isNaN(lastDate.getTime())) return true;

  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= AUTO_EXPORT_INTERVAL_DAYS;
}

export function isAutoExportConfigured(data) {
  const bueroEmail = data?.settings?.buero?.email || "";
  return !!bueroEmail;
}

function blobToBase64DataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(blob);
  });
}

// Sendet die exportierte Backup-Datei per EmailJS (client-seitiger, "public key"
// basierter E-Mail-Versand ohne eigenes Backend - siehe emailjs.com). Das
// EmailJS-Template muss folgende Variablen verwenden: to_email, subject,
// message, therapist_name, filename, attachment (als "Variable Attachment").
async function sendExportViaEmailJs({ bueroEmail, therapistName, blob, filename }) {
  const attachmentDataUrl = await blobToBase64DataUrl(blob);

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: bueroEmail,
        subject: `FaSt-Doku Automatischer Export – ${therapistName || "Therapeut"}`,
        message: `Automatischer Export von ${therapistName || "Therapeut"}. Enthält alle App-Daten, verschlüsselt mit dem Export-Passwort (nicht dem Praxispasswort).`,
        therapist_name: therapistName || "",
        filename,
        attachment: attachmentDataUrl
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`EmailJS-Versand fehlgeschlagen (${response.status}): ${text || response.statusText}`);
  }
}

function pushAutoExportHistory(status, message) {
  mutateRuntimeData((data) => {
    if (!Array.isArray(data.autoExportHistory)) data.autoExportHistory = [];
    data.autoExportHistory.unshift({
      id: `autoexport_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      status,
      message: String(message || "")
    });
    data.autoExportHistory = data.autoExportHistory.slice(0, 20);
  });
}

function markAutoExportSent() {
  mutateRuntimeData((data) => {
    data.ui.lastAutoExportAt = new Date().toISOString();
  });
}

// Wird beim App-Start (nach dem Entsperren) aufgerufen. Prüft, ob seit dem
// letzten automatischen Export AUTO_EXPORT_INTERVAL_DAYS vergangen sind
// (aktuell temporär 1 Tag für den Testbetrieb, regulär 4 Wochen), und
// verschickt in diesem Fall im Hintergrund eine vollständige, mit
// AUTO_EXPORT_TEST_PASSWORD verschlüsselte Kopie aller App-Daten
// (identisches Format wie das manuelle Backup) an die Büro-E-Mail.
// Läuft komplett ohne Rückfrage an den Therapeuten (Vorgabe: "ohne
// Bestätigung"). Gibt bei Erfolg { sent: true } zurück, damit die UI eine
// kurze stille Meldung ("Export gesendet") anzeigen kann.
export async function runAutoExportIfDue(runtimeData) {
  if (!isAutoExportDue(runtimeData)) {
    return { sent: false, reason: "not_due" };
  }

  if (!isAutoExportConfigured(runtimeData)) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const result = await exportBackup(runtimeData, { overridePassword: AUTO_EXPORT_TEST_PASSWORD });
    await sendExportViaEmailJs({
      bueroEmail: runtimeData.settings.buero.email,
      therapistName: runtimeData.settings.therapistName,
      blob: result.blob,
      filename: result.filename
    });

    markAutoExportSent();
    pushAutoExportHistory("sent", `Export "${result.filename}" gesendet an ${runtimeData.settings.buero.email}.`);
    await queuePersistRuntimeData();
    return { sent: true };
  } catch (err) {
    console.error("Automatischer Export fehlgeschlagen:", err);
    pushAutoExportHistory("failed", err?.message || String(err));
    await queuePersistRuntimeData().catch((persistErr) => console.error(persistErr));
    return { sent: false, reason: "error", error: err };
  }
}
