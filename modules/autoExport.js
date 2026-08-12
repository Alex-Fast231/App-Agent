import { exportBackup } from "./backup.js";
import { mutateRuntimeData, queuePersistRuntimeData } from "../core/app-core.js";

const AUTO_EXPORT_INTERVAL_DAYS = 28;
const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export function isAutoExportDue(data) {
  const lastAt = data?.ui?.lastAutoExportAt;
  if (!lastAt) return true;

  const lastDate = new Date(lastAt);
  if (Number.isNaN(lastDate.getTime())) return true;

  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= AUTO_EXPORT_INTERVAL_DAYS;
}

export function isAutoExportConfigured(data) {
  const autoExport = data?.settings?.autoExport || {};
  const bueroEmail = data?.settings?.buero?.email || "";
  return !!(autoExport.emailjsServiceId && autoExport.emailjsTemplateId && autoExport.emailjsPublicKey && bueroEmail);
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
// basierter E-Mail-Versand ohne eigenes Backend - siehe emailjs.com). Damit das
// tatsächlich funktioniert, muss in den Einstellungen ein EmailJS-Konto mit
// Service, Template (Vorlage mit Variable-Attachment "attachment") und
// Public Key hinterlegt sein. Das EmailJS-Template muss folgende Variablen
// verwenden: to_email, subject, message, therapist_name, filename, attachment.
async function sendExportViaEmailJs({ autoExportConfig, bueroEmail, therapistName, blob, filename }) {
  const attachmentDataUrl = await blobToBase64DataUrl(blob);

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: autoExportConfig.emailjsServiceId,
      template_id: autoExportConfig.emailjsTemplateId,
      user_id: autoExportConfig.emailjsPublicKey,
      template_params: {
        to_email: bueroEmail,
        subject: `FaSt-Doku Automatischer Export – ${therapistName || "Therapeut"}`,
        message: `Automatischer 4-Wochen-Export von ${therapistName || "Therapeut"}. Enthält alle App-Daten, verschlüsselt mit dem Praxispasswort.`,
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
// letzten automatischen Export 4 Wochen vergangen sind, und verschickt in
// diesem Fall im Hintergrund eine vollständige, verschlüsselte Kopie aller
// App-Daten (identisches Format wie das manuelle Backup) an die Büro-E-Mail.
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
    const result = await exportBackup(runtimeData);
    await sendExportViaEmailJs({
      autoExportConfig: runtimeData.settings.autoExport,
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
