/* Nocta — one night's view, built from the CPAP card. Every screen that shows
 * a single night (Tonight, the full night, metric pages, the coach, the
 * calendar, compare) reads FIXTURES[id], where a night's id is its date
 * ('YYYY-MM-DD', the evening it started — ResMed's sleep day).
 *
 * Built on demand from the same card night as its history.js row, so the
 * night's numbers and the multi-night views always agree. The insight comes
 * from lib/insights.js (detect → choose one action → write the FEATURES.md
 * schema). What the card can't know is left empty, never invented:
 *   bodyResponse  null — no wearable connected, so the body section hides
 *   pattern       null — journal patterns need check-ins to compare against
 *   position      not recorded by the machine, so nothing claims it
 *
 * The exports below are refreshed in place when the card changes (an
 * import), so importers stay current. */
import { NIGHTS, LAST_NIGHT, cardNight, ahiTotal, round1, toDate, addDays } from './history.js';
import { insightFor } from '../lib/insights.js';
import { onDataset } from '../lib/dataset.js';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* 'YYYY-MM-DDTHH:MM:SS' (the machine's wall clock) → '11:42 PM' */
const clockLabel = (at) => {
  const h = Number(at.slice(11, 13));
  return `${h % 12 || 12}:${at.slice(14, 16)} ${h < 12 ? 'AM' : 'PM'}`;
};
const weekday = (iso) => toDate(iso).toLocaleDateString('en-US', { weekday: 'long' });
const monthDay = (iso) => toDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
const signed = (x, unit) => {
  const r = round1(Math.abs(x));
  if (r < 0.3) return 'Close to your usual';
  return `${r} ${unit} ${x > 0 ? 'more' : 'less'} than usual`;
};

const STATE_LABEL = {
  anomaly: 'Off-baseline',
  steady: 'Steady',
  win: 'Better night',
  escalation: 'For the doctor',
  insufficient_data: 'Too short',
};

/* breathing events counted toward AHI */
const BREATHING = new Set(['osa', 'csa', 'hyp', 'apnea']);
function eventCount(raw, row) {
  if (raw?.events) return raw.events.osa + raw.events.csa + raw.events.hyp + (raw.events.apnea ?? 0);
  return row.ahi ? Math.round(ahiTotal(row) * row.hours) : 0;
}

function build(date) {
  const row = NIGHTS.find((x) => x.date === date);
  if (!row || row.hours === 0) return undefined;
  const raw = cardNight(date);
  const { insight, base } = insightFor(date);
  const sessions = raw?.sessions ?? [];
  const value = ahiTotal(row);
  const hard = insight.escalation_flag === 'hard';

  // the three numbers under the hero; a doctor-worthy central night leads
  // with centrals, since that's what the night is about
  const leakOrCentral = hard
    ? { key: 'central', label: 'Central', value: String(row.ahi.csa), unit: '/h', sub: `Usually ${base.csa ?? '—'}` }
    : row.leak == null
      ? { key: 'leak', label: 'Leak', value: '—', unit: '', sub: 'Not recorded' }
      : {
          key: 'leak',
          label: 'Leak',
          value: String(Math.round(row.leak)),
          unit: 'L/m',
          sub: base.leak == null ? '95th percentile' : `Usually about ${Math.round(base.leak)}`,
        };

  return {
    id: date,
    label: `${STATE_LABEL[insight.card_state]} · ${monthDay(date).replace(/^(\w{3})\w*/, '$1')}`,
    // the screen adds the person's first name if their sign-in gave one
    greeting: date === LAST_NIGHT ? 'Good morning' : 'Looking back',
    dayName: weekday(date),
    // nights on the machine, not calendar days since the first one
    dateLabel: `${monthDay(date)} · Night ${row.used}`,
    dayState: insight.card_state === 'insufficient_data' ? 'low' : hard ? 'escalation' : 'logged',
    session: {
      start: sessions.length ? clockLabel(sessions[0].start) : '—',
      end: sessions.length ? clockLabel(sessions.at(-1).end) : '—',
      durationHours: row.hours,
    },
    ahi: {
      value,
      avgSoFar: base.ahi ?? value,
      delta: value != null && base.ahi != null ? round1(Math.abs(value - base.ahi)) : null,
      dir: value == null || base.ahi == null || Math.abs(value - base.ahi) < 0.3 ? 'flat' : value > base.ahi ? 'up' : 'down',
    },
    secondary: [
      leakOrCentral,
      {
        key: 'pressure',
        label: 'Pressure',
        value: row.pressure == null ? '—' : row.pressure.toFixed(1),
        unit: row.pressure == null ? '' : 'cmH₂O',
        sub: raw?.pressure?.max != null ? `Median · peaked at ${round1(raw.pressure.max)}` : 'Median',
      },
      {
        key: 'hours',
        label: 'Hours',
        value: row.hours.toFixed(1),
        unit: 'h',
        sub: !row.ahi ? 'Under the 2 h needed' : base.hours == null ? 'On the mask' : signed(row.hours - base.hours, 'h'),
      },
    ],
    insight,
    timeline: { eventCount: eventCount(raw, row), events: [], journal: [], stages: null },
    pattern: null,
    bodyResponse: null,
  };
}

/* ---- FIXTURES: every night with a session, built when first read ---- */
const cache = new Map();
const used = new Set();
const fixture = (date) => {
  if (!used.has(date)) return undefined;
  if (!cache.has(date)) cache.set(date, build(date));
  return cache.get(date);
};
export const FIXTURES = new Proxy(
  {},
  {
    get: (_, key) => (typeof key === 'string' ? fixture(key) : undefined),
    has: (_, key) => used.has(key),
    ownKeys: () => [...used],
    getOwnPropertyDescriptor: (_, key) =>
      used.has(key) ? { enumerable: true, configurable: true, value: fixture(key) } : undefined,
  }
);

/* ---- episodes: the night's longest events, for the full-night list ---- */
// unclassified apneas are their own kind, not obstructive
const TYPE_LABEL = { osa: 'OSA', apnea: 'Apnea', csa: 'CSA', hyp: 'Hypopnea' };
const MAX_EPISODES = 8;

/* mask pressure (per-minute average) in the minute an event started, and the
 * highest of the next 3 minutes' averages. Said as what happened, not as the
 * machine "responding": AutoSet doesn't raise pressure for central apneas,
 * so a rise after one is usually about something else. */
function pressureAround(raw, at) {
  const t = Date.parse(`${at}Z`);
  for (const s of raw.sessions ?? []) {
    const p = s.series?.pressure;
    if (!p) continue;
    const i = Math.floor((t - Date.parse(`${s.start}Z`)) / 6e4);
    if (i >= 0 && i < p.length) {
      const after = Math.max(...p.slice(i, i + 4));
      return { at: p[i], after };
    }
  }
  return null;
}

function episodes(date) {
  const raw = cardNight(date);
  const events = (raw?.eventList ?? []).filter((e) => BREATHING.has(e.type));
  return [...events]
    .sort((a, b) => b.durSec - a.durSec)
    .slice(0, MAX_EPISODES)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => {
      const p = pressureAround(raw, e.at);
      return {
        type: TYPE_LABEL[e.type],
        time: clockLabel(e.at),
        dur: e.durSec,
        pressure: p ? `${round1(p.at).toFixed(1)} cmH₂O` : '—',
        response: !p
          ? '—'
          : p.after - p.at >= 0.3
            ? `Rose to ${round1(p.after).toFixed(1)} cmH₂O`
            : `Stayed near ${round1(p.at).toFixed(1)} cmH₂O`,
        position: null,
      };
    });
}
const episodeCache = new Map();
export const EPISODES = new Proxy(
  {},
  {
    get: (_, key) => {
      if (typeof key !== 'string' || !used.has(key)) return undefined;
      if (!episodeCache.has(key)) episodeCache.set(key, episodes(key));
      return episodeCache.get(key);
    },
  }
);

/* ---- the week strip and its windows ---- */

/* `days` calendar days ending on `end`, each a night or a no-session day */
export function nightsEnding(end, days) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(end, i - days + 1);
    return {
      date,
      day: DAY_SHORT[toDate(date).getDay()],
      fixtureId: used.has(date) ? date : null,
      state: 'missed',
    };
  });
}

/* the window that shows `date`: the latest one if it's in there, otherwise
 * the stretch around it (so picking an old night in the calendar still
 * lights it up on the strip) */
export function stripAround(date, days) {
  const anchor = date && date < addDays(LAST_NIGHT, -(days - 1)) ? addDays(date, Math.floor(days / 2)) : LAST_NIGHT;
  return nightsEnding(anchor > LAST_NIGHT ? LAST_NIGHT : anchor, days);
}

/* the last 7 days (the mobile week strip's default) */
export const WEEK = [];

/* nights worth jumping to from the DevPanel: last night, then the most
 * recent night of each kind */
export const FIXTURE_ORDER = [];
export let DEFAULT_FIXTURE = null;
/* a recent off-baseline night with a clear action — the onboarding preview
 * ("Tomorrow morning") and compare's default contrast */
export let EXAMPLE_FIXTURE = null;

/* what the person told us changed (a check-in, an onboarding answer): the
 * insights read it, so rebuild nights on next read */
export function refreshInsights() {
  cache.clear();
}

onDataset(() => {
  cache.clear();
  episodeCache.clear();
  used.clear();
  NIGHTS.forEach((x) => x.hours > 0 && used.add(x.date));

  WEEK.length = 0;
  WEEK.push(...nightsEnding(LAST_NIGHT, 7));

  const recent = [...used].sort().reverse();
  const order = [LAST_NIGHT];
  ['escalation', 'anomaly', 'win', 'steady', 'insufficient_data'].forEach((state) => {
    const d = recent.find((x) => !order.includes(x) && fixture(x)?.insight.card_state === state);
    if (d) order.push(d);
  });
  FIXTURE_ORDER.length = 0;
  FIXTURE_ORDER.push(...order);

  // open on last night: the most recent night with a session (what someone
  // checking each morning expects; the strip pins it on the right)
  DEFAULT_FIXTURE = recent[0] ?? LAST_NIGHT;
  EXAMPLE_FIXTURE =
    recent.find((x) => {
      const i = fixture(x)?.insight;
      // a night with a concrete fix (mask fit, position), not just a short one
      return (
        i?.card_state === 'anomaly' &&
        i.escalation_flag === 'none' &&
        ['equipment_check', 'position_change'].includes(i.recommended_action?.category)
      );
    }) ?? LAST_NIGHT;
});
