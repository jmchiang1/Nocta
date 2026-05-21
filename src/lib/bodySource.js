/* Nocta — body-overnight source routing. The fixture carries one canonical
 * `bodyResponse` (Apple-Watch shape). At render time we project it through
 * each connected device's capability list + the user's per-read toggles to
 * produce a per-device view. Devices that report fewer reads (Oura has no
 * blood oxygen, Whoop only has HR) show shorter cards — that's the point. */
import { deviceByKey } from '../data/account.js';

/* Devices that contribute to the "your body overnight" cards. Apple Health is
 * deliberately excluded — it aggregates steps/workouts/weight, not overnight
 * physiology. Order here = display order on the home screen. */
const BODY_DEVICES = ['watch', 'oura', 'whoop'];

/* Each BodyResponse field is gated by exactly one device-read label. */
const FIELD_READ = {
  hr: 'Heart rate',
  hrv: 'Heart-rate variability',
  respRate: 'Respiratory rate',
  spo2: 'Blood oxygen',
  stages: 'Sleep stages',
};

/* Tiny per-device deltas so two cards on the same night don't look identical.
 * Real devices disagree by a few bpm / ms — this mimics that without us having
 * to hand-author a second fixture series per device. */
const DEVICE_TUNE = {
  watch: { hrShift: 0, hrvShift: 0 },
  oura: { hrShift: -2, hrvShift: 4 },
  whoop: { hrShift: 1, hrvShift: -3 },
};

function bodyResponseFor(fx, deviceKey, deviceReads) {
  if (!fx.bodyResponse) return null;
  const dev = deviceByKey(deviceKey);
  if (!dev) return null;
  const caps = new Set(dev.reads);
  const reads = deviceReads || {};
  const has = (label) => caps.has(label) && reads[label] !== false;

  /* skip the device entirely if none of its enabled reads map to a card section */
  const anyField = Object.values(FIELD_READ).some(has);
  if (!anyField) return null;

  const tune = DEVICE_TUNE[deviceKey] || { hrShift: 0, hrvShift: 0 };
  const base = fx.bodyResponse;

  const hr = has('Heart rate')
    ? { ...base.hr, series: base.hr.series.map((v) => v + tune.hrShift) }
    : null;
  const hrv = has('Heart-rate variability')
    ? { ...base.hrv, value: base.hrv.value + tune.hrvShift }
    : null;
  const respRate = has('Respiratory rate') ? base.respRate : null;
  const spo2 = has('Blood oxygen') ? base.spo2 : null;
  const stages = has('Sleep stages') ? base.stages : null;

  return {
    deviceKey,
    source: dev.title,
    note: base.note,
    hr,
    hrv,
    respRate,
    sleep: base.sleep,
    spo2,
    stages,
    awakenings: stages ? base.awakenings : null,
    latencyMin: stages ? base.latencyMin : null,
  };
}

/* Build the list of body-overnight cards to render for the active fixture.
 * A device contributes only if it's both connected (OAuth granted) AND
 * enabled (the user hasn't paused it via the master toggle) AND has at
 * least one read that maps to a card section. Empty array → render no
 * "Your body overnight" section at all. */
export function activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads) {
  return BODY_DEVICES.filter(
    (k) => deviceConnections?.[k] && deviceEnabled?.[k] !== false
  )
    .map((k) => bodyResponseFor(fx, k, deviceReads?.[k]))
    .filter(Boolean);
}
