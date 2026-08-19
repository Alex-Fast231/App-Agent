// Feld-bezogene Auswertung des von Tesseract.js erkannten Textes. Anders
// als früher wird nicht mehr das gesamte fotografierte Rezept als ein
// Textblock durchsucht, sondern jedes Formularfeld einzeln zugeschnitten
// und einzeln erkannt (Region of Interest, siehe modules/ocrRegions.js
// und die Kamera-Erfassung in ui/views.js) - das reduziert Fehlzuordnungen
// deutlich, weil jede Funktion hier nur noch den bereits isolierten
// Text ihres eigenen Feldes aufbereiten muss statt raten zu müssen, zu
// welchem Feld eine Zeile irgendwo im Gesamttext gehört.
//
// Reine Textverarbeitung ohne DOM-/Browser-Abhängigkeit, damit sie
// unabhängig von der Kamera/OCR-Engine testbar bleibt. Liefert nur
// Bestwert-Vorschläge - der Therapeut prüft und korrigiert in jedem Fall
// im Formular, bevor gespeichert wird.

import { HEILMITTEL_KATALOG } from "./rezeptoptimierung.js";

const DATE_PATTERN = /\b(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})\b/g;
const ICD10_PATTERN = /\b([A-Z])\s?(\d{2})[.,]?\s?(\d{0,2})\b/g;

const HEILMITTEL_KEYWORDS = [
  { pattern: /kg[\s-]?zns|bobath|vojta|pnf/i, itemType: "KG-ZNS" },
  { pattern: /manuelle\s*therapie|\bmt\b/i, itemType: "MT" },
  { pattern: /krankengymnastik|\bkg\b/i, itemType: "KG" }
];

function normalizeWhitespace(text) {
  return String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ");
}

function toDDMMYYYY(dd, mm, yyyy) {
  const day = dd.padStart(2, "0");
  const month = mm.padStart(2, "0");
  let year = yyyy;
  if (year.length === 2) {
    const num = Number(year);
    year = String(num >= 30 ? 1900 + num : 2000 + num);
  }
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return null;
  return `${day}.${month}.${year}`;
}

// Isoliertes Namensfeld ("Nachname, Vorname" bzw. "Nachname Vorname" laut
// Personalienfeld auf Muster 13).
export function parseNameField(text) {
  const lines = normalizeWhitespace(text).split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const commaMatch = line.match(/^([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]+)\s*,\s*([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]+)/);
    if (commaMatch) return { lastName: commaMatch[1], firstName: commaMatch[2] };
    const spaceMatch = line.match(/^([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]+)\s+([A-ZÄÖÜ][a-zA-ZäöüÄÖÜß\-]+)$/);
    if (spaceMatch) return { lastName: spaceMatch[1], firstName: spaceMatch[2] };
  }
  return { lastName: "", firstName: "" };
}

// Isoliertes Datumsfeld (Geburtsdatum ODER Ausstellungsdatum - je nachdem
// welche Region übergeben wurde). Da das Feld schon isoliert ist, genügt
// der erste plausible Treffer, ohne Kontext-Rätselei über "geb."/"Datum".
export function parseDateField(text) {
  DATE_PATTERN.lastIndex = 0;
  const match = DATE_PATTERN.exec(normalizeWhitespace(text));
  if (!match) return "";
  return toDDMMYYYY(match[1], match[2], match[3]) || "";
}

// Isoliertes ICD-10-Feld. Enthält laut Muster 13 einen, in der Praxis
// gelegentlich zwei Codes (Haupt-/Nebendiagnose) - siehe icd10/icd10b im
// Rezeptformular.
export function parseIcd10Field(text) {
  const matches = [];
  let match;
  ICD10_PATTERN.lastIndex = 0;
  while ((match = ICD10_PATTERN.exec(text)) !== null) {
    const letter = match[1];
    const digits = match[2];
    const decimals = match[3];
    const code = decimals ? `${letter}${digits}.${decimals}` : `${letter}${digits}`;
    if (!matches.includes(code)) matches.push(code);
  }
  return { icd10: matches[0] || "", icd10b: matches[1] || "" };
}

// Isoliertes Diagnosegruppen-Kürzel (z.B. "EX", "ZN", "WS") - wird gegen
// die bekannten Gruppen aus dem Heilmittelkatalog abgeglichen (siehe
// modules/rezeptoptimierung.js), damit nur plausible Kürzel übernommen
// werden und kein zufällig erkanntes Kürzel durchrutscht.
export function parseDiagnosengruppeField(text) {
  const knownCodes = Object.keys(HEILMITTEL_KATALOG);
  const tokens = String(text || "").toUpperCase().match(/\b[A-Z]{2}\d?\b/g) || [];
  return tokens.find((token) => knownCodes.includes(token)) || "";
}

// Isoliertes Leitsymptomatik-Feld (Checkboxen a/b/c/patientenindividuell).
// Welche Checkbox angekreuzt ist, lässt sich aus reinem OCR-Text NICHT
// zuverlässig bestimmen (die drei Optionstexte stehen als Formulardruck
// immer alle in der Region, unabhängig vom Ankreuzstatus). Der erkannte
// Text wird deshalb nur bereinigt als Freitext-Vorschlag zurückgegeben -
// der Abgleich mit a/b/c bzw. die endgültige Auswahl bleibt Aufgabe des
// Therapeuten im Formular (siehe renderLeitsymptomatikField in ui/views.js).
export function parseLeitsymptomatikField(text) {
  const cleaned = normalizeWhitespace(text).replace(/\s{2,}/g, " ").trim();
  return cleaned.slice(0, 200);
}

export function parseHeilmittelField(text) {
  // Lymphdrainage wird auf dem Formular teils ausgeschrieben mit einer
  // separat genannten Dauer ("Manuelle Lymphdrainage 30 Minuten"), teils
  // als eine zusammengeschriebene Abkürzung ("MLD30") - die Dauer wird
  // deshalb als einfache Ziffernfolge irgendwo im Feldtext gesucht,
  // unabhängig davon, ob sie direkt an "mld" anschließt oder als eigenes
  // Wort auftritt.
  if (/lymphdrainage|mld/i.test(text)) {
    if (/60/.test(text)) return "MLD60";
    if (/45/.test(text)) return "MLD45";
    if (/30/.test(text)) return "MLD30";
    return "MLD60"; // Standarddauer, wenn keine explizite Angabe erkannt wurde
  }

  for (const { pattern, itemType } of HEILMITTEL_KEYWORDS) {
    if (pattern.test(text)) return itemType;
  }
  return "";
}

// Isoliertes Feld "Behandlungseinheiten" - eine kleine Zahl.
export function parseEinheitenField(text) {
  const match = String(text || "").match(/\d{1,2}/);
  return match ? match[0] : "";
}

// Führt die Ergebnisse aller einzeln zugeschnittenen und erkannten Felder
// zu einem vollständigen Formular-Vorschlagsobjekt zusammen. fieldTexts
// enthält den rohen OCR-Text je Feld (leerer String, wenn die Erkennung
// für dieses Feld nichts geliefert hat - kommt dann als "" durch).
// hausbesuch/dringend sind NICHT Teil dieser Funktion: deren Ankreuz-
// status wird nicht per Text-OCR, sondern per einfacher Kontrastanalyse
// des zugeschnittenen Bildausschnitts bestimmt (siehe
// modules/ocrMarkDetection.js), da auf dem Formular beide Wortoptionen
// ("ja" und "nein") immer als Druck vorhanden sind und Text-OCR daher
// nicht zwischen ihnen unterscheiden kann.
export function parseRezeptOcrFields(fieldTexts = {}) {
  const name = parseNameField(fieldTexts.name || "");
  const icdCodes = parseIcd10Field(fieldTexts.icd10 || "");

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    birthDate: parseDateField(fieldTexts.geburtsdatum || ""),
    ausstell: parseDateField(fieldTexts.ausstellungsdatum || ""),
    icd10: icdCodes.icd10,
    icd10b: icdCodes.icd10b,
    diagnosengruppeHint: parseDiagnosengruppeField(fieldTexts.diagnosengruppe || ""),
    leitsymptomatik: parseLeitsymptomatikField(fieldTexts.leitsymptomatik || ""),
    heilmittel: parseHeilmittelField(fieldTexts.heilmittel || ""),
    anzahl: parseEinheitenField(fieldTexts.einheiten || "")
  };
}
