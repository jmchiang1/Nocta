/* Nocta — Therapy tab mock data: device, equipment lifecycle, settings, projection */

export const DEVICE = {
  status: 'Synced 6 hours ago',
  name: 'ResMed AirSense 11 AutoSet',
  source: 'via SleepHQ · auto-import nightly',
  cells: [
    { k: 'Mode', v: 'AutoSet (APAP)' },
    { k: 'Pressure range', v: '5 – 12 cmH₂O' },
    { k: 'EPR', v: 'On · level 2' },
    { k: 'Mask', v: 'AirFit P30i' },
  ],
};

/* lifespanDays = recommended replacement interval; ageDays = current age */
export const EQUIPMENT = [
  { name: 'Mask cushion', ageDays: 24, lifespanDays: 30 },
  { name: 'Mask frame', ageDays: 24, lifespanDays: 90 },
  { name: 'Air filter', ageDays: 27, lifespanDays: 30 },
  { name: 'Tubing', ageDays: 96, lifespanDays: 180 },
  { name: 'Water chamber', ageDays: 168, lifespanDays: 180 },
  { name: 'Headgear', ageDays: 110, lifespanDays: 180 },
];

export const SETTINGS_VIEW = [
  { k: 'Prescribed pressure', v: '5 – 12 cmH₂O' },
  { k: 'Therapy mode', v: 'AutoSet' },
  { k: 'Ramp', v: 'Auto · starts at 4 cmH₂O' },
  { k: 'Humidity', v: 'Level 4' },
];

export const PROJECTION = {
  eyebrow: 'Compliance outlook',
  headline: 'On track to clear compliance around *day 22*.',
  // body: 'Insurance asks for 4+ hours on 21 of any 30 nights. You have hit it on 9 of 11 so far — two short nights early on, but staying on this pace still clears the bar with a few days to spare.',
  progressPct: 52,
  targetPct: 72, // day 22 of 30
  scale: ['Day 1', 'Day 22 · target', 'Day 30'],
  /* Per-night status across the 30-night window — rendered as a dot row under
   * the progress bar. 'met' = ≥4h on the machine, 'missed' = under, 'future'
   * = not happened yet. Purely informational; not interactive. */
  nights: [
    'met', 'missed', 'met', 'met', 'missed', 'met', 'met', 'met', 'met', 'met', 'met',
    'future', 'future', 'future', 'future', 'future', 'future', 'future', 'future', 'future',
    'future', 'future', 'future', 'future', 'future', 'future', 'future', 'future', 'future', 'future',
  ],
};
