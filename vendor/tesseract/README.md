# Vendored: Tesseract.js v5.1.1 (Apache-2.0)

Lokal eingebundene OCR-Engine für Funktion "Rezept abfotografieren"
(Patient + Rezept anlegen). Quelle: https://github.com/naptha/tesseract.js

Dateien:
- `tesseract.min.js` – Haupt-API (im Hauptthread geladen)
- `worker.min.js` – Web-Worker-Skript (führt die eigentliche Erkennung aus)
- `tesseract-core-simd-lstm.wasm` / `.wasm.js` – WASM-Engine (LSTM-only,
  SIMD-optimiert – kleinere/schnellere Variante ohne den älteren
  Legacy-Erkennungsmodus, für gedruckten/maschinenlesbaren Text
  ausreichend)

Die deutschen Sprachdaten (`deu.traineddata`, mehrere MB) werden bewusst
NICHT vendored, sondern beim ersten Gebrauch von Tesseract.js selbst aus
dessen Standard-CDN geladen und vom Browser gecacht. Das Foto selbst
verlässt dabei zu keinem Zeitpunkt das Gerät – nur die (nicht
personenbezogene) Erkennungssoftware wird nachgeladen.
