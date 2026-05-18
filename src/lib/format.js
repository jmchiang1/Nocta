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

/* overnight heart-rate trace (bpm) for mock Apple Watch data. HR dips through
 * mid-sleep and drifts up toward morning; `arousals` ({ at, width, mag } on a
 * 0..1 timeline) are the apnea-driven bumps that let the trace line up with
 * the night's events. */
export function genHeartRate(seed, { base = 56, n = 44, drift = 4, arousals = [] }) {
  const rnd = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1);
    let v = base - Math.sin(t * Math.PI) * 3 + t * drift; // mid-night dip, morning rise
    v += (rnd() - 0.5) * 2.6; // beat-to-beat noise
    for (const a of arousals) {
      const d = Math.abs(t - a.at);
      if (d < a.width) v += a.mag * (1 - d / a.width); // tent bump around an arousal
    }
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}

/* Deterministic overnight hypnogram for the mock Apple Watch sleep card.
 * Returns an array of stage samples ('deep'|'light'|'rem'|'awake') shaped like
 * a real night — deep concentrated early, REM weighted toward morning, brief
 * awakenings scattered through. Sample counts track the `stages` hour totals;
 * the card legend still shows the exact authored totals. */
export function genHypnogram(seed, stages, n = 108) {
  const rnd = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const total = stages.deep + stages.rem + stages.light + stages.awake || 1;
  const wDeep = Math.round((stages.deep / total) * n);
  const wRem = Math.round((stages.rem / total) * n);
  const wAwake = Math.round((stages.awake / total) * n);

  const cycles = 5;
  const deepW = [0.34, 0.27, 0.19, 0.13, 0.07]; // deep front-loaded
  const remW = [0.05, 0.14, 0.22, 0.28, 0.31]; // REM weighted toward morning
  const jit = () => 0.7 + rnd() * 0.6;
  const seq = [];
  const run = (stage, len) => {
    for (let k = 0; k < Math.round(len); k++) seq.push(stage);
  };
  for (let c = 0; c < cycles; c++) {
    const d = wDeep * deepW[c];
    const r = wRem * remW[c];
    run('light', 2 * jit());
    run('deep', d * 0.6 * jit());
    run('light', 1.5 * jit());
    run('deep', d * 0.4);
    run('light', 2 * jit());
    run('rem', r * 0.55 * jit());
    run('light', 1.2 * jit());
    run('rem', r * 0.45);
  }
  if (!seq.length) seq.push('light');

  // resample the asleep sequence to a fixed length, then splice awake blips in
  const asleepLen = Math.max(1, n - wAwake);
  const out = [];
  for (let i = 0; i < asleepLen; i++) {
    out.push(seq[Math.min(seq.length - 1, Math.floor((i / asleepLen) * seq.length))]);
  }
  let awakeLeft = wAwake;
  const blips = Math.max(1, Math.round(wAwake / 2.4));
  for (let b = 0; b < blips && awakeLeft > 0; b++) {
    const size = Math.min(awakeLeft, 1 + Math.floor(rnd() * 3));
    const pos = Math.floor(((b + 0.4 + (rnd() - 0.5) * 0.5) / blips) * out.length);
    out.splice(Math.max(0, Math.min(out.length, pos)), 0, ...Array(size).fill('awake'));
    awakeLeft -= size;
  }
  return out;
}

/* hours (decimal) → "6h 33m" / "49m" / "7h" */
export function fmtDur(hours) {
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function fmtDelta(n) {
  const v = Math.abs(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
