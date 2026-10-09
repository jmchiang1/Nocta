/* Nocta — Therapy tab mock data: device, equipment lifecycle, settings, projection */
import { NIGHTS, NIGHTS_ON_THERAPY, LAST_NIGHT, metCompliance } from './history.js';

/* prescribed APAP window — mirrored by the '5 – 12 cmH₂O' strings below and
 * drawn as the hatched band on the pressure trend chart */
export const PRESSURE_RANGE = [5, 12];

/* CPAP machines Nocta can read through SleepHQ. Auto-adjusting models only:
 * the prescription below is a 5–12 range, which a fixed-pressure machine
 * can't run. `comfortKey` is each brand's name for exhale relief. */
export const MACHINES = [
  { id: 'rm-as11-auto', brand: 'ResMed', name: 'AirSense 11 AutoSet', short: 'AirSense 11',
    mode: 'AutoSet (APAP)', comfortKey: 'EPR', comfort: 'On · level 2' },
  { id: 'rm-as10-auto', brand: 'ResMed', name: 'AirSense 10 AutoSet', short: 'AirSense 10',
    mode: 'AutoSet (APAP)', comfortKey: 'EPR', comfort: 'On · level 2' },
  { id: 'rm-airmini', brand: 'ResMed', name: 'AirMini AutoSet', short: 'AirMini',
    mode: 'AutoSet (APAP)', comfortKey: 'EPR', comfort: 'On · level 2' },
  { id: 'ph-ds2', brand: 'Philips Respironics', name: 'DreamStation 2 Auto', short: 'DreamStation 2',
    mode: 'Auto CPAP (APAP)', comfortKey: 'Flex', comfort: 'C-Flex+ · level 2' },
  { id: 'fp-sleepstyle', brand: 'Fisher & Paykel', name: 'SleepStyle Auto', short: 'SleepStyle',
    mode: 'Auto (APAP)', comfortKey: 'Exhale relief', comfort: 'On · level 2' },
  { id: 'rh-luna-g3', brand: 'React Health', name: 'Luna G3 Auto', short: 'Luna G3',
    mode: 'Auto CPAP (APAP)', comfortKey: 'Exhale relief', comfort: 'On · level 2' },
];
export const DEFAULT_MACHINE_ID = 'rm-as11-auto';
export const machineById = (id) => MACHINES.find((m) => m.id === id) || MACHINES[0];

/* sync status for whichever machine is selected */
export const DEVICE = {
  status: 'Synced 6 hours ago',
  source: 'via SleepHQ · auto-import nightly',
  pressureRange: '5 – 12 cmH₂O',
};

/* the four view-only cells on the device card, for the chosen machine + mask */
/* the machine card's settings grid. The mask isn't here: it has its own card
 * right below on Therapy. */
export function deviceCells(machine) {
  return [
    { k: 'Mode', v: machine.mode },
    { k: 'Pressure range', v: DEVICE.pressureRange },
    { k: machine.comfortKey, v: machine.comfort },
    { k: 'Humidity', v: SETTINGS_VIEW.find((s) => s.k === 'Humidity')?.v ?? '—' },
  ];
}

/* lifespanDays = recommended replacement interval (FEATURES › Equipment).
 * Everything came with the machine on night 1, so every part is the same age
 * as the user's therapy. */
export const EQUIPMENT = [
  { name: 'Mask cushion', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 30 },
  { name: 'Mask frame', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 90 },
  { name: 'Air filter', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 30 },
  { name: 'Tubing', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 180 },
  { name: 'Water chamber', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 180 },
  { name: 'Headgear', ageDays: NIGHTS_ON_THERAPY, lifespanDays: 180 },
];

export const SETTINGS_VIEW = [
  { k: 'Prescribed pressure', v: '5 – 12 cmH₂O' },
  { k: 'Therapy mode', v: 'AutoSet' },
  { k: 'Ramp', v: 'Auto · starts at 4 cmH₂O' },
  { k: 'Humidity', v: 'Level 4' },
];

/* Compliance: insurers ask for 4+ hours on 21 of the first 30 nights.
 * Computed from history.js *as of* a given night, so the Trends card can
 * follow the night picked on Tonight without drifting from anything else. */
const WINDOW = 30;
const REQUIRED = 21;

export function projectionAsOf(anchor = LAST_NIGHT) {
  const nights = NIGHTS.filter((x) => x.date <= anchor);
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
