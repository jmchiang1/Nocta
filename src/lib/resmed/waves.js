/* Nocta — the breathing waveform around each event, from a night's BRP files
 * (Flow.40ms + Press.40ms, 25 readings a second).
 *
 * A whole BRP file is large (~1.4 MB a session), so only the stretch around
 * each event is read: BRP records are fixed-size minutes, so each window is
 * one ranged read of the records it spans (entry.readRange, when the source
 * can do it). The samples are kept exactly as recorded — the file's own
 * 16-bit values plus its scale — so nothing is smoothed or thinned. */
import { readEdfHeader } from './edf.js';

const PRE_SEC = 30; // shown before an event starts
const POST_SEC = 30; // and after it ends
const MAX_WINDOWS = 150; // per night: a very eventful night stays a sane size

const ascii = (u8, at, n) => String.fromCharCode(...u8.subarray(at, at + n)).trim();

async function readRange(f, start, end) {
  if (f.readRange) return f.readRange(start, end);
  const all = await f.read(); // a source without ranged reads: whole file
  return all.slice(start, end);
}

/* the stretches to read: each event with a margin, overlaps merged. Times are
 * wall clock read as UTC (ms), like the rest of the parser. */
export function eventWindows(eventList) {
  const spans = eventList
    .map((e) => {
      const at = Date.parse(`${e.at}Z`);
      return { from: at - PRE_SEC * 1e3, to: at + ((e.durSec || 0) + POST_SEC) * 1e3 };
    })
    .sort((a, b) => a.from - b.from);
  const merged = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else merged.push({ ...s });
  }
  return merged.slice(0, MAX_WINDOWS);
}

function toB64(int16) {
  const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

/* windows → [{ start, rate, flow: {…}, press: {…} }] read from the BRP files */
export async function readWaves(brpFiles, windows, naive) {
  const out = [];
  if (!windows.length) return out;
  for (const f of brpFiles) {
    const first = new Uint8Array(await readRange(f, 0, 256));
    const ns = parseInt(ascii(first, 252, 4), 10);
    const headerBytes = 256 + ns * 256;
    const h = readEdfHeader(await readRange(f, 0, headerBytes));
    // the header alone can't say how many records are on disk: use the size
    const declared = parseInt(ascii(first, 236, 8), 10);
    const onDisk = h.recordBytes ? Math.floor(((f.size ?? 0) - headerBytes) / h.recordBytes) : 0;
    const nrec = declared >= 0 && declared <= onDisk ? declared : onDisk;
    if (!nrec) continue;
    const recMs = h.recordSec * 1e3;
    const fileStart = h.start;
    const fileEnd = fileStart + nrec * recMs;

    const want = ['Flow.40ms', 'Press.40ms'].map((label) => h.signals.findIndex((s) => s.label === label));
    if (want.some((i) => i < 0)) continue;
    const offsets = [];
    let acc = 0;
    for (const s of h.signals) {
      offsets.push(acc);
      acc += s.spr * 2;
    }

    for (const w of windows) {
      const a = Math.max(w.from, fileStart);
      const b = Math.min(w.to, fileEnd);
      if (b - a < 2e3) continue;
      const r0 = Math.floor((a - fileStart) / recMs);
      const r1 = Math.min(nrec - 1, Math.floor((b - fileStart - 1) / recMs));
      const buf = await readRange(f, headerBytes + r0 * h.recordBytes, headerBytes + (r1 + 1) * h.recordBytes);
      const dv = new DataView(buf);
      const sig = want.map((si) => {
        const s = h.signals[si];
        const rate = s.spr / h.recordSec;
        const all = new Int16Array((r1 - r0 + 1) * s.spr);
        for (let r = 0; r <= r1 - r0; r++) {
          const base = r * h.recordBytes + offsets[si];
          for (let k = 0; k < s.spr; k++) all[r * s.spr + k] = dv.getInt16(base + k * 2, true);
        }
        // trim to the window, on the file's own sample grid
        const i0 = Math.round(((a - (fileStart + r0 * recMs)) / 1e3) * rate);
        const n = Math.round(((b - a) / 1e3) * rate);
        const data = all.slice(i0, i0 + n);
        return {
          rate,
          dim: s.dim,
          physMin: s.physMin,
          digMin: s.digMin,
          gain: (s.physMax - s.physMin) / (s.digMax - s.digMin),
          b64: toB64(data),
        };
      });
      out.push({
        start: naive(a), // whole seconds: events and records both start on one
        rate: sig[0].rate,
        flow: sig[0],
        press: sig[1],
      });
    }
  }
  return out.sort((x, y) => x.start.localeCompare(y.start));
}
