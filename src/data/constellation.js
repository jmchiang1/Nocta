/* Nocta — the logo: R3 · Breath, a constellation of six stars on a
 * breathing wave (CPAP is breathing), the crest star in peach. Source of
 * truth for public/Nocta-constellation.svg (regular, ≥ ~100 px wide) and
 * Nocta-constellation-sm.svg (heavier, for ~28–48 px icons) and for the
 * splash, which reveals these exact stars in the night sky.
 * Coordinates are in the artwork's viewBox; `size` maps to a radius below. */
export const CONSTELLATION = {
  viewBox: [70, 10, 860, 360], // x, y, w, h
  nodes: [
    { x: 110, y: 330, size: 'xs' },
    { x: 262, y: 180, size: 's' },
    { x: 414, y: 300, size: 'xs' },
    { x: 566, y: 70, size: 'l' }, // crest — the peach star
    { x: 724, y: 300, size: 's' },
    { x: 890, y: 170, size: 'xs' },
  ],
  lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]], // drawn in this order, left to right
  hero: 3,
  radius: {"l": 30, "m": 23, "s": 17, "xs": 13}, // at full size; scaled up as the mark gets small
  lineWidth: 9,
};

/* the optical rule both the artwork and the animation follow: line and dot
 * weight grow as the mark is drawn smaller, so it stays legible as an icon */
export function constellationWeights(displayWidthPx) {
  const s = (displayWidthPx * 1000) / CONSTELLATION.viewBox[2];
  const f = Math.max(1, Math.min(4.2, 150 / s));
  return { line: CONSTELLATION.lineWidth * Math.pow(f, 0.9), dot: Math.pow(f, 0.55) };
}
