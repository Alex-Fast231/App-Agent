// Bildverarbeitung ohne fremde Bibliothek: Blatt finden, entzerren, Felder
// ausschneiden, Ankreuzfelder auswerten, Textzeilen für die Erkennung vorbereiten.
// Läuft im Web Worker (ocr-worker.js). Alles nur im Arbeitsspeicher.

export const NORM_BREITE = 1480; // entzerrtes Blatt, 10 Pixel je mm (A5 quer)
export const NORM_HOEHE = 1050;
export const ZEILEN_HOEHE = 48; // Eingabehöhe des Erkennungsmodells

// ------------------------------------------------------------ Hilfen
function perzentil(werte, anteil) {
  const kopie = Float32Array.from(werte).sort();
  if (kopie.length === 0) return 0;
  return kopie[Math.min(kopie.length - 1, Math.max(0, Math.floor(anteil * (kopie.length - 1))))];
}

function otsu(histogramm, anzahl) {
  let summe = 0;
  for (let i = 0; i < 256; i++) summe += i * histogramm[i];
  let sumB = 0, wB = 0, besteVarianz = -1, schwelle = 127;
  for (let t = 0; t < 256; t++) {
    wB += histogramm[t];
    if (wB === 0) continue;
    const wF = anzahl - wB;
    if (wF === 0) break;
    sumB += t * histogramm[t];
    const mB = sumB / wB;
    const mF = (summe - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > besteVarianz) { besteVarianz = v; schwelle = t; }
  }
  return schwelle;
}

// ------------------------------------------------------------ Blatt finden
// Erwartet ein verkleinertes Bild (ImageData). Liefert vier Ecken in dessen
// Koordinaten: links oben, rechts oben, rechts unten, links unten.
// Zwei Merkmale werden versucht: Helligkeit und „Weiße“ (geringe Farbsättigung,
// hilft bei Schatten). Genommen wird die Fläche, die am ehesten ein Viereck ist.
function weichzeichnen(werte, w, h) {
  const aus = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += werte[yy * w + xx]; n++;
        }
      }
      aus[y * w + x] = (s / n) | 0;
    }
  }
  return aus;
}

function flaecheAus(werte, w, h) {
  const histo = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) histo[werte[i]]++;
  const schwelle = otsu(histo, w * h);
  const marke = new Int32Array(w * h);
  const stapel = new Int32Array(w * h);
  let besteMarke = 0, besteGroesse = 0, naechste = 1;
  for (let start = 0; start < w * h; start++) {
    if (werte[start] <= schwelle || marke[start]) continue;
    let oben = 0, groesse = 0;
    stapel[oben++] = start;
    marke[start] = naechste;
    while (oben > 0) {
      const i = stapel[--oben];
      groesse++;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && werte[i - 1] > schwelle && !marke[i - 1]) { marke[i - 1] = naechste; stapel[oben++] = i - 1; }
      if (x < w - 1 && werte[i + 1] > schwelle && !marke[i + 1]) { marke[i + 1] = naechste; stapel[oben++] = i + 1; }
      if (y > 0 && werte[i - w] > schwelle && !marke[i - w]) { marke[i - w] = naechste; stapel[oben++] = i - w; }
      if (y < h - 1 && werte[i + w] > schwelle && !marke[i + w]) { marke[i + w] = naechste; stapel[oben++] = i + w; }
    }
    if (groesse > besteGroesse) { besteGroesse = groesse; besteMarke = naechste; }
    naechste++;
  }
  const anteil = besteGroesse / (w * h);
  if (!besteMarke) return { anteil: 0, guete: 0, schwelle };
  let lo = null, ro = null, ru = null, lu = null;
  let vLo = Infinity, vRo = -Infinity, vRu = -Infinity, vLu = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (marke[y * w + x] !== besteMarke) continue;
      const s = x + y, d = x - y;
      if (s < vLo) { vLo = s; lo = [x, y]; }
      if (s > vRu) { vRu = s; ru = [x, y]; }
      if (d > vRo) { vRo = d; ro = [x, y]; }
      if (d < vLu) { vLu = d; lu = [x, y]; }
    }
  }
  const ecken = [lo, ro, ru, lu];
  let viereck = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = ecken[i], [x2, y2] = ecken[(i + 1) % 4];
    viereck += x1 * y2 - x2 * y1;
  }
  viereck = Math.abs(viereck) / 2;
  // Güte: wie gut füllt die Fläche das Viereck aus ihren Ecken (1 = genau ein Viereck)
  const guete = viereck > 0 ? Math.min(besteGroesse / viereck, viereck / besteGroesse) : 0;
  return { ecken, anteil, guete, schwelle };
}

export function findeBlatt(bild) {
  const { width: w, height: h, data } = bild;
  const hell = new Uint8Array(w * h);
  const weiss = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const mx = Math.max(data[p], data[p + 1], data[p + 2]);
    const mn = Math.min(data[p], data[p + 1], data[p + 2]);
    hell[i] = mx;
    weiss[i] = mx < 25 ? 0 : 255 - Math.round(((mx - mn) / mx) * 255);
  }
  const kandidaten = [
    { art: "hell", ...flaecheAus(weichzeichnen(hell, w, h), w, h), werte: "hell" },
    { art: "weiss", ...flaecheAus(weichzeichnen(weiss, w, h), w, h), werte: "weiss" }
  ].filter((k) => k.anteil >= 0.08 && k.anteil <= 0.98);
  if (!kandidaten.length) return { ecken: randEcken(w, h), sicher: false, art: "hell", schwelle: 128, grund: "Kein Blatt gefunden" };
  // Unter den viereckigen Flächen die größte (ein Schatten teilt das Blatt sonst in
  // einen hellen Teil, der für sich allein auch ein Viereck sein kann)
  const gute = kandidaten.filter((k) => k.guete > 0.9);
  const k = gute.length
    ? gute.reduce((a, b) => (b.anteil > a.anteil ? b : a))
    : kandidaten.reduce((a, b) => (b.guete > a.guete ? b : a));
  const beruehrtRand = k.ecken.some(([x, y]) => x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2);
  const sicher = !beruehrtRand && k.guete > 0.9;
  return {
    ecken: k.ecken, sicher, art: k.art, schwelle: k.schwelle,
    grund: beruehrtRand ? "Blatt berührt den Bildrand" : k.guete <= 0.9 ? "Umriss nicht eindeutig" : ""
  };
}

export function randEcken(w, h) {
  const r = 0.04;
  return [[w * r, h * r], [w * (1 - r), h * r], [w * (1 - r), h * (1 - r)], [w * r, h * (1 - r)]];
}

// Ecken im Originalbild nachschärfen: im Fenster um jede Ecke den hellsten
// zusammenhängenden Bereich nehmen und dort erneut den Extrempunkt suchen.
export function verfeinereEcken(bild, ecken, schwelle, fenster, art = "hell") {
  const { width: w, height: h, data } = bild;
  const richtungen = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return ecken.map(([ex, ey], k) => {
    const [rx, ry] = richtungen[k];
    const x0 = Math.max(0, Math.round(ex - fenster)), x1 = Math.min(w - 1, Math.round(ex + fenster));
    const y0 = Math.max(0, Math.round(ey - fenster)), y1 = Math.min(h - 1, Math.round(ey + fenster));
    let bester = null, bestWert = -Infinity;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Mittel über 5x5 Pixel, damit einzelne verrauschte Pixel nicht zählen
        let v = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const p = (yy * w + xx) * 4;
            const mx = Math.max(data[p], data[p + 1], data[p + 2]);
            const mn = Math.min(data[p], data[p + 1], data[p + 2]);
            v += art === "weiss" ? (mx < 25 ? 0 : 255 - ((mx - mn) / mx) * 255) : mx;
            n++;
          }
        }
        v /= n;
        if (v <= schwelle) continue;
        const wert = rx * x + ry * y;
        if (wert > bestWert) { bestWert = wert; bester = [x, y]; }
      }
    }
    return bester || [ex, ey];
  });
}

// ------------------------------------------------------------ Entzerren
// Homographie, die Zielpunkte (dst) auf Quellpunkte (src) abbildet.
export function homographie(dst, src) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i], [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gauß-Elimination mit Pivotsuche
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return [...x, 1];
}

export function entzerre(quelle, ecken, breite = NORM_BREITE, hoehe = NORM_HOEHE) {
  const H = homographie([[0, 0], [breite, 0], [breite, hoehe], [0, hoehe]], ecken);
  const { width: sw, height: sh, data: s } = quelle;
  const aus = new Uint8ClampedArray(breite * hoehe * 4);
  for (let y = 0; y < hoehe; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < breite; x++) {
      const xx = x + 0.5;
      const z = H[6] * xx + H[7] * yy + 1;
      let u = (H[0] * xx + H[1] * yy + H[2]) / z - 0.5;
      let v = (H[3] * xx + H[4] * yy + H[5]) / z - 0.5;
      const o = (y * breite + x) * 4;
      if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) {
        aus[o] = aus[o + 1] = aus[o + 2] = 255; aus[o + 3] = 255;
        continue;
      }
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const p00 = (y0 * sw + x0) * 4, p10 = p00 + 4, p01 = p00 + sw * 4, p11 = p01 + 4;
      for (let c = 0; c < 3; c++) {
        const a = s[p00 + c] + (s[p10 + c] - s[p00 + c]) * fx;
        const bb = s[p01 + c] + (s[p11 + c] - s[p01 + c]) * fx;
        aus[o + c] = a + (bb - a) * fy;
      }
      aus[o + 3] = 255;
    }
  }
  return new ImageData(aus, breite, hoehe);
}

// ------------------------------------------------------------ Felder
export function feldRechteck(feld, breite = NORM_BREITE, hoehe = NORM_HOEHE) {
  const x = Math.max(0, Math.round(feld.x * breite));
  const y = Math.max(0, Math.round(feld.y * hoehe));
  const w = Math.min(breite - x, Math.round(feld.w * breite));
  const h = Math.min(hoehe - y, Math.round(feld.h * hoehe));
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}

export function ausschnittRGBA(bild, r, rand = 0) {
  const x0 = Math.max(0, r.x - rand), y0 = Math.max(0, r.y - rand);
  const x1 = Math.min(bild.width, r.x + r.w + rand), y1 = Math.min(bild.height, r.y + r.h + rand);
  const w = x1 - x0, h = y1 - y0;
  const aus = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const q = ((y0 + y) * bild.width + x0) * 4;
    aus.set(bild.data.subarray(q, q + w * 4), y * w * 4);
  }
  return new ImageData(aus, w, h);
}

// Rotkanal: der Vordruck (Blindfarbe Rot) verschwindet, Schwarz und Blau bleiben.
function rotKanal(bild, r) {
  const g = new Float32Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      g[y * r.w + x] = bild.data[((r.y + y) * bild.width + r.x + x) * 4];
    }
  }
  return g;
}

// Papierhelligkeit in der Umgebung des Felds (gegen Schatten und dunkles Licht)
function papierHell(bild, r) {
  const rand = Math.round(Math.max(r.w, r.h) * 0.6) + 6;
  const x0 = Math.max(0, r.x - rand), y0 = Math.max(0, r.y - rand);
  const x1 = Math.min(bild.width, r.x + r.w + rand), y1 = Math.min(bild.height, r.y + r.h + rand);
  const werte = [];
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) werte.push(bild.data[(y * bild.width + x) * 4]);
  return Math.max(30, perzentil(werte, 0.85));
}

// Anteil dunkler Pixel im Inneren eines Kästchens (Rahmen wird ausgespart).
export function tintenAnteil(bild, r, innen = 0.22, faktor = 0.55) {
  const papier = papierHell(bild, r);
  const dx = Math.round(r.w * innen), dy = Math.round(r.h * innen);
  const ri = { x: r.x + dx, y: r.y + dy, w: Math.max(1, r.w - 2 * dx), h: Math.max(1, r.h - 2 * dy) };
  const g = rotKanal(bild, ri);
  let dunkel = 0;
  for (const v of g) if (v < papier * faktor) dunkel++;
  return dunkel / g.length;
}

// ------------------------------------------------------------ Textzeilen
// Liefert vorbereitete Zeilen (Graustufen 0..255, schwarzer Text auf Weiß).
export function textZeilen(bild, r, maxZeilen = 1) {
  const papierUmgebung = papierHell(bild, r);
  const g = rotKanal(bild, r);
  const w = r.w, h = r.h;
  // Hintergrund je Spalte (helle Pixel der Spalte, über Nachbarspalten geglättet).
  // So stört eine Schattenkante, die quer durch das Feld läuft, nicht.
  const spalte = new Float32Array(w);
  const tmp = new Float32Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) tmp[y] = g[y * w + x];
    spalte[x] = perzentil(tmp, 0.8);
  }
  const radius = Math.max(4, Math.round(h * 0.6));
  const hg = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - radius); k <= Math.min(w - 1, x + radius); k++) if (spalte[k] > m) m = spalte[k];
    hg[x] = Math.max(m, papierUmgebung * 0.25, 20);
  }
  // Kontrast: Hintergrund -> 255, Text dunkel
  const v = new Float32Array(w * h);
  let dunkelste = 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = g[y * w + x] / hg[x];
    v[y * w + x] = q;
    if (q < dunkelste) dunkelste = q;
  }
  if (dunkelste > 0.6) return { zeilen: [], leer: true };
  const spanne = Math.max(0.05, 0.92 - dunkelste);
  for (let i = 0; i < v.length; i++) v[i] = Math.min(255, Math.max(0, ((v[i] - dunkelste) / spanne) * 255));
  const tinte = (i) => v[i] < 140;
  // Lange waagerechte und senkrechte Linien entfernen (Kastenlinien, Ränder)
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (tinte(y * w + x)) n++;
    if (n > w * 0.6) for (let x = 0; x < w; x++) v[y * w + x] = 255;
  }
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (tinte(y * w + x)) n++;
    if (n > h * 0.8) for (let y = 0; y < h; y++) v[y * w + x] = 255;
  }
  // Zeilenprofil
  const profil = new Uint32Array(h);
  let gesamt = 0;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (tinte(y * w + x)) n++;
    profil[y] = n; gesamt += n;
  }
  if (gesamt < Math.max(12, w * h * 0.003)) return { zeilen: [], leer: true };
  const minProZeile = Math.max(1, Math.round(w * 0.004));
  let laeufe = [];
  let start = -1;
  for (let y = 0; y <= h; y++) {
    const an = y < h && profil[y] >= minProZeile;
    if (an && start < 0) start = y;
    if (!an && start >= 0) { laeufe.push([start, y]); start = -1; }
  }
  // kleine Lücken schließen (i-Punkte, Umlaute)
  const zusammen = [];
  for (const l of laeufe) {
    const letzte = zusammen[zusammen.length - 1];
    if (letzte && l[0] - letzte[1] <= Math.max(2, Math.round(h * 0.04 / Math.max(1, maxZeilen)))) letzte[1] = l[1];
    else zusammen.push([...l]);
  }
  laeufe = zusammen.map(([a, b]) => {
    let masse = 0;
    for (let y = a; y < b; y++) masse += profil[y];
    return { a, b, masse };
  });
  const hoechste = Math.max(...laeufe.map((l) => l.b - l.a));
  laeufe = laeufe.filter((l) => l.b - l.a >= hoechste * 0.4);
  if (maxZeilen === 1 && laeufe.length > 1) {
    laeufe = [laeufe.reduce((m, l) => (l.masse > m.masse ? l : m))];
  } else if (laeufe.length > maxZeilen) {
    laeufe = laeufe.sort((p, q) => q.masse - p.masse).slice(0, maxZeilen).sort((p, q) => p.a - q.a);
  }
  const zeilen = [];
  for (const { a, b } of laeufe) {
    let x0 = w, x1 = -1;
    for (let y = a; y < b; y++) for (let x = 0; x < w; x++) if (tinte(y * w + x)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    if (x1 < x0) continue;
    const zh = b - a;
    const pad = Math.round(zh * 0.25) + 2;
    const za = Math.max(0, a - pad), zb = Math.min(h, b + pad);
    const zx0 = Math.max(0, x0 - pad), zx1 = Math.min(w, x1 + 1 + pad);
    const zw = zx1 - zx0, zhh = zb - za;
    const pix = new Float32Array(zw * zhh);
    for (let y = 0; y < zhh; y++) for (let x = 0; x < zw; x++) pix[y * zw + x] = v[(za + y) * w + zx0 + x];
    zeilen.push({ w: zw, h: zhh, pix });
  }
  return { zeilen, leer: zeilen.length === 0 };
}

// Zeile auf Modellhöhe bringen und als Tensor-Daten [1,3,48,B] liefern.
export function zeilenTensor(zeile, maxBreite = 1600) {
  const skal = ZEILEN_HOEHE / zeile.h;
  const breite = Math.max(16, Math.min(maxBreite, Math.round(zeile.w * skal)));
  const flaeche = ZEILEN_HOEHE * breite;
  const t = new Float32Array(3 * flaeche);
  const sx = zeile.w / breite, sy = zeile.h / ZEILEN_HOEHE;
  for (let y = 0; y < ZEILEN_HOEHE; y++) {
    const v = Math.min(zeile.h - 1.001, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = v | 0, fy = v - y0;
    for (let x = 0; x < breite; x++) {
      const u = Math.min(zeile.w - 1.001, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = u | 0, fx = u - x0;
      const p = zeile.pix;
      const i00 = y0 * zeile.w + x0;
      const a = p[i00] + (p[i00 + 1] - p[i00]) * fx;
      const b = p[i00 + zeile.w] + (p[i00 + zeile.w + 1] - p[i00 + zeile.w]) * fx;
      const wert = ((a + (b - a) * fy) / 255 - 0.5) / 0.5;
      const o = y * breite + x;
      t[o] = wert; t[flaeche + o] = wert; t[2 * flaeche + o] = wert;
    }
  }
  return { daten: t, breite };
}
