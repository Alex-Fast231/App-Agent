#!/usr/bin/env python3
"""Erzeugt erfundene, ausgefüllte Heilmittelverordnungen (nachgebautes Muster 13)
mit Fantasiedaten und daraus „Fotos“ in verschiedenen Varianten.

Keine echten Rezepte, keine echten Personen. Das Formular ist ein Nachbau mit
eigenem Layout (Querformat A5, Vordruck in Blindfarbe Rot, Eintragungen schwarz).
Die Feldpositionen hier sind die Grundlage von ../schablone-muster13.json.
Am echten Muster 13 müssen sie mit dem Kalibriermodus nachgemessen werden.

Aufruf:  python3 -I werkzeuge/testbilder.py <ausgabeordner> [--schablone]
Braucht: pillow, numpy
"""
import json, math, random, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PX = 20  # Pixel je mm beim Zeichnen des Formulars
BLATT_W, BLATT_H = 148, 105
ROT = (226, 90, 100)
SCHWARZ = (20, 20, 24)
BLAU = (40, 60, 160)

FONT_DIR = "/usr/share/fonts/truetype"
F_LABEL = os.path.join(FONT_DIR, "dejavu/DejaVuSans.ttf")
F_LABEL_B = os.path.join(FONT_DIR, "dejavu/DejaVuSans-Bold.ttf")
F_DRUCK = os.path.join(FONT_DIR, "liberation/LiberationMono-Regular.ttf")
F_STEMPEL = os.path.join(FONT_DIR, "liberation/LiberationSans-Regular.ttf")

# ---------------------------------------------------------------- Felder (mm)
# typ: text | datum | kreuz | tinte ; zeilen: Zeilen im Feld (Text)
FELDER = [
    dict(id="nachname", name="Nachname", typ="text", art="name", mm=(5, 16, 52, 5.5)),
    dict(id="vorname", name="Vorname", typ="text", art="name", mm=(5, 21.5, 52, 5.5)),
    dict(id="geburtsdatum", name="Geburtsdatum", typ="text", art="geburtsdatum", mm=(59, 16, 21, 5.5)),
    dict(id="versichertennummer", name="Versicherten-Nr.", typ="text", art="kvnr", mm=(29, 42, 29, 6)),
    dict(id="ausstellungsdatum", name="Ausstellungsdatum", typ="text", art="ausstellungsdatum", mm=(53, 52, 27, 6)),
    dict(id="bereich_physio", name="Physiotherapie", typ="kreuz", mm=(86, 16, 3.5, 3.5)),
    dict(id="bereich_podo", name="Podologische Therapie", typ="kreuz", mm=(86, 21, 3.5, 3.5)),
    dict(id="bereich_stimm", name="Stimm-/Sprech-/Sprach-/Schlucktherapie", typ="kreuz", mm=(86, 26, 3.5, 3.5)),
    dict(id="bereich_ergo", name="Ergotherapie", typ="kreuz", mm=(116, 16, 3.5, 3.5)),
    dict(id="bereich_ernaehrung", name="Ernährungstherapie", typ="kreuz", mm=(116, 21, 3.5, 3.5)),
    dict(id="gebuehrfrei", name="Gebühr frei", typ="kreuz", mm=(86, 33, 3.5, 3.5)),
    dict(id="gebuehrpflichtig", name="Gebührenpflichtig", typ="kreuz", mm=(104, 33, 3.5, 3.5)),
    dict(id="unfall", name="Unfall / Unfallfolgen", typ="kreuz", mm=(120, 33, 3.5, 3.5)),
    dict(id="bvg", name="BVG", typ="kreuz", mm=(134, 33, 3.5, 3.5)),
    dict(id="icd1", name="ICD-10-Code", typ="text", art="icd", mm=(5, 63, 25, 6)),
    dict(id="icd2", name="2. ICD-10-Code", typ="text", art="icd", optional=True, mm=(32, 63, 25, 6)),
    dict(id="diagnosegruppe", name="Diagnosegruppe", typ="text", art="diagnosegruppe", mm=(60, 63, 16, 6)),
    dict(id="leitsym_a", name="Leitsymptomatik a", typ="kreuz", mm=(82, 64.5, 3.5, 3.5)),
    dict(id="leitsym_b", name="Leitsymptomatik b", typ="kreuz", mm=(91, 64.5, 3.5, 3.5)),
    dict(id="leitsym_c", name="Leitsymptomatik c", typ="kreuz", mm=(100, 64.5, 3.5, 3.5)),
    dict(id="leitsym_indiv", name="Patientenindividuelle Leitsymptomatik", typ="kreuz", mm=(109, 64.5, 3.5, 3.5)),
    dict(id="leitsym_text", name="Leitsymptomatik (Text)", typ="text", art="freitext", optional=True, zeilen=2, mm=(5, 71, 104, 8.5)),
    dict(id="heilmittel1", name="Heilmittel 1", typ="text", art="heilmittel", mm=(5, 82, 66, 5)),
    dict(id="einheiten1", name="Einheiten 1", typ="text", art="einheiten", bezug="heilmittel1", mm=(73, 82, 13, 5)),
    dict(id="heilmittel2", name="Heilmittel 2", typ="text", art="heilmittel", optional=True, mm=(5, 87, 66, 5)),
    dict(id="einheiten2", name="Einheiten 2", typ="text", art="einheiten", optional=True, bezug="heilmittel2", mm=(73, 87, 13, 5)),
    dict(id="heilmittel3", name="Heilmittel 3", typ="text", art="heilmittel", optional=True, mm=(5, 92, 66, 5)),
    dict(id="einheiten3", name="Einheiten 3", typ="text", art="einheiten", optional=True, bezug="heilmittel3", mm=(73, 92, 13, 5)),
    dict(id="heilmittel_erg", name="Ergänzendes Heilmittel", typ="text", art="heilmittel", optional=True, mm=(5, 97, 66, 5)),
    dict(id="einheiten_erg", name="Einheiten ergänzend", typ="text", art="einheiten", optional=True, bezug="heilmittel_erg", mm=(73, 97, 13, 5)),
    dict(id="therapiebericht", name="Therapiebericht", typ="kreuz", mm=(90, 82.5, 3.5, 3.5)),
    dict(id="hausbesuch_ja", name="Hausbesuch ja", typ="kreuz", mm=(90, 88.5, 3.5, 3.5)),
    dict(id="hausbesuch_nein", name="Hausbesuch nein", typ="kreuz", mm=(104, 88.5, 3.5, 3.5)),
    dict(id="dringend", name="Dringlicher Behandlungsbedarf", typ="kreuz", mm=(90, 94.5, 3.5, 3.5)),
    dict(id="arzt", name="Arzt (Stempel)", typ="text", art="arzt", zeilen=4, mm=(112, 72, 32, 20)),
    dict(id="stempel", name="Stempel vorhanden", typ="tinte", mm=(112, 72, 32, 20)),
    dict(id="unterschrift", name="Unterschrift vorhanden", typ="tinte", mm=(112, 93, 32, 9)),
]

# Beschriftungen des Vordrucks (Blindfarbe), mm-Position links oben
BESCHRIFTUNG = [
    ("Krankenkasse bzw. Kostenträger", 5, 3.2), ("Name, Vorname des Versicherten", 5, 13.2), ("geb. am", 59, 13.2),
    ("Kostenträgerkennung", 5, 39.2), ("Versicherten-Nr.", 29, 39.2), ("Status", 59, 39.2),
    ("Betriebsstätten-Nr.", 5, 49.2), ("Arzt-Nr.", 29, 49.2), ("Datum", 53, 49.2),
    ("Physiotherapie", 90.5, 16.3), ("Podologische Therapie", 90.5, 21.3), ("Stimm-, Sprech-, Sprach-, Schlucktherapie", 90.5, 26.3),
    ("Ergotherapie", 120.5, 16.3), ("Ernährungstherapie", 120.5, 21.3),
    ("Gebühr frei", 90.5, 33.3), ("Gebühr pfl.", 108.5, 33.3), ("Unfall", 124.5, 33.3), ("BVG", 138.5, 33.3),
    ("Behandlungsrelevante Diagnose(n) ICD-10-Code", 5, 60.2), ("Diagnosegruppe", 60, 60.2), ("Leitsymptomatik", 82, 60.2),
    ("a", 86, 64.8), ("b", 95, 64.8), ("c", 104, 64.8), ("patientenindiv.", 113, 64.8),
    ("Leitsymptomatik (patientenindividuell) / Diagnose", 5, 68.2),
    ("Heilmittel nach Maßgabe des Kataloges", 5, 79.6), ("Behandlungseinheiten", 73, 79.6),
    ("Therapiebericht", 94.5, 83.1), ("Hausbesuch", 89, 86.0), ("ja", 94.5, 88.9), ("nein", 108.5, 88.9),
    ("Dringlich", 94.5, 94.4), ("(14 Tage)", 94.5, 96.8),
    ("Vertragsarztstempel", 112, 69.6), ("Unterschrift des Arztes", 112, 102.4),
]

# ---------------------------------------------------------------- Fantasiedaten
# Werte so, wie sie auf dem Blatt stehen. "erwartet" = normierter Wert, den der
# Prototyp ausgeben soll (für die automatische Trefferzählung im Test).
DATENSAETZE = [
    dict(id="d1", kasse="Fantasie-BKK Nord", nachname="Sonnenberg", vorname="Ottilie", strasse="Am Mühlbach 3", ort="12345 Musterstadt",
         geb="12.03.38", ktk="109999901", kvnr="Q123456785", status="5000000", bsnr="999999900", lanr="999999901", datum="02.11.26",
         kreuze=["bereich_physio", "gebuehrfrei", "leitsym_a", "hausbesuch_ja"], icd1="M17.1 G", icd2="", dg="EX",
         lstext="Kraftdefizit Quadrizeps, Gangunsicherheit", hm=[("KG", "6")], hm_erg=None,
         arzt=["Dr. med. Erika Fiktiv", "Allgemeinmedizin", "Lindenweg 12", "12345 Musterstadt"]),
    dict(id="d2", kasse="Erfundene AOK Süd", nachname="Wöhrle-Ägidius", vorname="Jürgen", strasse="Birkenhöhe 27", ort="23456 Beispielhausen",
         geb="04.07.51", ktk="109999902", kvnr="B987654321", status="1000000", bsnr="999999910", lanr="999999911", datum="28.10.26",
         kreuze=["bereich_physio", "gebuehrpflichtig", "leitsym_b", "therapiebericht", "hausbesuch_ja"], icd1="I63.5 G", icd2="G81.9 G", dg="ZN",
         lstext="", hm=[("KG-ZNS nach Bobath", "10")], hm_erg=None,
         arzt=["Dr. Konrad Erdacht", "Neurologie", "Schlossallee 4", "23456 Beispielhausen"]),
    dict(id="d3", kasse="Testkasse Mitte", nachname="Quast", vorname="Heribert", strasse="Feldweg 9", ort="34567 Nirgendwo",
         geb="30.09.44", ktk="109999903", kvnr="1234567890", status="1000000", bsnr="999999920", lanr="999999921", datum="05.11.26",
         kreuze=["bereich_physio", "gebuehrfrei", "leitsym_a", "hausbesuch_ja", "dringend"], icd1="M54.5 G", icd2="", dg="EX",
         lstext="Schmerzen LWS", hm=[("MT", "12")], hm_erg=None,
         arzt=["Dr. med. Ida Ausgedacht", "Orthopädie", "Marktplatz 1", "34567 Nirgendwo"]),
    dict(id="d4", kasse="Fantasie-BKK Nord", nachname="Lindqvist", vorname="Magdalena", strasse="Uferstraße 112", ort="45678 Seedorf",
         geb="21.01.47", ktk="109999901", kvnr="L555012347", status="5000000", bsnr="999999930", lanr="999999931", datum="11.11.26",
         kreuze=["bereich_physio", "gebuehrfrei", "leitsym_c", "hausbesuch_ja"], icd1="I89.0 G", icd2="", dg="LY",
         lstext="Lymphödem linkes Bein", hm=[("MLD 45 Min", "6")], hm_erg=("Kompressionsbandagierung", "6"),
         arzt=["Praxis Dr. Tim Probe", "Innere Medizin", "Hauptstraße 70", "45678 Seedorf"]),
    dict(id="d5", kasse="Erfundene AOK Süd", nachname="Oswald", vorname="Bruno", strasse="Ringstraße 5", ort="56789 Teststadt",
         geb="17.05.40", ktk="109999902", kvnr="O100200308", status="1000000", bsnr="999999940", lanr="999999941", datum="31.02.26",
         kreuze=["bereich_physio", "gebuehrpflichtig", "leitsym_a", "hausbesuch_nein", "therapiebericht"], icd1="J44.1 G", icd2="", dg="AT",
         lstext="", hm=[("KG-Atemtherapie", "6")], hm_erg=None,
         arzt=["Dr. med. Ulla Muster", "Pneumologie", "Kirchgasse 8", "56789 Teststadt"]),
    dict(id="d6", kasse="Testkasse Mitte", nachname="Grüßinger", vorname="Hannelore", strasse="Zum Anger 14", ort="67890 Dorfheim",
         geb="08.12.36", ktk="109999903", kvnr="G246813579", status="5000000", bsnr="999999950", lanr="999999951", datum="09.11.26",
         kreuze=["bereich_physio", "gebuehrfrei", "leitsym_indiv", "hausbesuch_ja", "unfall"], icd1="M51.2 G", icd2="M54.4 G", dg="WS",
         lstext="Lumboischialgie rechts mit Gangunsicherheit", hm=[("Manuelle Therapie", "6"), ("KG", "6")], hm_erg=None,
         arzt=["Dr. Bernd Erfunden", "Chirurgie", "Talstraße 33", "67890 Dorfheim"]),
]

HM_TYP = {"KG": "KG", "KG-ZNS nach Bobath": "KG-ZNS", "MT": "MT", "MLD 45 Min": "MLD45", "KG-Atemtherapie": "KG-Atemtherapie",
          "Manuelle Therapie": "MT", "Kompressionsbandagierung": "?"}


def datum_voll(s, geburt):
    t, m, j = s.split(".")
    j = int(j)
    jahr = (1900 + j) if geburt else (2000 + j)
    return f"{t}.{m}.{jahr}"


def erwartet(d):
    e = {}
    e["nachname"] = d["nachname"]
    e["vorname"] = d["vorname"]
    e["geburtsdatum"] = datum_voll(d["geb"], True)
    e["versichertennummer"] = d["kvnr"]
    e["ausstellungsdatum"] = datum_voll(d["datum"], False)
    for f in FELDER:
        if f["typ"] == "kreuz":
            e[f["id"]] = "angekreuzt" if f["id"] in d["kreuze"] else "leer"
    e["icd1"] = d["icd1"].split(" ")[0]
    e["icd2"] = d["icd2"].split(" ")[0] if d["icd2"] else ""
    e["diagnosegruppe"] = d["dg"]
    e["leitsym_text"] = d["lstext"]
    for i in range(3):
        if i < len(d["hm"]):
            e[f"heilmittel{i+1}"] = HM_TYP[d["hm"][i][0]] if HM_TYP[d["hm"][i][0]] != "?" else d["hm"][i][0]
            e[f"einheiten{i+1}"] = d["hm"][i][1]
        else:
            e[f"heilmittel{i+1}"] = ""
            e[f"einheiten{i+1}"] = ""
    if d["hm_erg"]:
        typ = HM_TYP[d["hm_erg"][0]]
        e["heilmittel_erg"] = d["hm_erg"][0] if typ == "?" else typ
        e["einheiten_erg"] = d["hm_erg"][1]
    else:
        e["heilmittel_erg"] = ""
        e["einheiten_erg"] = ""
    e["arzt"] = " | ".join([d["arzt"][0], d["arzt"][2], d["arzt"][3]])
    e["stempel"] = "vorhanden"
    e["unterschrift"] = "vorhanden"
    return e


# ---------------------------------------------------------------- Zeichnen
def mm(v):
    return int(round(v * PX))


def font(pfad, hoehe_mm):
    return ImageFont.truetype(pfad, mm(hoehe_mm))


def formular(d):
    im = Image.new("RGB", (mm(BLATT_W), mm(BLATT_H)), (253, 252, 250))
    g = ImageDraw.Draw(im)
    fl = font(F_LABEL, 1.9)
    # Titel
    g.text((mm(86), mm(4)), "Heilmittelverordnung", font=font(F_LABEL_B, 4.2), fill=ROT)
    g.text((mm(137), mm(10)), "13", font=font(F_LABEL_B, 4.2), fill=ROT)
    # Kästen der Kopfzone
    for (x, y, w, h) in [(4, 5.5, 76, 7), (4, 15.5, 76, 23), (4, 41.5, 24, 7), (28, 41.5, 30, 7), (58, 41.5, 22, 7),
                         (4, 51.5, 24, 7), (28, 51.5, 24, 7), (52, 51.5, 28, 7), (4, 62.5, 27, 7), (31, 62.5, 27, 7),
                         (59, 62.5, 18, 7), (4, 70.8, 106, 9), (4, 81.5, 68, 20.5), (72, 81.5, 15, 20.5),
                         (111, 71.5, 34, 30.5)]:
        g.rectangle([mm(x), mm(y), mm(x + w), mm(y + h)], outline=ROT, width=3)
    for y in (86.5, 91.5, 96.5):
        g.line([mm(4), mm(y), mm(87), mm(y)], fill=ROT, width=2)
    for f in FELDER:
        if f["typ"] == "kreuz":
            x, y, w, h = f["mm"]
            g.rectangle([mm(x), mm(y), mm(x + w), mm(y + h)], outline=ROT, width=3)
    for (t, x, y) in BESCHRIFTUNG:
        g.text((mm(x), mm(y)), t, font=fl, fill=ROT)
    # Eintragungen (Drucker, schwarz)
    fd = font(F_DRUCK, 3.3)
    def schreib(x, y, t, f=fd):
        g.text((mm(x), mm(y)), t, font=f, fill=SCHWARZ)
    schreib(5, 7.2, d["kasse"])
    schreib(5.5, 16.6, d["nachname"])
    schreib(5.5, 22.1, d["vorname"])
    schreib(5.5, 27.6, d["strasse"])
    schreib(5.5, 33.1, d["ort"])
    schreib(59.5, 16.6, d["geb"])
    schreib(5, 43.3, d["ktk"])
    schreib(29.5, 43.3, d["kvnr"])
    schreib(59, 43.3, d["status"])
    schreib(5, 53.3, d["bsnr"])
    schreib(29.5, 53.3, d["lanr"])
    schreib(54, 53.3, d["datum"])
    schreib(5.5, 64.3, d["icd1"])
    if d["icd2"]:
        schreib(32.5, 64.3, d["icd2"])
    schreib(61, 64.3, d["dg"])
    if d["lstext"]:
        schreib(5.5, 72.0, d["lstext"])
    for i, (t, n) in enumerate(d["hm"]):
        schreib(5.5, 82.6 + 5 * i, t)
        schreib(76, 82.6 + 5 * i, n)
    if d["hm_erg"]:
        schreib(5.5, 97.6, d["hm_erg"][0])
        schreib(76, 97.6, d["hm_erg"][1])
    for k in d["kreuze"]:
        f = next(f for f in FELDER if f["id"] == k)
        x, y, w, h = f["mm"]
        g.line([mm(x + 0.5), mm(y + 0.5), mm(x + w - 0.5), mm(y + h - 0.5)], fill=SCHWARZ, width=6)
        g.line([mm(x + 0.5), mm(y + h - 0.5), mm(x + w - 0.5), mm(y + 0.5)], fill=SCHWARZ, width=6)
    # Stempel (blau, leicht schräg) und Unterschrift
    st = Image.new("RGBA", (mm(31), mm(20)), (0, 0, 0, 0))
    sg = ImageDraw.Draw(st)
    fs = font(F_STEMPEL, 2.6)
    for i, z in enumerate(d["arzt"]):
        sg.text((mm(0.6), mm(0.8 + 4.4 * i)), z, font=fs, fill=BLAU + (225,))
    st = st.rotate(random.uniform(-1.5, 1.5), resample=Image.BICUBIC, expand=False)
    im.paste(st, (mm(112), mm(72)), st)
    pts = []
    x0, y0 = 114, 98.5
    for i in range(60):
        t = i / 59
        pts.append((mm(x0 + 24 * t), mm(y0 - 2.2 * math.sin(t * 11 + random.random()) - 1.2 * t)))
    g.line(pts, fill=BLAU, width=5, joint="curve")
    return im


# ---------------------------------------------------------------- „Fotos“
def hintergrund(w, h, rng):
    basis = np.array([120, 92, 70], np.float32) * rng.uniform(0.75, 1.1)
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    maser = (np.sin(y * 90 + np.sin(x * 7) * 3) * 10 + np.sin(y * 300) * 4)[:, :, None]
    bild = basis[None, None, :] + maser + rng.normal(0, 4, (h, w, 1))
    return np.clip(bild, 0, 255)


def perspektive_koeff(ziel, quelle):
    # PIL braucht die Abbildung Ausgabe -> Eingabe
    A, B = [], []
    for (x, y), (u, v) in zip(ziel, quelle):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()


def foto(blatt, variante, rng):
    W, H = 2400, 1800
    bw, bh = blatt.size
    breite = rng.uniform(0.72, 0.82) * W
    hoehe = breite * bh / bw
    cx, cy = W / 2 + rng.uniform(-60, 60), H / 2 + rng.uniform(-50, 50)
    ecken = np.array([[-breite / 2, -hoehe / 2], [breite / 2, -hoehe / 2], [breite / 2, hoehe / 2], [-breite / 2, hoehe / 2]])
    winkel = {"gedreht": rng.choice([-1, 1]) * rng.uniform(6, 10)}.get(variante, rng.uniform(-1.5, 1.5))
    a = math.radians(winkel)
    rot = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    ecken = ecken @ rot.T
    if variante == "schraeg":
        # oben schmaler (Handy schräg gehalten), etwas seitlich
        ecken[0, 0] += breite * 0.09; ecken[1, 0] -= breite * 0.05
        ecken[0, 1] += hoehe * 0.04; ecken[1, 1] += hoehe * 0.02
    ecken += [cx, cy]
    koeff = perspektive_koeff(ecken.tolist(), [(0, 0), (bw, 0), (bw, bh), (0, bh)])
    hg = Image.fromarray(hintergrund(W, H, rng).astype(np.uint8))
    blatt_rgba = blatt.convert("RGBA")
    verzerrt = blatt_rgba.transform((W, H), Image.PERSPECTIVE, koeff, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    hg.paste(verzerrt, (0, 0), verzerrt)
    a = np.asarray(hg).astype(np.float32)
    yy, xx = np.mgrid[0:H, 0:W]
    # leichte Vignette überall
    vign = 1 - 0.12 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 4
    a *= vign[:, :, None]
    if variante == "dunkel":
        a = a * 0.38 + rng.normal(0, 7, a.shape)
        a[:, :, 2] *= 0.85  # Kunstlicht, gelblich
    if variante == "schatten":
        rand = W * rng.uniform(0.35, 0.6)
        schatten = np.clip((xx + yy * 0.4 - rand) / 120, 0, 1)
        a *= (1 - 0.55 * schatten)[:, :, None]
    a = np.clip(a, 0, 255).astype(np.uint8)
    bild = Image.fromarray(a)
    if variante == "unscharf":
        bild = bild.filter(ImageFilter.GaussianBlur(1.6))
    else:
        bild = bild.filter(ImageFilter.GaussianBlur(0.6))
    return bild


# Nur diese Felder liest der Prototyp aus (Alex, 16.11.2026). Das Formular
# wird trotzdem vollständig gezeichnet, damit es realistisch aussieht.
APP_FELDER = ["nachname", "vorname", "geburtsdatum", "ausstellungsdatum", "icd1", "icd2",
              "heilmittel1", "einheiten1", "heilmittel2", "einheiten2", "heilmittel3", "einheiten3",
              "heilmittel_erg", "einheiten_erg", "hausbesuch_ja", "hausbesuch_nein", "dringend"]


def schablone():
    felder = []
    for f in sorted((f for f in FELDER if f["id"] in APP_FELDER), key=lambda f: APP_FELDER.index(f["id"])):
        x, y, w, h = f["mm"]
        e = {"id": f["id"], "name": f["name"], "typ": f["typ"]}
        for k in ("art", "zeilen", "optional", "bezug"):
            if k in f:
                e[k] = f[k]
        e.update({"x": round(x / BLATT_W, 4), "y": round(y / BLATT_H, 4), "w": round(w / BLATT_W, 4), "h": round(h / BLATT_H, 4)})
        felder.append(e)
    return {
        "version": 1,
        "hinweis": "Feldpositionen relativ zur Blattgröße (0..1) des entzerrten Blatts, Querformat A5. Stand: Nachbau-Formular, NICHT am echten Muster 13 ausgemessen. Mit dem Kalibriermodus anpassen.",
        "blatt_mm": [BLATT_W, BLATT_H],
        "felder": felder,
    }


VARIANTEN = ["gerade", "schraeg", "gedreht", "dunkel", "schatten", "unscharf"]


def main():
    ziel = sys.argv[1]
    os.makedirs(ziel, exist_ok=True)
    if "--schablone" in sys.argv:
        with open(os.path.join(ziel, "schablone-muster13.json"), "w", encoding="utf-8") as f:
            json.dump(schablone(), f, ensure_ascii=False, indent=1)
        return
    random.seed(13)
    rng = np.random.default_rng(13)
    wahrheit = []
    for d in DATENSAETZE:
        blatt = formular(d)
        blatt.save(os.path.join(ziel, f"{d['id']}-blatt.png"))
        for v in VARIANTEN:
            name = f"{d['id']}-{v}.jpg"
            foto(blatt, v, rng).save(os.path.join(ziel, name), quality=88)
            wahrheit.append({"datei": name, "datensatz": d["id"], "variante": v, "erwartet": erwartet(d)})
    with open(os.path.join(ziel, "wahrheit.json"), "w", encoding="utf-8") as f:
        json.dump(wahrheit, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
