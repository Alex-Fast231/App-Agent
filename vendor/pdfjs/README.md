# Vendored: PDF.js v4.10.38 (Apache-2.0)

Lokal eingebundene PDF-Rendering-Engine für die Funktion "Fax/PDF
hochladen" (Patient + Rezept anlegen). Quelle: https://github.com/mozilla/pdf.js
(npm-Paket `pdfjs-dist`).

Dateien:
- `pdf.min.mjs` – Haupt-API (im Hauptthread geladen, ES-Modul)
- `pdf.worker.min.mjs` – Web-Worker-Skript (führt das eigentliche PDF-Parsing aus)

Wird nur genutzt, wenn ein Therapeut tatsächlich eine PDF-Datei (z.B. ein
per Fax empfangenes Rezept) hochlädt, nicht bei jedem App-Start
nachgeladen. Die Datei wird ausschließlich lokal im Browser gerendert
und für die Texterkennung (Tesseract.js, siehe vendor/tesseract/)
verwendet - sie verlässt zu keinem Zeitpunkt das Gerät.
