// Web Worker: Blatt finden, entzerren, Felder auslesen. Kein Speicher, kein Netz
// außer den eigenen Dateien aus ocr-test/. Das Bild liegt nur in dieser Variablen.
import * as ort from "./lib/ort.wasm.min.mjs";
import {
  findeBlatt, verfeinereEcken, randEcken, entzerre, feldRechteck, ausschnittRGBA,
  tintenAnteil, textZeilen, zeilenTensor, NORM_BREITE, NORM_HOEHE
} from "./bild.js";

const MAX_KANTE = 3200;      // größere Fotos werden verkleinert
const SUCH_KANTE = 800;      // Bildgröße für die Blattsuche
const VORSCHAU_KANTE = 1400; // Bild für die Eckenanzeige

const DATEIEN = {
  wasm: "./lib/ort-wasm-simd-threaded.wasm",
  modell: "./models/latin_PP-OCRv3_rec_infer.onnx",
  woerter: "./models/latin_dict.txt"
};

let sitzung = null;
let zeichen = null;
let bild = null; // ImageData des aktuellen Fotos (nur Arbeitsspeicher)

function melde(nachricht, transfer = []) { self.postMessage(nachricht, transfer); }

async function ladeMitFortschritt(url, teil, gesamt) {
  const antwort = await fetch(new URL(url, import.meta.url), { credentials: "omit" });
  if (!antwort.ok) throw new Error(`Laden fehlgeschlagen: ${url} (${antwort.status})`);
  const laenge = Number(antwort.headers.get("content-length")) || 0;
  const leser = antwort.body.getReader();
  const teile = [];
  let geladen = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    teile.push(value);
    geladen += value.length;
    gesamt.geladen[teil] = geladen;
    if (laenge) gesamt.groesse[teil] = Math.max(laenge, geladen);
    melde({ typ: "fortschritt", geladen: Object.values(gesamt.geladen).reduce((a, b) => a + b, 0), groesse: Object.values(gesamt.groesse).reduce((a, b) => a + b, 0) });
  }
  const puffer = new Uint8Array(geladen);
  let o = 0;
  for (const t of teile) { puffer.set(t, o); o += t.length; }
  return puffer;
}

async function laden() {
  const t0 = performance.now();
  // ungefähre Größen, bis der Server die echten meldet
  const gesamt = { geladen: {}, groesse: { wasm: 11210254, modell: 8980573, woerter: 700 } };
  const [wasm, modell, woerter] = await Promise.all([
    ladeMitFortschritt(DATEIEN.wasm, "wasm", gesamt),
    ladeMitFortschritt(DATEIEN.modell, "modell", gesamt),
    ladeMitFortschritt(DATEIEN.woerter, "woerter", gesamt)
  ]);
  ort.env.wasm.wasmPaths = new URL("./lib/", import.meta.url).href;
  ort.env.wasm.wasmBinary = wasm.buffer;
  ort.env.wasm.numThreads = 1; // GitHub Pages ist nicht cross-origin-isolated
  ort.env.wasm.proxy = false;
  sitzung = await ort.InferenceSession.create(modell, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  const liste = new TextDecoder().decode(woerter).split(/\r?\n/);
  if (liste[liste.length - 1] === "") liste.pop();
  zeichen = ["", ...liste, " "];
  melde({
    typ: "bereit",
    ladezeit: performance.now() - t0,
    bytes: wasm.length + modell.length + woerter.length
  });
}

function zuImageData(bitmap, maxKante) {
  const f = Math.min(1, maxKante / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * f), h = Math.round(bitmap.height * f);
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0, w, h);
  return { daten: g.getImageData(0, 0, w, h), faktor: f };
}

async function neuesBild(bitmap) {
  const t0 = performance.now();
  bild = zuImageData(bitmap, MAX_KANTE).daten;
  const klein = zuImageData(bitmap, SUCH_KANTE);
  const vorschau = zuImageData(bitmap, VORSCHAU_KANTE);
  bitmap.close();
  const fund = findeBlatt(klein.daten);
  const skal = bild.width / klein.daten.width;
  let ecken = fund.ecken.map(([x, y]) => [x * skal, y * skal]);
  if (fund.sicher) ecken = verfeinereEcken(bild, ecken, fund.schwelle, Math.round(skal * 3) + 2, fund.art);
  else ecken = randEcken(bild.width, bild.height).map((e, i) => (fund.ecken[i] ? [fund.ecken[i][0] * skal, fund.ecken[i][1] * skal] : e));
  // Querformat: die längere Kante soll oben liegen
  const kante = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const quer = kante(ecken[0], ecken[1]) + kante(ecken[3], ecken[2]);
  const hoch = kante(ecken[0], ecken[3]) + kante(ecken[1], ecken[2]);
  if (hoch > quer * 1.1) ecken = [ecken[3], ecken[0], ecken[1], ecken[2]];
  const vb = await createImageBitmap(vorschau.daten);
  melde({
    typ: "ecken", ecken, sicher: fund.sicher, grund: fund.grund,
    breite: bild.width, hoehe: bild.height, vorschau: vb, zeit: performance.now() - t0
  }, [vb]);
}

function ctcDekodieren(ausgabe, schritte, klassen) {
  let text = "", letzte = 0;
  const wk = [];
  for (let t = 0; t < schritte; t++) {
    let best = 0, bw = -1;
    const o = t * klassen;
    for (let k = 0; k < klassen; k++) if (ausgabe[o + k] > bw) { bw = ausgabe[o + k]; best = k; }
    if (best !== 0 && best !== letzte) { text += zeichen[best] ?? ""; wk.push(bw); }
    letzte = best;
  }
  const konf = wk.length ? wk.reduce((a, b) => a + b, 0) / wk.length : 0;
  const minKonf = wk.length ? Math.min(...wk) : 0;
  return { text, konf, minKonf };
}

async function erkenneZeile(zeile) {
  const { daten, breite } = zeilenTensor(zeile);
  const tensor = new ort.Tensor("float32", daten, [1, 3, 48, breite]);
  const aus = await sitzung.run({ [sitzung.inputNames[0]]: tensor });
  const t = aus[sitzung.outputNames[0]];
  const [, schritte, klassen] = t.dims;
  return ctcDekodieren(t.data, schritte, klassen);
}

async function auswerten(ecken, schablone) {
  if (!bild) throw new Error("Kein Bild vorhanden");
  if (!sitzung) throw new Error("Erkennung ist noch nicht geladen");
  const t0 = performance.now();
  const blatt = entzerre(bild, ecken, NORM_BREITE, NORM_HOEHE);
  const t1 = performance.now();
  const felder = [];
  for (const feld of schablone.felder) {
    const r = feldRechteck(feld);
    const ausschnitt = ausschnittRGBA(blatt, r, 6);
    const e = { id: feld.id, ausschnitt };
    if (feld.typ === "kreuz") {
      e.anteil = tintenAnteil(blatt, r, 0.22, 0.55);
    } else {
      const { zeilen } = textZeilen(blatt, r, feld.zeilen || 1);
      e.zeilen = [];
      for (const z of zeilen) e.zeilen.push(await erkenneZeile(z));
    }
    felder.push(e);
  }
  const t2 = performance.now();
  const entzerrt = await createImageBitmap(blatt);
  melde({
    typ: "ergebnis", felder, entzerrt,
    zeiten: { entzerren: t1 - t0, erkennung: t2 - t1 }
  }, [entzerrt, ...felder.map((f) => f.ausschnitt.data.buffer)]);
}

self.onmessage = async (ereignis) => {
  const n = ereignis.data;
  try {
    if (n.typ === "laden") await laden();
    else if (n.typ === "bild") await neuesBild(n.bitmap);
    else if (n.typ === "auswerten") await auswerten(n.ecken, n.schablone);
    else if (n.typ === "loeschen") { bild = null; melde({ typ: "geloescht" }); }
  } catch (fehler) {
    melde({ typ: "fehler", bei: n.typ, meldung: String(fehler && fehler.message || fehler) });
  }
};
