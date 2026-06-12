/* Nocta — mock night fixtures.
 * Each `insight` object matches the AI insight JSON schema in docs/FEATURES.md exactly.
 * The five fixtures exercise every why-card state. Switchable via the Tonight dev toggle.
 *
 * `bodyResponse` is OPTIONAL — it stands in for data a connected Apple Watch
 * would supply via HealthKit (future integration; out of v1 scope). Shape:
 *   source     — device label
 *   note       — one honest, non-diagnostic line about the body's response
 *   hr         — { series: overnight bpm trace, dir: vs the user's baseline,
 *                  typical: [lo, hi] — the user's usual overnight range, drawn
 *                  as a hatched band behind the trace (same on every night) }
 *   hrv        — { value, unit, dir } overnight heart-rate variability
 *   respRate   — { value, unit } sleeping respiratory rate
 *   sleep      — { asleepHours (watch), maskOnHours (= session.durationHours) }
 *   spo2       — { avg, low, unit, flag? } overnight blood oxygen; `flag` is an
 *                optional non-diagnostic line that escalates desats to a doctor
 *   stages     — { deep, rem, light, awake } watch-measured hours, or null
 *   awakenings — count of times woken; latencyMin — minutes to fall asleep
 * Any numeric field may be '—' when the watch lacked enough data to report.
 * UI reads it only when present; remove the block and the card disappears. */
import { genHeartRate } from '../lib/format.js';

/* Week strip — last 7 nights. Each slot maps to a night fixture; tapping a day
 * opens that night. Days with a fixture take their moon state from the fixture's
 * `dayState`. Thu/Fri have no authored fixture yet, so they render muted and
 * non-interactive (their `state` is a static placeholder). */
export const WEEK = [
  { day: 'Sun', fixtureId: 'steady' },
  { day: 'Mon', fixtureId: 'win' },
  { day: 'Tue', fixtureId: 'escalation' },
  { day: 'Wed', fixtureId: 'insufficient' },
  { day: 'Thu', fixtureId: null, state: 'missed' },
  { day: 'Fri', fixtureId: null, state: 'missed' },
  { day: 'Sat', fixtureId: 'anomaly' },
];

const anomaly = {
  id: 'anomaly',
  label: 'Anomaly',
  greeting: 'Good morning, Jonathan',
  dayName: 'Saturday',
  dateLabel: 'June 7 · Night 11 of 30',
  dayState: 'alert',
  session: { start: '11:42 PM', end: '6:08 AM', durationHours: 6.2 },
  ahi: { value: 10.5, avg14: 5.0, delta: 5.5, dir: 'up', rangePct: [6, 34], markerPct: 35 },
  secondary: [
    { key: 'leak', label: 'Leak', value: '32', unit: 'L/m', sub: 'P95 · up from 11',
      spark: [0.3, 0.4, 0.35, 0.5, 0.9, 0.82, 0.45], hot: [4, 5] },
    { key: 'pressure', label: 'Pressure', value: '5.6', unit: 'cmH₂O', sub: 'Median · steady',
      spark: [0.6, 0.55, 0.62, 0.58, 0.6, 0.64, 0.58], hot: [] },
    { key: 'hours', label: 'Hours', value: '6.2', unit: 'h', sub: 'up 0.7 from avg',
      spark: [0.7, 0.75, 0.65, 0.8, 0.88, 0.7, 0.75], hot: [4] },
  ],
  insight: {
    card_state: 'anomaly',
    headline: 'Your AHI nearly *doubled* last night.',
    receipts: '**10.5** events · mostly central · 2–5 a.m.',
    observation:
      '**14** central events appeared while you slept on your stomach with pressure pinned at **6.6 cmH₂O**. The pattern matched **2** earlier nights this week.',
    time_window: { nights_analyzed: 14, nights_matching: 2 },
    likely_causes: [
      { cause: 'Sleeping on your stomach for most of the night', probability_label: 'most_likely' },
      { cause: 'A glass of wine logged before bed', probability_label: 'possible' },
      { cause: 'A mask leak that crept up after 3 a.m.', probability_label: 'less_likely' },
    ],
    recommended_action: {
      action: 'Try starting on your side tonight — a body pillow makes the position easier to hold.',
      category: 'position_change',
      effort: 'tonight',
    },
    confidence: 'medium',
    escalation_flag: 'soft',
    data_citations: [
      { metric: 'AHI', value: 10.5, unit: 'events/hr', source: 'SleepHQ' },
      { metric: 'Central events', value: 14, unit: 'count', source: 'SleepHQ' },
      { metric: 'Leak P95', value: 32, unit: 'L/min', source: 'SleepHQ' },
    ],
  },
  spark: [0.18, 0.22, 0.4, 0.28, 0.78, 0.92, 0.84, 0.52, 0.3, 0.24, 0.2, 0.16],
  sparkKind: ['', '', 'w', '', 'hi', 'hi', 'hi', 'w', '', '', '', ''],
  timeline: {
    eventCount: 16,
    stages: [
      { stage: 'rem', l: 0, w: 8 }, { stage: 'deep', l: 8, w: 14 },
      { stage: 'light', l: 22, w: 10 }, { stage: 'deep', l: 32, w: 18 },
      { stage: 'rem', l: 50, w: 8 }, { stage: 'light', l: 58, w: 14 },
      { stage: 'deep', l: 72, w: 16 }, { stage: 'rem', l: 88, w: 12 },
    ],
    events: [
      { type: 'csa', l: 30 }, { type: 'csa', l: 33 }, { type: 'csa', l: 35 },
      { type: 'csa', l: 38 }, { type: 'csa', l: 41 }, { type: 'csa', l: 44 },
      { type: 'csa', l: 47 }, { type: 'csa', l: 50 },
      { type: 'osa', l: 62 }, { type: 'osa', l: 78 },
      { type: 'leak', l: 42, top: 24 }, { type: 'leak', l: 48, top: 24 },
    ],
    journal: [
      { emoji: '🍽', label: 'Late meal', l: 4 },
      { emoji: '🍷', label: 'Glass of wine', l: 18 },
    ],
  },
  pattern: {
    headline: 'On nights you sleep on your stomach, your AHI averages 2.3× higher.',
    body: '4 of your last 5 stomach nights landed above your usual range. Most of the rise came from central events.',
    stats: [
      { v: '2.3×', k: 'average AHI' },
      { v: '5 / 5', k: 'matched pattern' },
      { v: '14d', k: 'data window' },
    ],
  },
  bodyResponse: {
    source: 'Apple Watch',
    note: 'Your heart rate climbed during the 2–5 a.m. event cluster, then settled afterward.',
    hr: {
      dir: 'up',
      series: genHeartRate('anomaly-hr', {
        base: 57, n: 44, drift: 6,
        arousals: [
          { at: 0.36, width: 0.13, mag: 17 },
          { at: 0.5, width: 0.1, mag: 13 },
          { at: 0.64, width: 0.08, mag: 9 },
        ],
      }),
      typical: [48, 64],
    },
    hrv: { value: 38, unit: 'ms', dir: 'down' },
    respRate: { value: 15.8, unit: 'br/min' },
    sleep: { asleepHours: 5.4, maskOnHours: 6.2 },
    spo2: {
      avg: 93, low: 86, unit: '%',
      flag: 'Your blood oxygen dipped to 86% a few times during the 2–5 a.m. cluster — worth mentioning to your doctor.',
    },
    stages: { deep: 0.7, rem: 0.9, light: 3.8, awake: 0.8 },
    awakenings: 6,
    latencyMin: 24,
  },
};

const steady = {
  id: 'steady',
  label: 'Steady',
  greeting: 'Good morning, Jonathan',
  dayName: 'Sunday',
  dateLabel: 'June 8 · Night 12 of 30',
  dayState: 'good',
  session: { start: '11:10 PM', end: '6:14 AM', durationHours: 7.1 },
  ahi: { value: 3.2, avg14: 4.6, delta: 1.4, dir: 'down', rangePct: [6, 34], markerPct: 14 },
  secondary: [
    { key: 'leak', label: 'Leak', value: '9', unit: 'L/m', sub: 'P95 · in range',
      spark: [0.3, 0.35, 0.28, 0.32, 0.3, 0.34, 0.3], hot: [] },
    { key: 'pressure', label: 'Pressure', value: '7.0', unit: 'cmH₂O', sub: 'Median · steady',
      spark: [0.6, 0.62, 0.6, 0.64, 0.6, 0.62, 0.6], hot: [] },
    { key: 'hours', label: 'Hours', value: '7.1', unit: 'h', sub: 'up 0.4 from avg',
      spark: [0.7, 0.72, 0.7, 0.74, 0.78, 0.76, 0.8], hot: [6] },
  ],
  insight: {
    card_state: 'steady',
    headline: 'Last night looked like *your usual*.',
    receipts: '**3.2** events · within your normal range',
    observation:
      'Your AHI held at **3.2**, comfortably inside your normal range. Leak stayed low at **9 L/min** and you slept **7.1 hours**.',
    time_window: { nights_analyzed: 14, nights_matching: 9 },
    likely_causes: [],
    recommended_action: {
      action: 'Nothing to change tonight — keep doing what you did.',
      category: 'behavioral_change',
      effort: 'tonight',
    },
    confidence: 'high',
    escalation_flag: 'none',
    data_citations: [
      { metric: 'AHI', value: 3.2, unit: 'events/hr', source: 'SleepHQ' },
      { metric: 'Leak P95', value: 9, unit: 'L/min', source: 'SleepHQ' },
      { metric: 'Session length', value: 7.1, unit: 'hours', source: 'SleepHQ' },
    ],
  },
  spark: [0.4, 0.36, 0.42, 0.38, 0.34, 0.4, 0.36, 0.42, 0.38, 0.36, 0.4, 0.38],
  sparkKind: [],
  timeline: {
    eventCount: 5,
    stages: [
      { stage: 'light', l: 0, w: 10 }, { stage: 'deep', l: 10, w: 20 },
      { stage: 'rem', l: 30, w: 10 }, { stage: 'deep', l: 40, w: 16 },
      { stage: 'light', l: 56, w: 12 }, { stage: 'deep', l: 68, w: 14 },
      { stage: 'rem', l: 82, w: 18 },
    ],
    events: [
      { type: 'osa', l: 20 }, { type: 'csa', l: 44 }, { type: 'osa', l: 58 },
      { type: 'osa', l: 74 }, { type: 'csa', l: 88 },
    ],
    journal: [],
  },
  pattern: {
    headline: 'Your steadiest stretch yet — 5 of the last 7 nights inside range.',
    body: 'When your bedtime stays before midnight, your AHI sits noticeably lower. The pattern is holding.',
    stats: [
      { v: '5 / 7', k: 'nights in range' },
      { v: '−0.8', k: 'vs last week' },
      { v: '14d', k: 'data window' },
    ],
  },
  bodyResponse: {
    source: 'Apple Watch',
    note: 'Your heart rate stayed low and even — a calm night for your body.',
    hr: {
      dir: 'flat',
      series: genHeartRate('steady-hr', {
        base: 53, n: 46, drift: 4,
        arousals: [
          { at: 0.3, width: 0.07, mag: 6 },
          { at: 0.72, width: 0.06, mag: 5 },
        ],
      }),
      typical: [48, 64],
    },
    hrv: { value: 54, unit: 'ms', dir: 'flat' },
    respRate: { value: 14.1, unit: 'br/min' },
    sleep: { asleepHours: 6.6, maskOnHours: 7.1 },
    spo2: { avg: 96, low: 92, unit: '%' },
    stages: { deep: 1.2, rem: 1.5, light: 3.9, awake: 0.5 },
    awakenings: 2,
    latencyMin: 13,
  },
};

const win = {
  id: 'win',
  label: 'Win',
  greeting: 'Good morning, Jonathan',
  dayName: 'Monday',
  dateLabel: 'June 9 · Night 13 of 30',
  dayState: 'good',
  session: { start: '10:54 PM', end: '6:30 AM', durationHours: 7.6 },
  ahi: { value: 2.1, avg14: 5.0, delta: 2.9, dir: 'down', rangePct: [6, 34], markerPct: 9 },
  secondary: [
    { key: 'leak', label: 'Leak', value: '7', unit: 'L/m', sub: 'P95 · in range',
      spark: [0.3, 0.28, 0.3, 0.26, 0.3, 0.28, 0.26], hot: [] },
    { key: 'pressure', label: 'Pressure', value: '6.8', unit: 'cmH₂O', sub: 'Median · steady',
      spark: [0.58, 0.6, 0.58, 0.6, 0.62, 0.58, 0.6], hot: [] },
    { key: 'hours', label: 'Hours', value: '7.6', unit: 'h', sub: 'up 0.9 from avg',
      spark: [0.66, 0.7, 0.72, 0.78, 0.84, 0.9, 0.94], hot: [5, 6] },
  ],
  insight: {
    card_state: 'win',
    headline: 'Your *best night* in two weeks.',
    receipts: '**2.1** events · your lowest in 14 nights',
    observation:
      'AHI fell to **2.1**, down from your 14-day average of **5.0**. This came on a night you logged **no alcohol** and stayed on your side.',
    time_window: { nights_analyzed: 14, nights_matching: 1 },
    likely_causes: [
      { cause: 'Side sleeping held through the whole night', probability_label: 'most_likely' },
      { cause: 'No alcohol logged the evening before', probability_label: 'possible' },
    ],
    recommended_action: {
      action: 'Worth repeating: side sleeping looks like the single biggest lever for you.',
      category: 'position_change',
      effort: 'this_week',
    },
    confidence: 'medium',
    escalation_flag: 'none',
    data_citations: [
      { metric: 'AHI', value: 2.1, unit: 'events/hr', source: 'SleepHQ' },
      { metric: '14-day average AHI', value: 5.0, unit: 'events/hr', source: 'Nocta baseline' },
    ],
  },
  spark: [0.5, 0.42, 0.38, 0.3, 0.26, 0.22, 0.2, 0.18, 0.16, 0.2, 0.18, 0.16],
  sparkKind: [],
  timeline: {
    eventCount: 3,
    stages: [
      { stage: 'light', l: 0, w: 8 }, { stage: 'deep', l: 8, w: 22 },
      { stage: 'rem', l: 30, w: 12 }, { stage: 'deep', l: 42, w: 18 },
      { stage: 'light', l: 60, w: 10 }, { stage: 'deep', l: 70, w: 14 },
      { stage: 'rem', l: 84, w: 16 },
    ],
    events: [
      { type: 'osa', l: 26 }, { type: 'osa', l: 54 }, { type: 'csa', l: 80 },
    ],
    journal: [{ emoji: '🏃', label: 'Exercised', l: 10 }],
  },
  pattern: {
    headline: 'Your best AHI nights this month all followed a day with exercise.',
    body: 'Four of four. On exercise days your AHI averages 2.4 — about half your non-exercise average.',
    stats: [
      { v: '4 / 4', k: 'exercise nights' },
      { v: '−2.4', k: 'avg AHI shift' },
      { v: '30d', k: 'data window' },
    ],
  },
  bodyResponse: {
    source: 'Apple Watch',
    note: 'Your lowest overnight heart rate in two weeks, with strong heart-rate variability.',
    hr: {
      dir: 'down',
      series: genHeartRate('win-hr', {
        base: 50, n: 48, drift: 3,
        arousals: [{ at: 0.55, width: 0.06, mag: 4 }],
      }),
      typical: [48, 64],
    },
    hrv: { value: 61, unit: 'ms', dir: 'up' },
    respRate: { value: 13.6, unit: 'br/min' },
    sleep: { asleepHours: 7.2, maskOnHours: 7.6 },
    spo2: { avg: 97, low: 94, unit: '%' },
    stages: { deep: 1.6, rem: 1.8, light: 3.8, awake: 0.4 },
    awakenings: 1,
    latencyMin: 9,
  },
};

const escalation = {
  id: 'escalation',
  label: 'Escalation',
  greeting: 'Good morning, Jonathan',
  dayName: 'Tuesday',
  dateLabel: 'June 10 · Night 14 of 30',
  dayState: 'alert',
  session: { start: '11:30 PM', end: '6:02 AM', durationHours: 6.4 },
  ahi: { value: 9.4, avg14: 5.2, delta: 4.2, dir: 'up', rangePct: [6, 34], markerPct: 31 },
  secondary: [
    { key: 'cai', label: 'Central idx', value: '6.8', unit: '/h', sub: 'up from 1.2',
      spark: [0.2, 0.28, 0.4, 0.55, 0.7, 0.85, 0.95], hot: [4, 5, 6] },
    { key: 'pressure', label: 'Pressure', value: '6.1', unit: 'cmH₂O', sub: 'Median · steady',
      spark: [0.58, 0.6, 0.58, 0.62, 0.6, 0.58, 0.6], hot: [] },
    { key: 'hours', label: 'Hours', value: '6.4', unit: 'h', sub: 'steady',
      spark: [0.7, 0.72, 0.7, 0.74, 0.7, 0.72, 0.7], hot: [] },
  ],
  insight: {
    card_state: 'escalation',
    headline: 'Central events are *climbing* this week.',
    receipts: '**6.8** central index · up from 1.2 · 4 nights',
    observation:
      'Your central apnea index has climbed to **6.8** over four nights, up from a usual **1.2**. This is a pattern worth bringing to your sleep doctor — not something to change on your own.',
    time_window: { nights_analyzed: 14, nights_matching: 4 },
    likely_causes: [
      { cause: 'A change in your breathing pattern your doctor should review', probability_label: 'most_likely' },
    ],
    recommended_action: {
      action: 'Prepare a doctor summary — Nocta can turn your last 14 nights into a one-page export to bring in.',
      category: 'consult_physician',
      effort: 'next_appointment',
    },
    confidence: 'high',
    escalation_flag: 'hard',
    data_citations: [
      { metric: 'Central apnea index', value: 6.8, unit: 'events/hr', source: 'SleepHQ' },
      { metric: 'Usual central apnea index', value: 1.2, unit: 'events/hr', source: 'Nocta baseline' },
      { metric: 'Nights matching', value: 4, unit: 'count', source: 'Nocta baseline' },
    ],
  },
  spark: [0.2, 0.26, 0.3, 0.38, 0.5, 0.6, 0.72, 0.8, 0.86, 0.9, 0.84, 0.88],
  sparkKind: ['', '', '', '', 'w', 'w', 'hi', 'hi', 'hi', 'hi', 'hi', 'hi'],
  timeline: {
    eventCount: 19,
    stages: [
      { stage: 'light', l: 0, w: 12 }, { stage: 'deep', l: 12, w: 14 },
      { stage: 'light', l: 26, w: 14 }, { stage: 'rem', l: 40, w: 10 },
      { stage: 'light', l: 50, w: 18 }, { stage: 'deep', l: 68, w: 12 },
      { stage: 'rem', l: 80, w: 20 },
    ],
    events: [
      { type: 'csa', l: 14 }, { type: 'csa', l: 22 }, { type: 'csa', l: 30 },
      { type: 'csa', l: 36 }, { type: 'csa', l: 42 }, { type: 'csa', l: 48 },
      { type: 'csa', l: 54 }, { type: 'csa', l: 60 }, { type: 'csa', l: 66 },
      { type: 'csa', l: 72 }, { type: 'osa', l: 50 }, { type: 'osa', l: 84 },
    ],
    journal: [],
  },
  pattern: null,
  bodyResponse: {
    source: 'Apple Watch',
    note: 'Your heart rate ran elevated through the night, in step with the rising events.',
    hr: {
      dir: 'up',
      series: genHeartRate('escalation-hr', {
        base: 60, n: 44, drift: 5,
        arousals: [
          { at: 0.18, width: 0.1, mag: 11 },
          { at: 0.34, width: 0.1, mag: 13 },
          { at: 0.5, width: 0.1, mag: 14 },
          { at: 0.66, width: 0.1, mag: 12 },
        ],
      }),
      typical: [48, 64],
    },
    hrv: { value: 34, unit: 'ms', dir: 'down' },
    respRate: { value: 15.2, unit: 'br/min' },
    sleep: { asleepHours: 5.3, maskOnHours: 6.4 },
    spo2: {
      avg: 94, low: 87, unit: '%',
      flag: 'Your blood oxygen dipped to 87% several times overnight. Bring this to your doctor alongside the rising central events.',
    },
    stages: { deep: 0.6, rem: 0.8, light: 3.9, awake: 1.1 },
    awakenings: 5,
    latencyMin: 17,
  },
};

const insufficient = {
  id: 'insufficient',
  label: 'Low data',
  greeting: 'Good morning, Jonathan',
  dayName: 'Wednesday',
  dateLabel: 'June 11 · Night 15 of 30',
  dayState: 'watch',
  session: { start: '1:20 AM', end: '3:00 AM', durationHours: 1.7 },
  ahi: { value: null, avg14: 5.0, delta: null, dir: 'flat', rangePct: [6, 34], markerPct: null },
  secondary: [
    { key: 'leak', label: 'Leak', value: '—', unit: '', sub: 'too little data',
      spark: [0.2, 0.2, 0.2], hot: [] },
    { key: 'pressure', label: 'Pressure', value: '5.8', unit: 'cmH₂O', sub: 'Median',
      spark: [0.5, 0.52, 0.5], hot: [] },
    { key: 'hours', label: 'Hours', value: '1.7', unit: 'h', sub: 'below 2h threshold',
      spark: [0.2, 0.2, 0.2], hot: [] },
  ],
  insight: {
    card_state: 'insufficient_data',
    headline: 'Not enough nights yet to spot patterns.',
    receipts: '**1.7 h** recorded · too short to score reliably',
    observation:
      "Last night's session was **1 hour 40 minutes** — short of the **2-hour** mark Nocta needs to spot patterns. A couple of full nights and the picture gets a lot clearer.",
    time_window: { nights_analyzed: 1, nights_matching: 0 },
    likely_causes: [],
    recommended_action: {
      action: 'Aim for a full night tonight — even a few hours more helps Nocta learn your baseline.',
      category: 'track_more_data',
      effort: 'tonight',
    },
    confidence: 'low',
    escalation_flag: 'none',
    data_citations: [
      { metric: 'Session length', value: 1.7, unit: 'hours', source: 'SleepHQ' },
    ],
  },
  spark: [0.2, 0.22, 0.18, 0.2, 0.2, 0.22],
  sparkKind: [],
  timeline: {
    eventCount: 2,
    stages: [
      { stage: 'light', l: 0, w: 30 }, { stage: 'deep', l: 30, w: 26 },
      { stage: 'light', l: 56, w: 44 },
    ],
    events: [{ type: 'osa', l: 38 }, { type: 'csa', l: 70 }],
    journal: [],
  },
  pattern: null,
  bodyResponse: {
    source: 'Apple Watch',
    note: 'Only 1.7 hours on your wrist last night — not enough for a reliable read.',
    hr: {
      dir: 'flat',
      series: genHeartRate('insufficient-hr', {
        base: 64, n: 16, drift: 2,
        arousals: [{ at: 0.5, width: 0.2, mag: 7 }],
      }),
      typical: [48, 64],
    },
    hrv: { value: '—', unit: 'ms', dir: 'flat' },
    respRate: { value: 16, unit: 'br/min' },
    sleep: { asleepHours: 1.3, maskOnHours: 1.7 },
    spo2: { avg: '—', low: '—', unit: '%' },
    stages: null,
    awakenings: '—',
    latencyMin: '—',
  },
};

export const FIXTURES = { anomaly, steady, win, escalation, insufficient };
export const FIXTURE_ORDER = ['anomaly', 'steady', 'win', 'escalation', 'insufficient'];
export const DEFAULT_FIXTURE = 'anomaly';

/* episodes — apnea events for the Full-night view. Keyed loosely; the Tonight
 * fixture maps to its night's events. Each event seeds its own mini-waveform. */
export const EPISODES = {
  anomaly: [
    { type: 'CSA', time: '2:01 AM', dur: 17, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Stomach', seed: 'a1' },
    { type: 'CSA', time: '2:18 AM', dur: 14, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Stomach', seed: 'a2' },
    { type: 'CSA', time: '2:44 AM', dur: 21, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Stomach', seed: 'a3' },
    { type: 'CSA', time: '3:07 AM', dur: 16, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Stomach', seed: 'a4' },
    { type: 'OSA', time: '4:22 AM', dur: 12, pressure: '6.6 cmH₂O', response: 'Rose to 8.9 cmH₂O', position: 'Back', seed: 'a5' },
    { type: 'CSA', time: '4:38 AM', dur: 19, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Back', seed: 'a6' },
    { type: 'OSA', time: '4:49 AM', dur: 10, pressure: '6.6 cmH₂O', response: 'Rose to 8.9 cmH₂O', position: 'Back', seed: 'a7' },
    { type: 'CSA', time: '5:11 AM', dur: 15, pressure: '6.6 cmH₂O', response: 'Held at 6.6 cmH₂O', position: 'Side', seed: 'a8' },
  ],
  steady: [
    { type: 'OSA', time: '12:40 AM', dur: 11, pressure: '7.0 cmH₂O', response: 'Rose to 8.4 cmH₂O', position: 'Side', seed: 's1' },
    { type: 'Hypopnea', time: '2:15 AM', dur: 18, pressure: '7.0 cmH₂O', response: 'Held at 7.0 cmH₂O', position: 'Side', seed: 's2' },
    { type: 'OSA', time: '3:30 AM', dur: 9, pressure: '7.0 cmH₂O', response: 'Rose to 8.1 cmH₂O', position: 'Back', seed: 's3' },
    { type: 'CSA', time: '4:52 AM', dur: 13, pressure: '7.0 cmH₂O', response: 'Held at 7.0 cmH₂O', position: 'Side', seed: 's4' },
  ],
  win: [
    { type: 'OSA', time: '1:05 AM', dur: 10, pressure: '6.8 cmH₂O', response: 'Rose to 7.9 cmH₂O', position: 'Side', seed: 'w1' },
    { type: 'OSA', time: '3:48 AM', dur: 8, pressure: '6.8 cmH₂O', response: 'Rose to 7.6 cmH₂O', position: 'Side', seed: 'w2' },
    { type: 'CSA', time: '5:20 AM', dur: 12, pressure: '6.8 cmH₂O', response: 'Held at 6.8 cmH₂O', position: 'Side', seed: 'w3' },
  ],
  escalation: [
    { type: 'CSA', time: '12:14 AM', dur: 16, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Side', seed: 'e1' },
    { type: 'CSA', time: '1:02 AM', dur: 22, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Side', seed: 'e2' },
    { type: 'CSA', time: '1:48 AM', dur: 19, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Back', seed: 'e3' },
    { type: 'CSA', time: '2:33 AM', dur: 24, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Back', seed: 'e4' },
    { type: 'CSA', time: '3:19 AM', dur: 18, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Back', seed: 'e5' },
    { type: 'OSA', time: '3:55 AM', dur: 11, pressure: '6.1 cmH₂O', response: 'Rose to 8.2 cmH₂O', position: 'Side', seed: 'e6' },
    { type: 'CSA', time: '4:40 AM', dur: 20, pressure: '6.1 cmH₂O', response: 'Held at 6.1 cmH₂O', position: 'Side', seed: 'e7' },
  ],
  insufficient: [
    { type: 'OSA', time: '1:52 AM', dur: 12, pressure: '5.8 cmH₂O', response: 'Rose to 6.9 cmH₂O', position: 'Back', seed: 'i1' },
    { type: 'CSA', time: '2:31 AM', dur: 14, pressure: '5.8 cmH₂O', response: 'Held at 5.8 cmH₂O', position: 'Back', seed: 'i2' },
  ],
};
