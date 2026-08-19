# FaSt App – Handoff Summary
**Stand:** 2026-08-19 (Session-Ende, fünfte Session: Feldkoordinaten-Fix + Fax/PDF-Upload)
**Branch:** `claude/fast-app-8-features-xep6yr` (in `/workspace/app-test`, lokal, **40 Commits, weiterhin nicht auf GitHub gepusht**)

Diese Datei ersetzt die vorherige Version vom 2026-08-17 (vierte Session) vollständig.

---

## -1. Diese Session (fünfte): Fax/PDF-Upload als Alternative zur Kamera-Aufnahme

Nutzeranfrage: Therapeuten erhalten Rezepte teils digital (z.B. per Fax als PDF) statt auf Papier – ein direkter Datei-Upload sollte als Alternative zur Kamera-Aufnahme möglich sein, ohne die bestehende Muster-13-Feld-Erkennung zu duplizieren.

**Umgesetzt (Commit `1c65b80`):**
- **`vendor/pdfjs/` (neu):** PDF.js v4.10.38 (Apache-2.0) lokal vendort (analog zu `vendor/tesseract/`) – `pdf.min.mjs` (Haupt-API), `pdf.worker.min.mjs` (Parsing-Worker), `LICENSE.md`, `README.md`. Wird nur bei tatsächlicher PDF-Nutzung per dynamischem `import()` nachgeladen, kein Netzwerkzugriff nötig, Verarbeitung ausschließlich lokal im Browser.
- **`ui/views.js`:** Neuer Button "📠 Fax/PDF hochladen" neben der bestehenden Kamera-Option. Neue Ansicht `renderFileUpload()`: Datei auswählen (PDF oder Bild JPG/PNG), lokale Vorschau mit demselben Ausrichtungsrahmen wie die Kamera-Ansicht, "Text erkennen" nutzt exakt dieselbe Muster-13-Feld-für-Feld-OCR-Pipeline. Die bisher direkt im Kamera-Handler eingebettete OCR-Schleife wurde nach `runRoiOcrOnFormCanvas()` extrahiert und wird von Kamera- und Upload-Flow gemeinsam genutzt (keine Duplizierung).
- **`modules/ocrRegions.js`:** Bug behoben – `MUSTER13_GUIDE_ASPECT_RATIO` war als Höhe/Breite dokumentiert (Wert `0.8`), die CSS-Formel erwartete aber Breite/Höhe, wodurch der Ausrichtungsrahmen rechnerisch über den sichtbaren Bereich hinausragte (86/0.8 = 107,5%). Konstante auf Breite/Höhe umsemantisiert (Wert `1.15`, aus dem Referenzbild geschätzt) und zu einer einzigen `MUSTER13_GUIDE_REGION` zusammengefasst, die jetzt von Kamera- UND Upload-Vorschau identisch verwendet wird statt unabhängig (und damit potenziell abweichend) berechnet zu werden.

**Getestet:**
- `smoketest_fax_pdf_upload.mjs` (neu) – **8/8**. Besonderheit: Das PDF-Rendering selbst (pdf.js) benötigt kein Netzwerk und konnte damit – anders als der Tesseract-OCR-Schritt – **vollständig End-to-End verifiziert werden**, inkl. einer echten synthetischen Test-PDF (korrekte, nicht-triviale Canvas-Pixelmaße nach dem Rendern bestätigt).
- `smoketest_ocr_task3.mjs` (Kamera-Flow, erneut) – 7/7, Ausrichtungsrahmen jetzt korrekt innerhalb der Grenzen (Bestätigung des Bugfixes).
- `test_ocr_roi_aufgabe.mjs` (reine Logik) – weiterhin 53/53.
- Sechs Regressions-Suiten (Rezept, Optimierer, Freikuvert, Zeit, Patientenliste, Dashboard/Assessment) – alle ohne Fehler.
- `node --check` über alle Nicht-Vendor-`.js`-Dateien erfolgreich.

**Bekannte Einschränkung (unverändert vs. Kamera-Flow):** Der eigentliche Tesseract-Texterkennungsschritt selbst ist in dieser Sandbox nicht bis zum tatsächlichen Erkennungsergebnis testbar, da die Sprachdaten-CDN blockiert ist – nur die Fehlerbehandlung (Fallback auf manuelle Eingabe) wurde geprüft, wie schon beim Kamera-Flow. Das PDF-Rendering selbst ist davon nicht betroffen und wurde vollständig verifiziert.

**Cosmetischer Punkt (bewusst nicht weiter verfolgt):** Der Ausrichtungsrahmen wird per CSS-Prozentwerten über Video/Canvas gelegt; da `top/height` relativ zur gerenderten Container-Höhe und `left/width` relativ zur Container-Breite berechnet werden, entspricht die sichtbare Rahmenform nicht zwingend exakt dem echten Muster-13-Papierformat (abhängig vom Seitenverhältnis der Kamera bzw. des hochgeladenen Bilds/PDFs). Rein optisch – die Zuschneide-/Feld-Prozent-Logik arbeitet unabhängig davon konsistent auf dem tatsächlich markierten Bereich.

---

## 0. Nachtrag: Feldkoordinaten anhand echtem Muster-13-Referenzbild kalibriert

Nach der ursprünglichen Umsetzung (Abschnitt 1) hat der Nutzer ein offizielles Muster-13-Formular mit nummerierter Feldbeschriftung (Platzhalterdaten "Frau Herr Musterman", **keine echten Patientendaten**) als Referenzbild geschickt. **Wichtig:** Der Nutzer wurde ausdrücklich gebeten, **kein echtes Patientenrezept** zu schicken (Datenschutz/Art. 9 DSGVO) – dieses Referenzbild war dafür nicht nötig und ausreichend.

Anhand des Bildes wurden die Feldkoordinaten in `modules/ocrRegions.js` Zeile für Zeile neu abgeschätzt (u.a. Diagnosegruppe/Leitsymptomatik deutlich schmaler/weiter unten, ICD-10-Feld höher und für zwei Zeilen groß genug, Hausbesuch-Region auf den reinen "ja/nein"-Ankreuzbereich verengt, Seitenverhältnis des Kamera-Rahmens korrigiert – Muster 13 ist querformatiger als ursprünglich angenommen). Dabei außerdem ein echter, durch das Beispiel im Referenzbild aufgedeckter Fehler behoben: "Manuelle Lymphdrainage 30 Minuten" wurde bisher fälschlich als MLD60 statt MLD30 erkannt. Neue Unit-Tests mit den Beispielwerten aus dem Referenzbild – **53/53 Tests erfolgreich.** Commit: `596b186`.

Die Koordinaten sind dadurch deutlich verlässlicher als in der ursprünglichen Schätzung, aber weiterhin **nicht mit einem echten fotografierten Papier-Rezept verifiziert** (das Referenzbild war ein abfotografierter Bildschirm/eine Vorlage, kein per Handykamera schräg/mit Schatten fotografiertes Papierformular) – der echte Testlauf aus Abschnitt 3 bleibt der wichtigste nächste Schritt.

---

## 1. Diese Session: OCR Region-of-Interest-Optimierung für Muster 13

Der Nutzer gab ein detailliertes technisches Aufgabendokument vor: die Fotoerkennung (Tesseract.js) soll statt das gesamte Rezeptfoto zu scannen nur noch die relevanten Formularfelder einzeln erkennen (Region of Interest), mit vom Nutzer am echten Muster-13-Formular abgemessenen Feldpositionen. Umgesetzt und committet:

```
327b4fd OCR: Region-of-Interest-Scanning für GKV Muster 13 statt Gesamtbild-OCR
```

### Was umgesetzt wurde

- **`modules/ocrRegions.js` (neu):** `MUSTER13_FIELD_REGIONS` definiert alle 10 vom Nutzer genannten Felder als prozentuale Bildkoordinaten (Name, Geburtsdatum, Ausstellungsdatum, ICD-10, Diagnosegruppe, Leitsymptomatik, Heilmittel, Behandlungseinheiten, Hausbesuch, Dringlicher Bedarf) – Basis sind die vom Nutzer bereitgestellten, am echten Formular abgemessenen Werte, mit ca. 2 Prozentpunkten Sicherheitsrand je Seite erweitert.
- **`modules/ocr.js` (komplett umgebaut):** Statt einer Handvoll Heuristiken, die im gesamten erkannten Text nach Mustern suchten, gibt es jetzt pro Feld eine eigene, einfache Aufbereitungsfunktion (`parseNameField`, `parseDateField`, `parseIcd10Field`, `parseDiagnosengruppeField`, `parseLeitsymptomatikField`, `parseHeilmittelField`, `parseEinheitenField`), die nur noch den bereits isolierten Text ihres eigenen Feldausschnitts bereinigen muss.
- **`modules/ocrMarkDetection.js` (neu):** Für "Hausbesuch ja/nein" wird **nicht** Text-OCR verwendet, sondern eine einfache Kontrastanalyse (welche Bildhälfte der Ankreuzzeile enthält mehr dunkle Pixel/Tinte) – Text-OCR könnte "ja" und "nein" nicht unterscheiden, weil auf dem Formular beide Wörter unabhängig vom Ankreuzstatus gedruckt sind. Bewusst konservativ: nur bei deutlichem Kontrastunterschied wird ein Ergebnis geliefert, sonst bleibt das Feld leer (der Therapeut wählt manuell) – ein Fehlraten bei einem abrechnungsrelevanten Feld wäre riskanter als eine leere Vorgabe.
- **Kamera-Ausrichtungsrahmen:** Die Kamera-Vorschau zeigt jetzt einen gestrichelten Rahmen (Muster-13-Seitenverhältnis), an dem der Therapeut das Formular vor der Aufnahme ausrichten soll. Nach der Aufnahme wird das Foto auf diesen Rahmen zugeschnitten, danach werden die einzelnen Feldbereiche daraus zugeschnitten und je einzeln an Tesseract übergeben (ein Durchlauf pro Feld statt einem Gesamtbild-Durchlauf).
- **Neues Feld "Diagnosegruppe":** Wird als Hinweistext ("Erkannte Diagnosegruppe laut Formular: EX") neben dem ICD-10-Feld angezeigt – **kein** neues, dauerhaft gespeichertes Formularfeld, da die App diese Klassifikation (WS/EX/ZN/...) bereits im Rezeptoptimierer aus dem ICD-10-Code selbst ableitet (`HEILMITTEL_KATALOG` in `modules/rezeptoptimierung.js`) und ein zweites, redundantes gespeichertes Feld unnötige Doppelpflege bedeutet hätte.

### Bewusste Abweichungen vom Aufgabendokument (mit Begründung)

1. **Keine automatische Kantenerkennung/Entzerrung ("Normalisierung" von Größe/Rotation).** Das Aufgabendokument nannte dies als Schritt 2. Eine echte Dokumentenerkennung (Formularkanten im Foto finden, perspektivisch entzerren) erfordert entweder eine zusätzliche Bildverarbeitungs-Bibliothek (z.B. OpenCV.js, mehrere MB groß) oder einen selbst geschriebenen Algorithmus, der sich in dieser Umgebung mangels echter Testfotos nicht verifizieren lässt (die OCR-Sprachdaten-CDN ist in der Sandbox blockiert, siehe Punkt "Was noch aussteht"). Ungetesteter Bildverarbeitungscode hätte ein höheres Risiko dargestellt als der jetzt umgesetzte Ausrichtungsrahmen (Punkt oben), der denselben Zweck – das Foto möglichst nah an den erwarteten Prozentkoordinaten ausrichten – ohne Bildverarbeitungsrisiko erreicht.
2. **"Dringlicher Behandlungsbedarf" wird nicht automatisch erkannt** (im Gegensatz zu Hausbesuch). Anders als bei Hausbesuch (zwei Wortoptionen "ja"/"nein" nebeneinander, vergleichbar) ist dies ein einzelnes Ankreuzfeld ohne Vergleichspartner in derselben Zeile. Ohne die exakte Position des kleinen Ankreuzkästchens innerhalb der Zeile (die weder im Aufgabendokument spezifiziert noch in dieser Umgebung messbar war) lässt sich eine Markierung nicht zuverlässig vom gedruckten Feldtext selbst unterscheiden – das Feld bleibt wie bisher zur manuellen Auswahl.
3. **Feld-Koordinaten sind unverifiziert.** Sie basieren auf den vom Nutzer bereitgestellten Schätzwerten (leicht erweitert), konnten aber nicht gegen ein echtes Foto getestet werden (siehe unten). Sollten nach dem ersten echten Testlauf nachjustiert werden.

---

## 2. Testprotokoll dieser Session

| Test | Ergebnis | Hinweis |
|---|---|---|
| `test_ocr_roi_aufgabe.mjs` | **48/48** | **neu** – Unit-Tests (reine Logik, kein Browser) für alle Feld-Parser, die Regionen-Definitionen, `regionToPixelRect` und die Kontrastanalyse (inkl. synthetischer Testbilder für "eindeutig markiert"/"beide leer"/"minimale Differenz ignoriert") |
| `smoketest_ocr_task3.mjs` | 7/7 | erweitert um Prüfung des neuen Ausrichtungsrahmens; Wartezeiten an den neuen (längeren) OCR-Timeout angepasst |
| `smoketest_rezept_block3.mjs` | 10/10 | unverändert grün |
| `smoketest_freikuvert_block10.mjs` | 4/4 | unverändert grün |
| `smoketest_zeit_block6.mjs` | 4/4 | unverändert grün |
| `smoketest_optimierer_block4.mjs` | 6/6 | unverändert grün |
| `smoketest_patientenliste_aufgabe2.mjs` | 4/4 | unverändert grün |
| `smoketest_verstorben_aufgabe4.mjs` | 4/4 | unverändert grün |
| `smoketest_dashboard_assessment.mjs` | 13/13 | unverändert grün |
| `smoketest_therapiebericht_block12.mjs` | 6/6 | unverändert grün |

`node --check` erfolgreich für alle .js-Dateien im Repo. Ein während der Implementierung selbst gefundener und behobener Fehler: die ursprüngliche Version hat einzelne Feld-OCR-Fehler zu großzügig abgefangen, wodurch ein grundsätzlicher Ausfall der Erkennungs-Engine (z.B. keine Internetverbindung für die Sprachdaten) 8x wiederholt statt sofort als Fehler gemeldet wurde – das führte dazu, dass am Ende ein leeres statt eines Fehler-Formulars angezeigt worden wäre. Behoben: nur das erste Feld darf einen Engine-Fehler ungefangen nach oben durchreichen, alle Folgefelder werden weiterhin einzeln gnädig abgefangen.

Alle Testskripte liegen unter `/tmp/claude-0/-home-user/a9e9d6a0-2415-56f0-be21-0759b91d7c6a/scratchpad/`.

---

## 3. Was noch aussteht

1. **GitHub-Push weiterhin blockiert (403).** Unverändert. Alle 40 Commits liegen lokal bereit. Diese Session wieder die **komplette App** als ZIP bereitgestellt (nicht nur Änderungen), wie vom Nutzer als Standardvorgehen verlangt.

2. **Echter Testlauf mit fotografiertem/hochgeladenem Muster-13-Formular fehlt weiterhin.** Die OCR-Sprachdaten-CDN ist in dieser Sandbox-Umgebung blockiert (`net::ERR_TUNNEL_CONNECTION_FAILED`/`Failed to fetch`), daher konnte die ROI-Erkennung – sowohl per Kamera als auch per neuem Datei-Upload – nur bis zur erwarteten Fehlermeldung getestet werden, nicht mit echtem, erkanntem Text (das PDF-Rendering selbst wurde davon unabhängig vollständig verifiziert, siehe Abschnitt -1). **Wichtigster nächster Schritt für den Nutzer:** ein echtes Muster-13-Rezept mit der App fotografieren UND/ODER als PDF hochladen und prüfen, ob (a) der Ausrichtungsrahmen intuitiv nutzbar ist, (b) die einzelnen Felder plausible Werte liefern, (c) die Feldkoordinaten in `modules/ocrRegions.js` nachjustiert werden müssen (z.B. wenn ein Feld systematisch leer bleibt oder falschen Text erwischt).

3. **Offene Punkte aus früheren Sessions** (unverändert, siehe deren Handoff-Versionen im Git-Verlauf):
   - `AUTO_EXPORT_INTERVAL_DAYS` steht weiterhin auf `1` (täglich, zum Testen) – nach erfolgreichem Testbetrieb auf `28` zurücksetzen.
   - `AUTO_EXPORT_TEST_PASSWORD` weiterhin eine Übergangslösung bis zum geplanten Viewer.
   - 3 offene Code-Lücken (`updateHomeAddress`, `deleteDiagnoseZuordnung`, `createRezeptTimeEntry` – Funktionen ohne UI-Anbindung).
   - DSGVO-Löschkonzept/Aufbewahrungsfristen und AVV-Prüfung mit EmailJS weiterhin organisatorisch/rechtlich zu klären.
   - "FaSt-Button"-Thema aus einer früheren Aufgabe wurde auf Nutzerwunsch übersprungen.

4. **Viewer-Session (separates Projekt).** Laut Nutzer folgt nach erfolgreichem Test des täglichen Exports eine separate Session für den lokalen PC-Viewer.

---

## 4. Wichtige Dateien (Übersicht für den schnellen Wiedereinstieg)

Repo: `/workspace/app-test` (GitHub: `alex-fast231/app-test`, Branch `claude/fast-app-8-features-xep6yr`)

| Datei | Zweck |
|---|---|
| `data/schema.js` | `APP_VERSION` (aktuell 3.9.17, automatischer Bump bei jedem Commit) |
| `modules/ocrRegions.js` | `MUSTER13_FIELD_REGIONS` (prozentuale Feldkoordinaten), `regionToPixelRect()`, `MUSTER13_GUIDE_ASPECT_RATIO`, **neu** `MUSTER13_GUIDE_REGION` (gemeinsame Rahmen-Position/-Größe für Kamera + Upload) |
| `modules/ocr.js` | Feldbasierte Parser statt Gesamtblock-Heuristiken (siehe Abschnitt 1); Lymphdrainage-Dauer-Erkennung (MLD30/45/60) korrigiert |
| `modules/ocrMarkDetection.js` | Kontrastanalyse für Hausbesuch-ja/nein-Erkennung |
| `vendor/pdfjs/` | **Neu** – PDF.js v4.10.38 vendort, für Fax/PDF-Upload |
| `ui/views.js` | Kamera-Erfassung (`renderCameraCapture`) und **neu** Datei-Upload (`renderFileUpload`) teilen sich `runRoiOcrOnFormCanvas()` (gemeinsame OCR-Pipeline) und `guideOverlayStyle()` (gemeinsamer Ausrichtungsrahmen); `renderCombinedForm` zeigt Diagnosegruppen-Hinweis und übernimmt erkanntes Hausbesuch-Ja/Nein |
| `.githooks/pre-commit` + `scripts/bump-version.js` | Automatischer Versions-Bump. Einmalige Einrichtung pro Klon: `git config core.hooksPath .githooks` |
| `viewer/index.html` | Eigenständiger Offline-Viewer (wird in separater Session weitergebaut) |

Zweites Repo `verordnungschecker-entwicklung`: unverändert.

---

## 5. Empfohlener nächster Schritt für die neue Session

1. GitHub-Push-Berechtigung klären, dann alle Commits pushen oder die bereitgestellte komplette-App-ZIP manuell einspielen lassen.
2. **Vom Nutzer: echten Testlauf mit fotografiertem UND/ODER hochgeladenem Muster-13-Rezept durchführen** und Rückmeldung zu Erkennungsqualität/Feldkoordinaten einholen (siehe Abschnitt 3, Punkt 2) – das ist der wichtigste offene Punkt dieser Session.
3. Bei Bedarf: Feldkoordinaten in `modules/ocrRegions.js` anhand der Rückmeldung nachjustieren.
4. Mit dem Nutzer die übrigen offenen Punkte aus Abschnitt 3 durchgehen.
5. Warten auf die separate Viewer-Session.
