# FaSt App – Handoff Summary
**Stand:** 2026-08-20 (Session-Ende, fünfte Session, inkl. zweier Nutzer-Feedback-Runden: Fax/PDF-Upload entfernt, tägliches Viewer-Backup, OCR-ROI-Rückbau)
**Branch:** `claude/fast-app-8-features-xep6yr` (in `/workspace/app-test`, lokal, **43 Commits, weiterhin nicht auf GitHub gepusht**)

Diese Datei ersetzt die vorherige Version vom 2026-08-17 (vierte Session) vollständig.

---

## 0b. Zweites Nutzer-Feedback: OCR Region-of-Interest zurückgebaut, wieder Gesamtbild-Scan (Commit `b76e73f`)

Rückmeldung: "seit du bei der Bilderkennung die 8 Felder eingeführt hast und das Format in der Kamera ist die OCR viel schlechter. Mach es wieder auf den ursprünglichen Zustand." Die in Abschnitt 1 (unten) beschriebene Region-of-Interest-Umstellung (Kamera-Ausrichtungsrahmen + 8 einzeln zugeschnittene Formularfelder statt einem Gesamtbild-Scan) hat sich in der Praxis also verschlechternd auf die Erkennungsqualität ausgewirkt, vermutlich weil ein leicht schief/nicht exakt im Rahmen liegendes Foto bei der ROI-Methode dazu führt, dass einzelne Feld-Crops den Text abschneiden oder verfehlen - während der alte Gesamtbild-Scan mit Freitext-Suche über das ganze erkannte Bild toleranter gegenüber Ausrichtungsungenauigkeiten war.

**Zurückgebaut auf den Stand vor Commit `327b4fd`:**
- `modules/ocr.js` auf die Vorversion zurückgesetzt: `parseRezeptOcrText(rawText)` durchsucht wieder den gesamten von Tesseract erkannten Text mit Freitext-Heuristiken (Datums-/ICD-10-Regex über den ganzen Text, Zeilensuche nach "Leitsymptomatik", grobe Namenserkennung über Groß-/Kleinschreibungs-Muster, Heilmittel-Schlüsselwörter). Der in Abschnitt 0 (Nachtrag) dokumentierte Lymphdrainage-Dauer-Bugfix (bare "Lymphdrainage" fälschlich immer als MLD60 statt der tatsächlich genannten Dauer) wurde dabei bewusst NICHT mit zurückgesetzt, sondern in die zurückgebaute `extractHeilmittel()`-Funktion erneut eingebaut.
- `modules/ocrRegions.js` und `modules/ocrMarkDetection.js` (beide nur für die ROI-Erkennung gebraucht) komplett entfernt.
- `ui/views.js`: `showCreatePatientRezeptView` auf die Vorversion zurückgesetzt - keine Ausrichtungsrahmen-Overlay mehr in der Kamera-Vorschau, kein Zuschneiden pro Formularfeld, wieder EIN Tesseract-Durchlauf über das komplette Foto (Timeout 30s statt 45s). Hausbesuch-Auswahl und der "Erkannte Diagnosegruppe"-Hinweis sind wieder rein manuell, da beide an der jetzt entfernten Feld-Erkennung hingen.

Bestätigt per `git log -- ui/views.js` zwischen den relevanten Commits: seit der letzten Vor-ROI-Version wurde in `ui/views.js` ausschließlich der OCR/Kamera-Bereich verändert (327b4fd, das inzwischen wieder entfernte 1c65b80 Fax/PDF-Upload, sowie 9aa879a) - alle anderen seither hinzugekommenen Funktionen (Freikuvert, Zeiterfassung, Assessments, tägliches Viewer-Backup, ...) sind von diesem Rückbau nicht betroffen.

**Getestet:** Kamera-Flow (`smoketest_ocr_task3.mjs`, um die entfernte Ausrichtungsrahmen-Prüfung bereinigt) weiterhin 6/6. Alle sechs Regressions-Suiten (Rezept, Optimierer, Freikuvert, Zeit, Patientenliste, Dashboard/Assessment) unverändert grün. Der neue Viewer-Autoexport-Test (`smoketest_viewer_autoexport.mjs`) weiterhin 10/10 (unabhängig von der OCR-Änderung, da er nur auf `runtimeData` zugreift, nicht auf OCR-Interna). Freitext-Parsing manuell mit Beispieltext direkt in Node verifiziert, inkl. korrektem `MLD30` statt `MLD60` bei "Manuelle Lymphdrainage 30 Minuten".

**Ausstehend:** Vom Nutzer zu bestätigen, dass die Erkennungsqualität mit dem Gesamtbild-Scan tatsächlich wieder besser ist als mit der ROI-Methode - das war der eigentliche Auslöser dieses Rückbaus.

---

## 0. Nutzer-Feedback nach Abschnitt -1: Fax/PDF-Upload entfernt, tägliches PIN-geschütztes Viewer-Backup (Commit `9aa879a`)

Nachdem der Nutzer die App getestet hat, kam folgende Rückmeldung: (1) der frisch gebaute Fax/PDF-Upload (Abschnitt -1) soll wieder raus, da empfangene Faxe in der Praxis oft verschoben/schlecht leserlich sind und der Upload dadurch keinen echten Mehrwert bringt; (2) es fehlt noch das tägliche automatische Backup für den separaten Offline-Viewer, das im Hintergrund per E-Mail an physio_fast@gmx.de gehen soll, mit einer JSON-Datei mit allen App-Daten, als ZIP verpackt und mit der PIN **1550** entsperrbar.

**1. Fax/PDF-Upload entfernt:** `📠 Fax/PDF hochladen`-Button, `renderFileUpload()`, `loadPdfJsScript()`, `renderPdfFileToCanvas()`, `renderImageFileToCanvas()` aus `ui/views.js` entfernt, `vendor/pdfjs/` komplett gelöscht. Die Kamera-Aufnahme (`renderCameraCapture`) ist unverändert die einzige Fotoerkennung. `runRoiOcrOnFormCanvas()` und `guideOverlayStyle()` (DRY-Refaktorierungen aus Abschnitt -1) blieben erhalten, da sie weiterhin vom Kamera-Flow genutzt werden - keine Duplizierung musste rückgängig gemacht werden.

**2. Tägliches Viewer-Backup umgebaut** (`modules/autoExport.js`, bereits als Grundgerüst seit Aufgabe 2/Funktion 8 vorhanden, jetzt an die neue Anforderung angepasst):
- Ziel-E-Mail fest auf `physio_fast@gmx.de` (Konstante `AUTO_EXPORT_TARGET_EMAIL`) - bewusst getrennt von der "Büro-E-Mail-Adresse" in den Einstellungen, die weiterhin unverändert nur für Freikuvert-Bestellungen an eine andere Stelle genutzt wird.
- Die versendete ZIP enthält jetzt **eine** Datei, `appData.json`, mit dem vollständigen, unverschlüsselten JSON-Stand aller App-Daten (`finalizeAppStructure(runtimeData)`) - statt wie zuvor `appData.enc`/`cryptoMeta.json`, die zusätzlich zum ZIP-Passwort noch das echte Praxispasswort zum Entschlüsseln benötigt hätten.
- Die ZIP ist mit der PIN **1550** (Konstante `AUTO_EXPORT_ZIP_PIN`) entsperrbar, über die eingebaute Passwortverschlüsselung von zip.js.
- Läuft weiterhin täglich (`AUTO_EXPORT_INTERVAL_DAYS = 1`) und ohne Rückfrage im Hintergrund direkt nach jedem Entsperren der App, wenn seit dem letzten Versand mindestens ein Tag vergangen ist.
- **`viewer/index.html`** entsprechend angepasst: fragt jetzt eine PIN statt des Praxispassworts ab und liest `appData.json` direkt (kein AES-GCM/PBKDF2-Unwrap mehr nötig für diesen Export-Typ - der komplette Krypto-Abschnitt des Viewers entfiel dadurch ersatzlos).
- Das manuelle "Backup exportieren/importieren" in den Einstellungen (`modules/backup.js`, weiterhin mit dem echten Praxispasswort, für die Wiederherstellung in der App selbst) ist davon **nicht** betroffen und bleibt unverändert.

**Sicherheitshinweis (dem Nutzer mitgeteilt, bewusste Nutzerentscheidung):** Eine 4-stellige ZIP-PIN ist deutlich schwächer als ein richtiges Passwort und bei abgefangener E-Mail in vertretbarer Zeit per Brute-Force angreifbar. Das ist eine bewusste Abwägung zwischen einfacher Bedienbarkeit im Viewer und Schutzstärke, die der Nutzer explizit so gewünscht hat.

**Getestet:** Fax/PDF-Entfernung mit den bestehenden Regressionstests bestätigt (Kamera-Flow weiterhin 7/7, sowie Rezept/Optimierer/Freikuvert/Zeit/Patientenliste/Dashboard je unverändert grün). Neuer Playwright-Test `smoketest_viewer_autoexport.mjs` (**10/10**) verifiziert das Viewer-Backup vollständig lokal (der EmailJS-Request wird per `page.route` abgefangen statt tatsächlich versendet, dadurch keine Abhängigkeit vom in dieser Sandbox blockierten Netzwerk): Ziel-E-Mail korrekt, ZIP enthält ausschließlich `appData.json`, falsche PIN schlägt beim Entpacken fehl, korrekte PIN liefert lesbares JSON mit allen App-Daten - inkl. eines zwischen zwei simulierten Tagen (Playwright-Uhr-Fast-Forward über die Tagesgrenze) angelegten Heims, um zu bestätigen, dass der zweite tägliche Export tatsächlich die neuen Daten enthält.

---

## -1. Vorherige Session-Runde (inzwischen wieder entfernt): Fax/PDF-Upload als Alternative zur Kamera-Aufnahme

**Hinweis:** Diese Funktion wurde in Abschnitt 0 oben auf Nutzerwunsch wieder entfernt. Dieser Abschnitt bleibt nur als historische Dokumentation stehen.

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

## 1. Frühere Session-Runde (inzwischen per Abschnitt 0b wieder zurückgebaut): OCR Region-of-Interest-Optimierung für Muster 13

**Hinweis:** Diese Region-of-Interest-Umstellung wurde in Abschnitt 0b oben auf Nutzerwunsch wieder komplett zurückgebaut, da sie die Erkennungsqualität in der Praxis verschlechtert hat. Dieser Abschnitt (und die Abschnitte 0/Nachtrag oben, die auf dieser ROI-Version aufbauten) bleiben nur als historische Dokumentation stehen - `modules/ocrRegions.js`/`modules/ocrMarkDetection.js` existieren nicht mehr, `modules/ocr.js` und der Kamera-Flow in `ui/views.js` sind wieder auf Gesamtbild-Scan.

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

1. **GitHub-Push weiterhin blockiert (403).** Unverändert. Alle 43 Commits liegen lokal bereit. Diese Session wieder die **komplette App** als ZIP bereitgestellt (nicht nur Änderungen), wie vom Nutzer als Standardvorgehen verlangt.

2. **Echter Testlauf mit fotografiertem Muster-13-Formular fehlt weiterhin, jetzt mit dem zurückgebauten Gesamtbild-Scan (siehe Abschnitt 0b).** Die OCR-Sprachdaten-CDN ist in dieser Sandbox-Umgebung blockiert (`net::ERR_TUNNEL_CONNECTION_FAILED`/`Failed to fetch`), daher konnte die Erkennung per Kamera nur bis zur erwarteten Fehlermeldung getestet werden, nicht mit echtem, erkanntem Text. **Wichtigster nächster Schritt für den Nutzer:** ein echtes Muster-13-Rezept fotografieren und prüfen, ob die Erkennungsqualität mit dem Gesamtbild-Scan tatsächlich besser ist als mit der zuvor genutzten Feld-für-Feld-Erkennung (das war der Auslöser für den Rückbau in Abschnitt 0b).

3. **Tägliches Viewer-Backup: erste echte Zustellung noch nicht vom Nutzer bestätigt.** Der EmailJS-Versand konnte in dieser Sandbox nur durch Abfangen des Requests verifiziert werden (siehe Abschnitt 0), nicht durch eine tatsächlich zugestellte E-Mail. **Nächster Schritt für den Nutzer:** nach dem nächsten Entsperren der App (oder nach Ablauf eines Tages seit dem letzten Export) prüfen, ob eine E-Mail mit ZIP-Anhang bei physio_fast@gmx.de ankommt, und ob sich die ZIP mit der PIN 1550 im Viewer öffnen lässt.

4. **Offene Punkte aus früheren Sessions** (unverändert, siehe deren Handoff-Versionen im Git-Verlauf):
   - 3 offene Code-Lücken (`updateHomeAddress`, `deleteDiagnoseZuordnung`, `createRezeptTimeEntry` – Funktionen ohne UI-Anbindung).
   - DSGVO-Löschkonzept/Aufbewahrungsfristen und AVV-Prüfung mit EmailJS weiterhin organisatorisch/rechtlich zu klären. Zusätzlich neu zu beachten: das tägliche Viewer-Backup verschickt jetzt unverschlüsselte Gesundheitsdaten (nur per 4-stelliger ZIP-PIN geschützt) per E-Mail – eine bewusste Nutzerentscheidung (siehe Abschnitt 0), aber ggf. bei der DSGVO-Prüfung zu berücksichtigen.
   - "FaSt-Button"-Thema aus einer früheren Aufgabe wurde auf Nutzerwunsch übersprungen.

5. **Viewer-Session (separates Projekt).** Laut Nutzer folgt nach erfolgreichem Test des täglichen Exports eine separate Session für den lokalen PC-Viewer. Der Viewer (`viewer/index.html`) liest das neue PIN-Format bereits, eine weitergehende Überarbeitung der Viewer-Oberfläche selbst steht laut Nutzer noch aus.

---

## 4. Wichtige Dateien (Übersicht für den schnellen Wiedereinstieg)

Repo: `/workspace/app-test` (GitHub: `alex-fast231/app-test`, Branch `claude/fast-app-8-features-xep6yr`)

| Datei | Zweck |
|---|---|
| `data/schema.js` | `APP_VERSION` (aktuell 3.9.21, automatischer Bump bei jedem Commit) |
| `modules/ocr.js` | **Zurückgebaut (Abschnitt 0b)** – wieder Freitext-Parsing (`parseRezeptOcrText`) über den gesamten erkannten Text statt Feld-für-Feld-Crops; Lymphdrainage-Dauer-Erkennung (MLD30/45/60) weiterhin korrekt |
| `modules/ocrRegions.js`, `modules/ocrMarkDetection.js` | **Entfernt (Abschnitt 0b)** – nur für die inzwischen zurückgebaute ROI-Erkennung gebraucht |
| `modules/autoExport.js` | **Umgebaut (Abschnitt 0)** – tägliches PIN-geschütztes (`1550`) Viewer-Backup (`appData.json` in ZIP) an feste Adresse `physio_fast@gmx.de`, statt des früheren doppelt-verschlüsselten Formats |
| `modules/backup.js` | Unverändert – manuelles "Backup exportieren/importieren" in den Einstellungen, weiterhin mit dem echten Praxispasswort |
| `ui/views.js` | `showCreatePatientRezeptView`/`renderCameraCapture` **zurückgebaut (Abschnitt 0b)** auf einen einzelnen Tesseract-Durchlauf über das ganze Foto, ohne Ausrichtungsrahmen. Der Fax/PDF-Upload aus Abschnitt -1 wurde bereits in Abschnitt 0 entfernt. |
| `.githooks/pre-commit` + `scripts/bump-version.js` | Automatischer Versions-Bump. Einmalige Einrichtung pro Klon: `git config core.hooksPath .githooks` |
| `viewer/index.html` | **Umgebaut (Abschnitt 0)** – eigenständiger Offline-Viewer, liest jetzt PIN-geschützte `appData.json` statt praxispasswort-verschlüsselter Daten; UI/Feature-Umfang selbst unverändert (wird laut Nutzer in separater Session weitergebaut) |

Zweites Repo `verordnungschecker-entwicklung`: unverändert.

---

## 5. Empfohlener nächster Schritt für die neue Session

1. GitHub-Push-Berechtigung klären, dann alle Commits pushen oder die bereitgestellte komplette-App-ZIP manuell einspielen lassen.
2. **Vom Nutzer: Rückmeldung einholen, ob der zurückgebaute Gesamtbild-Scan (Abschnitt 0b) tatsächlich besser erkennt als die vorherige Feld-für-Feld-Erkennung** (Kamera-Aufnahme, echtes Muster-13-Rezept, siehe Abschnitt 3, Punkt 2).
3. **Vom Nutzer: bestätigen lassen, dass die tägliche Viewer-Backup-E-Mail bei physio_fast@gmx.de ankommt** und sich mit der PIN 1550 öffnen lässt (siehe Abschnitt 3, Punkt 3) – erste echte Zustellung außerhalb der Sandbox noch nicht bestätigt.
4. Mit dem Nutzer die übrigen offenen Punkte aus Abschnitt 3 durchgehen.
5. Warten auf die separate Viewer-Session (Weiterbau der Viewer-Oberfläche selbst).
