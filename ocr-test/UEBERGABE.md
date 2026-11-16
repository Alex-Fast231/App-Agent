# Übergabe OCR-Prototyp Muster 13

Stand 16.11.2026. Anweisung: `PAKET_OCR_PROTOTYP.md` (Chat), Feldauswahl nach Rückmeldung von Alex am selben Tag. Reiner Test-Prototyp, unabhängig vom Strato-Umzug.

## Adresse

`https://alex-fast231.github.io/App-Agent/ocr-test/` (vorausgesetzt, GitHub Pages ist für App-Agent eingeschaltet. Von der Code-Sitzung aus ließ sich das nicht prüfen.)

## Bedienung in fünf Sätzen

1. Prototyp öffnen und warten, bis oben „Erkennung bereit“ steht (einmalig etwa 19 MB).
2. „Kamera“ antippen, das Rezept flach und ganz ins Bild nehmen und „Auslösen“ drücken, oder mit „Bild wählen“ ein Foto aus der Galerie nehmen.
3. Prüfen, ob die vier blauen Punkte auf den Blattecken liegen, falls nötig hinziehen (bei einem Hochkant-Foto „Drehen“), dann „Auswerten“.
4. Bei jedem Feld „stimmt“ oder „falsch“ antippen, dann „Nächstes Rezept“.
5. Am Ende den Text unter „Auswertung dieser Sitzung“ kopieren (nur Zahlen, keine Patientendaten) und mit „Alles löschen“ oder Schließen alles verwerfen.

## Ausgelesene Felder

Nach Rückmeldung von Alex nur diese:

| Feld | Art | Prüfung |
| --- | --- | --- |
| Nachname, Vorname | Text | Buchstaben, „B“ zwischen Kleinbuchstaben → „ß“, Großschreibung am Anfang |
| Geburtsdatum | Text | gültiges Datum, Alter 0–115 Jahre |
| Ausstellungsdatum | Text | gültiges Datum, nicht in der Zukunft, nicht älter als ein Jahr |
| ICD-10-Code 1 und 2 | Text | Format, Abgleich mit der ICD-Liste der App, Lesefehler (O/0, I/1, S/5 …) |
| Heilmittel 1–3 und ergänzendes Heilmittel | Text | Zuordnung zu den Leistungen der App (KG, MT, KG-ZNS, KG-Atemtherapie, MLD30/45/60, Blanko), vorrangig für die Diagnosegruppe laut ICD |
| Behandlungseinheiten zu jedem Heilmittel | Text | Zahl, nicht über der Höchstmenge je VO der Diagnosegruppe laut ICD, Heilmittel ohne Einheiten → rot |
| Hausbesuch ja / nein | Ankreuzfeld | beide oder keins angekreuzt → gelb |
| Dringlicher Behandlungsbedarf (14 Tage) | Ankreuzfeld | – |

Weggelassen: Versichertennummer, Arzt-Nr., Betriebsstätten-Nr., Kasse, Diagnosegruppe als eigenes Feld (sie wird aus dem ICD-10-Code abgeleitet), Leitsymptomatik, Heilmittelbereich, Therapiebericht, Gebühr, Arztstempel, Unterschrift. Stempel und Unterschrift ließen sich als „vorhanden ja/nein“ erkennen, das wird laut Alex aber nicht gebraucht.

## Was gebaut ist

| Datei | Inhalt |
| --- | --- |
| `index.html`, `app.css`, `app.js` | Oberfläche: Kamera/Galerie, Ecken verschieben, Ergebnis mit Ampel, stimmt/falsch, Kalibriermodus, Auswertung, „Alles löschen“ |
| `ocr-worker.js` | Web Worker: Blatt finden, entzerren, Felder ausschneiden, Erkennung (onnxruntime-web, WASM) |
| `bild.js` | Bildverarbeitung ohne Bibliothek: Blattsuche, Entzerrung (Homographie), Ankreuzfelder, Zeilen trennen, roten Vordruck ausblenden, Schatten ausgleichen |
| `pruefung.js` | Plausibilität |
| `katalog.js` | Kopie aus App-Agent (`HEILMITTEL_KATALOG`, `PRAEFIX_REGELN`, `REZEPT_ITEM_OPTIONS`). Das Original ist unverändert. |
| `schablone-muster13.json` | Feldpositionen relativ zur Blattgröße |
| `werkzeuge/testbilder.py` | erzeugt erfundene Rezepte und „Fotos“ in 6 Varianten |
| `werkzeuge/test-lokal.mjs` | automatischer Test im Browser (Trefferquote, Dauer, Netz, Speicher, CSP) |
| `testbilder/` | 4 erfundene Beispielbilder plus erwartete Werte |

**Abweichung von der Anweisung:** Für das Finden und Entzerren des Blatts nutze ich kein OpenCV.js, das wären rund 10 MB mehr gewesen. Das erledigen etwa 300 Zeilen eigener Code. Die Blattsuche probiert Helligkeit und „Weiße“ (geringe Farbsättigung, hilft bei Schatten) und nimmt die größte viereckige Fläche. Auch ein Modell zur Textbereichserkennung ist nicht nötig.

## Datenschutz

- Nichts wird gespeichert: Der Prototyp selbst nutzt kein localStorage, keine sessionStorage, keine IndexedDB, keine Cookies, keinen Cache Storage und keinen Service Worker. Bild, Ausschnitte und Ergebnisse liegen nur in Variablen. „Alles löschen“ und Neuladen verwerfen sie.
- Nichts wird gesendet: Es gibt nur `fetch` auf die eigenen Dateien (Schablone, WASM, Modell, Wörterliste), mit `credentials: "omit"`. Kein CDN, keine Schrift, kein Tracking.
- Erkannter Text kommt nur über `textContent` und `dataset` auf die Seite. `innerHTML`, `eval` und `new Function` kommen im eigenen Code nicht vor.
- CSP per `<meta>` wörtlich wie in der Anweisung. **Begründung `'wasm-unsafe-eval'`:** onnxruntime-web führt das Modell in WebAssembly aus. Der Browser erlaubt das Kompilieren von WebAssembly nur mit dieser Angabe. Sie erlaubt kein JavaScript-`eval`. Inline-Styles gibt es nicht. Positionen setzt das Skript über `element.style`, das erlaubt die CSP.
- **Service Worker von App-Agent:** `App-Agent/sw.js` gilt für den ganzen Pfad `/App-Agent/`, also auch für `ocr-test/`. Auf einem Handy, auf dem die alte App schon einmal offen war, legt er die Programm- und Modelldateien des Prototyps in seinem Cache Storage ab. Fotos und Ergebnisse legt er nicht ab, die werden nie angefragt. Alex hat entschieden: Das ist in Ordnung, weil App-Agent nur noch auf seinem Handy läuft und die Diensthandys die Strato-App nutzen.
- Die Seite hat `noindex` und `no-referrer`.

## Ergebnisse des lokalen Tests

Testaufbau: 6 erfundene Rezepte (Fantasienamen, darunter Umlaute, ß und Doppelnamen) mit gültigen und absichtlich falschen Angaben: 12 Einheiten bei Höchstmenge 6, 31.02., eine Leistung, die nicht in der App vorkommt. Jedes Rezept als „Foto“ in 6 Varianten: gerade, schräg (perspektivisch), gedreht (6–10°), dunkel (Kunstlicht, Rauschen), Schatten quer übers Blatt, unscharf. 36 Bilder × 17 Felder = 612 Feldwerte. Test in Chromium (Handy-Bildschirmgröße) über `werkzeuge/test-lokal.mjs`, das „stimmt“/„falsch“ automatisch gegen die erwarteten Werte setzt.

**Trefferquote gesamt 99 % (605 von 612).** Je Variante 99 %, nur unscharf 98 %.

| Feld | Treffer | Fehlerursache |
| --- | --- | --- |
| Nachname | 29/36 (81 %) | großes „Ä“ wird als „A“ gelesen (Wöhrle-**Ä**gidius), einmal „ü“ als „ú“ |
| alle übrigen 16 Felder | 36/36 (100 %) | – |

**Ampel:** Absichtlich falsche Angaben werden gelb, z. B. Einheiten über der Höchstmenge, ungültiges Datum, Leistung nicht in der App-Liste. Korrekturen von Lesefehlern werden gelb mit „korrigiert (Lesefehler)“ angezeigt. 5 von 612 Werten waren falsch und trotzdem grün, alle beim Nachnamen (Ä).

**Dauer** (Desktop-Prozessor, ein Kern): Entzerren 0,1 s (max. 0,6 s), Erkennung 0,9 s (max. 1,5 s), gesamt 1,1 s (max. 1,6 s) je Rezept. Die CPU-Drosselung von Chrome wirkt nicht auf Web Worker, ein Handywert ließ sich deshalb hier nicht messen. Grobe Schätzung für ein Mittelklasse-Android: 3- bis 5-mal langsamer, also etwa 3–6 s, deutlich unter dem Ziel von 10 s. Den echten Wert zeigt die Auswertung auf dem Handy.

**Netz und Speicher:** 14 Anfragen, alle auf die eigenen Dateien, keine nach außen. Die Seite hat auf keine Speicher-API zugegriffen: Im Test wurde jeder Zugriff auf localStorage, sessionStorage, indexedDB, caches, Cookies und serviceWorker.register mitgeschrieben. Ergebnis: keiner. Vorher angelegte Einträge einer „alten App“ derselben Adresse waren danach unverändert. Konsole ohne Fehler, also auch ohne CSP-Meldungen.

**Wichtige Einschränkung:** Getestet wurde mit einem **nachgebauten** Formular und erzeugten „Fotos“, gedruckt in einer sauberen Druckerschrift, der Vordruck in Rot. Echte Rezepte und echte Handyfotos werden schlechter abschneiden. Die Zahlen oben sind eine Obergrenze, keine Zusage.

## Bibliotheken und Modelle

| Datei | Herkunft, Version | Lizenz | Größe |
| --- | --- | --- | --- |
| `lib/ort.wasm.min.mjs` | onnxruntime-web 1.22.0 (npm) | MIT | 48 KB |
| `lib/ort-wasm-simd-threaded.mjs` | onnxruntime-web 1.22.0 | MIT | 21 KB |
| `lib/ort-wasm-simd-threaded.wasm` | onnxruntime-web 1.22.0 | MIT | 11,2 MB |
| `models/latin_PP-OCRv3_rec_infer.onnx` | PaddleOCR PP-OCRv3, Erkennung „latin“ (inkl. ä ö ü ß), ONNX-Fassung aus npm `multilingual-purejs-ocr` 1.0.1 | Apache-2.0 (Modell), ISC (Paket) | 9,0 MB |
| `models/latin_dict.txt` | dazu, 185 Zeichen | wie oben | 1 KB |

Ladegröße insgesamt etwa 19,3 MB plus rund 60 KB eigener Code. Das Laden startet beim Öffnen des Prototyps, mit Fortschrittsbalken. Prüfsummen und Herkunft stehen in `PRUEFSUMMEN.txt`, Lizenztexte in `lib/` und `models/`. Das Modell stammt aus einem npm-Paket eines Dritten, weil die Quelle von PaddlePaddle von hier nicht erreichbar war.

## Frühere OCR-Versuche (Git-Historie App-Agent)

- Im Oktober 2026 hatte App-Agent eine Fotoerkennung mit **Tesseract.js** (`modules/ocr.js`, `vendor/tesseract/`): Kamerafoto, ein Tesseract-Durchlauf über das ganze Bild, danach Freitext-Suche (Datum/ICD per Regex, Namen über Groß-/Kleinschreibung, Heilmittel über Stichwörter).
- Ein Versuch mit 8 Feldausschnitten und Ausrichtungsrahmen machte die Erkennung laut Alex „viel schlechter“. Vermutliche Ursache: Bei schiefen Fotos schnitten die festen Ausschnitte den Text ab, weil das Bild **nicht entzerrt** wurde. Das wurde wieder zurückgebaut. Ein Fax/PDF-Upload kam auch kurz dazu und wurde wieder entfernt (Faxe oft verschoben und schlecht lesbar).
- Danach wurde die OCR auf Alex' Wunsch **komplett entfernt** (HANDOFF_SUMMARY „Aufgabe 1 – OCR/Kamera komplett entfernt“, Stand Commit `441f009`, 13.10.2026).
- Was hier anders ist: Das Blatt wird zuerst gefunden und entzerrt (Ecken verschiebbar), erst dann werden die Felder ausgeschnitten. Der rote Vordruck wird ausgeblendet. Statt Tesseract liest ein PaddleOCR-Modell. Dazu kommen Plausibilität und Ampel je Feld.

## Offene Fragen und Grenzen

1. **Schablone nicht am echten Muster 13 ausgemessen.** Hier lag kein echtes Formular vor. Die Positionen gehören zum Nachbau. Vor dem ersten echten Test ein (leeres oder geschwärztes) Muster 13 fotografieren, im Kalibriermodus die Rahmen anpassen („Feld wählen“, Pfeile in 0,5-mm-Schritten oder ziehen), „JSON ausgeben“, kopieren und in den Chat geben. Dann wird `schablone-muster13.json` ersetzt. Ohne Kalibrierung liegen die Rahmen auf einem echten Rezept vermutlich daneben.
2. **Handschrift:** Das Modell ist auf gedruckten Text trainiert. Handschriftliche Rezepte oder Nachträge werden schlecht bis gar nicht gelesen.
3. **„Ä“:** Großes „Ä“ wurde im Test immer als „A“ gelesen, die Ampel bleibt dabei grün. Namen also immer selbst ansehen.
4. **ICD-Liste der App:** Die Prüfung nutzt die Präfixliste aus App-Agent (erste drei Zeichen). Gültige Codes außerhalb dieser Liste werden gelb. Die Diagnosegruppe für Höchstmenge und „vorrangig“ kommt aus dem ersten ICD-10-Code, nicht vom Rezept.
5. **Blatt um 180° gedreht:** wird nicht erkannt. Dann mit „Drehen“ (zweimal) die Ecken weiterschalten.
6. **Dauer auf dem Handy** ist nur geschätzt (siehe oben).
7. **GitHub Pages:** Falls `…/App-Agent/ocr-test/` nicht erreichbar ist, ist Pages für App-Agent vermutlich ausgeschaltet (Repo-Einstellungen → Pages → Branch `main`).

## Was hat Alex zu tun

1. Prüfen, ob die Adresse auf dem Handy aufgeht.
2. Ein leeres oder geschwärztes Muster 13 fotografieren, kalibrieren und das JSON in den Chat geben (Punkt 1).
3. Danach echte Rezepte testen und den Auswertungstext in den Chat geben.
