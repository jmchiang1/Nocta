/* Nocta — the night's insight, computed from the card (no AI in v1).
 *
 * Four layers, so the words can never outrun the numbers:
 *   1. context  who this is: how much history (new → calibrating, or back
 *               after a break), their usual (median of up to 30 scored nights
 *               before this one), recent stretches (7 / 14 / 21 days), and
 *               what they've told us: onboarding answers (lib/profile.js) and
 *               this night's morning check-in (lib/checkins.js). Anything
 *               missing is simply not assumed: no check-in, no wearable, no
 *               onboarding → the machine's numbers alone.
 *   2. detect   every detector looks at the night (or the stretch ending on
 *               it) and returns a finding with the exact values it used.
 *   3. choose   one finding leads, by a fixed priority: safety first (the
 *               CLAUDE.md escalation rules), then a too-short night, then
 *               equipment, breathing events, usage, coming back after a
 *               break, a better night, a steady one. Its ONE action is the
 *               action. Up to two other findings ride along as a sentence
 *               each ("Also: …"), so nothing that fired is silently dropped.
 *   4. write    templates fill the FEATURES.md insight schema. Wording knows
 *               which night it is: "last night" / "tonight" for the latest,
 *               "that night" for an older one.
 *
 * Safety rails (CLAUDE.md): no pressure advice, no condition names, hedged
 * causes, one action. Hard escalation (talk to your doctor) for: centrals
 * above 5 an hour on a night, centrals trending up or appearing, AHI above 5
 * for three weeks, repeated oxygen dips (if an oximeter is connected). The
 * card can't see sleep position or the evening before, so only what the
 * person told us is ever cited for either. */
import {
  NIGHTS,
  LAST_NIGHT,
  cardNight,
  ahiTotal,
  round1,
  addDays,
  SCORE_MIN_HOURS,
  COMPLIANCE_MIN_HOURS,
} from '../data/history.js';
import { getAnswers } from './profile.js';
import { checkinTags, isLateCheckin } from './checkins.js';
import { nightDetail, nightTrendValues } from './nightDetail.js';
import { equipmentStatus } from './equipment.js';
import { onDataset, getCard } from './dataset.js';
import { wearableNight, wearableNightsBefore } from './wearables.js';

const SOURCE = 'SD card';
const BASELINE_NIGHTS = 30;
const CALIBRATION_NIGHTS = 7; // scored nights before "your usual" means anything
const BREAK_DAYS = 14; // a gap this long and the old usual may not fit any more
const LEAK_LINE = 24; // L/min — ResMed's large-leak line
const AHI_GOAL = 5; // the common goal on CPAP: under 5 an hour
const CENTRAL_HARD = 5; // central events/hr on one night — FEATURES.md hard escalation
const SPO2_DIP_MIN = 5; // minutes under 90% that count as a dip night
const PERIODIC_MIN = 10; // minutes of a repeating rise-and-fall breathing pattern → doctor
const AT_MAX_MIN = 20; // minutes pinned at the top of the prescribed range → doctor
const FLOW_HIGH = 0.25; // flow limitation (0–1) 95th percentile worth a doctor's look
const RESP_UP = 3; // breaths/min above your usual
const BREAKS_MIN = 2; // times the mask came off and went back on
const MASK_OFF_MIN = 30; // minutes off the mask between sessions
const LATE_SHARE = 0.55; // share of events in the last third of the night
const LEAK_SHARE = 0.4; // share of events inside high-leak minutes
const RECENT_NIGHTS = 3; // a tip given on one of these isn't repeated
/* a connected wearable (Oura, Fitbit, Whoop, Withings) is supporting
 * evidence: it adds causes and soft, "worth watching" findings, and gives
 * oxygen to the many people without an oximeter. A consumer estimate never
 * raises a hard escalation on its own. */
const WEAR_SPO2_LOW = 92; // nightly average %, at or under
const WEAR_SPO2_NIGHTS = 3; // low nights in a week that make a pattern
const WEAR_HRV_DROP = 0.7; // HRV at or under this share of your usual
const WEAR_HR_UP = 8; // resting heart rate this far over your usual, bpm
const WEAR_USUAL_MIN = 5; // nights before a wearable "usual" means anything
const WEAR_GAP_H = 1.5; // asleep this much longer than the mask was on
const WEAR_LATENCY_MIN = 45; // minutes to fall asleep worth naming

/* which wearables the insights may read: connected and switched on (the
 * store sets this), best evidence first — the ones with a stage timeline */
const WEAR_ORDER = ['oura', 'fitbit', 'whoop', 'withings'];
const WEAR_NAME = { oura: 'Oura Ring', fitbit: 'Fitbit', whoop: 'Whoop', withings: 'Withings' };
let wearKeys = [];
export function setInsightWearables(keys) {
  const next = WEAR_ORDER.filter((k) => keys.includes(k));
  if (next.join() === wearKeys.join()) return false;
  wearKeys = next;
  clearInsights();
  return true;
}
const wearableFor = (date) => {
  for (const p of wearKeys) {
    const n = wearableNight(p, date);
    if (n) return { p, name: WEAR_NAME[p], n };
  }
  return null;
};
/* your usual from that wearable's earlier nights (median), or null */
function wearUsual(w, date, pickValue) {
  const vals = wearableNightsBefore(w.p, date, 14).map(pickValue).filter(Number.isFinite);
  return vals.length >= WEAR_USUAL_MIN ? median(vals) : null;
}
/* what a wearable adds to a short or broken night: how long you actually
 * slept (vs. how long the mask was on), how long it took to fall asleep,
 * and how often you woke */
function wearSleep(ctx, maskHours) {
  const w = ctx.wear;
  if (!w) return null;
  const asleep = w.n.asleepHours;
  const gap = asleep != null ? asleep - maskHours : null;
  return {
    device: w.name,
    asleep,
    gap: gap != null && gap >= WEAR_GAP_H ? gap : null,
    latency: w.n.latencyMin != null && w.n.latencyMin >= WEAR_LATENCY_MIN ? Math.round(w.n.latencyMin) : null,
    wakes: w.n.awakenings ?? null,
  };
}

/* the night's breathing events against the wearable's stage timeline:
 * how many fell in dream (REM) sleep, and how much of the night was REM */
function remShare(raw, w) {
  const phases = w?.n?.phases;
  if (!phases?.length || !w.n.start) return null;
  const events = (raw?.eventList ?? []).filter((e) => BREATHING.has(e.type));
  if (events.length < 6) return null;
  const t0 = Date.parse(`${w.n.start}:00Z`);
  const inRem = events.filter((e) => phases[Math.floor((Date.parse(`${e.at}Z`) - t0) / 3e5)] === 'rem').length;
  return { inRem, events: events.length, share: inRem / events.length, remPct: phases.filter((x) => x === 'rem').length / phases.length };
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (x) => (x == null ? '—' : round1(x).toFixed(1)); // always one decimal: 2.0, not 2
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/* ---- context ---- */

/* your recent usual, from nights before this one */
export function baselineFor(date) {
  const before = NIGHTS.filter((x) => x.date < date);
  const scored = before.filter((x) => x.ahi).slice(-BASELINE_NIGHTS);
  const used = before.filter((x) => x.hours > 0).slice(-BASELINE_NIGHTS);
  return {
    n: scored.length,
    ahi: round1(median(scored.map(ahiTotal))),
    csa: round1(median(scored.map((x) => x.ahi.csa))),
    obstructive: round1(median(scored.map((x) => x.ahi.osa + x.ahi.hyp))),
    leak: round1(median(used.filter((x) => x.leak != null).map((x) => x.leak))),
    hours: round1(median(used.map((x) => x.hours))),
    bestAhi: scored.length ? Math.min(...scored.map(ahiTotal)) : null,
  };
}

/* the calendar days ending on `date` (inclusive), as history rows */
const stretch = (date, days) => {
  const from = addDays(date, -(days - 1));
  return NIGHTS.filter((x) => x.date >= from && x.date <= date);
};

function contextFor(row) {
  const date = row.date;
  const base = baselineFor(date);
  const prevUsed = NIGHTS.filter((x) => x.date < date && x.hours > 0).at(-1);
  const gapDays = prevUsed ? Math.round((Date.parse(date) - Date.parse(prevUsed.date)) / 864e5) : null;
  const answers = getAnswers();
  const tags = checkinTags(date); // null: no check-in that morning
  return {
    date,
    latest: date === LAST_NIGHT,
    base,
    raw: cardNight(date),
    calibrating: base.n < CALIBRATION_NIGHTS,
    nightNumber: base.n + 1,
    returning: gapDays != null && gapDays > BREAK_DAYS ? gapDays : null,
    week: stretch(date, 7),
    fortnight: stretch(date, 14),
    threeWeeks: stretch(date, 21),
    month: stretch(date, 30),
    answers,
    tags,
    has: (tag) => Boolean(tags?.includes(tag)),
    // a check-in added days later is recall, not that morning: its causes
    // drop a notch, and the wording says so
    lateCheckin: Boolean(tags) && isLateCheckin(date),
    // inside the night, straight off the card (lib/nightDetail.js)
    detail: nightDetail(date),
    trend: nightTrendValues(date),
    leakSp: leakSpells(cardNight(date)),
    lateShare: lateShare(cardNight(date)),
    respUsual: round1(median(NIGHTS.filter((x) => x.date < date && x.hours > 0).slice(-BASELINE_NIGHTS).map((x) => cardNight(x.date)?.respRate?.p50).filter(Number.isFinite))),
    flowUsual: median(NIGHTS.filter((x) => x.date < date && x.hours > 0).slice(-BASELINE_NIGHTS).map((x) => flowOf(x.date)).filter(Number.isFinite)),
    settingsRecent: settingsChangedNear(date),
    maskType: getCard()?.settings?.maskType ?? null, // 'FullFace' | 'Nasal' | 'Pillows' …
    // parts past their interval, as logged today: only meaningful for the
    // latest night (an old night can't know what was due back then)
    overdue: date === LAST_NIGHT ? equipmentStatus().filter((p) => p.ageDays != null && p.ageDays > p.lifespanDays) : [],
    wear: wearableFor(date),
  };
}

const flowMemo = new Map();
const flowOf = (date) => {
  if (!flowMemo.has(date)) flowMemo.set(date, nightTrendValues(date)?.flowP95 ?? null);
  return flowMemo.get(date);
};

/* the machine's settings changed within the last few nights (the card's
 * own per-night settings): when, and how long ago */
function settingsChangedNear(date, days = 5) {
  const nights = (getCard()?.nights ?? []).filter((n) => n.settings && n.date <= date);
  const same = (a, b) => a.mode === b.mode && a.minPressure === b.minPressure && a.maxPressure === b.maxPressure && a.setPressure === b.setPressure && a.eprLevel === b.eprLevel;
  for (let i = nights.length - 1; i > 0; i--) {
    if (!same(nights[i].settings, nights[i - 1].settings)) {
      const ago = Math.round((Date.parse(date) - Date.parse(nights[i].date)) / 864e5);
      return ago <= days ? { date: nights[i].date, ago } : null;
    }
    if (Math.round((Date.parse(date) - Date.parse(nights[i].date)) / 864e5) > days) return null;
  }
  return null;
}

/* share of the night's breathing events in its last third (the early
 * morning, when dream sleep is longest); null with too few events */
function lateShare(raw) {
  const events = (raw?.eventList ?? []).filter((e) => BREATHING.has(e.type));
  const s = raw?.sessions ?? [];
  if (events.length < 8 || !s.length) return null;
  const t0 = Date.parse(`${s[0].start}Z`);
  const t1 = Date.parse(`${s.at(-1).end}Z`);
  const cut = t0 + ((t1 - t0) * 2) / 3;
  return events.filter((e) => Date.parse(`${e.at}Z`) >= cut).length / events.length;
}

/* "last night" for the latest night, "that night" for an older one. The
 * action always says "tonight": on an older night the UI labels it "That
 * morning, Nox suggested", so it reads as what was said then. */
const words = (ctx) =>
  ctx.latest
    ? { night: 'last night', Night: 'Last night', tonight: 'tonight' }
    : { night: 'that night', Night: 'That night', tonight: 'tonight' };

/* ---- inside the night: when events cluster, and what leak was doing ---- */
const BREATHING = new Set(['osa', 'csa', 'hyp', 'apnea']);
const hourOf = (at) => Number(at.slice(11, 13));
const clock = (h) => {
  const h12 = h % 12 || 12;
  return { n: h12, ap: h < 12 ? 'a.m.' : 'p.m.' };
};
const windowLabel = (fromH, toH) => {
  const a = clock(fromH);
  const b = clock(toH % 24);
  return a.ap === b.ap ? `${a.n}–${b.n} ${b.ap}` : `${a.n} ${a.ap}–${b.n} ${b.ap}`;
};

/* the 3-hour stretch with the most events, when it holds a clear share */
function peakWindow(raw) {
  const events = (raw?.eventList ?? []).filter((e) => BREATHING.has(e.type));
  if (events.length < 6) return null;
  const byHour = new Map();
  events.forEach((e) => byHour.set(hourOf(e.at), (byHour.get(hourOf(e.at)) ?? 0) + 1));
  let best = null;
  for (const h of byHour.keys()) {
    const count = [0, 1, 2].reduce((a, k) => a + (byHour.get((h + k) % 24) ?? 0), 0);
    if (!best || count > best.count) best = { from: h, count };
  }
  const share = best.count / events.length;
  return share >= 0.5 ? { label: windowLabel(best.from, best.from + 3), share, count: best.count, total: events.length } : null;
}

/* minutes above the leak line, and how many events landed in them. With no
 * per-minute series (a summary-only night) minutes is null — unknown, not 0. */
function leakSpells(raw) {
  let minutes = 0;
  let measured = false;
  const hot = new Set();
  for (const s of raw?.sessions ?? []) {
    const leak = s.series?.leak;
    if (!leak) continue;
    measured = true;
    const t0 = Date.parse(`${s.start}Z`); // wall clock, read as UTC: only differences matter
    leak.forEach((v, i) => {
      if (v > LEAK_LINE) {
        minutes += 1;
        hot.add(Math.floor((t0 + i * 6e4) / 6e4));
      }
    });
  }
  const events = (raw?.eventList ?? []).filter((e) => BREATHING.has(e.type));
  const inLeak = events.filter((e) => hot.has(Math.floor(Date.parse(`${e.at}Z`) / 6e4))).length;
  return { minutes: measured ? minutes : null, inLeak, events: events.length };
}

const dipNight = (date) => {
  const s = cardNight(date)?.spo2;
  return Boolean(s && s.minutesBelow90 != null && s.minutesBelow90 >= SPO2_DIP_MIN);
};

/* ---- detectors: each returns a finding (with its own priority) or null ---- */

const P = {
  centralNight: 100,
  centralTrend: 95,
  periodic: 93,
  oxygenPattern: 92,
  persistentHigh: 90,
  insufficient: 80,
  oxygenNight: 70,
  wearO2Pattern: 65,
  leak: 60,
  atMax: 58,
  highStretch: 55,
  events: 50,
  flowLimit: 48,
  shortStretch: 46,
  short: 45,
  breaks: 44,
  wearO2: 41,
  respUp: 40,
  wearStrain: 39,
  dryMouth: 37,
  returning: 30,
  win: 20,
  settings: 18,
  equipment: 15,
  calibrating: 12,
  steady: 10,
};

function centralNight(row) {
  if (!row.ahi || row.ahi.csa <= CENTRAL_HARD) return null;
  return { kind: 'central', priority: P.centralNight, csa: row.ahi.csa, leak: row.leak > LEAK_LINE ? row.leak : null };
}

/* centrals creeping up (or appearing) over two weeks, without any one night
 * crossing 5 — compared with the 30 scored nights before that fortnight */
function centralTrend(row, ctx) {
  const recent = ctx.fortnight.filter((x) => x.ahi);
  if (recent.length < 7) return null;
  const from = ctx.fortnight[0].date;
  const earlier = NIGHTS.filter((x) => x.date < from && x.ahi).slice(-BASELINE_NIGHTS);
  if (earlier.length < 7) return null;
  const now = median(recent.map((x) => x.ahi.csa));
  const then = median(earlier.map((x) => x.ahi.csa));
  const appearing = then < 0.5 && now >= 2;
  const rising = now >= 2 && now >= then * 1.5 && now - then >= 1;
  if (!appearing && !rising) return null;
  return { kind: 'centralTrend', priority: P.centralTrend, now: round1(now), then: round1(then), nights: recent.length, appearing };
}

/* oxygen: only when an oximeter was connected (SA2 data on the card) */
function oxygen(row, ctx) {
  const s = ctx.raw?.spo2;
  if (!s || s.avg == null) return null;
  const dips = ctx.week.filter((x) => dipNight(x.date)).length;
  if (!dipNight(row.date)) return null;
  return dips >= 2
    ? { kind: 'oxygenPattern', priority: P.oxygenPattern, minutes: s.minutesBelow90, min: s.min, dips }
    : { kind: 'oxygenNight', priority: P.oxygenNight, minutes: s.minutesBelow90, min: s.min };
}

/* AHI over the goal night after night: three weeks → doctor; one week → a
 * fix to try. Measured against the goal, not "your usual" — a high usual is
 * still high. */
function persistent(row, ctx) {
  const three = ctx.threeWeeks.filter((x) => x.ahi);
  if (three.length >= 10 && median(three.map(ahiTotal)) > AHI_GOAL) {
    return { kind: 'persistentHigh', priority: P.persistentHigh, median: round1(median(three.map(ahiTotal))), nights: three.length };
  }
  const week = ctx.week.filter((x) => x.ahi);
  if (week.length >= 4 && median(week.map(ahiTotal)) > AHI_GOAL) {
    const leaky = ctx.week.filter((x) => x.leak > LEAK_LINE).length;
    return {
      kind: 'highStretch',
      priority: P.highStretch,
      median: round1(median(week.map(ahiTotal))),
      nights: week.length,
      over: week.filter((x) => ahiTotal(x) > AHI_GOAL).length,
      leaky,
      obstructive: median(week.map((x) => x.ahi.osa + x.ahi.hyp)) >= median(week.map((x) => x.ahi.csa)),
    };
  }
  return null;
}

function notScored(row) {
  if (row.ahi) return null;
  return { kind: 'insufficient', priority: P.insufficient, hours: row.hours };
}

/* leak: a spike against your usual, or above the line most nights (a mask
 * that never seals well never looks like a "spike") */
function leak(row, ctx) {
  if (row.leak == null || row.leak <= LEAK_LINE) return null;
  const { base } = ctx;
  const leakyNights = ctx.week.filter((x) => x.leak > LEAK_LINE).length;
  const spike = base.leak == null || row.leak >= base.leak * 2;
  const chronic = leakyNights >= 4;
  if (!spike && !chronic) return null;
  return {
    kind: 'leak',
    priority: P.leak,
    leak: row.leak,
    usual: base.leak,
    chronic: chronic && !spike,
    leakyNights,
    ahi: ahiTotal(row),
    usualAhi: base.ahi,
    felt: ctx.has('mask_leak'),
    ...leakSpells(ctx.raw),
  };
}

/* breathing events up: against your usual once there is one, against the
 * goal while Nocta is still learning it */
function events(row, ctx) {
  if (!row.ahi) return null;
  const ahi = ahiTotal(row);
  const { base } = ctx;
  if (ahi < AHI_GOAL) return null;
  if (!ctx.calibrating && base.ahi != null && ahi < base.ahi * 1.8) return null;
  const obstructive = round1(row.ahi.osa + row.ahi.hyp);
  return {
    kind: 'events',
    priority: P.events,
    ahi,
    usual: ctx.calibrating ? null : base.ahi,
    ratio: !ctx.calibrating && base.ahi ? ahi / base.ahi : null,
    obstructive,
    csa: row.ahi.csa,
    mostlyObstructive: obstructive >= row.ahi.csa,
    peak: peakWindow(ctx.raw),
  };
}

/* under 4 hours always counts — it's the line insurers use, whatever your
 * usual is; most nights of the week under it is its own finding */
function usage(row, ctx) {
  if (row.hours >= COMPLIANCE_MIN_HOURS) return null;
  const used = ctx.week.filter((x) => x.hours > 0);
  const shortNights = used.filter((x) => x.hours < COMPLIANCE_MIN_HOURS).length;
  const month = ctx.month;
  const met = month.filter((x) => x.hours >= COMPLIANCE_MIN_HOURS).length;
  const common = {
    hours: row.hours,
    usual: ctx.base.hours,
    sessions: ctx.raw?.sessions?.length ?? 1,
    tookOff: ctx.has('mask_off'),
    inWindow: ctx.answers.complianceWindow === 'yes',
    met,
    monthDays: month.length,
    trouble: (ctx.answers.sleepConditions ?? []).includes('insomnia'),
  };
  return shortNights >= 4
    ? { kind: 'shortStretch', priority: P.shortStretch, shortNights, nights: used.length, ...common }
    : { kind: 'short', priority: P.short, ...common };
}

function returning(row, ctx) {
  if (!ctx.returning) return null;
  return { kind: 'returning', priority: P.returning, days: ctx.returning, ahi: ahiTotal(row), hours: row.hours };
}

/* a better night: strictly your lowest in the window, or matching it when
 * both are ~0 (so a run of 0.0 nights isn't "your best" every morning) */
function better(row, ctx) {
  const { base } = ctx;
  if (ctx.calibrating || !row.ahi || base.bestAhi == null) return null;
  const ahi = ahiTotal(row);
  if (row.hours < COMPLIANCE_MIN_HOURS || row.hours < (base.hours ?? 0) * 0.9) return null;
  const best = ahi < base.bestAhi;
  const matched = !best && ahi === base.bestAhi && ahi <= 1;
  if (!best && !matched) return null;
  return { kind: 'win', priority: P.win, ahi, usual: base.ahi, hours: row.hours, nights: base.n, matched };
}

function calibrating(row, ctx) {
  if (!ctx.calibrating || !row.ahi) return null;
  return { kind: 'calibrating', priority: P.calibrating, ahi: ahiTotal(row), hours: row.hours, n: ctx.nightNumber };
}

/* a repeating rise-and-fall breathing pattern, as the machine flags it:
 * something a doctor should see (CLAUDE.md: anything that may imply a
 * change in how breathing is controlled is escalated, never named) */
function periodic(row, ctx) {
  const m = ctx.raw?.periodicBreathingMin;
  if (m == null || m < PERIODIC_MIN) return null;
  return { kind: 'periodic', priority: P.periodic, minutes: Math.round(m) };
}

/* the machine ran at the very top of its prescribed range for a while:
 * worth the doctor's eye (Nocta never suggests a pressure) */
function atMax(row, ctx) {
  const m = ctx.detail?.atMaxMin;
  if (m == null || m < AT_MAX_MIN) return null;
  const nights = ctx.week.filter((x) => (nightDetail(x.date)?.atMaxMin ?? 0) >= AT_MAX_MIN).length;
  return { kind: 'atMax', priority: P.atMax, minutes: Math.round(m), max: ctx.detail.range?.[1] ?? null, nights };
}

/* flattened breaths: well above both a fixed line and your usual */
function flowLimit(row, ctx) {
  const v = ctx.trend?.flowP95;
  if (v == null || v < FLOW_HIGH) return null;
  if (ctx.flowUsual != null && v < ctx.flowUsual * 2) return null;
  return { kind: 'flowLimit', priority: P.flowLimit, value: v, usual: ctx.flowUsual };
}

/* a full night, but in pieces: the mask came off and went back on */
function breaks(row, ctx) {
  const d = ctx.detail;
  if (!d?.sessionCount || row.hours < COMPLIANCE_MIN_HOURS) return null; // a short night says it already
  const n = d.sessionCount - 1;
  if (n < BREAKS_MIN && d.maskOff < MASK_OFF_MIN) return null;
  return { kind: 'breaks', priority: P.breaks, breaks: n, offMin: Math.round(d.maskOff) };
}

/* breathing faster than usual all night: often a cold or a rough day; a
 * few nights running is worth mentioning */
function respUp(row, ctx) {
  const v = ctx.raw?.respRate?.p50;
  if (v == null || ctx.respUsual == null || v - ctx.respUsual < RESP_UP) return null;
  return { kind: 'respUp', priority: P.respUp, rate: v, usual: ctx.respUsual };
}

/* a dry mouth in the morning (from the check-in) */
function dryMouth(row, ctx) {
  if (!ctx.has('dry_mouth')) return null;
  return { kind: 'dryMouth', priority: P.dryMouth, nasal: /nasal|pillow/i.test(ctx.maskType ?? '') };
}

/* oxygen from a wearable (a nightly average, not an oximeter's minute-by-
 * minute dips): only when the card has no oximeter of its own. A run of
 * low nights → "talk to your doctor"; one → wear it snugly and watch */
function wearO2(row, ctx) {
  const w = ctx.wear;
  if (ctx.raw?.spo2?.avg != null || w?.n.spo2 == null || w.n.spo2 > WEAR_SPO2_LOW) return null;
  const low = [w.n, ...wearableNightsBefore(w.p, row.date, 6)].filter((n) => n.date >= addDays(row.date, -6) && n.spo2 != null && n.spo2 <= WEAR_SPO2_LOW).length;
  return low >= WEAR_SPO2_NIGHTS
    ? { kind: 'wearO2Pattern', priority: P.wearO2Pattern, spo2: w.n.spo2, low, device: w.name }
    : { kind: 'wearO2', priority: P.wearO2, spo2: w.n.spo2, usual: wearUsual(w, row.date, (n) => n.spo2), device: w.name };
}

/* the body under strain: HRV well under your usual, or resting heart rate
 * well over it (alcohol, illness, stress and a hard night all do this) */
function wearStrain(row, ctx) {
  const w = ctx.wear;
  if (!w) return null;
  const hrvUsual = wearUsual(w, row.date, (n) => n.hrv);
  const hrUsual = wearUsual(w, row.date, (n) => n.hr?.resting ?? n.hr?.low);
  const hr = w.n.hr?.resting ?? w.n.hr?.low;
  const hrvLow = w.n.hrv != null && hrvUsual != null && w.n.hrv <= hrvUsual * WEAR_HRV_DROP;
  const hrHigh = hr != null && hrUsual != null && hr >= hrUsual + WEAR_HR_UP;
  if (!hrvLow && !hrHigh) return null;
  return { kind: 'wearStrain', priority: P.wearStrain, device: w.name, hrv: hrvLow ? w.n.hrv : null, hrvUsual, hr: hrHigh ? hr : null, hrUsual };
}

function settingsChanged(row, ctx) {
  if (!ctx.settingsRecent) return null;
  return { kind: 'settings', priority: P.settings, ...ctx.settingsRecent };
}

function equipmentDue(row, ctx) {
  if (!ctx.overdue.length) return null;
  return { kind: 'equipment', priority: P.equipment, parts: ctx.overdue };
}

const DETECTORS = [
  centralNight,
  centralTrend,
  periodic,
  oxygen,
  persistent,
  notScored,
  leak,
  atMax,
  events,
  flowLimit,
  usage,
  breaks,
  respUp,
  dryMouth,
  wearO2,
  wearStrain,
  returning,
  better,
  settingsChanged,
  equipmentDue,
  calibrating,
];

/* ---- actions. Every action has a `key`, and the key must stay the same
 * for the same tip: the "Was this helpful?" ratings (InsightThumbs, the
 * insight_rated event) are grouped by it. Variants of one tip share a key
 * (refit / refitLeak / refitWeek are all 'refit').
 * Each finding offers its candidates, best-evidenced first;
 * the first one not already suggested on the last few nights is the one
 * (so a tip that didn't move the numbers makes way for the next). A
 * doctor action is never rotated away. ---- */
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const partNames = (parts) => parts.map((p) => p.name.toLowerCase()).join(' and ');

const A = {
  doctor: {
    key: 'doctor',
    short: 'talking to your doctor',
    action: 'Worth bringing up with your sleep doctor. Nocta can put your recent nights on one page.',
    category: 'consult_physician',
    effort: 'next_appointment',
  },
  doctorNext: {
    key: 'doctor_next',
    short: 'mentioning it to your doctor',
    action: 'If nights like this keep coming, bring them up with your sleep doctor at your next visit. Nocta can put them on one page.',
    category: 'consult_physician',
    effort: 'next_appointment',
  },
  checkin: {
    key: 'checkin',
    short: 'the morning check-in',
    action: 'Do the morning check-in for the next few days, so Nox can see what goes with these nights.',
    category: 'track_more_data',
    effort: 'this_week',
  },
  side: (w) => ({
    key: 'side',
    short: 'starting on your side',
    action: `Try starting on your side ${w.tonight}. Obstructive events often ease off your back.`,
    category: 'position_change',
    effort: 'tonight',
  }),
  alcohol: (w) => ({
    key: 'alcohol',
    short: 'skipping alcohol before bed',
    action: `If you can, skip alcohol in the few hours before bed ${w.tonight}. It relaxes the airway.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  meal: (w) => ({
    key: 'meal',
    short: 'an earlier dinner',
    action: `Try finishing dinner a few hours before bed ${w.tonight}. A full stomach can make breathing harder lying down.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  congestion: (w) => ({
    key: 'congestion',
    short: 'clearing your nose before bed',
    action: `If your nose is blocked, try a saline rinse or spray before bed ${w.tonight}. Air gets through more easily when it's clear.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  refit: (w) => ({
    key: 'refit',
    short: 're-fitting your mask',
    action: `Re-fit your mask before bed ${w.tonight}. Loosen the straps, then tighten them evenly until it seals without pressing hard.`,
    category: 'equipment_check',
    effort: 'tonight',
  }),
  refitLeak: (w, ls) => ({
    key: 'refit',
    short: 're-fitting your mask',
    action: `Re-fit your mask before bed ${w.tonight}. ${ls.inLeak} of the night's ${ls.events} events came while it was leaking, so a better seal may bring them down.`,
    category: 'equipment_check',
    effort: 'tonight',
  }),
  refitWeek: (w) => ({
    key: 'refit',
    short: 're-fitting your mask',
    action: `Re-fit your mask before bed ${w.tonight}. Leak has been high this week too, and a better seal often brings events down.`,
    category: 'equipment_check',
    effort: 'tonight',
  }),
  refitNew: (w) => ({
    key: 'refit_new',
    short: 'fitting the new mask',
    action: `A new mask often needs a few tries to fit. Before bed ${w.tonight}, put it on lying down and adjust it until it seals without pressing hard.`,
    category: 'equipment_check',
    effort: 'tonight',
  }),
  cushion: {
    key: 'cushion',
    short: 'checking the cushion',
    action: 'Check your cushion for wear, and replace it if it’s due. A worn cushion is the most common cause of a leak that keeps coming back.',
    category: 'equipment_check',
    effort: 'this_week',
  },
  replace: (parts) => ({
    key: 'replace',
    short: `replacing your ${partNames(parts)}`,
    action: `Your ${partNames(parts)} ${parts.length === 1 ? 'is' : 'are'} past ${parts.length === 1 ? 'its' : 'their'} replacement date. A fresh one often seals better and is more comfortable.`,
    category: 'equipment_check',
    effort: 'this_week',
  }),
  mouth: {
    key: 'mouth',
    short: 'asking about mouth breathing',
    action: 'A dry mouth with a nasal mask often suggests air escaping through your mouth. Ask your equipment provider about a chin strap or a full-face mask.',
    category: 'equipment_check',
    effort: 'this_week',
  },
  provider: {
    key: 'provider',
    short: 'having your mask size checked',
    action: 'Ask your equipment provider to check your mask size. A mask that’s a size off often leaks however it’s fitted.',
    category: 'equipment_check',
    effort: 'this_week',
  },
  settle: (c) => ({
    key: 'settle',
    short: 'giving the new settings a few nights',
    action: `Your machine's settings changed on ${shortDate(c.date)}. It often takes a few nights to settle. If it hasn't after a week, let your doctor know.`,
    category: 'track_more_data',
    effort: 'this_week',
  }),
  sleepAid: {
    key: 'sleep_aid',
    short: 'mentioning the sleep aid',
    action: 'Mention the sleep aid you logged to your doctor at your next visit. Some can relax the airway.',
    category: 'consult_physician',
    effort: 'next_appointment',
  },
  backOn: (w) => ({
    key: 'back_on',
    short: 'putting the mask straight back on',
    action: `If you wake up ${w.tonight}, put the mask straight back on. Every hour counts toward the 4.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  practice: {
    key: 'practice',
    short: 'wearing the mask awake first',
    action: 'Put the mask on for 20 minutes before bed tonight, while you read or watch something. Getting used to it awake often makes the nights longer.',
    category: 'behavioral_change',
    effort: 'tonight',
  },
  bathroom: (w) => ({
    key: 'bathroom',
    short: 'leaving the mask within reach',
    action: `If you get up ${w.tonight}, unclip the hose and leave the mask on, or set it on the pillow, so it goes straight back on when you lie down.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  comfort: {
    key: 'comfort',
    short: 'checking what makes the mask uncomfortable',
    action: 'Notice what makes you take the mask off: dryness, pressure on your face, or feeling closed in. Your equipment provider can help with each one.',
    category: 'equipment_check',
    effort: 'this_week',
  },
  caffeine: (w) => ({
    key: 'caffeine',
    short: 'cutting caffeine after 2 p.m.',
    action: `Skip caffeine after 2 p.m. ${w.tonight === 'tonight' ? 'today' : 'that day'}. It can make it harder to stay asleep with the mask on.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  windDown: (w) => ({
    key: 'wind_down',
    short: 'a slower wind-down',
    action: `Give yourself 30 quiet minutes before bed ${w.tonight}, with the mask on for the last few. A calmer start may mean fewer wake-ups.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  wearSnug: (device) => ({
    key: 'wear_snug',
    short: `wearing your ${device} snugly`,
    action: `Wear your ${device} snugly tonight, so its oxygen reading is a good one. If it reads low again, Nox will tell you.`,
    category: 'track_more_data',
    effort: 'tonight',
  }),
  easy: (w) => ({
    key: 'easy',
    short: 'an easier evening',
    action: `Go easy ${w.tonight === 'tonight' ? 'this evening' : 'that evening'}: no alcohol, an earlier dinner and a regular bedtime. It gives your body a chance to recover.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
  keep: (w) => ({
    key: 'keep',
    short: 'keeping the same routine',
    action: `Keep ${w.tonight} as close to ${w.night} as you can. Same bedtime, same setup.`,
    category: 'behavioral_change',
    effort: 'tonight',
  }),
};

/* what an obstructive-leaning night (or week) could try, in order of the
 * evidence for each: what you told us, what the machine saw, then the
 * general ones */
function eventActions(ctx, w, { obstructive = true, leakyWeek = false } = {}) {
  const ls = ctx.leakSp;
  const leakyNight = ls && ls.events >= 4 && ls.inLeak / ls.events >= LEAK_SHARE;
  const side = ctx.answers.sleepPosition === 'side';
  return [
    ctx.has('alcohol') && A.alcohol(w),
    leakyNight && A.refitLeak(w, ls),
    leakyWeek && A.refitWeek(w),
    ctx.has('mask_change') && A.refitNew(w),
    (ctx.has('congested') || ctx.has('cold_meds')) && A.congestion(w),
    ctx.has('late_meal') && A.meal(w),
    ctx.settingsRecent && A.settle(ctx.settingsRecent),
    obstructive && !side && A.side(w),
    ctx.overdue.length > 0 && A.replace(ctx.overdue),
    ctx.has('sleep_aid') && A.sleepAid,
    !ctx.tags && A.checkin,
    A.doctorNext,
  ];
}

/* the first candidate not suggested on the last few nights (a doctor
 * action always stays). Records what it chose, and what it stepped past. */
function pick(ctx, list) {
  const cands = list.filter(Boolean);
  if (!cands.length) return null;
  const fresh = cands.find((c) => c.category === 'consult_physician' && c.key === 'doctor') ??
    cands.find((c) => !ctx.recent.has(c.key)) ??
    cands[0];
  const skipped = cands.slice(0, cands.indexOf(fresh)).find((c) => ctx.recent.has(c.key));
  ctx.chosen = { key: fresh.key, skipped: skipped ? { key: skipped.key, short: skipped.short, date: ctx.recent.get(skipped.key) } : null };
  return { action: fresh.action, category: fresh.category, effort: fresh.effort };
}

/* ---- writing ---- */

const cite = (metric, value, unit, source = SOURCE) => ({ metric, value: round1(value), unit, source });

/* a short sentence for a finding that didn't lead, appended as "Also: …" */
function alsoLine(f, w) {
  switch (f.kind) {
    case 'leak':
      return `leak ran above the ${LEAK_LINE} L/min line for part of the night (95th percentile ${fmt(f.leak)}).`;
    case 'events':
      return `your AHI was ${fmt(f.ahi)}${f.usual != null ? `, against a usual ${fmt(f.usual)}` : ''}.`;
    case 'short':
    case 'shortStretch':
      return `${w.night} was ${fmt(f.hours)} hours on the mask, under the ${COMPLIANCE_MIN_HOURS} that count toward compliance.`;
    case 'highStretch':
      return `your AHI has been over ${AHI_GOAL} on ${f.over} of the last ${f.nights} nights.`;
    case 'oxygenNight':
      return `your oxygen was under 90% for about ${f.minutes} minutes.`;
    case 'returning':
      return `this was your first night back after ${f.days} days.`;
    case 'atMax':
      return `the machine spent about ${f.minutes} minutes at the top of its range.`;
    case 'flowLimit':
      return `more of your breaths than usual were flattened.`;
    case 'breaks':
      return `the mask came off ${times(f.breaks)}, about ${f.offMin} minutes in all.`;
    case 'respUp':
      return `you were breathing a little faster than usual (${fmt(f.rate)} a minute).`;
    case 'dryMouth':
      return `you logged a dry mouth this morning.`;
    case 'settings':
      return `your machine's settings changed on ${shortDate(f.date)}.`;
    case 'wearO2':
      return `your ${f.device} read your oxygen a little low (${fmt(f.spo2)}% average).`;
    case 'wearO2Pattern':
      return `your ${f.device} has read low oxygen on ${f.low} nights this week.`;
    case 'wearStrain':
      return `your ${f.device} saw your body under more strain than usual.`;
    case 'equipment':
      return `your ${partNames(f.parts)} ${f.parts.length === 1 ? 'is' : 'are'} past ${f.parts.length === 1 ? 'its' : 'their'} replacement date.`;
    default:
      return null;
  }
}

/* the cause most worth naming, from what the person told us; null if
 * they haven't told us anything that fits */
function toldCauses(ctx) {
  const out = [];
  const p = ctx.lateCheckin ? 'less_likely' : 'possible';
  const logged = ctx.lateCheckin ? 'you added later' : 'you logged';
  if (ctx.has('alcohol')) out.push({ cause: `The alcohol ${logged} for the evening before`, probability_label: p });
  if (ctx.has('late_meal')) out.push({ cause: `The late or big meal ${logged}`, probability_label: p });
  if (ctx.has('sleep_aid')) out.push({ cause: `The sleep aid ${logged}`, probability_label: p });
  if (ctx.has('congested') || ctx.has('cold_meds'))
    out.push({ cause: ctx.lateCheckin ? 'Congestion, which you added later' : 'Congestion, which you noted that morning', probability_label: p });
  return out;
}

function write(f, row, ctx) {
  const { base } = ctx;
  const w = words(ctx);
  const ahi = ahiTotal(row);
  const analyzed = base.n + (row.ahi ? 1 : 0);
  const common = {
    time_window: { nights_analyzed: analyzed, nights_matching: 1 },
    confidence: base.n >= 14 ? 'high' : base.n >= 5 ? 'medium' : 'low',
    escalation_flag: 'none',
    likely_causes: [],
    recommended_action: null,
  };
  const doctor = () => pick(ctx, [A.doctor]);
  const position = ctx.answers.sleepPosition; // 'back' | 'side' | 'stomach' | 'varies' | undefined

  switch (f.kind) {
    case 'central':
      return {
        ...common,
        card_state: 'escalation',
        headline: 'Central events ran *well above* your usual.',
        glance: {
          headline: 'Central events *jumped.*',
          detail: base.csa != null ? `${fmt(f.csa)} an hour, usually ${fmt(base.csa)}` : `${fmt(f.csa)} an hour`,
          peak_window: peakWindow(ctx.raw)?.label ?? null,
          peak_position: null,
        },
        receipts: `**${fmt(f.csa)}** central events an hour${base.csa != null ? ` · usually ${fmt(base.csa)}` : ''}`,
        observation:
          `Central events, where breathing pauses without the airway closing, ran at **${fmt(f.csa)}** an hour ${w.night}.` +
          (base.csa != null ? ` Over your last **${base.n}** nights they sat near **${fmt(base.csa)}**.` : '') +
          ` Your AHI was **${fmt(ahi)}** overall.` +
          (f.leak ? ` Leak also ran high, at **${fmt(f.leak)} L/min**.` : ''),
        likely_causes: [{ cause: 'A change in your breathing pattern your doctor should review', probability_label: 'most_likely' }],
        recommended_action: doctor(),
        escalation_flag: 'hard',
        data_citations: [cite('Central events', f.csa, 'events/hr'), cite('AHI', ahi, 'events/hr')],
      };

    case 'centralTrend':
      return {
        ...common,
        card_state: 'escalation',
        headline: f.appearing ? 'Central events have *started showing up*.' : 'Central events have been *creeping up*.',
        glance: {
          headline: f.appearing ? 'Centrals *appearing.*' : 'Centrals *rising.*',
          detail: `${fmt(f.now)} an hour lately, ${fmt(f.then)} before`,
          peak_window: null,
          peak_position: null,
        },
        receipts: `**${fmt(f.now)}** central events an hour over ${plural(f.nights, 'night')} · ${fmt(f.then)} before`,
        observation: `No single night stood out, but over the last **two weeks** central events, where breathing pauses without the airway closing, ran at a typical **${fmt(f.now)}** an hour. In the month before, they sat near **${fmt(f.then)}**. ${w.Night}'s AHI was **${fmt(ahi)}**.`,
        likely_causes: [{ cause: 'A gradual change in your breathing pattern your doctor should review', probability_label: 'most_likely' }],
        recommended_action: doctor(),
        escalation_flag: 'hard',
        confidence: f.nights >= 10 ? 'high' : 'medium',
        data_citations: [cite('Central events, last 14 days (median)', f.now, 'events/hr'), cite('Central events, before (median)', f.then, 'events/hr')],
      };

    case 'oxygenPattern':
      return {
        ...common,
        card_state: 'escalation',
        headline: 'Your oxygen *dipped* on more than one night this week.',
        glance: { headline: 'Oxygen *dipped.*', detail: `${f.dips} nights this week under 90% for 5+ min`, peak_window: null, peak_position: null },
        receipts: `**${f.minutes} min** under 90% oxygen · lowest **${f.min}%** · ${f.dips} nights this week`,
        observation: `Your oximeter showed oxygen under **90%** for about **${f.minutes} minutes** ${w.night}, dipping to **${f.min}%**. It's happened on **${f.dips}** nights this week.`,
        likely_causes: [{ cause: 'Something your doctor should look at with the full readings', probability_label: 'most_likely' }],
        recommended_action: doctor(),
        escalation_flag: 'hard',
        data_citations: [cite('Minutes under 90% SpO₂', f.minutes, 'min'), cite('Lowest SpO₂', f.min, '%')],
      };

    case 'persistentHigh':
      return {
        ...common,
        card_state: 'escalation',
        headline: `Your AHI has stayed *above ${AHI_GOAL}* for three weeks.`,
        glance: { headline: `Above ${AHI_GOAL}, *for weeks.*`, detail: `${fmt(f.median)} an hour, typical over 3 weeks`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.median)}** typical AHI over ${plural(f.nights, 'night')} · goal under ${AHI_GOAL}`,
        observation: `Over the last **three weeks**, your AHI has typically been **${fmt(f.median)}** an hour. Under **${AHI_GOAL}** is a common goal on CPAP. When it stays above that this long, even with a good mask fit, it's worth your doctor's eye. ${w.Night} was **${fmt(ahi)}**.`,
        likely_causes: [{ cause: 'Your therapy may need a look from your doctor', probability_label: 'most_likely' }],
        recommended_action: doctor(),
        escalation_flag: 'hard',
        confidence: 'high',
        data_citations: [cite('AHI, last 21 days (median)', f.median, 'events/hr'), cite('AHI', ahi, 'events/hr')],
      };

    case 'insufficient':
      return {
        ...common,
        card_state: 'insufficient_data',
        headline: `${w.Night} was *too short* to read.`,
        glance: { headline: 'Too short *to read.*', detail: `${fmt(f.hours)} hours recorded, too short to score`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.hours)} h** on the mask · under the ${SCORE_MIN_HOURS} h needed to score`,
        observation: `Your machine recorded **${fmt(f.hours)} hours** ${w.night}. Nocta needs at least **${SCORE_MIN_HOURS} hours** to read a night reliably, so there's no score this time.`,
        confidence: 'high',
        data_citations: [cite('Usage', f.hours, 'hours')],
      };

    case 'oxygenNight':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your oxygen *dipped* ${w.night}.`,
        glance: { headline: 'Oxygen *dipped.*', detail: `Under 90% for about ${f.minutes} min`, peak_window: null, peak_position: null },
        receipts: `**${f.minutes} min** under 90% oxygen · lowest **${f.min}%**`,
        observation: `Your oximeter showed oxygen under **90%** for about **${f.minutes} minutes**, dipping to **${f.min}%**. One night like this can be a loose sensor. If it comes back, it's worth your doctor's eye.`,
        likely_causes: [
          { cause: 'The oximeter slipping during the night', probability_label: 'possible' },
          { cause: 'A real dip worth watching', probability_label: 'possible' },
        ],
        recommended_action: pick(ctx, [
          {
            key: 'oximeter_snug',
            short: 'wearing the oximeter snugly',
            action: `Wear the oximeter snugly ${w.tonight}. That way Nox can tell whether it happens again.`,
            category: 'equipment_check',
            effort: 'tonight',
          },
        ]),
        escalation_flag: 'soft',
        data_citations: [cite('Minutes under 90% SpO₂', f.minutes, 'min'), cite('Lowest SpO₂', f.min, '%')],
      };

    case 'leak': {
      const overlap = f.events && f.inLeak ? ` **${f.inLeak}** of the night's **${f.events}** events came while it was that high.` : '';
      const spell = f.minutes ? ` and ran above **${LEAK_LINE}** for about **${f.minutes} minutes**` : '';
      const felt = f.felt ? ' You noted the mask felt leaky that morning, which fits.' : '';
      return {
        ...common,
        card_state: 'anomaly',
        headline: f.chronic ? `Your mask has been *leaking* most nights.` : `Your mask *leaked* more than usual ${w.night}.`,
        glance: {
          headline: f.chronic ? 'Leak, *most nights.*' : 'Mask leak *spiked.*',
          detail: f.chronic ? `Over ${LEAK_LINE} L/min on ${f.leakyNights} of 7 nights` : `${fmt(f.leak)} L/min in the leakiest stretch${f.usual != null ? `, usually ${fmt(f.usual)}` : ''}`,
          peak_window: null,
          peak_position: null,
        },
        receipts: `**${fmt(f.leak)} L/min** leak${f.minutes ? ` · above ${LEAK_LINE} for about ${f.minutes} min` : ''}${f.chronic ? ` · ${f.leakyNights} of 7 nights` : ''}`,
        observation:
          `Leak ran high ${w.night}, reaching **${fmt(f.leak)} L/min** in the leakiest stretch${spell}.${overlap}` +
          (f.chronic ? ` It's been above the line on **${f.leakyNights} of the last 7** nights.` : '') +
          (f.ahi != null ? ` Your AHI was **${fmt(f.ahi)}**${f.usualAhi != null ? `, against a usual **${fmt(f.usualAhi)}**` : ''}.` : '') +
          felt,
        likely_causes: f.chronic
          ? [
              { cause: 'A cushion that has started to wear, or a size that doesn’t quite fit', probability_label: 'most_likely' },
              { cause: 'Breathing through your mouth with a nasal mask', probability_label: 'possible' },
            ]
          : [
              { cause: 'The mask shifted or loosened during the night', probability_label: 'most_likely' },
              ...(ctx.has('congested')
                ? [
                    ctx.lateCheckin
                      ? { cause: 'Congestion, which you added later', probability_label: 'less_likely' }
                      : { cause: 'Congestion, which you noted that morning', probability_label: 'possible' },
                  ]
                : []),
              { cause: 'A cushion that has started to wear', probability_label: 'possible' },
            ],
        recommended_action: pick(ctx, [
          ctx.has('mask_change') && A.refitNew(w),
          ctx.overdue.some((p) => p.id === 'cushion') && A.replace(ctx.overdue),
          ctx.has('dry_mouth') && /nasal|pillow/i.test(ctx.maskType ?? '') && A.mouth,
          f.chronic ? A.cushion : A.refit(w),
          f.chronic ? A.refit(w) : A.cushion,
          A.provider,
        ]),
        data_citations: [cite('Leak P95', f.leak, 'L/min'), ...(f.ahi != null ? [cite('AHI', f.ahi, 'events/hr')] : [])],
      };
    }

    case 'highStretch': {
      const action = pick(ctx, eventActions(ctx, w, { obstructive: f.obstructive, leakyWeek: f.leaky >= 3 }));
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your AHI has been *above ${AHI_GOAL}* most of this week.`,
        glance: { headline: `Above ${AHI_GOAL}, *this week.*`, detail: `${f.over} of ${f.nights} nights over ${AHI_GOAL}`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.median)}** typical AHI this week · ${f.over} of ${f.nights} nights over ${AHI_GOAL}`,
        observation: `Your AHI was over **${AHI_GOAL}** on **${f.over} of the last ${f.nights}** nights, typically **${fmt(f.median)}** an hour. Under ${AHI_GOAL} is a common goal on CPAP. ${w.Night} was **${fmt(ahi)}**. If it stays like this for a few weeks, Nocta will suggest showing your doctor.`,
        likely_causes: [
          ...(f.leaky >= 3 ? [{ cause: 'Mask leak, which has been high this week too', probability_label: 'most_likely' }] : []),
          ...(f.obstructive && (position === 'back' || position === 'varies')
            ? [{ cause: 'Sleeping on your back, which you mentioned you do', probability_label: 'possible' }]
            : []),
          ...toldCauses(ctx),
        ],
        recommended_action: action,
        escalation_flag: 'soft',
        data_citations: [cite('AHI, last 7 days (median)', f.median, 'events/hr'), cite('AHI', ahi, 'events/hr')],
      };
    }

    case 'events': {
      const word = f.ratio == null ? null : f.ratio >= 3 ? 'tripled' : f.ratio >= 2 ? 'doubled' : 'rose';
      const where = f.peak ? `, most of them between ${f.peak.label}` : '';
      const told = toldCauses(ctx);
      const sideAlready = position === 'side';
      const late = ctx.lateShare != null && ctx.lateShare >= LATE_SHARE;
      const rem = remShare(ctx.raw, ctx.wear);
      const action = f.mostlyObstructive
        ? pick(ctx, eventActions(ctx, w))
        : pick(ctx, [!ctx.tags && A.checkin, A.doctorNext]);
      return {
        ...common,
        card_state: 'anomaly',
        headline: word ? `Your AHI *${word}* ${w.night}.` : `Your AHI was *above ${AHI_GOAL}* ${w.night}.`,
        glance: {
          headline: word ? `AHI *${word}.*` : `AHI *above ${AHI_GOAL}.*`,
          detail: f.usual != null ? `${fmt(f.ahi)} an hour, up from your usual ${fmt(f.usual)}` : `${fmt(f.ahi)} an hour · still learning your usual`,
          peak_window: f.peak?.label ?? null,
          peak_position: null,
        },
        receipts: `**${fmt(f.ahi)}** events an hour${f.peak ? ` · ${f.peak.label}` : ''}`,
        observation:
          `Your AHI was **${fmt(f.ahi)}** ${w.night}${where}. **${fmt(f.obstructive)}** an hour were obstructive or shallow breaths and **${fmt(f.csa)}** were central. ` +
          (f.usual != null
            ? `Your usual is about **${fmt(f.usual)}**.`
            : `Nocta is still learning your usual (night ${ctx.nightNumber} of ${CALIBRATION_NIGHTS}), so for now it compares with the common goal of under **${AHI_GOAL}**.`),
        likely_causes: f.mostlyObstructive
          ? [
              ...(ctx.leakSp?.events >= 4 && ctx.leakSp.inLeak / ctx.leakSp.events >= LEAK_SHARE
                ? [{ cause: `Mask leak: ${ctx.leakSp.inLeak} of the ${ctx.leakSp.events} events came while it was leaking`, probability_label: 'most_likely' }]
                : []),
              ...(ctx.settingsRecent ? [{ cause: `Your machine's settings changing on ${shortDate(ctx.settingsRecent.date)}`, probability_label: 'possible' }] : []),
              ...(rem && rem.share >= 0.5 && rem.share >= rem.remPct * 1.8
                ? [{ cause: `Dream (REM) sleep: ${rem.inRem} of ${rem.events} events came then, by your ${ctx.wear.name}`, probability_label: 'most_likely' }]
                : late
                  ? [{ cause: 'Dream sleep in the early-morning hours, when the airway relaxes most', probability_label: 'possible' }]
                  : []),
              ...(told.length
                ? told
                : [
                    ...(sideAlready ? [] : [{ cause: 'Sleeping on your back for part of the night', probability_label: 'possible' }]),
                    { cause: 'Alcohol or a heavy meal late in the evening', probability_label: 'possible' },
                  ]),
            ].slice(0, 3)
          : [{ cause: 'A shift in your breathing pattern worth watching', probability_label: 'possible' }],
        recommended_action: action,
        escalation_flag: f.mostlyObstructive ? 'none' : 'soft',
        confidence: ctx.calibrating ? 'low' : base.n >= 14 ? 'medium' : 'low', // the cause is a guess; the numbers aren't
        data_citations: [cite('AHI', f.ahi, 'events/hr'), cite('Obstructive + hypopnea', f.obstructive, 'events/hr')],
      };
    }

    case 'short':
    case 'shortStretch': {
      const stretchy = f.kind === 'shortStretch';
      const broke = f.sessions > 1 ? ` The mask came off **${f.sessions - 1}** ${f.sessions === 2 ? 'time' : 'times'} during the night.` : '';
      const off = f.tookOff ? ' You noted taking it off, which fits.' : '';
      const window = f.inWindow
        ? ` **${f.met} of the last ${f.monthDays}** days reached 4 hours. Insurers often look for 21 of 30.`
        : '';
      const ws = wearSleep(ctx, f.hours);
      const wearLine = ws
        ? (ws.gap ? ` Your ${ws.device} counted **${fmt(ws.asleep)} hours** asleep, so you likely slept about **${fmt(ws.gap)} hours** without the mask.` : '') +
          (ws.latency ? ` It also took you about **${ws.latency} minutes** to fall asleep.` : '')
        : '';
      return {
        ...common,
        card_state: 'anomaly',
        headline: stretchy ? 'Most nights this week were *under 4 hours*.' : 'A *short* night on the mask.',
        glance: {
          headline: stretchy ? 'Short nights, *this week.*' : 'A *short* night.',
          detail: stretchy ? `${f.shortNights} of ${f.nights} nights under 4 hours` : f.usual != null ? `${fmt(f.hours)} hours, usually ${fmt(f.usual)}` : `${fmt(f.hours)} hours on the mask`,
          peak_window: null,
          peak_position: null,
        },
        receipts: `**${fmt(f.hours)} h** on the mask${stretchy ? ` · ${f.shortNights} of ${f.nights} nights under 4 h` : f.usual != null ? ` · usually ${fmt(f.usual)} h` : ''}`,
        observation:
          `You wore the mask for **${fmt(f.hours)} hours** ${w.night}, under the **${COMPLIANCE_MIN_HOURS} hours** that count toward compliance.` +
          (stretchy ? ` That's **${f.shortNights} of the last ${f.nights}** nights.` : '') +
          broke +
          off +
          wearLine +
          window +
          (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: [
          ...(ws?.gap ? [{ cause: `Sleeping without the mask for part of the night (your ${ws.device} saw you asleep longer)`, probability_label: 'most_likely' }] : []),
          ...(ws?.latency ? [{ cause: `Taking a while to fall asleep, about ${ws.latency} minutes`, probability_label: 'possible' }] : []),
          ...(f.trouble
            ? [{ cause: 'Trouble staying asleep, which you mentioned', probability_label: 'possible' }]
            : [
                { cause: 'Waking up and leaving the mask off', probability_label: 'possible' },
                ...(stretchy ? [{ cause: 'A mask that isn’t comfortable enough to keep on', probability_label: 'possible' }] : []),
              ]),
        ].slice(0, 3),
        recommended_action: pick(ctx, [
          ws?.gap && A.backOn(w),
          ws?.latency && A.windDown(w),
          ctx.has('bathroom') && A.bathroom(w),
          ctx.has('mask_off') && A.comfort,
          ctx.has('caffeine_late') && A.caffeine(w),
          (ctx.has('stressed') || ctx.has('worked_late')) && A.windDown(w),
          stretchy && A.practice,
          A.backOn(w),
          stretchy ? A.comfort : A.practice,
        ]),
        data_citations: [
          cite('Usage', f.hours, 'hours'),
          ...(ahi != null ? [cite('AHI', ahi, 'events/hr')] : []),
          ...(ws?.gap ? [cite('Time asleep', ws.asleep, 'hours', ws.device)] : []),
        ],
      };
    }

    case 'periodic':
      return {
        ...common,
        card_state: 'escalation',
        headline: 'Your breathing ran in a *repeating pattern* for a while.',
        glance: { headline: 'A breathing *pattern.*', detail: `About ${f.minutes} min, flagged by your machine`, peak_window: null, peak_position: null },
        receipts: `**${f.minutes} min** of a repeating rise-and-fall breathing pattern`,
        observation: `Your machine flagged about **${f.minutes} minutes** ${w.night} where your breathing rose and fell in a repeating pattern. Your AHI was **${fmt(ahi)}**. This is the kind of thing your doctor wants to see with the full readings.`,
        likely_causes: [{ cause: 'A change in your breathing pattern your doctor should review', probability_label: 'most_likely' }],
        recommended_action: doctor(),
        escalation_flag: 'hard',
        data_citations: [cite('Repeating breathing pattern', f.minutes, 'min'), ...(ahi != null ? [cite('AHI', ahi, 'events/hr')] : [])],
      };

    case 'atMax':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your machine ran at the *top of its range* ${w.night}.`,
        glance: { headline: 'At the *top* of its range.', detail: `About ${f.minutes} min at ${f.max ?? 'its'} max`, peak_window: null, peak_position: null },
        receipts: `**${f.minutes} min** at the top of your prescribed range${f.nights > 1 ? ` · ${f.nights} nights this week` : ''}`,
        observation:
          `Your machine spent about **${f.minutes} minutes** at the top of your prescribed range${f.max != null ? ` (**${fmt(f.max)} cmH₂O**)` : ''} ${w.night}.` +
          (f.nights > 1 ? ` It's happened on **${f.nights}** nights this week.` : '') +
          ` That often suggests it would have gone higher if its range allowed. Only your doctor can decide whether your range is right.`,
        likely_causes: [
          { cause: 'Your airway needing more support than the range allows, for part of the night', probability_label: 'possible' },
          ...(row.leak > LEAK_LINE ? [{ cause: 'Leak, which can push the machine up too', probability_label: 'possible' }] : []),
        ],
        recommended_action: f.nights > 1 ? doctor() : pick(ctx, [row.leak > LEAK_LINE && A.refit(w), A.doctorNext]),
        escalation_flag: 'soft',
        data_citations: [cite('Minutes at the top of the range', f.minutes, 'min'), ...(f.max != null ? [cite('Range maximum', f.max, 'cmH₂O')] : [])],
      };

    case 'flowLimit':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `More of your breaths were *flattened* ${w.night}.`,
        glance: { headline: 'Flattened *breaths.*', detail: `Flow limitation ${f.value.toFixed(2)}${f.usual != null ? `, usually ${f.usual.toFixed(2)}` : ''}`, peak_window: null, peak_position: null },
        receipts: `**${f.value.toFixed(2)}** flow limitation (95th percentile)${f.usual != null ? ` · usually ${f.usual.toFixed(2)}` : ''}`,
        observation: `Your machine measures how flattened each breath is, from 0 to 1. ${w.Night} the top of that range reached **${f.value.toFixed(2)}**${f.usual != null ? `, against a usual **${f.usual.toFixed(2)}**` : ''}. Flattened breaths often mean the airway was partly narrowed, even without full events. AHI was **${fmt(ahi)}**.`,
        likely_causes: [
          { cause: 'The airway narrowing partway, often more on your back', probability_label: 'possible' },
          ...toldCauses(ctx),
        ].slice(0, 3),
        recommended_action: pick(ctx, eventActions(ctx, w)),
        escalation_flag: 'soft',
        data_citations: [cite('Flow limitation (95th percentile)', f.value, '0–1'), ...(ahi != null ? [cite('AHI', ahi, 'events/hr')] : [])],
      };

    case 'breaks':
      return {
        ...common,
        card_state: 'anomaly',
        headline: f.breaks >= BREAKS_MIN ? `The mask came off *${times(f.breaks)}* ${w.night}.` : `The mask was *off for a while* ${w.night}.`,
        glance: { headline: 'A night *in pieces.*', detail: `${plural(f.breaks, 'break')} · ${f.offMin} min off the mask`, peak_window: null, peak_position: null },
        receipts: `**${plural(f.breaks, 'break')}** · ${f.offMin} min off the mask · ${fmt(row.hours)} h on`,
        observation:
          `You reached **${fmt(row.hours)} hours** on the mask ${w.night}, but it came off **${times(f.breaks)}**, for about **${f.offMin} minutes** in all.` +
          (ctx.has('bathroom') ? ' You logged getting up for the bathroom, which fits.' : '') +
          (ctx.has('mask_off') ? ' You noted taking it off.' : '') +
          (ctx.wear?.n.awakenings != null ? ` Your ${ctx.wear.name} counted **${ctx.wear.n.awakenings}** wake-ups.` : '') +
          (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: [
          ...(ctx.has('bathroom') ? [{ cause: 'Getting up in the night, which you logged', probability_label: 'most_likely' }] : []),
          ...(ctx.has('woke_noise') ? [{ cause: 'Noise or a partner waking you, which you logged', probability_label: 'possible' }] : []),
          { cause: 'Waking up and taking the mask off half-asleep', probability_label: 'possible' },
          { cause: 'Something about the mask that’s uncomfortable at night', probability_label: 'possible' },
        ].slice(0, 3),
        recommended_action: pick(ctx, [
          ctx.has('bathroom') && A.bathroom(w),
          ctx.has('mask_off') && A.comfort,
          A.backOn(w),
          A.comfort,
          A.bathroom(w),
        ]),
        data_citations: [cite('Mask breaks', f.breaks, 'times'), cite('Time off the mask', f.offMin, 'min'), cite('Usage', row.hours, 'hours')],
      };

    case 'respUp':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `You were breathing *faster than usual* ${w.night}.`,
        glance: { headline: 'Faster *breathing.*', detail: `${fmt(f.rate)} breaths a minute, usually ${fmt(f.usual)}`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.rate)}** breaths a minute · usually ${fmt(f.usual)}`,
        observation:
          `Your breathing rate sat near **${fmt(f.rate)}** breaths a minute ${w.night}, against your usual **${fmt(f.usual)}**.` +
          (ctx.has('sick') || ctx.has('congested') ? ' You logged feeling unwell, which often does this.' : ' A cold, a hard day, or a warm room can all do this.') +
          (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: [
          ...(ctx.has('sick') || ctx.has('congested') ? [{ cause: 'Being unwell, which you logged', probability_label: 'most_likely' }] : [{ cause: 'A cold or a hard day', probability_label: 'possible' }]),
        ],
        recommended_action: pick(ctx, [
          (ctx.has('congested') || ctx.has('cold_meds')) && A.congestion(w),
          !ctx.tags && A.checkin,
          A.doctorNext,
        ]),
        confidence: 'low',
        data_citations: [cite('Breathing rate (median)', f.rate, 'breaths/min'), cite('Usual breathing rate', f.usual, 'breaths/min')],
      };

    case 'dryMouth':
      return {
        ...common,
        card_state: 'anomaly',
        headline: 'You woke up with a *dry mouth*.',
        glance: { headline: 'A *dry mouth.*', detail: 'From your morning check-in', peak_window: null, peak_position: null },
        receipts: `Dry mouth, from your check-in · leak **${fmt(row.leak)} L/min**`,
        observation:
          `You logged a dry mouth this morning.` +
          (f.nasal ? ' With a nasal mask, that often suggests air escaped through your mouth during the night.' : ' It often comes from dry air or air escaping around the mask.') +
          (row.leak != null ? ` Leak was **${fmt(row.leak)} L/min**${ctx.base.leak != null ? `, usually ${fmt(ctx.base.leak)}` : ''}.` : ''),
        likely_causes: f.nasal
          ? [{ cause: 'Breathing through your mouth with a nasal mask', probability_label: 'most_likely' }, { cause: 'Dry air from the machine', probability_label: 'possible' }]
          : [{ cause: 'Dry air from the machine', probability_label: 'possible' }, { cause: 'Air escaping around the mask', probability_label: 'possible' }],
        recommended_action: pick(ctx, [
          f.nasal && A.mouth,
          {
            key: 'humidity',
            short: 'asking about humidity',
            action: 'Ask your equipment provider how to add more moisture to the air. Most machines have a humidifier setting they can walk you through.',
            category: 'equipment_check',
            effort: 'this_week',
          },
          A.refit(w),
        ]),
        confidence: 'medium',
        data_citations: row.leak != null ? [cite('Leak P95', row.leak, 'L/min')] : [],
      };

    case 'wearO2Pattern':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your ${f.device} read *low oxygen* on several nights.`,
        glance: { headline: 'Low oxygen, *several nights.*', detail: `${f.low} nights this week at or under ${WEAR_SPO2_LOW}%`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.spo2)}%** average oxygen · ${f.low} nights this week at or under ${WEAR_SPO2_LOW}% · from your ${f.device}`,
        observation: `Your ${f.device} put your average oxygen at **${fmt(f.spo2)}%** ${w.night}, and at or under **${WEAR_SPO2_LOW}%** on **${f.low}** nights this week. A wearable's reading is an estimate, not a medical test, but a run like this is worth showing your doctor.`,
        likely_causes: [
          { cause: 'Something your doctor should look at with a proper oxygen test', probability_label: 'possible' },
          { cause: 'The wearable reading low because of fit or position', probability_label: 'possible' },
        ],
        recommended_action: doctor(),
        escalation_flag: 'soft',
        confidence: 'medium',
        data_citations: [cite('Average oxygen', f.spo2, '%', f.device), cite('Low nights this week', f.low, 'nights', f.device)],
      };

    case 'wearO2':
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your ${f.device} read your oxygen *lower than usual*.`,
        glance: { headline: 'Oxygen read *low.*', detail: `${fmt(f.spo2)}% average${f.usual != null ? `, usually ${fmt(f.usual)}%` : ''}`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.spo2)}%** average oxygen${f.usual != null ? ` · usually ${fmt(f.usual)}%` : ''} · from your ${f.device}`,
        observation: `Your ${f.device} put your average oxygen at **${fmt(f.spo2)}%** ${w.night}${f.usual != null ? `, against a usual **${fmt(f.usual)}%**` : ''}. One night like this is often the device's fit. Nox will watch for more.` + (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: [
          { cause: 'The wearable sitting loose or at an angle', probability_label: 'most_likely' },
          { cause: 'A real dip worth watching', probability_label: 'possible' },
        ],
        recommended_action: pick(ctx, [A.wearSnug(f.device), A.doctorNext]),
        confidence: 'low',
        data_citations: [cite('Average oxygen', f.spo2, '%', f.device)],
      };

    case 'wearStrain': {
      const bits = [
        f.hrv != null && `your heart-rate variability was **${fmt(f.hrv)} ms**, against a usual **${fmt(f.hrvUsual)}**`,
        f.hr != null && `your resting heart rate was **${fmt(f.hr)}**, against a usual **${fmt(f.hrUsual)}**`,
      ].filter(Boolean);
      return {
        ...common,
        card_state: 'anomaly',
        headline: `Your body seemed *under strain* ${w.night}.`,
        glance: { headline: 'Under *strain.*', detail: `From your ${f.device}`, peak_window: null, peak_position: null },
        receipts: [f.hrv != null && `**${fmt(f.hrv)} ms** HRV · usually ${fmt(f.hrvUsual)}`, f.hr != null && `**${fmt(f.hr)}** resting heart rate · usually ${fmt(f.hrUsual)}`].filter(Boolean).join(' · '),
        observation:
          `Your ${f.device} saw a harder night than usual: ${bits.join(', and ')}.` +
          (ctx.has('alcohol') ? ' You logged alcohol, which often does this.' : ctx.has('sick') || ctx.has('congested') ? ' You logged feeling unwell, which often does this.' : ' Alcohol, illness, stress or a late night can all do this.') +
          (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: [
          ...toldCauses(ctx),
          ...(ctx.has('stressed') ? [{ cause: 'The stress you logged', probability_label: 'possible' }] : []),
          { cause: 'A late night, illness or a hard day', probability_label: 'possible' },
        ].slice(0, 3),
        recommended_action: pick(ctx, [ctx.has('alcohol') && A.alcohol(w), A.easy(w), !ctx.tags && A.checkin, A.windDown(w)]),
        confidence: 'low',
        data_citations: [
          ...(f.hrv != null ? [cite('Heart-rate variability', f.hrv, 'ms', f.device)] : []),
          ...(f.hr != null ? [cite('Resting heart rate', f.hr, 'bpm', f.device)] : []),
        ],
      };
    }

    case 'settings':
      return {
        ...common,
        card_state: 'steady',
        headline: `Your machine's *settings changed* ${f.ago === 0 ? w.night : `${f.ago} ${f.ago === 1 ? 'night' : 'nights'} ago`}.`,
        glance: { headline: 'New *settings.*', detail: `Changed ${shortDate(f.date)}`, peak_window: null, peak_position: null },
        receipts: `Settings changed **${shortDate(f.date)}** · AHI **${fmt(ahi)}** · ${fmt(row.hours)} h`,
        observation: `Your machine's settings changed on **${shortDate(f.date)}**. Your AHI was **${fmt(ahi)}** across **${fmt(row.hours)} hours**${base.ahi != null ? `, against a usual **${fmt(base.ahi)}**` : ''}. It often takes a few nights for things to settle after a change.`,
        recommended_action: pick(ctx, [A.settle(f), A.checkin]),
        data_citations: [cite('AHI', ahi, 'events/hr'), cite('Usage', row.hours, 'hours')],
      };

    case 'equipment':
      return {
        ...common,
        card_state: 'steady',
        headline: `Your ${partNames(f.parts)} ${f.parts.length === 1 ? 'is' : 'are'} *due*.`,
        glance: { headline: 'Equipment *due.*', detail: `${f.parts.map((p) => p.name).join(', ')}`, peak_window: null, peak_position: null },
        receipts: f.parts.map((p) => `**${p.name}** ${p.ageDays} days · every ${p.lifespanDays}`).join(' · '),
        observation: `${w.Night} looked close to your usual, with an AHI of **${fmt(ahi)}**. Your ${f.parts.map((p) => `**${p.name.toLowerCase()}** has been in use **${p.ageDays} days**`).join(' and your ')}, past the usual replacement time.`,
        recommended_action: pick(ctx, [A.replace(f.parts)]),
        data_citations: f.parts.map((p) => cite(`${p.name} age`, p.ageDays, 'days')),
      };

    case 'returning':
      return {
        ...common,
        card_state: 'steady',
        headline: `Your *first night back* after ${f.days} days.`,
        glance: { headline: 'First night *back.*', detail: `${fmt(f.ahi)} an hour · ${fmt(f.hours)} h on the mask`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.ahi)}** events an hour · ${fmt(f.hours)} h · after a ${f.days}-day break`,
        observation: `This was your first night on the mask in **${f.days} days**. Your AHI was **${fmt(f.ahi)}** across **${fmt(f.hours)} hours**. Your usual from before the break is about **${fmt(base.ahi)}**. It can take a few nights to settle back in.`,
        confidence: 'medium',
        data_citations: [cite('AHI', f.ahi, 'events/hr'), cite('Usage', f.hours, 'hours')],
      };

    case 'win':
      return {
        ...common,
        card_state: 'win',
        headline: f.matched ? `${w.Night} *matched* your best.` : `Your *best* night in ${f.nights} nights.`,
        glance: {
          headline: f.matched ? 'Matched *your best.*' : 'Your *best* night.',
          detail: f.matched ? `${fmt(f.ahi)} an hour, your lowest` : `${fmt(f.ahi)} an hour, lowest in ${f.nights} nights`,
          peak_window: null,
          peak_position: null,
        },
        receipts: `**${fmt(f.ahi)}** events an hour · ${fmt(f.hours)} h on the mask`,
        observation: `Your AHI was **${fmt(f.ahi)}**, ${f.matched ? 'equal to' : 'the'} lowest of your last **${f.nights}** nights, and you wore the mask for **${fmt(f.hours)} hours**. Your usual is about **${fmt(f.usual)}**.`,
        recommended_action: pick(ctx, [A.keep(w)]),
        data_citations: [cite('AHI', f.ahi, 'events/hr'), cite('Usage', f.hours, 'hours')],
      };

    case 'calibrating':
      return {
        ...common,
        card_state: 'steady',
        headline: `Night ${f.n} of learning *your usual*.`,
        glance: { headline: 'Learning *your usual.*', detail: `${fmt(f.ahi)} an hour · night ${f.n} of ${CALIBRATION_NIGHTS}`, peak_window: null, peak_position: null },
        receipts: `**${fmt(f.ahi)}** events an hour · ${fmt(f.hours)} h on the mask`,
        observation: `Your AHI was **${fmt(f.ahi)}** across **${fmt(f.hours)} hours**, under the common goal of **${AHI_GOAL}**. Nocta needs about **${CALIBRATION_NIGHTS}** nights to learn what's usual for you. After that, each morning compares with your own nights.`,
        confidence: 'low',
        data_citations: [cite('AHI', f.ahi, 'events/hr'), cite('Usage', f.hours, 'hours')],
      };

    default: {
      // steady: a few phrasings (picked by date, so a night always reads the
      // same) and a line about the week, so it isn't the same card every day
      const met = ctx.week.filter((x) => x.hours >= COMPLIANCE_MIN_HOURS).length;
      const used = ctx.week.filter((x) => x.hours > 0).length;
      const pick = Number(ctx.date.slice(8)) % 3;
      const heads = ['A *usual* night for you.', `${w.Night} looked like *your usual*.`, 'Steady, *as usual*.'];
      return {
        ...common,
        card_state: 'steady',
        headline: heads[pick],
        glance: { headline: 'Your *usual* night.', detail: `${fmt(ahi)} an hour, close to your usual`, peak_window: null, peak_position: null },
        receipts: `**${fmt(ahi)}** events an hour · ${fmt(row.hours)} h on the mask`,
        observation:
          `Your AHI was **${fmt(ahi)}** across **${fmt(row.hours)} hours**, close to your usual **${fmt(base.ahi)}**.` +
          (row.leak != null ? ` Leak stayed near **${fmt(row.leak)} L/min**.` : '') +
          ` This week, **${met} of ${used}** nights on the mask reached 4 hours.`,
        data_citations: [cite('AHI', ahi, 'events/hr'), cite('Usage', row.hours, 'hours')],
      };
    }
  }
}

/* each night's insight is remembered until the data, a check-in or the
 * profile changes (data/fixtures.js › refreshInsights calls clearInsights) */
const memo = new Map();
export function clearInsights() {
  memo.clear();
  flowMemo.clear();
}
onDataset(clearInsights);

/* the night's insight. Returns null for a night without a session. Nights
 * are worked out in order, so each knows what Nox suggested on the few
 * before it, and a tip that didn't move the numbers makes way for the next
 * (nothing is stored: it's the same answer every time). */
export function insightFor(date) {
  if (memo.has(date)) return memo.get(date);
  const used = NIGHTS.filter((x) => x.hours > 0 && x.date <= date);
  for (const x of used) if (x.date !== date && !memo.has(x.date)) memo.set(x.date, compute(x.date));
  const out = compute(date);
  memo.set(date, out);
  return out;
}

function compute(date) {
  const row = NIGHTS.find((x) => x.date === date);
  if (!row || row.hours === 0) return null;
  const ctx = contextFor(row);
  // what Nox suggested on the last few nights (key → that night's date)
  ctx.recent = new Map();
  NIGHTS.filter((x) => x.hours > 0 && x.date < date && x.date >= addDays(date, -7))
    .slice(-RECENT_NIGHTS)
    .forEach((x) => {
      const k = memo.get(x.date)?.actionKey;
      if (k) ctx.recent.set(k, x.date);
    });
  ctx.chosen = null;
  const found = DETECTORS.map((d) => d(row, ctx))
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);
  const lead = found[0] ?? { kind: 'steady', priority: P.steady };
  const insight = write(lead, row, ctx);

  // what else fired rides along, a sentence each (never a second action)
  const w = words(ctx);
  const also = found
    .slice(1)
    .filter((f) => !((lead.kind === 'highStretch' || lead.kind === 'leak') && f.kind === 'events')) // the lead already gives the AHI
    .map((f) => alsoLine(f, w))
    .filter(Boolean)
    .slice(0, 2);
  if (also.length) {
    insight.observation += ` Also, ${also.join(' And ')}`;
    insight.time_window.nights_matching = found.length;
  }
  // a tip suggested lately that the night didn't bear out: say so, and why
  // this one is different
  const skipped = ctx.chosen?.skipped;
  if (skipped && insight.card_state !== 'win') {
    const when = ctx.latest && skipped.date === addDays(date, -1) ? 'Yesterday' : `On ${shortDate(skipped.date)}`;
    insight.observation += ` ${when}, Nox suggested ${skipped.short}. If that didn't seem to help, this is the next thing to try.`;
  }
  // "3–6 a.m." at the end of a sentence shouldn't end in "a.m.."
  ['headline', 'observation', 'receipts'].forEach((k) => {
    insight[k] = insight[k].replace(/\.\.(?=\s|$|\*)/g, '.');
  });
  return { insight, finding: lead, base: ctx.base, also: found.slice(1), actionKey: insight.recommended_action ? ctx.chosen?.key ?? null : null };
}
