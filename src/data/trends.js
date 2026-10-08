/* Nocta — Trends data, computed from the user's real history (history.js).
 *
 * Trends are shown *as of the night you're looking at*: pick Tuesday on the
 * Tonight week strip and the 7-night window ends on Tuesday, "all" covers
 * night 1 → Tuesday, and every sentence speaks about Tuesday as "last night".
 * Nothing after the selected night leaks in. With no night selected
 * (e.g. the You tab's summary) the anchor is the real last night, Oct 10.
 *
 * Every number — tiles, chart series, best/worst, the early journal signal —
 * is derived from NIGHTS, so it can't drift from compliance, the journal, or
 * the profile. Insight sentences are templates filled with those same
 * computed values. The user is 11 nights in: the 30- and 90-day ranges show
 * the nights that exist rather than inventing history. */
import {
  NIGHTS,
  LAST_NIGHT,
  THERAPY_START,
  ahiTotal,
  averages,
  round1,
  fmtShort,
  fmtDayShort,
  nightsBetween,
  toDate,
  dateForFixture,
} from './history.js';

export const RANGES = ['7d', '30d', '90d'];
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

const isoMinusDays = (iso, days) => {
  const d = toDate(iso);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const weekday = (iso) => toDate(iso).toLocaleDateString('en-US', { weekday: 'long' });
const listJoin = (xs) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/* what made particular nights stand out (best/worst cards) */
const NIGHT_NOTES = {
  '2026-09-30': 'First night on CPAP · mostly on your stomach',
  '2026-10-04': 'Side sleeping · in bed before midnight',
  '2026-10-05': 'Side sleeping · exercised that day',
  '2026-10-06': 'Central events through the night',
  '2026-10-10': 'Stomach sleeping · wine + late meal · leak after 3 a.m.',
};

/* Early journal signal — stomach nights vs the rest, using only nights up to
 * `anchor`. It's the only pattern this little history can support, so it is
 * labelled as early, and it only appears once there are 2+ stomach nights and
 * at least a 25% difference (the FEATURES effect-size floor). */
function stomachSignal(anchor) {
  const scored = NIGHTS.filter((x) => x.ahi && x.date <= anchor);
  const stomach = scored.filter((x) => x.position === 'stomach');
  const other = scored.filter((x) => x.position !== 'stomach');
  if (stomach.length < 2 || other.length < 2) return null;
  const a = averages(stomach).ahi;
  const b = averages(other).ahi;
  const ratio = round1(a / b);
  if (ratio < 1.25) return null;
  const above = stomach.filter((x) => ahiTotal(x) > b).length;
  const allAbove = above === stomach.length;
  const who = stomach.length === 2 ? 'Both of' : `All ${stomach.length} of`;
  return {
    label: 'Early signal',
    window: `${scored.length} nights`,
    headline: `On nights you sleep on your stomach, your AHI runs about ${ratio}× higher.`,
    body: allAbove
      ? `${who} your stomach nights so far landed above your usual range. It’s early, and a few more nights will show whether it holds.`
      : `Your stomach nights averaged ${a} against ${b} on other nights. It’s early, and a few more nights will show whether it holds.`,
    stats: [
      { v: `${ratio}×`, k: 'average AHI' },
      { v: `${above} / ${stomach.length}`, k: 'stomach nights above range' },
      { v: String(scored.length), k: 'nights so far' },
    ],
  };
}
/* as of the real last night — the Saturday why-card shares this */
export const STOMACH_SIGNAL = stomachSignal(LAST_NIGHT);

/* 7 evenly spaced axis slots: first, middle, last date */
function axis(nights) {
  if (!nights.length) return ['', '', '', '', '', '', ''];
  const mid = nights[Math.floor((nights.length - 1) / 2)];
  return [fmtShort(nights[0].date), '', '', fmtShort(mid.date), '', '', fmtShort(nights.at(-1).date)];
}

function tiles(win, prior, nightsInWindow) {
  const tile = (key, label, value, unit, cur, prev, extra = {}) => {
    if (value == null) return { key, label, value: '—', unit: '', dir: 'flat', note: 'no data' };
    if (prev == null) return { key, label, value, unit, dir: 'flat', ...extra };
    // leak reads in whole L/min, so its change does too
    const delta = key === 'leak' ? Math.round(cur - prev) : round1(cur - prev);
    if (Math.abs(delta) < (key === 'leak' ? 1 : 0.3)) return { key, label, value, unit, dir: 'flat', ...extra };
    return { key, label, value, unit, delta: Math.abs(delta), dir: delta > 0 ? 'up' : 'down' };
  };
  return [
    tile('ahi', 'AHI', win.ahi?.toFixed(1), '/h', win.ahi, prior?.ahi, {
      note: `${win.scored} scored nights`,
    }),
    tile('leak', 'Leak P95', win.leak == null ? null : String(Math.round(win.leak)), 'L/m', win.leak, prior?.leak, {
      note: 'steady',
    }),
    // usage is always "on nights used", with how many nights that was
    {
      key: 'hours',
      label: 'Usage',
      value: win.hours?.toFixed(1) ?? '—',
      unit: win.hours == null ? '' : 'h',
      dir: 'flat',
      note: `${win.used} of ${nightsInWindow} nights`,
    },
    {
      key: 'pressure',
      label: 'Pressure',
      value: win.pressure?.toFixed(1) ?? '—',
      unit: win.pressure == null ? '' : 'cmH₂O',
      dir: 'flat',
      note: 'steady',
    },
  ];
}

function bestWorst(nights) {
  const scored = nights.filter((x) => x.ahi);
  if (scored.length < 2) return null;
  const by = [...scored].sort((a, b) => ahiTotal(a) - ahiTotal(b));
  const card = (x) => ({
    date: fmtDayShort(x.date),
    ahi: ahiTotal(x).toFixed(1),
    note: NIGHT_NOTES[x.date] || `${x.hours} h on the mask`,
  });
  return { best: card(by[0]), worst: card(by.at(-1)) };
}

/* ---- insight sentences: templates over computed values ---- */

/* how the anchor night compares with everything before it */
function lastNightLine(last, before) {
  if (!last.ahi) {
    return last.hours > 0
      ? `Last night was too short to score: **${last.hours} h** on the mask, under the **2 h** needed.`
      : 'No session was recorded last night.';
  }
  const t = ahiTotal(last);
  if (before.ahi == null) return `Your AHI was **${t}** last night.`;
  const r = t / before.ahi;
  const rel =
    r >= 2 ? 'more than double' : r >= 1.4 ? 'well above' : r <= 0.7 ? 'well below' : 'close to';
  return `Your AHI was **${t}** last night, ${rel} your average of **${before.ahi}** before it.`;
}

function centralLine(last, priorNights) {
  if (!last.ahi || last.ahi.csa <= 5) return null;
  const usual = round1(
    priorNights.filter((x) => x.ahi).reduce((a, x) => a + x.ahi.csa, 0) /
      Math.max(1, priorNights.filter((x) => x.ahi).length)
  );
  return `Central events reached **${last.ahi.csa}** an hour last night. It’s usually about **${usual}**.`;
}

function leakLine(last, nights, scope) {
  const others = nights.filter((x) => x.leak != null && x.date !== last.date);
  const typical = others.length ? Math.round(averages(others).leak) : null;
  if (last.leak != null && typical && last.leak >= typical * 2) {
    return scope === 'week'
      ? `Leak reached **${last.leak} L/min** last night, after a week that mostly stayed near **${typical}**.`
      : `Leak stayed near **${typical} L/min** on most nights; last night’s **${last.leak}** was the outlier.`;
  }
  const w = averages(nights).leak;
  return w == null ? null : `Leak has stayed near **${Math.round(w)} L/min**${scope === 'week' ? ' this week' : ''}.`;
}

function coverageLine(nights, days) {
  const short = nights.filter((x) => x.hours > 0 && !x.ahi).map((x) => weekday(x.date));
  const none = nights.filter((x) => x.hours === 0).map((x) => weekday(x.date));
  const scored = nights.filter((x) => x.ahi).length;
  const parts = [];
  if (short.length) parts.push(`${listJoin(short)} ${short.length > 1 ? 'were' : 'was'} too short to score`);
  if (none.length) parts.push(`${listJoin(none)} had no session`);
  if (parts.length) return `This week rests on **${scored}** scored nights: ${parts.join(', and ')}.`;
  if (nights.length < days) return `You’re **${nights.length}** nights in, so this is every night so far.`;
  return 'Every night this week had a full session.';
}

function insights(scope, nights, anchor, days) {
  const last = NIGHTS.find((x) => x.date === anchor) || nights.at(-1);
  if (!nights.length || !last) {
    return [{ icon: 'spark', text: `No therapy nights fall in this range. Your first night was ${fmtShort(THERAPY_START)}.` }];
  }
  const priorAll = NIGHTS.filter((x) => x.date < last.date);
  const before = averages(priorAll);
  const lines = [];
  if (scope === 'week') {
    const central = centralLine(last, priorAll);
    lines.push({ icon: 'ahi', text: central || lastNightLine(last, before) });
    const leak = leakLine(last, nights, 'week');
    if (leak) lines.push({ icon: 'leak', text: leak });
    lines.push({ icon: 'spark', text: coverageLine(nights, days) });
    return lines;
  }
  const win = averages(nights);
  const scored = nights.filter((x) => x.ahi).map(ahiTotal);
  if (scored.length >= 2) {
    lines.push({
      icon: 'ahi',
      text: `Across these **${nights.length}** nights your AHI averaged **${win.ahi}**, from a low of **${Math.min(...scored)}** to a high of **${Math.max(...scored)}**.`,
    });
  } else {
    lines.push({ icon: 'ahi', text: lastNightLine(last, before) });
  }
  const leak = leakLine(last, nights, 'all');
  if (leak) lines.push({ icon: 'leak', text: leak });
  const sofar = NIGHTS.filter((x) => x.date <= anchor).length;
  lines.push({
    icon: 'spark',
    text: `It’s early. Nocta needs about two weeks of nights before it calls anything a trend. You’re at **${sofar}**.`,
  });
  return lines;
}

function series(nights) {
  return {
    ahiSeries: nights.map((x) => x.ahi || { csa: 0, osa: 0, hyp: 0 }),
    leakSeries: nights.map((x) => x.leak),
    hoursSeries: nights.map((x) => x.hours),
    pressureSeries: nights.map((x) => x.pressure),
  };
}

function summarize({ scope, nights, anchor, days, rangeLabel }) {
  const win = averages(nights);
  const priorNights = nights.length ? NIGHTS.filter((x) => x.date < nights[0].date) : [];
  const prior = priorNights.length ? averages(priorNights) : null;
  const signal = stomachSignal(anchor);
  return {
    rangeLabel,
    xLabels: axis(nights),
    window: `${nights.length} nights`,
    ahiAvg: win.ahi == null ? '—' : win.ahi.toFixed(1),
    tiles: tiles(win, prior, nights.length),
    insights: insights(scope, nights, anchor, days),
    bestWorst: bestWorst(nights),
    patterns: signal && nights.length ? [signal] : [],
    ...series(nights),
  };
}

/* fixtureId = the night selected on Tonight (anchor); omit for "now" */
export function getTrends(fixtureId, range, custom) {
  const anchor = dateForFixture(fixtureId);
  const through = anchor === LAST_NIGHT ? '' : ` · through ${fmtShort(anchor)}`;

  if (range === 'custom' && custom) {
    const nights = nightsBetween(custom.start, custom.end);
    return summarize({
      scope: 'all',
      nights,
      anchor: nights.at(-1)?.date ?? anchor,
      days: nights.length,
      rangeLabel: `${custom.startLabel} – ${custom.endLabel} · ${nights.length} nights`,
    });
  }
  const r = RANGE_DAYS[range] ? range : '7d';
  const days = RANGE_DAYS[r];
  const nights = nightsBetween(isoMinusDays(anchor, days - 1), anchor);
  const base =
    nights.length < days ? `Past ${days} nights · ${nights.length} recorded so far` : `Past ${days} nights`;
  return summarize({
    scope: r === '7d' ? 'week' : 'all',
    nights,
    anchor,
    days,
    rangeLabel: base + through,
  });
}
