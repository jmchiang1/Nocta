/* Nocta — Therapy tab data: device, settings, compliance. The machine, its
 * settings and compliance come from the CPAP card; equipment ages from the
 * replacement dates the person logs (lib/equipment.js). */
import { NIGHTS, LAST_NIGHT, metCompliance, fmtShort } from './history.js';
import { getCard } from '../lib/dataset.js';

/* The machine and its settings, as the card records them. Nothing here is a
 * default: a card that doesn't carry a setting shows it as missing. */

/* the card's machine: { brand, model, serial } or null */
export function cardDevice() {
  const d = getCard()?.device;
  return d?.model ? d : null;
}

const MODE_NAME = { AutoSet: 'AutoSet', CPAP: 'CPAP (fixed)', HerAuto: 'AutoSet for Her', APAP: 'Auto (APAP)' };

/* the prescribed pressure window from the card: [min, max] for an auto mode,
 * [set, set] for fixed CPAP, null when the card doesn't say */
export function pressureRange() {
  const s = getCard()?.settings;
  if (!s) return null;
  if (s.mode === 'CPAP' && s.setPressure != null) return [s.setPressure, s.setPressure];
  if (s.minPressure != null && s.maxPressure != null) return [s.minPressure, s.maxPressure];
  return null;
}
export const rangeLabel = (r) => (!r ? null : r[0] === r[1] ? `${r[0]} cmH₂O` : `${r[0]} – ${r[1]} cmH₂O`);

/* the machine card's settings grid — only what the card recorded */
export function deviceCells() {
  const s = getCard()?.settings;
  if (!s) return [];
  const cells = [];
  if (s.mode) cells.push({ k: 'Mode', v: MODE_NAME[s.mode] ?? s.mode });
  const r = rangeLabel(pressureRange());
  if (r) cells.push({ k: s.mode === 'CPAP' ? 'Pressure' : 'Pressure range', v: r });
  if (s.epr) cells.push({ k: 'EPR', v: s.epr.on ? `On · level ${s.epr.level}` : 'Off' });
  if (s.humidifierLevel != null) cells.push({ k: 'Humidity', v: `Level ${s.humidifierLevel}` });
  if (s.rampMinutes != null) cells.push({ k: 'Ramp', v: `${s.rampMinutes} min` });
  return cells;
}

/* CPAP machines (the picker's catalogue). Shown only when there's no card to
 * say which machine it is. */
export const MACHINES = [
  { id: 'rm-as11-auto', brand: 'ResMed', name: 'AirSense 11 AutoSet', short: 'AirSense 11' },
  { id: 'rm-as10-auto', brand: 'ResMed', name: 'AirSense 10 AutoSet', short: 'AirSense 10' },
  { id: 'rm-airmini', brand: 'ResMed', name: 'AirMini AutoSet', short: 'AirMini' },
  { id: 'ph-ds2', brand: 'Philips Respironics', name: 'DreamStation 2 Auto', short: 'DreamStation 2' },
  { id: 'fp-sleepstyle', brand: 'Fisher & Paykel', name: 'SleepStyle Auto', short: 'SleepStyle' },
  { id: 'rh-luna-g3', brand: 'React Health', name: 'Luna G3 Auto', short: 'Luna G3' },
];
export const DEFAULT_MACHINE_ID = 'rm-as11-auto';
export const machineById = (id) => MACHINES.find((m) => m.id === id) || MACHINES[0];

/* the machine to name on screen: the card's, else the one picked */
export function machineName(machineId) {
  const d = cardDevice();
  if (d) return { brand: d.brand, name: d.model.replace(/^ResMed\s+/, ''), short: d.model.replace(/ AutoSet$| CPAP$/, '') };
  const m = machineById(machineId);
  return { brand: m.brand, name: m.name, short: m.short };
}

/* Compliance: insurers ask for 4+ hours on 21 of the first 30 nights.
 * Computed from history.js *as of* a given night, so the Trends card can
 * follow the night picked on Tonight without drifting from anything else. */
const WINDOW = 30;
const REQUIRED = 21;

/* past the first 30 nights: the bar was the first 30, so say when it was
 * cleared, then track the most recent 30 (many plans keep checking ~70%) */
function rollingAsOf(nights) {
  let count = 0;
  let clearedOn = null;
  nights.slice(0, WINDOW).forEach((x, i) => {
    if (metCompliance(x)) count += 1;
    if (count === REQUIRED && clearedOn == null) clearedOn = i + 1;
  });
  const last = nights.slice(-WINDOW);
  const status = last.map((x) => (metCompliance(x) ? 'met' : 'missed'));
  const met = status.filter((x) => x === 'met').length;
  const cleared = clearedOn
    ? `You cleared the ${REQUIRED}-of-${WINDOW} bar on night ${clearedOn}.`
    : `The first ${WINDOW} nights didn't reach ${REQUIRED} with 4+ hours.`;
  return {
    eyebrow: 'Compliance · last 30 nights',
    headline:
      met >= REQUIRED
        ? `*${met} of your last ${WINDOW}* nights had 4+ hours.`
        : `*${met} of your last ${WINDOW}* nights had 4+ hours, under the ${REQUIRED} plans look for.`,
    body:
      `${cleared} Many plans keep checking about 70% use, so this follows your most recent ${WINDOW}.` +
      (met >= REQUIRED ? '' : ' A few more full nights brings it back up.'),
    met,
    missed: WINDOW - met,
    stillNeeded: Math.max(0, REQUIRED - met),
    earliest: null,
    slack: null,
    progressPct: Math.round((met / WINDOW) * 100),
    targetPct: Math.round((REQUIRED / WINDOW) * 100),
    scale: [fmtShort(last[0].date), `${REQUIRED} of ${WINDOW}`, fmtShort(last.at(-1).date)],
    nights: status,
  };
}

export function projectionAsOf(anchor = LAST_NIGHT) {
  const nights = NIGHTS.filter((x) => x.date <= anchor);
  if (nights.length > WINDOW) return rollingAsOf(nights);
  const elapsed = nights.map((x) => (metCompliance(x) ? 'met' : 'missed'));
  const met = elapsed.filter((x) => x === 'met').length;
  const missed = elapsed.length - met;
  const stillNeeded = Math.max(0, REQUIRED - met);
  const earliest = elapsed.length + stillNeeded; // if every night from here counts
  const slack = WINDOW - REQUIRED - missed; // misses left before it's out of reach

  let headline;
  let body;
  if (met >= REQUIRED) {
    headline = 'You’ve *cleared* compliance.';
    body = `${met} of your first ${elapsed.length} nights had 4+ hours. That meets the ${REQUIRED}-of-${WINDOW} bar insurance asks for.`;
  } else if (slack < 0) {
    headline = 'Compliance is *out of reach* this window.';
    body = `Too many nights fell under 4 hours to reach ${REQUIRED} of ${WINDOW}. Worth a call to your equipment provider about what happens next.`;
  } else {
    headline = missed
      ? `You can still clear compliance by *night ${earliest}*.`
      : `You’re on track to clear compliance by *night ${earliest}*.`;
    // headline carries the target night and the dot row shows which nights missed
    body =
      `Insurance needs 4+ hours on ${REQUIRED} of your first ${WINDOW} nights. ` +
      `You’re at ${met} of ${elapsed.length}. ${stillNeeded} more gets you there, with ${slack} nights to spare.`;
  }

  return {
    eyebrow: 'Compliance outlook',
    headline,
    body,
    met,
    missed,
    stillNeeded,
    earliest,
    slack,
    progressPct: Math.round((Math.min(met, REQUIRED) / REQUIRED) * 100), // nights banked toward the 21
    targetPct: Math.round((Math.min(earliest, WINDOW) / WINDOW) * 100), // marker: earliest possible night
    scale: ['Night 1', `Night ${earliest} · earliest`, `Night ${WINDOW}`],
    /* per-night status across the 30-night window, shown as a dot row:
     * 'met' = ≥4h, 'missed' = under, 'future' = not happened yet */
    nights: [...elapsed, ...Array(Math.max(0, WINDOW - elapsed.length)).fill('future')],
  };
}

/* as of the real last night — Therapy (desktop), You stats */
export const PROJECTION = projectionAsOf(LAST_NIGHT);
export const COMPLIANCE = {
  window: WINDOW,
  required: REQUIRED,
  met: PROJECTION.met,
  missed: PROJECTION.missed,
  stillNeeded: PROJECTION.stillNeeded,
  earliest: PROJECTION.earliest,
  slack: PROJECTION.slack,
};
