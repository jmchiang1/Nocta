/* Nocta — "your body overnight", per connected wearable. Each live wearable
 * (lib/wearables.js) keeps its synced nights by date, the same id as the CPAP
 * night, so a night's card is that wearable's record for the same evening.
 * The user's per-read toggles decide which parts show. A device that measures
 * less (Whoop has no overnight heart-rate samples, Withings no SpO₂) shows a
 * shorter card. Only what the device reported appears: no scores, no labels,
 * nothing filled in. */
import { deviceByKey } from '../data/account.js';
import { LIVE_WEARABLES, wearableNight, wearableNightsBefore } from './wearables.js';

/* how many earlier nights make "your usual" heart-rate range, and how few is too few */
const USUAL_NIGHTS = 14;
const USUAL_MIN = 5;

/* the band behind the heart-rate chart: the spread of this wearable's average
 * overnight heart rate across your recent nights */
function usualHr(deviceKey, date) {
  const avgs = wearableNightsBefore(deviceKey, date, USUAL_NIGHTS)
    .map((n) => n.hr?.avg)
    .filter((v) => v != null);
  return avgs.length >= USUAL_MIN ? [Math.min(...avgs), Math.max(...avgs)] : null;
}

function bodyResponseFor(fx, deviceKey, deviceReads) {
  const n = wearableNight(deviceKey, fx.id);
  const dev = deviceByKey(deviceKey);
  if (!n || !dev) return null;
  const caps = new Set(dev.reads);
  const reads = deviceReads || {};
  const has = (label) => caps.has(label) && reads[label] !== false;

  const hr = has('Heart rate') && n.hr ? { ...n.hr, typical: n.hr.series ? usualHr(deviceKey, fx.id) : null } : null;
  const hrv = has('Heart-rate variability') && n.hrv != null ? { value: n.hrv, unit: 'ms' } : null;
  const respRate = has('Respiratory rate') && n.respRate != null ? { value: n.respRate, unit: 'br/min' } : null;
  const spo2 = has('Blood oxygen') && n.spo2 != null ? { avg: n.spo2, low: null, unit: '%' } : null;
  const stages = has('Sleep stages') && n.stages ? { ...n.stages, phases: n.phases } : null;
  if (!hr && !hrv && !respRate && !spo2 && !stages) return null;

  return {
    deviceKey,
    // a sandbox night (OURA_SANDBOX) is canned data, and the card says so
    source: n.test ? `${dev.title} · test data` : dev.title,
    note: null,
    hr,
    hrv,
    respRate,
    spo2,
    stages,
    // asleep (the wearable's count) next to mask-on (the machine's)
    sleep: stages && n.asleepHours != null ? { asleepHours: n.asleepHours, maskOnHours: fx.session.durationHours } : null,
    awakenings: stages ? n.awakenings : null,
    latencyMin: stages ? n.latencyMin : null,
  };
}

/* The body cards for a night: one per wearable that's connected, not paused,
 * and has that night with at least one allowed read. Empty array → no
 * "Your body overnight" section at all. */
export function activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads) {
  if (!fx) return [];
  return LIVE_WEARABLES.filter((k) => deviceConnections?.[k] && deviceEnabled?.[k] !== false)
    .map((k) => bodyResponseFor(fx, k, deviceReads?.[k]))
    .filter(Boolean);
}

/* the first card with sleep stages, for the full-night view and the doctor
 * summary, which show one source */
export function primaryBody(fx, deviceConnections, deviceEnabled, deviceReads) {
  const cards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);
  return cards.find((c) => c.stages) ?? cards[0] ?? null;
}
