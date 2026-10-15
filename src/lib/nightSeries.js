/* Nocta — the night's data, shared by every chart of a single night (the
 * horizon on Tonight, the full-night page and its metric pages, desktop) so
 * they always agree with each other and with history.js. All of it comes
 * from the CPAP card (data/history.js › cardNight):
 *   - nightSeries: the machine's per-minute readings across the night's
 *     sessions — pressure, leak, breathing rate, snore. The 25 Hz flow
 *     waveform isn't read (lib/resmed), so there's no breath-by-breath trace.
 *   - nightBins: the night's recorded events per time bucket, by type, plus
 *     the buckets where leak ran above the line.
 *   - session helpers for clock-time axes. */
import { NIGHTS, cardNight, dateForFixture } from '../data/history.js';

export const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};

const LEAK_LINE = 24;
const MAX_POINTS = 180; // plenty for a chart; keeps a 9-hour night light

/* ---- clock time ---- */

/* "11:42 PM" → minutes since the previous noon, so a night reads as one span */
export function clockMin(t) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return (h * 60 + Number(m[2]) + 12 * 60) % (24 * 60);
}
export function sessionSpan(session) {
  const start = clockMin(session?.start);
  let span = clockMin(session?.end) - start;
  if (!(span > 0)) span = (session?.durationHours ?? 6) * 60;
  return { start, span };
}
/* minutes-since-noon → "2a" / "11p" */
export function hourLabel(minFromNoon) {
  const h24 = (Math.round(minFromNoon / 60) + 12) % 24;
  return `${h24 % 12 || 12}${h24 < 12 ? 'a' : 'p'}`;
}

/* ---- machine series ---- */

const ms = (at) => Date.parse(`${at}Z`); // wall clock, read as UTC: only differences matter

/* one value per minute from the first session's start to the last one's end;
 * the gaps between sessions (mask off) stay null so lines break there */
function minuteSeries(raw, key) {
  const sessions = (raw?.sessions ?? []).filter((s) => s.series?.[key]);
  if (!sessions.length) return null;
  const t0 = ms(sessions[0].start);
  const len = Math.round((ms(sessions.at(-1).end) - t0) / 6e4);
  const out = new Array(Math.max(1, len)).fill(null);
  sessions.forEach((s) => {
    const off = Math.round((ms(s.start) - t0) / 6e4);
    s.series[key].forEach((v, i) => {
      if (off + i < out.length) out[off + i] = v;
    });
  });
  return out;
}

/* average down to at most MAX_POINTS (a bucket's max for leak, so a short
 * spike isn't averaged away) */
function downsample(series, peak = false) {
  if (!series || series.length <= MAX_POINTS) return series;
  const k = series.length / MAX_POINTS;
  return Array.from({ length: MAX_POINTS }, (_, i) => {
    const slice = series.slice(Math.floor(i * k), Math.floor((i + 1) * k)).filter((v) => v != null);
    if (!slice.length) return null;
    return peak ? Math.max(...slice) : slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}
/* gaps (mask off between sessions) stay null, so charts break there instead
 * of drawing readings the machine never took */
const filled = (series) => series;

const seriesCache = new Map();
export function nightSeries(fixtureId) {
  const date = dateForFixture(fixtureId);
  const raw = cardNight(date);
  const key = `${date}:${raw?.sessions?.length ?? 0}:${NIGHTS.length}`;
  if (seriesCache.has(key)) return seriesCache.get(key);
  const out = {
    resp: filled(downsample(minuteSeries(raw, 'respRate')), true),
    pressure: filled(downsample(minuteSeries(raw, 'pressure')), true),
    leak: filled(downsample(minuteSeries(raw, 'leak'), true)),
    snore: filled(downsample(minuteSeries(raw, 'snore'), true)),
  };
  seriesCache.set(key, out);
  return out;
}

/* ---- breathing events by type, per time bucket ---- */

const TYPE = { osa: 'osa', apnea: 'osa', csa: 'csa', hyp: 'hyp' };

export function nightBins(fixtureId, buckets) {
  const date = dateForFixture(fixtureId);
  const raw = cardNight(date);
  const bins = Array.from({ length: buckets }, () => ({ osa: 0, csa: 0, hyp: 0, leak: 0 }));
  const sessions = raw?.sessions ?? [];
  if (!sessions.length) return bins;
  const t0 = ms(sessions[0].start);
  const span = ms(sessions.at(-1).end) - t0 || 1;
  const at = (t) => Math.min(buckets - 1, Math.max(0, Math.floor(((t - t0) / span) * buckets)));

  (raw.eventList ?? []).forEach((e) => {
    const k = TYPE[e.type];
    if (k) bins[at(ms(e.at))][k] += 1;
  });
  // leak spells: a marker in each bucket where leak ran above the line
  sessions.forEach((s) => {
    (s.series?.leak ?? []).forEach((v, i) => {
      if (v > LEAK_LINE) bins[at(ms(s.start) + i * 6e4)].leak = 1;
    });
  });
  return bins;
}

/* ---- breathing events by type, per CLOCK hour ----
 * One bar per hour the night touched (from the hour the mask first went on
 * to the hour it last came off), so each bar sits over its own hour label.
 * `worn` is minutes on the mask in that hour: an hour between sessions shows
 * as worn 0 rather than as a quiet hour. Times are the machine's wall clock. */
const HOUR = 36e5;
const hourName = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;

export function nightHours(fixtureId) {
  const raw = cardNight(dateForFixture(fixtureId));
  const sessions = raw?.sessions ?? [];
  if (!sessions.length) return { bins: [], startMs: 0 };
  const first = Math.floor(ms(sessions[0].start) / HOUR) * HOUR;
  const last = Math.ceil(ms(sessions.at(-1).end) / HOUR) * HOUR;
  const n = Math.max(1, Math.round((last - first) / HOUR));
  const bins = Array.from({ length: n }, (_, i) => {
    const h = new Date(first + i * HOUR).getUTCHours();
    return { hour: h, label: hourName(h), osa: 0, csa: 0, hyp: 0, leak: 0, worn: 0 };
  });
  const at = (t) => Math.min(n - 1, Math.max(0, Math.floor((t - first) / HOUR)));
  (raw.eventList ?? []).forEach((e) => {
    const k = TYPE[e.type];
    if (k) bins[at(ms(e.at))][k] += 1;
  });
  sessions.forEach((s) => {
    const t0 = ms(s.start);
    // minutes on the mask, minute by minute, into their hour
    for (let m = 0; m < Math.round(s.minutes); m += 1) bins[at(t0 + m * 6e4)].worn += 1;
    (s.series?.leak ?? []).forEach((v, i) => {
      if (v > LEAK_LINE) bins[at(t0 + i * 6e4)].leak = 1;
    });
  });
  return { bins, startMs: first };
}
