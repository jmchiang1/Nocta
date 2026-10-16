/* Nocta — what the full night's extra charts need, read straight off the card
 * (data/history.js › cardNight), nothing reshaped:
 *   - mask sessions: each time the mask went on and came off, on the clock
 *   - the night's prescribed range (its own STR row, else the latest before)
 *   - the set pressure's spread over the night (for time at each pressure)
 *   - large-leak minutes (2 s samples above ResMed's 24 L/min line)
 * Plain data only: nothing here judges a number or suggests a setting
 * (CLAUDE.md safety rails). */
import { cardNight, dateForFixture } from '../data/history.js';
import { getCard } from './dataset.js';

const ms = (at) => Date.parse(`${at}Z`); // wall clock read as UTC: only differences matter
const wallMin = (at) => {
  const d = new Date(ms(at));
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
};

/* 234 → "3h 54m", 16 → "16 min" */
export function duration(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/* the settings in force that night: the night's own STR row, else the last
 * night before it that had one, else the card's current settings */
function settingsFor(date) {
  const own = cardNight(date)?.settings;
  if (own) return { ...own, inferred: false };
  const nights = getCard()?.nights ?? [];
  for (let i = nights.length - 1; i >= 0; i--) {
    if (nights[i].date < date && nights[i].settings) return { ...nights[i].settings, inferred: true };
  }
  const current = getCard()?.settings;
  return current ? { ...current, eprLevel: current.epr?.on ? current.epr.level : current.epr ? 0 : null, inferred: true } : null;
}

export function nightDetail(fixtureId) {
  const date = dateForFixture(fixtureId);
  const night = cardNight(date);
  if (!night) return null;

  // ---- mask sessions, as clock minutes from the first one's start ----
  const sessions = (night.sessions ?? []).filter((s) => s.start && s.end).sort((a, b) => a.start.localeCompare(b.start));
  const origin = sessions.length ? wallMin(sessions[0].start) : 0;
  const t0 = sessions.length ? ms(sessions[0].start) : 0;
  const spans = sessions.map((s) => ({
    from: origin + (ms(s.start) - t0) / 6e4,
    to: origin + (ms(s.end) - t0) / 6e4,
  }));
  let maskOff = 0;
  for (let i = 1; i < spans.length; i++) maskOff += Math.max(0, spans[i].from - spans[i - 1].to);

  // ---- the prescription ----
  const settings = settingsFor(date);
  const fixed = settings?.mode === 'CPAP';
  const range = !settings
    ? null
    : fixed
      ? settings.setPressure != null
        ? [settings.setPressure, settings.setPressure]
        : null
      : settings.minPressure != null && settings.maxPressure != null
        ? [settings.minPressure, settings.maxPressure]
        : null;

  // ---- time at the maximum, from the set pressure's spread ----
  const hist = night.pressure?.targetHist ?? null;
  let atMaxMin = null;
  if (hist && !fixed && settings?.maxPressure != null) {
    const ceiling = Math.round(settings.maxPressure / hist.step) - 1; // within 0.1: the machine's rounding
    atMaxMin = (hist.counts.reduce((n, c, i) => (hist.from + i >= ceiling ? n + c : n), 0) * hist.sampleSec) / 60;
  }

  return {
    date,
    detailed: night.source === 'datalog',
    spans,
    sessionCount: spans.length,
    maskOff,
    mode: settings?.mode ?? null,
    range,
    rangeInferred: !!settings?.inferred,
    eprLevel: settings?.eprLevel ?? null,
    hist,
    atMaxMin,
    largeLeakMin: night.leak?.largeMinutes ?? null,
  };
}

/* ---- one value per night, for the Trends charts (data/trends.js) ---- */
function nearestRank(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
}

/* null where the card doesn't have it for that night (summary-only nights
 * have no flow limitation, large-leak minutes or set-pressure spread) */
export function nightTrendValues(date) {
  const night = cardNight(date);
  if (!night || !(night.hours > 0)) return null;
  const d = nightDetail(date);
  const flow = (night.sessions ?? []).flatMap((s) => s.series?.flowLimit ?? []);
  return {
    atMaxMin: d.atMaxMin,
    maskOffMin: d.sessionCount ? d.maskOff : null,
    breaks: d.sessionCount ? d.sessionCount - 1 : null, // times the mask came off and went back on
    largeLeakMin: night.leak?.largeMinutes ?? null,
    flowP95: flow.length ? nearestRank(flow, 0.95) : null,
  };
}

/* the prescription changes inside a run of nights, for the trend charts'
 * markers: [{ index, label }]. Only nights with their own settings count
 * (a night without a row isn't a change); compared with the last night
 * before it that had them. */
const rxText = (s) =>
  s.mode === 'CPAP' ? (s.setPressure != null ? `${s.setPressure}` : null) : s.minPressure != null ? `${s.minPressure}–${s.maxPressure}` : null;
export function settingsChanges(dates) {
  if (!dates.length) return [];
  const nights = getCard()?.nights ?? [];
  let prev = null;
  for (const n of nights) {
    if (n.date >= dates[0]) break;
    if (n.settings) prev = n.settings;
  }
  const out = [];
  dates.forEach((date, index) => {
    const s = cardNight(date)?.settings;
    if (!s) return;
    if (prev) {
      const parts = [];
      if (s.mode !== prev.mode) parts.push(`Mode ${prev.mode ?? '—'} → ${s.mode ?? '—'}`);
      const a = rxText(prev);
      const b = rxText(s);
      if (a !== b) parts.push(`Range ${a ?? '—'} → ${b ?? '—'} cmH₂O`);
      if (s.eprLevel !== prev.eprLevel) parts.push(`Exhale relief ${prev.eprLevel ?? '—'} → ${s.eprLevel ?? '—'}`);
      if (parts.length) out.push({ index, label: parts.join(' · ') });
    }
    prev = s;
  });
  return out;
}
