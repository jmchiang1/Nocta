/* Nocta — the user's therapy history. THE single source of truth for every
 * number that spans more than one night: Trends charts + tiles, compliance,
 * the journal's AHI column, profile stats. Per-night fixtures (fixtures.js)
 * must agree with the matching row here.
 *
 * Story: CPAP + Nocta started Wed Sep 30, 2026. "Last night" is Sat Oct 10,
 * night 11. All equipment is original (11 days old). This week: Wednesday's
 * session was only 1.7 h (too short to score), and there was no session
 * Thursday or Friday.
 *
 * ahi = { csa, osa, hyp } events/hr (central, obstructive, hypopnea; total =
 * the night's AHI), or null when the night wasn't scored. Central averages
 * 1.2/hr over nights 1–6 — the "usual" the escalation night is measured
 * against. hours = mask-on time (0 = no session). leak = P95 L/min.
 * pressure = median cmH₂O. */

export const THERAPY_START = '2026-09-30';
export const LAST_NIGHT = '2026-10-10';
export const COMPLIANCE_MIN_HOURS = 4;
export const SCORE_MIN_HOURS = 2;

export const NIGHTS = [
  { n: 1, date: '2026-09-30', ahi: { csa: 1.2, osa: 2.9, hyp: 1.5 }, hours: 4.6, leak: 14, pressure: 5.9, position: 'stomach' },
  { n: 2, date: '2026-10-01', ahi: { csa: 1.1, osa: 1.3, hyp: 1.0 }, hours: 5.4, leak: 12, pressure: 5.7, position: 'side' },
  { n: 3, date: '2026-10-02', ahi: { csa: 1.3, osa: 1.3, hyp: 1.0 }, hours: 5.9, leak: 11, pressure: 5.8, position: 'side' },
  { n: 4, date: '2026-10-03', ahi: { csa: 1.2, osa: 2.3, hyp: 1.3 }, hours: 6.3, leak: 13, pressure: 5.9, position: 'stomach' },
  // Sun — fixture "steady"
  { n: 5, date: '2026-10-04', fixture: 'steady', ahi: { csa: 1.1, osa: 1.2, hyp: 0.9 }, hours: 7.1, leak: 9, pressure: 7.0, position: 'side' },
  // Mon — fixture "win"
  { n: 6, date: '2026-10-05', fixture: 'win', ahi: { csa: 1.1, osa: 0.5, hyp: 0.5 }, hours: 7.6, leak: 7, pressure: 6.8, position: 'side' },
  // Tue — fixture "escalation" (central index 6.8)
  { n: 7, date: '2026-10-06', fixture: 'escalation', ahi: { csa: 6.8, osa: 1.4, hyp: 1.2 }, hours: 6.4, leak: 10, pressure: 6.1, position: 'back' },
  // Wed — fixture "insufficient" (1.7 h, unscored)
  { n: 8, date: '2026-10-07', fixture: 'insufficient', ahi: null, hours: 1.7, leak: null, pressure: 5.8, position: null },
  // Thu, Fri — no session
  { n: 9, date: '2026-10-08', ahi: null, hours: 0, leak: null, pressure: null, position: null },
  { n: 10, date: '2026-10-09', ahi: null, hours: 0, leak: null, pressure: null, position: null },
  // Sat — fixture "anomaly" (65 events over 6.2 h; 52 obstructive)
  { n: 11, date: '2026-10-10', fixture: 'anomaly', ahi: { csa: 0.6, osa: 8.4, hyp: 1.5 }, hours: 6.2, leak: 32, pressure: 5.6, position: 'stomach' },
];

export const NIGHTS_ON_THERAPY = NIGHTS.length;

/* the date a night-detail fixture describes (falls back to last night) */
export const dateForFixture = (fixtureId) =>
  NIGHTS.find((x) => x.fixture === fixtureId)?.date ?? LAST_NIGHT;

/* ---- derived helpers ---- */
export const ahiTotal = (night) =>
  night.ahi ? +(night.ahi.csa + night.ahi.osa + night.ahi.hyp).toFixed(1) : null;
export const metCompliance = (night) => night.hours >= COMPLIANCE_MIN_HOURS;

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

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

/* 'YYYY-MM-DD' → Date at local midnight (no timezone day-shift) */
export const toDate = (iso) => new Date(`${iso}T00:00:00`);
export const fmtShort = (iso) =>
  toDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtDayShort = (iso) =>
  toDate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export function nightsBetween(startIso, endIso) {
  return NIGHTS.filter((x) => x.date >= startIso && x.date <= endIso);
}
