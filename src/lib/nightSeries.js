/* Nocta — the night's data, shared by every chart of a single night (the
 * horizon on Tonight, the full-night page and its metric pages, desktop) so
 * they always agree with each other and with history.js:
 *   - nightSeries: flow / pressure / leak / snore. Generated shapes, anchored
 *     to what history recorded: pressure centres on the night's median and
 *     reaches the levels the episodes quote (never below the prescribed
 *     floor); leak scales so its 95th percentile is the night's P95.
 *   - nightBins: breathing events per time bucket, by type. Each type's total
 *     is history's rate × hours (summing to the night's event count), placed
 *     around that night's listed episodes so the chart, the episode list and
 *     the copy ("2–5 a.m.") line up.
 *   - session helpers for clock-time axes. */
import { genBreathing, genSeries } from './format.js';
import { NIGHTS, dateForFixture } from '../data/history.js';
import { FIXTURES, EPISODES } from '../data/fixtures.js';
import { PRESSURE_RANGE } from '../data/therapy.js';

export const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
};

const nightFor = (fixtureId) => NIGHTS.find((x) => x.date === dateForFixture(fixtureId));

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

const PRESSURE_NUM = /(\d+(?:\.\d+)?)\s*cmH/g;

export function nightSeries(fixtureId) {
  const night = nightFor(fixtureId);
  const flow = genBreathing(fixtureId + 'flow', 72);
  let pressure = genSeries(fixtureId + 'pr', 60, 6.2, 1.6);
  let leak = genSeries(fixtureId + 'lk', 48, 10, 14);
  const snore = genSeries(fixtureId + 'sn', 40, 2.4, 3).map((v) => Math.min(10, v));

  if (night?.pressure) {
    const med = pct(pressure, 0.5);
    pressure = pressure.map((v) => v - med + night.pressure);
    // the episodes quote the pressure at their peak; the line should reach it
    const quoted = (EPISODES[fixtureId] || []).flatMap((ep) =>
      [...`${ep.pressure} ${ep.response}`.matchAll(PRESSURE_NUM)].map((x) => Number(x[1]))
    );
    const epMax = quoted.length ? Math.max(...quoted) : null;
    const max = Math.max(...pressure);
    if (epMax && max < epMax) {
      const k = (epMax - night.pressure) / (max - night.pressure || 1);
      pressure = pressure.map((v) => (v > night.pressure ? night.pressure + (v - night.pressure) * k : v));
    }
    pressure = pressure.map((v) => Math.min(PRESSURE_RANGE[1], Math.max(PRESSURE_RANGE[0], v)));
  }
  if (night && night.leak == null) {
    leak = null; // nothing recorded: no made-up line
  } else if (night?.leak) {
    const p95 = pct(leak, 0.95) || 1;
    leak = leak.map((v) => (v * night.leak) / p95);
  }
  return { flow, pressure, leak, snore };
}

/* ---- breathing events by type ---- */

const TYPE_KEY = { OSA: 'osa', CSA: 'csa', Hypopnea: 'hyp' };
const KERNEL_MIN = 38; // how widely each listed episode spreads its type's events

/* split `total` across weights so the parts are whole numbers summing exactly */
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, r: r - Math.floor(r) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (left > 0) {
        out[i] += 1;
        left -= 1;
      }
    });
  return out;
}

export function nightBins(fixtureId, buckets) {
  const fx = FIXTURES[fixtureId];
  const night = nightFor(fixtureId);
  const episodes = EPISODES[fixtureId] || [];
  const { start, span } = sessionSpan(fx.session);
  const count = fx.timeline?.eventCount ?? 0;

  // per-type totals: history's rate × hours, made to sum to the night's count
  const types = ['osa', 'csa', 'hyp'];
  let totals;
  if (night?.ahi) {
    const parts = allocate(
      count,
      types.map((t) => night.ahi[t] * night.hours)
    );
    totals = Object.fromEntries(types.map((t, i) => [t, parts[i]]));
  } else {
    totals = { osa: 0, csa: 0, hyp: 0 };
    episodes.forEach((ep) => {
      const k = TYPE_KEY[ep.type];
      if (k) totals[k] += 1;
    });
  }

  // where each type happened: around that type's listed episodes
  const centers = (k) => {
    const own = episodes.filter((ep) => TYPE_KEY[ep.type] === k);
    return (own.length ? own : episodes).map((ep) => clockMin(ep.time) - start);
  };
  const bucketMid = (i) => ((i + 0.5) / buckets) * span;
  const bins = Array.from({ length: buckets }, () => ({ osa: 0, csa: 0, hyp: 0, leak: 0 }));
  types.forEach((k) => {
    const cs = centers(k);
    const w = Array.from({ length: buckets }, (_, i) =>
      cs.length
        ? cs.reduce((a, c) => a + Math.exp(-(((bucketMid(i) - c) / KERNEL_MIN) ** 2)), 0) + 0.02
        : 1
    );
    allocate(totals[k], w).forEach((n, i) => {
      bins[i][k] = n;
    });
  });

  // leak spells from the timeline's markers (not breathing events, not counted)
  (fx.timeline?.events || [])
    .filter((e) => e.type === 'leak')
    .forEach((e) => {
      const i = Math.min(buckets - 1, Math.max(0, Math.floor((e.l / 100) * buckets)));
      bins[i].leak += 1;
    });
  return bins;
}
