# FaSti – Liste aller Chat-Befehle

Stand: November 2026, nach dem FaSti-Stichwörter-Abgleich mit `support-suchbegriffe-physio.json`
(siehe Abschlussbericht der Support-Seiten-Umstellung).

Diese Liste entspricht genau dem tatsächlichen Code in `modules/fasti.js` – sie ist die
Grundlage für den gedruckten FaSti-Spickzettel.

**Zwei Arten von Antworten:**
- **Auskunft** – FaSti beantwortet die Frage sofort, es wird nichts in den Daten geändert.
- **Änderung** – FaSti schlägt die Änderung vor und wartet auf eine Bestätigung ("Ja"/"Nein"
  bzw. einen Bestätigen-Button), bevor tatsächlich etwas gespeichert wird.

Reines Tippen eines Stichworts reicht bei den Auskunft-Themen (Assessment, Rezept, Stunden,
Urlaub, Krank, Zuzahlung, Fristen, Nachbestellung, Kilometer) – wird kein Befehl weiter unten
erkannt, aber eines dieser Stichwörter gefunden, gibt FaSti die passende Übersicht aus. Wird
gar nichts erkannt, zeigt FaSti eine Hilfe-Übersicht der unterstützten Themen.

Daneben prüft FaSti nach jedem Entsperren automatisch im Hintergrund fünf Bereiche (Rezepte,
Zeiterfassung/Saldo, Assessments, Fristen/Nachbestellung, Zuzahlung) und zeigt dazu von sich
aus Hinweiskarten mit Aktions-Buttons an – das sind keine Chat-Befehle zum Eintippen und daher
nicht Teil dieser Liste.

---

## Doku

| | |
|---|---|
| **Beispielsatz** | „Schreibe Doku für Herrn Müller: heute Kniemobilisation durchgeführt" |
| **Stichwörter** | schreibe doku, schreib doku, dokumentiere, trag doku ein, trage doku ein, doku eintragen, in die doku, notiere in der doku, doku schreiben, behandlung eintragen |
| **Art** | **Änderung** – FaSti fragt vor dem Speichern nach Bestätigung und bietet danach optional an, auch gleich die passende Zeit zu buchen. |

| | |
|---|---|
| **Beispielsatz** | „Zeig Doku" |
| **Stichwörter** | zeig doku, öffne doku, doku anzeigen, zeig die doku, dokuliste, doku-liste, schnelldoku |
| **Art** | Auskunft (Navigation) – öffnet nur die Doku-Patientenliste. |

## Zeit

| | |
|---|---|
| **Beispielsatz** | „Trage 40 Minuten für Klara Beispiel ein" |
| **Stichwörter** | zeit eintragen, zeit buchen, buche zeit, trage zeit, minuten eintragen, zeiterfassung für, zeiterfassung bei – sowie jede Formulierung mit „Minuten"/„Min" zusammen mit einem „trag…"/„buch…"-Wortstamm (z. B. „Trage 20 Min für … ein", „Buche 40 Minuten bei …") |
| **Art** | **Änderung** – FaSti fragt vor dem Buchen nach Bestätigung. Ohne Minutenangabe wird die automatisch erkannte Minutenzahl des Rezepts vorgeschlagen (sonst 20 Min.). |

## Stunden

| | |
|---|---|
| **Beispielsatz** | „Wie viele Stunden habe ich diesen Monat gearbeitet?" |
| **Stichwörter** | stunden, saldo, konto, gearbeitet |
| **Art** | Auskunft – nennt Ist-Zeit, Soll-Zeit und Saldo für den erkannten Zeitraum (versteht u. a. „heute", „gestern", „diese Woche", „letzte Woche", „diesen Monat", „letzten Monat", „seit TT.MM.JJJJ", „seit Juli"). |

| | |
|---|---|
| **Beispielsatz** | „Zeig Stundenkonto" |
| **Stichwörter** | zeig stundenkonto, öffne stundenkonto, stundenkonto anzeigen, stundenübersicht öffnen |
| **Art** | Auskunft (Navigation) – öffnet die Stundenkonto-Ansicht. |

## Rezept

| | |
|---|---|
| **Beispielsatz** | „Welche Rezepte hat Herr Schmidt?" |
| **Stichwörter** | rezept, verordnung, behandlung |
| **Art** | Auskunft – mit Patientenname: Liste seiner Rezepte mit verbleibenden Behandlungen. Ohne Patientenname: Übersicht aller knapp werdenden Rezepte. |

| | |
|---|---|
| **Beispielsatz** | „Neues Rezept für Frau Wagner anlegen" |
| **Stichwörter** | neues rezept für, neues rezept anlegen, rezept anlegen für, leg rezept an, lege rezept an, neue verordnung für |
| **Art** | Auskunft (Navigation) – öffnet das Rezept-Anlegen-Formular für den erkannten Patienten, FaSti trägt selbst nichts ein. |

| | |
|---|---|
| **Beispielsatz** | „Optimiere Rezept für Frau Wagner" |
| **Stichwörter** | optimiere rezept, optimier rezept, rezept optimieren, rezeptoptimierung, rezeptoptimierer |
| **Art** | Auskunft (Navigation) – öffnet den Rezeptoptimierer für den erkannten Patienten. |

| | |
|---|---|
| **Beispielsatz** | „Arztbericht für Frau Wagner" |
| **Stichwörter** | arztbericht für, therapiebericht für, öffne arztbericht, schreib arztbericht, schreibe arztbericht, arztbericht schreiben |
| **Art** | Auskunft (Navigation) – öffnet den Arztbericht des erkannten Patienten. |

## Assessment

| | |
|---|---|
| **Beispielsatz** | „Wann ist das nächste Assessment von Frau Müller?" |
| **Stichwörter** | assessment, befund, testung, bbs, sturzrisiko, gleichgewicht |
| **Art** | Auskunft – mit Patientenname: dessen nächstes Fälligkeitsdatum. Ohne Patientenname: Liste aller aktuell fälligen Assessments. |

| | |
|---|---|
| **Beispielsatz** | „Starte Assessment" |
| **Stichwörter** | starte assessment, assessment starten, assessment durchführen, mach assessment, beginne assessment, assessment beginnen |
| **Art** | Auskunft (Navigation) – öffnet den Assessment-Einstieg für den erkannten Patienten. |

## Zuzahlung

| | |
|---|---|
| **Beispielsatz** | „Ist Frau Müller befreit?" |
| **Stichwörter** | zuzahlung, befreit, befreiung |
| **Art** | Auskunft – Frageform („Ist … befreit?", „wer ist nicht befreit") liefert nur den Status bzw. eine Liste. |

| | |
|---|---|
| **Beispielsatz** | „Frau Müller ist befreit" |
| **Stichwörter** | dieselben wie oben, aber als Aussage statt Frage (kein „Ist …?"/„Sind …?", kein Fragezeichen) |
| **Art** | **Änderung** – FaSti erkennt „befreit" / „nicht befreit" / „ungeklärt" als gewünschten neuen Status und fragt vor dem Setzen nach Bestätigung. |

## Nachbestellung

| | |
|---|---|
| **Beispielsatz** | „Nachbestellung für Dr. Schmidt" |
| **Stichwörter** | nachbestell…, bestell…, fax |
| **Art** | Auskunft – mit Arztname: fällige Rezepte dieses Arztes (fragt bei nötiger Optimierungsprüfung ggf. zuerst nach, siehe unten). Ohne Arztname: Übersicht fälliger Rezepte je Arzt. |

| | |
|---|---|
| **Beispielsatz** | „Zeig Nachbestellung" / „Folgerezept für Dr. Schmidt" |
| **Stichwörter** | zeig nachbestellung, öffne nachbestellung, nachbestellungsübersicht, nachbestellung anzeigen, zeig die nachbestellliste, folgerezept, folgeverordnung |
| **Art** | Auskunft (Navigation) – öffnet die Nachbestellungsübersicht. |

> Schlägt FaSti bei einer fälligen Nachbestellung vorab eine Rezeptoptimierung vor ("Für das
> Rezept von … würde … empfohlen. Optimieren?"), ist das weiterhin reine Auskunft mit
> Auswahl-Buttons – geändert wird dabei nichts automatisch.

## Fristen

| | |
|---|---|
| **Beispielsatz** | „Welche Fristen laufen bald ab?" |
| **Stichwörter** | frist, ablauf, läuft ab, abgelaufen |
| **Art** | Auskunft – mit Patientenname: dessen Rezeptfristen. Ohne Patientenname: alle aktuellen Fristen-Hinweise. |

## Urlaub / Krank

| | |
|---|---|
| **Beispielsatz** | „Wie viel Resturlaub habe ich noch?" |
| **Stichwörter** | urlaub, resturlaub |
| **Art** | Auskunft – Jahresanspruch, genommene und verbleibende Urlaubstage. |

| | |
|---|---|
| **Beispielsatz** | „Wie viele Krankheitstage hatte ich dieses Jahr?" |
| **Stichwörter** | krank, krankheitstage |
| **Art** | Auskunft – Anzahl der Krankheitstage im erkannten Zeitraum (Standard: laufendes Jahr). |

| | |
|---|---|
| **Beispielsatz** | „Ich bin vom 1.10.2026 bis 5.10.2026 im Urlaub" |
| **Stichwörter** | „urlaub" oder „krank" zusammen mit einer Melde-Formulierung (z. B. „ich bin", „eintragen", „melde", „trage", „krankgeschrieben") |
| **Art** | **Änderung** – FaSti fragt vor dem Eintragen nach Bestätigung. Erkennt zwei Daten ("vom … bis …"), ein einzelnes Datum, „heute" oder „morgen"; fehlt ein eindeutiges Datum, fragt FaSti gezielt danach. |

## Kilometer

| | |
|---|---|
| **Beispielsatz** | „Wie viele Kilometer diesen Monat?" |
| **Stichwörter** | kilometer, km |
| **Art** | Auskunft – Anzahl Fahrten und Gesamtkilometer im erkannten Zeitraum. **Kein Eintragen per Chat möglich**, nur Übersicht. |

| | |
|---|---|
| **Beispielsatz** | „Zeig Kilometer" |
| **Stichwörter** | zeig kilometer, öffne kilometer, kilometeransicht, kilometer anzeigen |
| **Art** | Auskunft (Navigation) – öffnet die Kilometer-Ansicht. |

## Freikuvert

| | |
|---|---|
| **Beispielsatz** | „Freikuvert bestellen für Dr. Schmidt" |
| **Stichwörter** | freikuvert bestellen, freikuvert für, bestelle freikuvert, freiumschlag bestellen, kuvert |
| **Art** | **Änderung** – FaSti fragt vor dem Bestellen nach Bestätigung. Fehlt der Arztname, fragt FaSti gezielt danach. |

## Navigation

| | |
|---|---|
| **Beispielsatz** | „Zeig alle Patienten" |
| **Stichwörter** | zeig alle patienten, patientenliste, zeig die patientenliste, öffne patientenliste |
| **Art** | Auskunft (Navigation) – öffnet die Patientenliste. |

| | |
|---|---|
| **Beispielsatz** | „Zeig Patient Herr Müller" |
| **Stichwörter** | zeig patient, zeig mir patient, öffne patient, patient anzeigen, patientendetail, zeig mir die patientenakte |
| **Art** | Auskunft (Navigation) – öffnet die Detailansicht des erkannten Patienten. |

| | |
|---|---|
| **Beispielsatz** | „Zeig Abgabeliste" |
| **Stichwörter** | zeig abgabeliste, öffne abgabeliste, abgabeliste anzeigen, zeig mir die abgabeliste |
| **Art** | Auskunft (Navigation) – öffnet die Abgabeliste. |

## Patienten & Einrichtungen verwalten

| | |
|---|---|
| **Beispielsatz** | „Neuen Patienten anlegen in Heim Sonnenhof" |
| **Stichwörter** | neuen patienten anlegen, neuer patient in, patient anlegen in, lege neuen patienten an |
| **Art** | Auskunft (Navigation) – öffnet das Patient-Anlegen-Formular für die erkannte Einrichtung. FaSti legt den Patienten nicht selbst an. |

| | |
|---|---|
| **Beispielsatz** | „Neue Einrichtung anlegen" |
| **Stichwörter** | neue einrichtung anlegen, neues heim anlegen, leg neue einrichtung an, lege neues heim an |
| **Art** | Auskunft (Navigation) – öffnet die Einrichtungsübersicht, dort läuft das Anlegen über „Neues Heim anlegen" wie gewohnt. |

| | |
|---|---|
| **Beispielsatz** | „Herr Müller ist ausgeschieden" |
| **Stichwörter** | ist ausgeschieden, als ausgeschieden markieren, ausgeschieden markieren, nicht mehr aktiv, wieder aktiv, reaktivieren |
| **Art** | **Änderung** – FaSti fragt vor dem Markieren nach Bestätigung. „wieder aktiv"/„reaktivieren"/„nicht mehr ausgeschieden" heben die Markierung wieder auf, alles andere setzt sie. Der Patient wird dabei **nicht gelöscht**. |

---

## Hinweis zum Stichwort-Abgleich

Diese Liste spiegelt den Stand nach dem Abgleich mit `support-suchbegriffe-physio.json` wider
(siehe Abschlussbericht). Ergänzt wurden ausschließlich Begriffe, die zu einem der oben
gelisteten, bereits bestehenden Themen passen – „Folgerezept"/„Folgeverordnung" zur
Nachbestellung, „Kuvert" zum Freikuvert, „Schnelldoku"/„Doku schreiben"/„Behandlung eintragen"
zur Doku, „BBS"/„Sturzrisiko"/„Gleichgewicht" zum Assessment, „Abgelaufen" zu den Fristen.
Keine neuen Themen oder Fähigkeiten wurden hinzugefügt.
