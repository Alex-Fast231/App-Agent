// Erkennung von Ankreuz-Markierungen (Hausbesuch ja/nein, Dringlicher
// Bedarf) über eine einfache Kontrastanalyse statt über Text-OCR.
//
// Warum kein Text-OCR: Auf Muster 13 stehen beide Wortoptionen ("ja" und
// "nein") als Formulardruck IMMER in der Region, unabhängig davon welche
// angekreuzt ist - Text-Erkennung kann die beiden Optionen daher nicht
// zuverlässig unterscheiden. Ein handschriftliches Kreuz/Ausfüllen macht
// die jeweilige Ankreuzbox aber sichtbar dunkler (mehr Tinten-Pixel) als
// eine leere Box - das lässt sich rein über Helligkeitswerte auswerten,
// ganz ohne Texterkennung.
//
// Reine Pixel-Mathematik ohne DOM-Abhängigkeit (arbeitet auf einem
// ImageData-förmigen Objekt {data, width, height}, wie es
// CanvasRenderingContext2D.getImageData() liefert), damit sie ohne
// Browser mit synthetischen Testdaten prüfbar bleibt.

// Anteil der "dunklen" Pixel (Graustufen-Luminanz unter dem Schwellwert)
// an der Gesamtfläche - ein Maß dafür, wie viel Tinte/Markierung in
// diesem Bildausschnitt sichtbar ist.
export function computeDarknessRatio(imageData, { threshold = 140 } = {}) {
  const data = imageData?.data;
  if (!data || data.length < 4) return 0;

  let darkCount = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    if (luminance < threshold) darkCount += 1;
  }
  return pixelCount > 0 ? darkCount / pixelCount : 0;
}

// Vergleicht zwei Bildausschnitte (z.B. die "ja"- und die "nein"-Ankreuz-
// box) und liefert "a", "b" oder "" (kein eindeutiges Ergebnis) zurück.
// Bewusst konservativ: nur bei deutlichem Kontrastunterschied (minGap)
// wird überhaupt ein Ergebnis geliefert, sonst "" - ein billing-relevantes
// Feld soll im Zweifel leer bleiben (manuelle Auswahl durch den
// Therapeuten) statt eine unsichere Vermutung vorauszufüllen.
export function compareTwoRegionsDarkness(imageDataA, imageDataB, { minGap = 0.08, minDarkness = 0.03 } = {}) {
  const darknessA = computeDarknessRatio(imageDataA);
  const darknessB = computeDarknessRatio(imageDataB);
  const gap = Math.abs(darknessA - darknessB);

  if (gap < minGap) return "";
  if (Math.max(darknessA, darknessB) < minDarkness) return "";
  return darknessA > darknessB ? "a" : "b";
}
