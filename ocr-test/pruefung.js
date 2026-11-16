// Plausibilität der erkannten Werte. Grundlage sind die Listen aus App-Agent
// (katalog.js). Ergebnis je Feld: Wert, Ampel (gruen/gelb/rot/leer), Hinweise.
import { HEILMITTEL_KATALOG, PRAEFIX_REGELN } from "./katalog.js";

export const KONF_GUT = 0.85;  // darunter gelb
export const KONF_SCHLECHT = 0.5; // darunter rot

// Typische Verwechslungen der Texterkennung
const ZU_ZIFFER = { O: "0", o: "0", D: "0", Q: "0", U: "0", I: "1", l: "1", i: "1", "|": "1", "!": "1", J: "1", Z: "2", z: "2", S: "5", s: "5", B: "8", G: "6", b: "6", T: "7", g: "9", q: "9" };
const ZU_BUCHSTABE = { 0: "O", 1: "I", 2: "Z", 5: "S", 6: "G", 8: "B", 4: "A", 7: "T" };

const PRAEFIXE = new Map(PRAEFIX_REGELN.map((r) => [r.praefix, r]));

// ------------------------------------------------------------ Einzelprüfungen
function alsZiffern(text) {
  let geaendert = false;
  const aus = [...text].map((z) => {
    if (/\d/.test(z)) return z;
    if (ZU_ZIFFER[z] !== undefined) { geaendert = true; return ZU_ZIFFER[z]; }
    return z;
  }).join("");
  return { aus, geaendert };
}

export function pruefeDatum(roh, art) {
  const text = roh.replace(/\s+/g, "");
  const { aus, geaendert } = alsZiffern(text.replace(/[,:;\-/]/g, "."));
  const m = aus.match(/(\d{1,2})\.?(\d{1,2})\.?(\d{4}|\d{2})/);
  if (!m) return { wert: roh, ampel: "rot", hinweise: ["kein Datum erkannt"] };
  const t = Number(m[1]), mo = Number(m[2]);
  let j = Number(m[3]);
  const heute = new Date();
  if (m[3].length === 2) {
    if (art === "geburtsdatum") j += j > heute.getFullYear() % 100 ? 1900 : 2000;
    else j += 2000;
  }
  const d = new Date(j, mo - 1, t);
  const wert = `${String(t).padStart(2, "0")}.${String(mo).padStart(2, "0")}.${j}`;
  const hinweise = [];
  let ampel = "gruen";
  if (d.getFullYear() !== j || d.getMonth() !== mo - 1 || d.getDate() !== t) {
    return { wert, ampel: "gelb", hinweise: ["ungültiges Datum"], korrigiert: geaendert };
  }
  if (art === "geburtsdatum") {
    const alter = (heute - d) / (365.25 * 864e5);
    if (alter < 0 || alter > 115) { ampel = "gelb"; hinweise.push("Alter unplausibel"); }
  } else {
    const tage = (heute - d) / 864e5;
    if (tage < -1) { ampel = "gelb"; hinweise.push("Datum liegt in der Zukunft"); }
    else if (tage > 365) { ampel = "gelb"; hinweise.push("älter als ein Jahr"); }
  }
  if (geaendert) { ampel = "gelb"; hinweise.push("korrigiert (Lesefehler)"); }
  return { wert, ampel, hinweise, korrigiert: geaendert };
}

export function pruefeIcd(roh) {
  let text = roh.toUpperCase().replace(/\s+/g, " ").trim();
  // Zusatzkennzeichen (G/V/A/Z, Seite L/R/B) abtrennen
  text = text.split(" ")[0] || "";
  text = text.replace(/[,]/g, ".").replace(/[^A-Z0-9.]/g, "");
  // Zusatzkennzeichen ohne Leerzeichen angehängt (z. B. „M17.1G“)
  if (text.replace(/\./g, "").length >= 4 && /\d[GVAZLRB]$/.test(text)) text = text.slice(0, -1);
  if (!text) return { wert: "", ampel: "rot", hinweise: ["nicht lesbar"] };
  let geaendert = false;
  const zeichen = [...text.replace(/\./g, "")];
  if (/\d/.test(zeichen[0]) && ZU_BUCHSTABE[zeichen[0]]) { zeichen[0] = ZU_BUCHSTABE[zeichen[0]]; geaendert = true; }
  for (let i = 1; i < zeichen.length; i++) {
    if (!/\d/.test(zeichen[i]) && ZU_ZIFFER[zeichen[i]] !== undefined) { zeichen[i] = ZU_ZIFFER[zeichen[i]]; geaendert = true; }
  }
  const kern = zeichen.join("");
  const wert = kern.length > 3 ? `${kern.slice(0, 3)}.${kern.slice(3)}` : kern;
  if (!/^[A-Z]\d{2}(\.\d{1,2})?$/.test(wert)) {
    return { wert, ampel: "rot", hinweise: ["kein gültiges ICD-10-Format"], korrigiert: geaendert };
  }
  const regel = PRAEFIXE.get(wert.slice(0, 3));
  const hinweise = [];
  let ampel = "gruen";
  if (!regel) { ampel = "gelb"; hinweise.push("nicht in der ICD-Liste der App"); }
  else hinweise.push(`${regel.diagnose} (${regel.gruppe})`);
  if (geaendert) { ampel = "gelb"; hinweise.push("korrigiert (Lesefehler)"); }
  return { wert, ampel, hinweise, korrigiert: geaendert, gruppe: regel ? regel.gruppe : null };
}

// Heilmittel-Text -> Leistung wie im Rezeptformular der App
export function heilmittelTyp(roh) {
  const t = roh.toLowerCase().replace(/[\s\-_.]/g, "");
  const woerter = roh.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(Boolean);
  if (!t) return null;
  if (/zns|bobath|vojta|pnf/.test(t)) return "KG-ZNS";
  if (/atem/.test(t)) return "KG-Atemtherapie";
  if (/mld|lymph/.test(t)) {
    const m = roh.match(/(30|45|60)/);
    return m ? `MLD${m[1]}` : "MLD";
  }
  if (/manuelletherapie/.test(t) || woerter.includes("mt")) return "MT";
  if (/krankengymnastik/.test(t) || woerter.includes("kg")) return "KG";
  if (/blanko/.test(t)) return "Blanko";
  return null;
}

const TYP_ZU_EMPFEHLUNG = { KG: "KG", MT: "MT", "KG-ZNS": "KgZNS", "KG-Atemtherapie": "KG", MLD30: "MLD", MLD45: "MLD", MLD60: "MLD" };

export function pruefeHeilmittel(roh, gruppe) {
  const text = roh.trim();
  const typ = heilmittelTyp(text);
  if (!typ) return { wert: text, ampel: "gelb", hinweise: ["keine Leistung der App erkannt"] };
  const hinweise = [`gelesen: ${text}`];
  let ampel = "gruen";
  if (typ === "MLD") { ampel = "gelb"; hinweise.push("Dauer (30/45/60) fehlt"); }
  const emp = TYP_ZU_EMPFEHLUNG[typ];
  if (gruppe && HEILMITTEL_KATALOG[gruppe] && emp && !HEILMITTEL_KATALOG[gruppe].vorrangig.includes(emp)) {
    ampel = "gelb";
    hinweise.push(`laut App-Katalog nicht vorrangig bei ${gruppe} (Gruppe aus ICD-10)`);
  }
  return { wert: typ, ampel, hinweise };
}

export function pruefeEinheiten(roh, gruppe) {
  const { aus, geaendert } = alsZiffern(roh.replace(/\s+/g, ""));
  const m = aus.match(/\d+/);
  if (!m) return { wert: roh, ampel: "rot", hinweise: ["keine Zahl erkannt"] };
  const n = Number(m[0]);
  const hinweise = [];
  let ampel = "gruen";
  const max = gruppe && HEILMITTEL_KATALOG[gruppe] ? HEILMITTEL_KATALOG[gruppe].maxProVO : null;
  if (n < 1) { ampel = "gelb"; hinweise.push("Anzahl 0"); }
  if (max && n > max) { ampel = "gelb"; hinweise.push(`mehr als Höchstmenge je VO (${max} bei ${gruppe}, Gruppe aus ICD-10)`); }
  if (geaendert) { ampel = "gelb"; hinweise.push("korrigiert (Lesefehler)"); }
  return { wert: String(n), ampel, hinweise, korrigiert: geaendert };
}

// „B“ zwischen Kleinbuchstaben ist fast immer ein „ß“ (GrüBinger, StraBe)
function esZett(text) {
  return text.replace(/ßB/g, "ß").replace(/([a-zäöü])B(?=[a-zäöü])/g, "$1ß");
}

export function pruefeName(roh) {
  let wert = roh.replace(/\s+/g, " ").trim();
  if (!wert) return { wert, ampel: "rot", hinweise: ["nicht lesbar"] };
  const vorher = wert;
  wert = esZett(wert);
  // Namensteile beginnen groß (wöhrle-Agidius -> Wöhrle-Agidius)
  wert = wert.replace(/(^|[\s-])([a-zäöü])/g, (m, a, b) => a + b.toUpperCase());
  const geaendert = wert !== vorher;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿĀ-žß' .-]+$/.test(wert)) return { wert, ampel: "gelb", hinweise: ["ungewöhnliche Zeichen"], korrigiert: geaendert };
  return { wert, ampel: geaendert ? "gelb" : "gruen", hinweise: geaendert ? ["korrigiert (Lesefehler)"] : [], korrigiert: geaendert };
}

// ------------------------------------------------------------ Gesamtbewertung
function konfAmpel(b, konf) {
  if (b.ampel === "leer") return b;
  if (konf < KONF_SCHLECHT) { b.ampel = "rot"; b.hinweise.push(`unsicher gelesen (${Math.round(konf * 100)} %)`); }
  else if (konf < KONF_GUT && b.ampel === "gruen") { b.ampel = "gelb"; b.hinweise.push(`unsicher gelesen (${Math.round(konf * 100)} %)`); }
  return b;
}

export function kreuzStatus(anteil, schwelle) {
  if (anteil >= schwelle) return "angekreuzt";
  if (anteil < schwelle * 0.4) return "leer";
  return "unsicher";
}

// felder: Ergebnisse aus dem Worker; schablone: Feldliste; schwelle: Ankreuzfelder
export function bewerte(felder, schablone, schwelle) {
  const nachId = new Map(felder.map((f) => [f.id, f]));
  const defs = new Map(schablone.felder.map((f) => [f.id, f]));
  const aus = new Map();
  const textVon = (f) => (f && f.zeilen ? f.zeilen.map((z) => z.text).join(" ").trim() : "");
  const konfVon = (f) => (f && f.zeilen && f.zeilen.length ? Math.min(...f.zeilen.map((z) => z.konf)) : 0);

  // ICD zuerst: daraus die Diagnosegruppe laut App (für Heilmittel und Höchstmenge)
  let icdGruppe = null;
  for (const f of felder) {
    const d = defs.get(f.id);
    if (!d || d.art !== "icd") continue;
    const roh = textVon(f);
    let b;
    if (!roh) b = d.optional ? { wert: "", ampel: "leer", hinweise: [] } : { wert: "", ampel: "rot", hinweise: ["leer oder nicht lesbar"] };
    else b = konfAmpel(pruefeIcd(roh), konfVon(f));
    b.roh = roh;
    if (!icdGruppe && b.gruppe) icdGruppe = b.gruppe;
    aus.set(f.id, b);
  }
  const gruppe = icdGruppe;

  for (const f of felder) {
    if (aus.has(f.id)) continue;
    const d = defs.get(f.id);
    if (!d) continue;
    let b;
    if (d.typ === "kreuz") {
      const s = kreuzStatus(f.anteil, schwelle);
      b = { wert: s, ampel: s === "unsicher" ? "gelb" : "gruen", hinweise: [`Tinte ${(f.anteil * 100).toFixed(1)} %`] };
    } else {
      const roh = textVon(f);
      if (!roh) {
        b = d.optional ? { wert: "", ampel: "leer", hinweise: [] } : { wert: "", ampel: "rot", hinweise: ["leer oder nicht lesbar"] };
        if (d.art === "einheiten" && d.bezug && textVon(nachId.get(d.bezug))) b = { wert: "", ampel: "rot", hinweise: ["Heilmittel ohne Einheiten"] };
      } else {
        const k = konfVon(f);
        if (d.art === "name") b = pruefeName(roh);
        else if (d.art === "geburtsdatum" || d.art === "ausstellungsdatum") b = pruefeDatum(roh, d.art);
        else if (d.art === "heilmittel") b = pruefeHeilmittel(roh, gruppe);
        else if (d.art === "einheiten") b = pruefeEinheiten(roh, gruppe);
        else b = { wert: roh.replace(/\s+/g, " ").trim(), ampel: "gruen", hinweise: [] };
        b = konfAmpel(b, k);
        b.roh = roh;
      }
    }
    aus.set(f.id, b);
  }

  // Querprüfungen der Ankreuzfelder
  const ja = aus.get("hausbesuch_ja"), nein = aus.get("hausbesuch_nein");
  if (ja && nein && (ja.wert === "angekreuzt") === (nein.wert === "angekreuzt")) {
    for (const b of [ja, nein]) { if (b.ampel === "gruen") b.ampel = "gelb"; b.hinweise.push("Hausbesuch: ja und nein widersprüchlich"); }
  }
  return aus;
}
