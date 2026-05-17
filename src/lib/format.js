/* Nocta — pure helpers: deterministic noise, series + waveform generators, formatting */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* organic value series for trend / overnight charts */
export function genSeries(seed, n, base, variance) {
  const rnd = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * variance;
    v = Math.max(0, v);
    // gentle pull back toward base
    v += (base - v) * 0.18;
    out.push(v);
  }
  return out;
}

/* clustered breathing-style amplitudes 0..1 (audio-waveform look) */
export function genBreathing(seed, n) {
  const rnd = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const envelope = 0.45 + 0.45 * Math.abs(Math.sin(i * 0.34 + rnd()));
    const jitter = 0.55 + rnd() * 0.45;
    out.push(Math.min(1, envelope * jitter));
  }
  return out;
}

/* apnea-event mini waveform: full → quiet gap (the event) → full, amplitudes 0..1 */
export function genEventWave(seed, n = 44) {
  const rnd = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const gapStart = Math.round(n * 0.32);
  const gapEnd = Math.round(n * 0.68);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (i >= gapStart && i < gapEnd) {
      out.push(0.04 + rnd() * 0.05);
    } else {
      const env = 0.5 + 0.5 * Math.abs(Math.sin(i * 0.6));
      out.push(Math.min(1, (0.45 + rnd() * 0.55) * env));
    }
  }
  return { amps: out, gapStart, gapEnd };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function fmtDelta(n) {
  const v = Math.abs(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
