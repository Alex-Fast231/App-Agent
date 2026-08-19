// Relative Feldpositionen (Region of Interest) auf dem GKV-Formular
// "Muster 13" (Heilmittelverordnung, einheitliches Verordnungsmuster seit
// 01.01.2021 - das für Physiotherapie/Ergotherapie/Logopädie gültige
// Formular). Alle Koordinaten sind prozentual (0..1) bezogen auf das
// fotografierte, auf den Formularrand zugeschnittene Bild, damit sie
// unabhängig von der tatsächlichen Fotogröße funktionieren.
//
// WICHTIG: Diese Werte wurden anhand eines echten Muster-13-Vordrucks
// (offizielle Vorlage mit Feldnummerierung 1-12, vom Nutzer als
// Referenzbild bereitgestellt - KEINE echten Patientendaten, nur
// Platzhaltertext "Frau Herr Musterman") Zeile für Zeile abgeschätzt und
// mit einem kleinen Sicherheitsrand erweitert. Das ist deutlich
// verlässlicher als die ursprüngliche Schätzung der Vorsession, aber
// weiterhin NICHT an einem echten fotografierten (nicht nur
// abfotografierten Bildschirm-)Foto verifiziert - Kamerawinkel, Schatten
// und Papierkrümmung können die tatsächlichen Positionen verschieben.
// Nach dem ersten echten Testlauf bei Bedarf nachjustieren.
export const MUSTER13_FIELD_REGIONS = {
  name: { x0: 0.02, y0: 0.06, x1: 0.55, y1: 0.17 },
  geburtsdatum: { x0: 0.50, y0: 0.06, x1: 0.70, y1: 0.17 },
  ausstellungsdatum: { x0: 0.55, y0: 0.19, x1: 0.85, y1: 0.29 },
  icd10: { x0: 0.02, y0: 0.27, x1: 0.42, y1: 0.44 },
  diagnosengruppe: { x0: 0.02, y0: 0.41, x1: 0.22, y1: 0.48 },
  leitsymptomatik: { x0: 0.20, y0: 0.41, x1: 1.00, y1: 0.50 },
  heilmittel: { x0: 0.02, y0: 0.54, x1: 0.78, y1: 0.81 },
  einheiten: { x0: 0.76, y0: 0.54, x1: 0.98, y1: 0.81 },
  hausbesuch: { x0: 0.30, y0: 0.79, x1: 0.62, y1: 0.86 },
  dringend: { x0: 0.02, y0: 0.84, x1: 0.47, y1: 0.90 }
};

// Referenz-Seitenverhältnis für den Ausrichtungsrahmen, als Breite/Höhe
// (nicht Höhe/Breite!). Muster 13 ist laut Referenzbild querformatig
// (breiter als hoch, ca. 1.15:1) - das Verhältnis dient nur als visuelle
// Orientierungshilfe, keine exakte Formatvorgabe.
export const MUSTER13_GUIDE_ASPECT_RATIO = 1.15;

// Position/Größe des Ausrichtungsrahmens als Region (0..1) - gemeinsam
// genutzt von der Kamera-Live-Vorschau (CSS-Overlay über dem Video) und
// der Datei-Upload-Vorschau (Overlay über dem gerenderten PDF/Bild), damit
// beide exakt denselben Ausschnitt meinen und nicht unabhängig
// auseinanderdriften können.
const GUIDE_WIDTH = 0.86;
const GUIDE_HEIGHT = GUIDE_WIDTH / MUSTER13_GUIDE_ASPECT_RATIO;
export const MUSTER13_GUIDE_REGION = {
  x0: 0.07,
  y0: 0.06,
  x1: 0.07 + GUIDE_WIDTH,
  y1: 0.06 + GUIDE_HEIGHT
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Rechnet eine relative Region (0..1) in ein Pixel-Rechteck innerhalb
// eines Quellbereichs der gegebenen Breite/Höhe um. Reine Zahlen-Logik,
// unabhängig von Canvas/DOM, damit sie ohne Browser testbar bleibt.
export function regionToPixelRect(region, width, height) {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  const x0 = clamp01(region.x0) * w;
  const y0 = clamp01(region.y0) * h;
  const x1 = clamp01(region.x1) * w;
  const y1 = clamp01(region.y1) * h;

  return {
    x: Math.round(Math.min(x0, x1)),
    y: Math.round(Math.min(y0, y1)),
    w: Math.max(1, Math.round(Math.abs(x1 - x0))),
    h: Math.max(1, Math.round(Math.abs(y1 - y0)))
  };
}
