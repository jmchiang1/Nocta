/* Nocta — the night's data, shared by every chart of a single night (the
 * horizon on Tonight, the full-night page and its metric pages, desktop) so
 * they always agree with each other and with history.js. All of it comes
 * from the CPAP card (data/history.js › cardNight):
 *   - nightSeries: the machine's per-minute readings across the night's
 *     sessions, every one of them (charts fit the data, never the other way
 *     round): pressure, the set pressure in and out, leak, breathing rate,
 *     snore, flow limitation, breath size and volume a minute. The
 *     breath-by-breath waveform around each event is lib/waves.js.
 *   - nightBins: the night's recorded events per time bucket, by type, plus
 *     the buckets where leak ran above the line.
 *   - session helpers for clock-time axes. */
import { NIGHTS, cardNight, dateForFixture } from '../data/history.js';

export const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};

const LEAK_LINE = 24;

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

/* gaps (mask off between sessions) stay null, so charts break there instead
 * of drawing readings the machine never took */
const filled = (series) => series;

/* the clock minute of the day (running past 1440 after midnight) where each
 * plotted point of a series starts — the x axis of the night's charts */
const wallMin = (at) => {
  const d = new Date(ms(at));
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
function seriesClock(raw, key, n) {
  const sessions = (raw?.sessions ?? []).filter((s) => s.series?.[key]);
  if (!sessions.length || !n) return null;
  const start = wallMin(sessions[0].start);
  const len = Math.max(1, Math.round((ms(sessions.at(-1).end) - ms(sessions[0].start)) / 6e4));
  const k = len > n ? len / n : 1;
  return Array.from({ length: n }, (_, i) => start + Math.floor(i * k));
}

const SERIES_KEYS = {
  resp: 'respRate',
  pressure: 'pressure',
  leak: 'leak',
  snore: 'snore',
  flow: 'flowLimit',
  inhale: 'inhale',
  exhale: 'exhale',
  tidal: 'tidalVolume',
  minVent: 'minuteVent',
};

const seriesCache = new Map();
export function nightSeries(fixtureId) {
  const date = dateForFixture(fixtureId);
  const raw = cardNight(date);
  const key = `${date}:${raw?.sessions?.length ?? 0}:${NIGHTS.length}`;
  if (seriesCache.has(key)) return seriesCache.get(key);
  // chart key → the card's per-minute series
  const out = Object.fromEntries(Object.entries(SERIES_KEYS).map(([k, src]) => [k, filled(minuteSeries(raw, src))]));
  // each point's clock minute, per series (for the charts' time axis)
  out.clock = Object.fromEntries(Object.entries(SERIES_KEYS).map(([k, src]) => [k, seriesClock(raw, src, out[k]?.length)]));
  seriesCache.set(key, out);
  return out;
}

/* ---- a clock-time x axis for a night's chart (charts' `axes` prop) ----
 * mins: each point's clock minute of the day. Whole hours get a tick ("1 AM"),
 * every other hour when the chart is too narrow for all of them; the
 * tooltip reads the point's own time ("1:42 AM"). */
const clockText = (m) => {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const hourText = (m) => clockText(m).replace(':00', '');

export function clockAxes(mins, extra = {}) {
  const hours = mins.length ? (mins.at(-1) - mins[0]) / 60 : 0;
  return {
    labels: mins.map(clockText),
    tick: (i, width) => {
      const step = hours * 46 > width - 60 ? 2 : 1;
      const h = Math.floor(mins[i] / 60);
      const isHour = i === 0 ? mins[0] % 60 === 0 : h > Math.floor(mins[i - 1] / 60);
      return isHour && h % step === 0 ? hourText(h * 60) : null;
    },
    xTitle: 'Time',
    ...extra,
  };
}

/* the axes of each machine graph of a night (full night, metric pages) */
const METRIC_AXIS = {
  resp: { yTitle: 'Breaths a minute', unit: 'breaths/min' },
  pressure: { yTitle: 'cmH₂O', unit: 'cmH₂O' },
  leak: { yTitle: 'L/min', unit: 'L/min' },
  snore: { yTitle: 'Snore index' },
  flow: { yTitle: 'Flow limitation (0–1)', decimals: 2 },
  inhale: { yTitle: 'cmH₂O', unit: 'cmH₂O' },
  tidal: { yTitle: 'mL', unit: 'mL', decimals: 0 },
  minVent: { yTitle: 'L/min', unit: 'L/min' },
};
export const metricAxes = (key, series) =>
  series.clock?.[key] ? clockAxes(series.clock[key], METRIC_AXIS[key]) : undefined;

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
