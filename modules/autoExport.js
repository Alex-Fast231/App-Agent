import { finalizeAppStructure } from "../data/normalization.js";
import { mutateRuntimeData, queuePersistRuntimeData } from "../core/app-core.js";

// Tägliches automatisches Backup für den separaten Offline-Viewer
// (Vorgabe des Nutzers: "tägliches automatisches Backup für den Viewer").
const AUTO_EXPORT_INTERVAL_DAYS = 1;
const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

// Feste Ziel-E-Mail-Adresse für den täglichen Viewer-Export (Vorgabe des
// Nutzers). Bewusst getrennt von der "Büro-E-Mail-Adresse" in den
// Einstellungen, die für Freikuvert-Bestellungen an eine andere Stelle
// genutzt wird - der tägliche Export soll unabhängig davon immer an diese
// eine feste Adresse gehen, ohne dass der Therapeut sie erst konfigurieren
// muss.
const AUTO_EXPORT_TARGET_EMAIL = "physio_fast@gmx.de";

// PIN, mit der die versendete ZIP-Datei im Viewer entsperrt werden kann
// (Vorgabe des Nutzers: PIN 1550). Bewusst eine einfache, im Viewer
// eingebbare PIN statt des Praxispassworts, damit die ZIP direkt mit dem
// separaten Offline-Viewer geöffnet werden kann, ohne das Praxispasswort
// preiszugeben. Die ZIP enthält dafür eine unverschlüsselte JSON-Kopie
// aller App-Daten (kein zusätzlicher App-Schlüssel nötig) - anders als
// beim manuellen "Backup exportieren" in den Einstellungen, das weiterhin
// mit dem echten Praxispasswort arbeitet und für die Wiederherstellung in
// der App selbst gedacht ist.
const AUTO_EXPORT_ZIP_PIN = "1550";

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

function requireZip() {
  if (!globalThis.zip) {
    throw new Error("ZIP Bibliothek ist nicht geladen");
  }
  return globalThis.zip;
}

function sanitizeFilenamePart(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Baut die tägliche Viewer-Export-ZIP: enthält eine einzige Datei
// (appData.json) mit dem vollständigen, unverschlüsselten JSON-Stand
// aller App-Daten - anders als das manuelle Backup keine appData.enc/
// cryptoMeta.json, da der Viewer die Daten direkt (nur per ZIP-PIN
// geschützt) lesen soll, ohne den Praxispasswort-Krypto-Stack der App zu
// benötigen.
async function buildViewerExportZip(runtimeData) {
  const normalized = finalizeAppStructure(runtimeData);
  const zipLib = requireZip();
  const writer = new zipLib.ZipWriter(new zipLib.BlobWriter("application/zip"));
  await writer.add(
    "appData.json",
    new zipLib.TextReader(JSON.stringify(normalized, null, 2)),
    { password: AUTO_EXPORT_ZIP_PIN, encryptionStrength: 3 }
  );

  const blob = await writer.close();
  const stamp = normalized.exportTimestamp.replace(/[:T]/g, "-").slice(0, 16);
  const therapistSlug = sanitizeFilenamePart(normalized.settings?.therapistName) || "therapeut";
  const filename = `FaSt-Doku-Viewer-Backup-${therapistSlug}-${stamp}.zip`;
  return { blob, filename };
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
async function sendExportViaEmailJs({ therapistName, blob, filename }) {
  const attachmentDataUrl = await blobToBase64DataUrl(blob);

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: AUTO_EXPORT_TARGET_EMAIL,
        subject: `FaSt-Doku Viewer-Backup – ${therapistName || "Therapeut"}`,
        message: `Automatisches tägliches Backup von ${therapistName || "Therapeut"} für den FaSt-Doku Viewer. Die ZIP-Datei ist mit einer PIN geschützt.`,
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
// letzten automatischen Export AUTO_EXPORT_INTERVAL_DAYS (täglich)
// vergangen sind, und verschickt in diesem Fall im Hintergrund eine
// vollständige, mit AUTO_EXPORT_ZIP_PIN geschützte JSON-Kopie aller
// App-Daten an die feste Viewer-Backup-Adresse. Läuft komplett ohne
// Rückfrage an den Therapeuten (Vorgabe: "ohne Bestätigung"). Gibt bei
// Erfolg { sent: true } zurück, damit die UI eine kurze stille Meldung
// ("Export gesendet") anzeigen kann.
export async function runAutoExportIfDue(runtimeData) {
  if (!isAutoExportDue(runtimeData)) {
    return { sent: false, reason: "not_due" };
  }

  try {
    const result = await buildViewerExportZip(runtimeData);
    await sendExportViaEmailJs({
      therapistName: runtimeData.settings.therapistName,
      blob: result.blob,
      filename: result.filename
    });

    markAutoExportSent();
    pushAutoExportHistory("sent", `Viewer-Backup "${result.filename}" gesendet an ${AUTO_EXPORT_TARGET_EMAIL}.`);
    await queuePersistRuntimeData();
    return { sent: true };
  } catch (err) {
    console.error("Automatischer Export fehlgeschlagen:", err);
    pushAutoExportHistory("failed", err?.message || String(err));
    await queuePersistRuntimeData().catch((persistErr) => console.error(persistErr));
    return { sent: false, reason: "error", error: err };
  }
}
