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
import { checkinTags } from './checkins.js';

const SOURCE = 'SD card';
const BASELINE_NIGHTS = 30;
const CALIBRATION_NIGHTS = 7; // scored nights before "your usual" means anything
const BREAK_DAYS = 14; // a gap this long and the old usual may not fit any more
const LEAK_LINE = 24; // L/min — ResMed's large-leak line
const AHI_GOAL = 5; // the common goal on CPAP: under 5 an hour
const CENTRAL_HARD = 5; // central events/hr on one night — FEATURES.md hard escalation
const SPO2_DIP_MIN = 5; // minutes under 90% that count as a dip night

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const fmt = (x) => (x == null ? '—' : round1(x).toFixed(1)); // always one decimal: 2.0, not 2
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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
  };
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
  oxygenPattern: 92,
  persistentHigh: 90,
  insufficient: 80,
  oxygenNight: 70,
  leak: 60,
  highStretch: 55,
  events: 50,
  shortStretch: 46,
  short: 45,
  returning: 30,
  win: 20,
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

const DETECTORS = [centralNight, centralTrend, oxygen, persistent, notScored, leak, events, usage, returning, better, calibrating];

/* ---- writing ---- */

const cite = (metric, value, unit) => ({ metric, value: round1(value), unit, source: SOURCE });

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
    default:
      return null;
  }
}

/* the cause most worth naming, from what the person told us; null if
 * they haven't told us anything that fits */
function toldCauses(ctx) {
  const out = [];
  if (ctx.has('alcohol')) out.push({ cause: 'The alcohol you logged the evening before', probability_label: 'possible' });
  if (ctx.has('late_meal')) out.push({ cause: 'The late or big meal you logged', probability_label: 'possible' });
  if (ctx.has('sleep_aid')) out.push({ cause: 'The sleep aid you logged', probability_label: 'possible' });
  if (ctx.has('congested') || ctx.has('cold_meds')) out.push({ cause: 'Congestion, which you noted that morning', probability_label: 'possible' });
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
  const doctor = {
    action: 'Worth bringing up with your sleep doctor. Nocta can put your recent nights on one page.',
    category: 'consult_physician',
    effort: 'next_appointment',
  };
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
        recommended_action: doctor,
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
        recommended_action: doctor,
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
        recommended_action: doctor,
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
        recommended_action: doctor,
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
        recommended_action: {
          action: `Wear the oximeter snugly ${w.tonight}. That way Nox can tell whether it happens again.`,
          category: 'equipment_check',
          effort: 'tonight',
        },
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
              ...(ctx.has('congested') ? [{ cause: 'Congestion, which you noted that morning', probability_label: 'possible' }] : []),
              { cause: 'A cushion that has started to wear', probability_label: 'possible' },
            ],
        recommended_action: f.chronic
          ? {
              action: 'Check your cushion for wear, and replace it if it’s due. A worn cushion is the most common cause of a leak that keeps coming back.',
              category: 'equipment_check',
              effort: 'this_week',
            }
          : {
              action: `Re-fit your mask before bed ${w.tonight}. Loosen the straps, then tighten them evenly until it seals without pressing hard.`,
              category: 'equipment_check',
              effort: 'tonight',
            },
        data_citations: [cite('Leak P95', f.leak, 'L/min'), ...(f.ahi != null ? [cite('AHI', f.ahi, 'events/hr')] : [])],
      };
    }

    case 'highStretch': {
      const action = f.leaky >= 3
        ? { action: `Re-fit your mask before bed ${w.tonight}. Leak has been high this week too, and a better seal often brings events down.`, category: 'equipment_check', effort: 'tonight' }
        : f.obstructive && position !== 'side'
          ? { action: `Try starting on your side ${w.tonight}. Obstructive events often ease off your back.`, category: 'position_change', effort: 'tonight' }
          : { action: 'Do the morning check-in for the next few days, so Nox can see what goes with these nights.', category: 'track_more_data', effort: 'this_week' };
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
      const action = f.mostlyObstructive
        ? ctx.has('alcohol')
          ? { action: `If you can, skip alcohol in the few hours before bed ${w.tonight}. It relaxes the airway.`, category: 'behavioral_change', effort: 'tonight' }
          : !sideAlready
            ? { action: `Try starting on your side ${w.tonight}. Obstructive events often ease off your back.`, category: 'position_change', effort: 'tonight' }
            : { action: 'Do the morning check-in tomorrow, so Nox can see what goes with nights like this.', category: 'track_more_data', effort: 'tonight' }
        : { action: 'Do the morning check-in for the next few days, so Nox can see what goes with these nights.', category: 'track_more_data', effort: 'this_week' };
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
          ? told.length
            ? told
            : [
                ...(sideAlready ? [] : [{ cause: 'Sleeping on your back for part of the night', probability_label: 'possible' }]),
                { cause: 'Alcohol or a heavy meal late in the evening', probability_label: 'possible' },
              ]
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
          window +
          (ahi != null ? ` Your AHI was **${fmt(ahi)}**.` : ''),
        likely_causes: f.trouble
          ? [{ cause: 'Trouble staying asleep, which you mentioned', probability_label: 'possible' }]
          : [
              { cause: 'Waking up and leaving the mask off', probability_label: 'possible' },
              ...(stretchy ? [{ cause: 'A mask that isn’t comfortable enough to keep on', probability_label: 'possible' }] : []),
            ],
        recommended_action: stretchy
          ? {
              action: 'Put the mask on for 20 minutes before bed tonight, while you read or watch something. Getting used to it awake often makes the nights longer.',
              category: 'behavioral_change',
              effort: 'tonight',
            }
          : {
              action: `If you wake up ${w.tonight}, put the mask straight back on. Every hour counts toward the 4.`,
              category: 'behavioral_change',
              effort: 'tonight',
            },
        data_citations: [cite('Usage', f.hours, 'hours'), ...(ahi != null ? [cite('AHI', ahi, 'events/hr')] : [])],
      };
    }

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
        recommended_action: {
          action: `Keep ${w.tonight} as close to ${w.night} as you can. Same bedtime, same setup.`,
          category: 'behavioral_change',
          effort: 'tonight',
        },
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

/* the night's insight. Returns null for a night without a session. */
export function insightFor(date) {
  const row = NIGHTS.find((x) => x.date === date);
  if (!row || row.hours === 0) return null;
  const ctx = contextFor(row);
  const found = DETECTORS.map((d) => d(row, ctx))
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);
  const lead = found[0] ?? { kind: 'steady', priority: P.steady };
  const insight = write(lead, row, ctx);

  // what else fired rides along, a sentence each (never a second action)
  const w = words(ctx);
  const also = found
    .slice(1)
    .filter((f) => !(lead.kind === 'highStretch' && f.kind === 'events')) // the stretch already says it
    .map((f) => alsoLine(f, w))
    .filter(Boolean)
    .slice(0, 2);
  if (also.length) {
    insight.observation += ` Also, ${also.join(' And ')}`;
    insight.time_window.nights_matching = found.length;
  }
  // "3–6 a.m." at the end of a sentence shouldn't end in "a.m.."
  ['headline', 'observation', 'receipts'].forEach((k) => {
    insight[k] = insight[k].replace(/\.\.(?=\s|$|\*)/g, '.');
  });
  return { insight, finding: lead, base: ctx.base, also: found.slice(1) };
}
