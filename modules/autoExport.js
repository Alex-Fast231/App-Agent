import { finalizeAppStructure } from "../data/normalization.js";
import { mutateRuntimeData, queuePersistRuntimeData } from "../core/app-core.js";

// Tägliches automatisches Backup für den separaten Offline-Viewer
// (Vorgabe des Nutzers: "tägliches automatisches Backup für den Viewer",
// nach abgeschlossenem Testbetrieb auf alle 4 Wochen umzustellen - dann
// hier einfach auf 28 ändern, die Kalendertag-Zählung in
// isAutoExportDue() funktioniert unverändert für jeden Intervallwert).
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

function toLocalDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Zählt volle Kalendertage zwischen zwei Zeitpunkten (lokale Zeitzone),
// nicht volle 24-Stunden-Intervalle - damit ein Export z.B. um 23:50 Uhr
// und der nächste um 00:10 Uhr (nur 20 Minuten später, aber nach
// Mitternacht) bereits als "neuer Tag" zählt. Entspricht der Vorgabe
// "Zählung nach Mitternacht - neue E-Mail am nächsten Tag sobald App
// geöffnet" statt eines starren 24h-Countdowns ab dem letzten Versand.
function daysBetweenLocalDates(earlier, later) {
  const a = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function isAutoExportDue(data) {
  const lastAt = data?.ui?.lastAutoExportAt;
  if (!lastAt) return true;

  const lastDate = new Date(lastAt);
  if (Number.isNaN(lastDate.getTime())) return true;

  return daysBetweenLocalDates(lastDate, new Date()) >= AUTO_EXPORT_INTERVAL_DAYS;
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

// EmailJS erzwingt eine harte Obergrenze von 50 KB für alle dynamischen
// Template-Variablen zusammen, AUSSER für Variablen, die im Template
// explizit als "Variable Attachment" konfiguriert sind - dort gilt
// stattdessen ein je nach EmailJS-Tarif höheres Limit (der kostenlose
// Free-Tarif unterstützt laut EmailJS-Doku generell keine Attachments).
// Da die Backup-ZIP mit den echten Praxisdaten wächst (anders als die
// winzigen Testdatensätze in dieser Sandbox) und hier als Base64-String
// übertragen wird, ist dieses Limit ein sehr wahrscheinlicher Grund dafür,
// dass der Versand in der echten Nutzung scheitert, obwohl er strukturell
// korrekt aussieht. Wir senden trotzdem immer (das Attachment-Feld könnte
// im EmailJS-Template korrekt als "Variable Attachment" mit höherem Limit
// hinterlegt sein), hängen aber bei Überschreitung einen klaren Hinweis an
// die Fehlermeldung an, damit die tatsächliche Ursache beim nächsten
// Fehlschlag sichtbar ist statt nur "Failed to fetch".
const EMAILJS_VARIABLE_ATTACHMENT_SAFE_LIMIT_BYTES = 50 * 1024;

// Sendet die exportierte Backup-Datei per EmailJS (client-seitiger, "public key"
// basierter E-Mail-Versand ohne eigenes Backend - siehe emailjs.com). Das
// EmailJS-Template muss folgende Variablen verwenden: to_email, subject,
// message, therapist_name, filename, attachment (als "Variable Attachment").
async function sendExportViaEmailJs({ therapistName, blob, filename }) {
  console.log(`Auto-Export: baue Base64-Anhang aus ZIP (${blob.size} Bytes roh)…`);
  const attachmentDataUrl = await blobToBase64DataUrl(blob);
  const attachmentBytes = attachmentDataUrl.length;
  console.log(`Auto-Export: Base64-Anhang fertig (${attachmentBytes} Zeichen). Sende an EmailJS (Service ${EMAILJS_SERVICE_ID}, Template ${EMAILJS_TEMPLATE_ID}, Ziel ${AUTO_EXPORT_TARGET_EMAIL})…`);

  const oversizeHint = attachmentBytes > EMAILJS_VARIABLE_ATTACHMENT_SAFE_LIMIT_BYTES
    ? ` [Hinweis: Anhang ist ${Math.round(attachmentBytes / 1024)} KB groß - EmailJS begrenzt Nicht-Attachment-Variablen auf 50 KB und unterstützt echte Attachments je nach Tarif nur eingeschränkt. Falls dieser Fehler wiederholt auftritt: im EmailJS-Dashboard prüfen, ob das Feld "attachment" im Template als "Variable Attachment" konfiguriert ist und ob der Tarif Attachments in dieser Größe erlaubt.]`
    : "";

  let response;
  try {
    response = await fetch(EMAILJS_ENDPOINT, {
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
  } catch (networkErr) {
    console.error("Auto-Export: Netzwerkfehler beim EmailJS-Request (fetch konnte keine Antwort empfangen):", networkErr);
    throw new Error(
      `EmailJS-Versand fehlgeschlagen: Netzwerkfehler (${networkErr?.message || networkErr}). ` +
      `Das deutet meist auf ein CORS-/Origin-Problem hin - im EmailJS-Dashboard unter Account > Security prüfen, ` +
      `ob die Domain dieser App unter "Allowed origins" eingetragen ist.${oversizeHint}`
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`Auto-Export: EmailJS antwortete mit Fehlerstatus ${response.status}:`, text || response.statusText);
    throw new Error(`EmailJS-Versand fehlgeschlagen (${response.status}): ${text || response.statusText}${oversizeHint}`);
  }

  console.log("Auto-Export: EmailJS hat den Versand mit Status", response.status, "bestätigt.");
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
export async function runAutoExportIfDue(runtimeData, { force = false } = {}) {
  if (!force && !isAutoExportDue(runtimeData)) {
    console.log("Auto-Export: heute bereits gesendet, kein erneuter Versand fällig.");
    return { sent: false, reason: "not_due" };
  }

  console.log(force ? "Auto-Export: manueller Test-Versand gestartet…" : "Auto-Export: fällig, starte Versand…");

  try {
    if (!runtimeData) throw new Error("Keine App-Daten im Speicher (runtimeData ist leer) - Export übersprungen.");

    const result = await buildViewerExportZip(runtimeData);
    console.log(`Auto-Export: ZIP "${result.filename}" gebaut (${result.blob.size} Bytes).`);

    await sendExportViaEmailJs({
      therapistName: runtimeData.settings.therapistName,
      blob: result.blob,
      filename: result.filename
    });

    markAutoExportSent();
    pushAutoExportHistory("sent", `Viewer-Backup "${result.filename}" gesendet an ${AUTO_EXPORT_TARGET_EMAIL}.`);
    await queuePersistRuntimeData();
    console.log("Auto-Export: erfolgreich abgeschlossen.");
    return { sent: true };
  } catch (err) {
    console.error("Automatischer Export fehlgeschlagen:", err);
    pushAutoExportHistory("failed", err?.message || String(err));
    await queuePersistRuntimeData().catch((persistErr) => console.error(persistErr));
    return { sent: false, reason: "error", error: err };
  }
}
