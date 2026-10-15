/* Nocta — the user's therapy history, from the CPAP card (lib/dataset.js).
 * THE single source of truth for every number that spans more than one
 * night: Trends charts + tiles, compliance, the calendar, the journal's AHI
 * column, profile stats. Each night's own view (fixtures.js) agrees with its
 * row here because both come from the same card night.
 *
 * One row per calendar day of the current therapy run, first night → last:
 *   n         night number in the run (1 = first night)
 *   date      'YYYY-MM-DD' — the evening the night started (ResMed's sleep day)
 *   fixture   the night's id for its detail view (= date), absent on no-use days
 *   ahi       { csa, osa, hyp } events/hr (unclassified apneas count as
 *             obstructive), or null when under SCORE_MIN_HOURS (not scored)
 *   hours     mask-on time, rounded to 0.1 (0 = no session)
 *   rawHours  mask-on time unrounded — what the 4-hour compliance test uses,
 *             so 3.95 h doesn't round up into a compliant night
 *   used      nights with a session so far, this one included (the "Night N"
 *             people see counts nights on the machine, not calendar days)
 *   leak      95th-percentile leak, L/min (null when not recorded)
 *   pressure  median pressure, cmH₂O
 *   position  always null: the machine doesn't know how you slept
 *
 * The run starts after the last gap of more than RUN_GAP_DAYS without a
 * session, so a card that also holds an old stretch (a previous machine, a
 * long break) reads as the therapy you're on now.
 *
 * Exports are live: NIGHTS is refilled in place and the `let` exports are
 * reassigned when the card changes (an import), so importers stay current. */
import { onDataset } from '../lib/dataset.js';

export const COMPLIANCE_MIN_HOURS = 4;
export const SCORE_MIN_HOURS = 2;
const RUN_GAP_DAYS = 60;

export const NIGHTS = [];
export let THERAPY_START = null;
export let LAST_NIGHT = null;
export let NIGHTS_ON_THERAPY = 0; // calendar days in the run (first night → last)
export let NIGHTS_USED = 0; // nights with a session — what "nights on therapy" means to a person

/* the raw card night for a date (sessions, per-minute series, events) */
const CARD_BY_DATE = new Map();
export const cardNight = (date) => CARD_BY_DATE.get(date) ?? null;

/* ---- date helpers ---- */
/* 'YYYY-MM-DD' → Date at local midnight (no timezone day-shift) */
export const toDate = (iso) => new Date(`${iso}T00:00:00`);
export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (iso, days) => {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return isoOf(d);
};
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
export const fmtShort = (iso) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtDayShort = (iso) =>
  toDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

function rebuild(card) {
  CARD_BY_DATE.clear();
  card.nights.forEach((x) => CARD_BY_DATE.set(x.date, x));

  const used = card.nights.filter((x) => x.hours > 0).map((x) => x.date).sort();
  let start = used[0];
  for (let i = 1; i < used.length; i += 1) {
    if (daysBetween(used[i - 1], used[i]) > RUN_GAP_DAYS) start = used[i];
  }
  const last = used.at(-1);

  NIGHTS.length = 0;
  if (!start) {
    THERAPY_START = LAST_NIGHT = null;
    NIGHTS_ON_THERAPY = NIGHTS_USED = 0;
    return;
  }
  let usedSoFar = 0;
  for (let date = start, n = 1; date <= last; date = addDays(date, 1), n += 1) {
    const x = CARD_BY_DATE.get(date);
    const hours = x?.hours > 0 ? round1(x.hours) : 0;
    if (hours > 0) usedSoFar += 1;
    NIGHTS.push({
      n,
      used: usedSoFar,
      rawHours: x?.hours > 0 ? x.hours : 0,
      date,
      ...(hours > 0 ? { fixture: date } : {}),
      ahi:
        hours >= SCORE_MIN_HOURS && x.ahi
          ? {
              csa: round1(x.ahi.csa),
              osa: round1(x.ahi.osa + (x.ahi.apnea ?? 0)),
              hyp: round1(x.ahi.hyp),
            }
          : null,
      hours,
      leak: hours > 0 && x.leak?.p95 != null ? round1(x.leak.p95) : null,
      pressure: hours > 0 && x.pressure?.p50 != null ? round1(x.pressure.p50) : null,
      position: null,
    });
  }
  THERAPY_START = start;
  LAST_NIGHT = last;
  NIGHTS_ON_THERAPY = NIGHTS.length;
  NIGHTS_USED = usedSoFar;
}
onDataset(rebuild);

/* the date a night's detail view describes: its id is its date. Anything
 * else (no night selected, an old id) means the real last night. */
export const dateForFixture = (fixtureId) =>
  (fixtureId && NIGHTS.some((x) => x.date === fixtureId) && fixtureId) || LAST_NIGHT;

/* ---- derived helpers ---- */
export const ahiTotal = (night) =>
  night.ahi ? +(night.ahi.csa + night.ahi.osa + night.ahi.hyp).toFixed(1) : null;
export const metCompliance = (night) => (night.rawHours ?? night.hours) >= COMPLIANCE_MIN_HOURS;

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/* average over the nights that have a value (unscored / no-session skipped) */
export function averages(nights) {
  const scored = nights.filter((x) => x.ahi);
  const used = nights.filter((x) => x.hours > 0);
  return {
    ahi: round1(avg(scored.map(ahiTotal))),
    leak: round1(avg(nights.filter((x) => x.leak != null).map((x) => x.leak))),
    hours: round1(avg(used.map((x) => x.hours))),
    pressure: round1(avg(nights.filter((x) => x.pressure != null).map((x) => x.pressure))),
    scored: scored.length,
    used: used.length,
  };
}

export function nightsBetween(startIso, endIso) {
  return NIGHTS.filter((x) => x.date >= startIso && x.date <= endIso);
}
