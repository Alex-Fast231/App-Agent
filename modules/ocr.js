// Freitext-Auswertung des von Tesseract.js erkannten Rezept-Textes.
// Reine Textverarbeitung ohne DOM-/Browser-Abhängigkeit, damit sie
// unabhängig von der Kamera/OCR-Engine testbar bleibt. Liefert nur
// Bestwert-Vorschläge - der Therapeut prüft und korrigiert in jedem Fall
// im Formular, bevor gespeichert wird.

const DATE_PATTERN = /\b(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})\b/g;
const ICD10_PATTERN = /\b([A-Z])\s?(\d{2})[.,]?\s?(\d{0,2})\b/g;

const HEILMITTEL_KEYWORDS = [
  { pattern: /kg[\s-]?zns|bobath|vojta|pnf/i, itemType: "KG-ZNS" },
  { pattern: /manuelle\s*therapie|\bmt\b/i, itemType: "MT" },
  { pattern: /lymphdrainage|\bmld\s?60\b/i, itemType: "MLD60" },
  { pattern: /\bmld\s?45\b/i, itemType: "MLD45" },
  { pattern: /\bmld\s?30\b|\bmld\b/i, itemType: "MLD30" },
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

// Findet alle plausiblen Datumsangaben im Text. Ordnet sie heuristisch zu:
// die Angabe nahe "geb"/"geboren" ist das Geburtsdatum, eine spätere/
// eigenständige Angabe (typischerweise ein aktuelles Datum) das
// Ausstellungsdatum. Beide können leer bleiben, wenn nichts Eindeutiges
// gefunden wird.
function extractDates(text) {
  const lines = normalizeWhitespace(text).split("\n");
  let birthDate = null;
  let ausstellDate = null;
  const allDates = [];

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    const isBirthContext = /geb\.?|geburt/.test(lower);
    const isIssueContext = /ausstell|datum(?!.*geb)/.test(lower);

    let match;
    DATE_PATTERN.lastIndex = 0;
    while ((match = DATE_PATTERN.exec(line)) !== null) {
      const formatted = toDDMMYYYY(match[1], match[2], match[3]);
      if (!formatted) continue;
      allDates.push(formatted);
      if (isBirthContext && !birthDate) birthDate = formatted;
      if (isIssueContext && !isBirthContext && !ausstellDate) ausstellDate = formatted;
    }
  });

  if (!birthDate && !ausstellDate && allDates.length >= 2) {
    // Ohne Kontext: älteres Datum = Geburtsdatum, jüngeres = Ausstellung.
    const sorted = [...allDates].sort();
    birthDate = sorted[0];
    ausstellDate = sorted[sorted.length - 1];
  } else if (!ausstellDate && allDates.length === 1 && !birthDate) {
    ausstellDate = allDates[0];
  } else if (!ausstellDate) {
    // Geburtsdatum wurde über Kontext gefunden, aber kein weiteres Datum
    // hatte einen erkennbaren Ausstellungs-Kontext: das übrige,
    // unbeanspruchte Datum als Ausstellungsdatum verwenden.
    const remaining = allDates.filter((d) => d !== birthDate);
    if (remaining.length === 1) ausstellDate = remaining[0];
  }

  return { birthDate: birthDate || "", ausstell: ausstellDate || "" };
}

// Das GKV-Muster 13 (Heilmittelverordnung) sieht im Feld "Diagnose(n)
// (ICD-10-Code)" Platz für einen, in der Praxis gelegentlich auch für
// zwei Codes vor (Haupt-/Nebendiagnose) - daher werden bis zu zwei
// eindeutige Treffer zurückgegeben.
function extractIcd10Codes(text) {
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

// Sucht die Zeile mit dem Formular-Label "Leitsymptomatik" (Muster 13)
// und liefert den nachfolgenden Text als Freitext-Vorschlag - ein
// Abgleich mit den drei standardisierten Kategorien a/b/c erfolgt
// bewusst nicht hier, sondern beim Rendern im Formular (Freitext-Fall).
function extractLeitsymptomatik(text) {
  const lines = normalizeWhitespace(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((line) => /leitsymptomatik/i.test(line));
  if (idx === -1) return "";

  const sameLine = lines[idx].replace(/.*leitsymptomatik\s*[:\-]?\s*/i, "").trim();
  if (sameLine) return sameLine.slice(0, 200);

  const nextLine = lines[idx + 1] || "";
  return /diagnose|icd|heilmittel|verordnungsmenge/i.test(nextLine) ? "" : nextLine.slice(0, 200);
}

function extractArzt(text) {
  const lines = normalizeWhitespace(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const drLine = lines.find((line) => /^dr\.?\s?(med\.?)?\s+\S/i.test(line));
  if (drLine) {
    return drLine.replace(/\s{2,}/g, " ").slice(0, 80);
  }
  const arztLine = lines.find((line) => /vertragsarzt|arztstempel|praxis/i.test(line));
  return arztLine ? "" : "";
}

function extractHeilmittel(text) {
  for (const { pattern, itemType } of HEILMITTEL_KEYWORDS) {
    if (pattern.test(text)) return itemType;
  }
  return "";
}

// Sucht eine "Anzahl x" oder "x Anzahl"-Angabe (z.B. "6x", "x6", "6 x KG").
function extractAnzahl(text) {
  const match = String(text || "").match(/\b(\d{1,2})\s?[xX]\b/) || String(text || "").match(/\b[xX]\s?(\d{1,2})\b/);
  return match ? match[1] : "";
}

// Sehr grobe Namenserkennung: erste Zeile mit zwei aufeinanderfolgenden
// großgeschriebenen Wörtern, die nicht offensichtlich Praxis-/Kassentext ist.
function extractPatientName(text) {
  const lines = normalizeWhitespace(text).split("\n").map((l) => l.trim()).filter(Boolean);
  const stopwords = /rezept|verordnung|kasse|praxis|arzt|stempel|unterschrift|diagnose|heilmittel|krankengymnastik|zuzahlung/i;

  for (const line of lines) {
    if (stopwords.test(line)) continue;
    if (/^dr\.?\s/i.test(line)) continue;
    const nameMatch = line.match(/^([A-ZÄÖÜ][a-zäöüß]+)[,\s]+([A-ZÄÖÜ][a-zäöüß]+)$/);
    if (nameMatch) {
      return { lastName: nameMatch[1], firstName: nameMatch[2] };
    }
  }
  return { lastName: "", firstName: "" };
}

// Haupteinstieg: rohen OCR-Text in Formular-Vorschlagswerte umwandeln.
// Gibt IMMER ein vollständiges Objekt zurück (leere Strings statt
// undefined), damit die aufrufende UI die Felder direkt befüllen kann.
export function parseRezeptOcrText(rawText) {
  const text = String(rawText || "");
  const dates = extractDates(text);
  const name = extractPatientName(text);
  const icdCodes = extractIcd10Codes(text);

  return {
    firstName: name.firstName,
    lastName: name.lastName,
    birthDate: dates.birthDate,
    arzt: extractArzt(text),
    ausstell: dates.ausstell,
    icd10: icdCodes.icd10,
    icd10b: icdCodes.icd10b,
    leitsymptomatik: extractLeitsymptomatik(text),
    heilmittel: extractHeilmittel(text),
    anzahl: extractAnzahl(text)
  };
}
