// Lokaler Test des OCR-Prototyps mit erfundenen Testbildern (werkzeuge/testbilder.py).
// Aufruf: node werkzeuge/test-lokal.mjs <ordner-mit-testbildern> [--drossel=4] [--nur=d1-gerade.jpg,...]
// Erwartet einen laufenden Webserver auf http://127.0.0.1:8765/ mit dem Inhalt von ocr-test/.
// Prüft: Trefferquote je Feld, Dauer, keine Netzanfragen nach außen, kein Zugriff
// auf Browser-Speicher, keine CSP-Fehler, fremder Speicher derselben Adresse bleibt unberührt.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASIS = "http://127.0.0.1:8765/";
const ordner = process.argv[2];
const drossel = Number((process.argv.find((a) => a.startsWith("--drossel=")) || "=1").split("=")[1]);
const nur = (process.argv.find((a) => a.startsWith("--nur=")) || "").replace("--nur=", "").split(",").filter(Boolean);
const wahrheit = JSON.parse(fs.readFileSync(path.join(ordner, "wahrheit.json"), "utf8")).filter((w) => !nur.length || nur.includes(w.datei));

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 412, height: 915 } });
const anfragen = [];
const konsole = [];
kontext.on("request", (r) => anfragen.push(r.url()));
const seite = await kontext.newPage();
seite.on("console", (m) => { if (["error", "warning"].includes(m.type())) konsole.push(`${m.type()}: ${m.text()}`); });
seite.on("pageerror", (e) => konsole.push("pageerror: " + e.message));

// 1) Fremden Speicher derselben Adresse anlegen (wie eine alte App auf github.io)
await seite.goto(BASIS + "PRUEFSUMMEN.txt");
await seite.evaluate(async () => {
  localStorage.setItem("alteApp", "nicht anfassen");
  sessionStorage.setItem("alteAppSitzung", "nicht anfassen");
  document.cookie = "alteApp=1; path=/";
  await new Promise((ok, f) => {
    const r = indexedDB.open("AlteAppDB", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("daten").put("geheim", "schluessel");
    r.onsuccess = () => { r.result.close(); ok(); };
    r.onerror = f;
  });
});

// 2) Zugriffe auf Speicher-APIs im Hauptfenster protokollieren (nur Test)
await kontext.addInitScript(() => {
  window.__zugriffe = [];
  const merk = (name) => window.__zugriffe.push(name);
  for (const name of ["localStorage", "sessionStorage", "indexedDB", "caches"]) {
    const d = Object.getOwnPropertyDescriptor(window, name) || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), name);
    if (d && d.get) Object.defineProperty(window, name, { configurable: true, get() { merk(name); return d.get.call(window); } });
  }
  const c = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
  Object.defineProperty(document, "cookie", { configurable: true, get() { merk("cookie"); return c.get.call(document); }, set(v) { merk("cookie"); c.set.call(document, v); } });
  if (navigator.serviceWorker) {
    const reg = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...a) => { merk("serviceWorker"); return reg(...a); };
  }
});

const cdp = await kontext.newCDPSession(seite);
if (drossel > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: drossel });

const tLaden = Date.now();
await seite.goto(BASIS + "index.html");
await seite.waitForSelector("body[data-bereit='ja']", { timeout: 180000 });
const ladezeit = Date.now() - tLaden;
const ladeText = await seite.textContent("#ladeText");

const ergebnisse = [];
for (const w of wahrheit) {
  await seite.setInputFiles("#dateiWahl", path.join(ordner, w.datei));
  await seite.waitForSelector("#ecken:not(.versteckt)", { timeout: 60000 });
  const eckenMeldung = await seite.textContent("#eckenMeldung");
  await seite.click("#auswertenBtn");
  await seite.waitForSelector("#ergebnis:not(.versteckt)", { timeout: 180000 });
  const zeiten = await seite.textContent("#ergebnisZeiten");
  const felder = await seite.$$eval(".feld", (karten) => karten.map((k) => ({
    id: k.dataset.feld,
    ampel: ["gruen", "gelb", "rot", "leer"].find((a) => k.classList.contains(a)),
    wert: k.querySelector(".feld-wert").dataset.wert,
    roh: k.querySelector(".feld-wert").dataset.roh ?? null,
    hinweis: k.querySelector(".feld-hinweis").textContent
  })));
  const zeile = { datei: w.datei, variante: w.variante, datensatz: w.datensatz, zeiten, eckenMeldung, felder: [] };
  for (const f of felder) {
    const soll = w.erwartet[f.id];
    if (soll === undefined) continue;
    const stimmt = norm(f.wert) === norm(soll) || (f.roh !== null && norm(f.roh) === norm(soll));
    await seite.click(`.feld[data-feld='${f.id}'] button[data-urteil='${stimmt ? "ja" : "nein"}']`);
    zeile.felder.push({ ...f, soll, stimmt });
  }
  ergebnisse.push(zeile);
  const falsch = zeile.felder.filter((f) => !f.stimmt);
  console.log(`${w.datei.padEnd(20)} ${zeiten}  falsch: ${falsch.map((f) => `${f.id}[${f.wert}|${f.roh}≠${f.soll}]`).join(", ") || "-"}`);
  await seite.click("#naechstesBtn");
}
const auswertung = await seite.inputValue("#auswertungText");

// 3) Speicher und Netz prüfen
const zugriffe = await seite.evaluate(() => window.__zugriffe);
const speicher = await seite.evaluate(async () => ({
  local: Object.keys(localStorage), localWert: localStorage.getItem("alteApp"),
  session: Object.keys(sessionStorage),
  idb: (await indexedDB.databases()).map((d) => d.name),
  caches: await caches.keys(),
  sw: (await navigator.serviceWorker.getRegistrations()).length,
  cookie: document.cookie
}));
const fremd = anfragen.filter((u) => !u.startsWith(BASIS) && !u.startsWith("blob:") && !u.startsWith("data:"));
await browser.close();

const bericht = { drossel, ladezeit, ladeText, ergebnisse, auswertung, zugriffe, speicher, fremdeAnfragen: fremd, konsole };
fs.writeFileSync(path.join(ordner, `bericht-drossel${drossel}.json`), JSON.stringify(bericht, null, 1));
console.log("\n" + auswertung);
console.log("\nLadezeit:", ladezeit, "ms;", ladeText);
console.log("Speicherzugriffe der Seite (ohne Testvorbereitung):", JSON.stringify(zugriffe));
console.log("Speicher danach:", JSON.stringify(speicher));
console.log("Anfragen gesamt:", anfragen.length, "nach außen:", JSON.stringify(fremd));
console.log("Konsole:", konsole.length ? konsole.join("\n") : "keine Fehler/Warnungen");
