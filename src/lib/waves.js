/* Nocta — the breathing waveform around an event (the 25 Hz flow and mask
 * pressure the machine wrote to its BRP files), for the full night's event
 * list. An imported card keeps each night's slices on the device
 * (night.waves, lib/resmed/waves.js); the bundled demo keeps its latest
 * nights' as separate files in public/demo-waves, fetched on first open.
 * Values are the file's own samples, scaled to their units: nothing is
 * smoothed or thinned. */
import { cardNight } from '../data/history.js';

const cache = new Map();

/* a night's wave slices, or [] when the card kept none for it */
export async function wavesFor(date) {
  const night = cardNight(date);
  if (!night) return [];
  if (night.waves) return night.waves;
  if (!night.demoWaves) return [];
  if (!cache.has(date)) {
    cache.set(
      date,
      fetch(`/demo-waves/${date}.json`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
    );
  }
  return cache.get(date);
}

/* base64 16-bit samples → physical values (the file's own scale) */
function decode(sig) {
  const bin = atob(sig.b64);
  const out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    const d = ((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16;
    out[i] = sig.physMin + (d - sig.digMin) * sig.gain;
  }
  return out;
}

const ms = (at) => Date.parse(`${at}Z`);

/* the trace around one event: time in seconds from the event's start, flow
 * in L/min (the file's L/s × 60), mask pressure in cmH₂O */
export function traceFor(waves, at, durSec) {
  const t = ms(at);
  const w = waves.find((x) => {
    const start = ms(x.start);
    const len = (atob(x.flow.b64).length / 2 / x.flow.rate) * 1e3;
    return t >= start && t < start + len;
  });
  if (!w) return null;
  const flow = decode(w.flow);
  const press = decode(w.press);
  const rate = w.flow.rate;
  const t0 = (ms(w.start) - t) / 1e3; // seconds, negative: before the event
  const time = Array.from(flow, (_, i) => t0 + i / rate);
  const toLpm = /l\/s/i.test(w.flow.dim) ? 60 : 1;
  return {
    time,
    flow: Array.from(flow, (v) => v * toLpm),
    press: Array.from(press),
    pressRate: w.press.rate,
    event: [0, durSec || 0],
  };
}
