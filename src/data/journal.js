import { NIGHTS, ahiTotal, toDate, fmtDayShort } from './history.js';

/* Nocta — Morning Check-In question set + journal history.
 * Tags are a controlled vocabulary (see docs/FEATURES.md). */

export const CHECKIN_SCREENS = [
  {
    id: 'feel',
    question: 'How do you feel this morning?',
    hint: 'Select all that apply.',
    options: [
      { id: 'rested', label: 'Rested' },
      { id: 'tired', label: 'Tired' },
      { id: 'sore', label: 'Sore' },
      { id: 'foggy', label: 'Foggy' },
      { id: 'anxious', label: 'Anxious' },
      { id: 'congested', label: 'Congested' },
      { id: 'sick', label: 'Sick' },
      { id: 'headache', label: 'Headache' },
      { id: 'dry_mouth', label: 'Dry mouth' },
    ],
  },
  {
    id: 'lastnight',
    question: 'Last night I had…',
    hint: 'Anything that might have shifted your sleep.',
    options: [
      { id: 'alcohol', label: 'Alcohol' },
      { id: 'caffeine_late', label: 'Caffeine after 2pm' },
      { id: 'late_meal', label: 'Big or late meal' },
      { id: 'cold_meds', label: 'Cold / flu meds' },
      { id: 'nothing_lastnight', label: 'Nothing unusual', exclusive: true },
    ],
  },
  {
    id: 'yesterday',
    question: 'Yesterday I…',
    hint: 'The day before a night shapes it too.',
    options: [
      { id: 'exercised', label: 'Exercised' },
      { id: 'worked_late', label: 'Worked late' },
      { id: 'traveled', label: 'Traveled' },
      { id: 'stressed', label: 'Felt stressed' },
      { id: 'mask_change', label: 'Changed my mask' },
      { id: 'nothing_yesterday', label: 'Nothing unusual', exclusive: true },
    ],
  },
];

/* lookup: tag id -> human label, for rendering logged tags back */
export const TAG_LABELS = CHECKIN_SCREENS.reduce((acc, s) => {
  s.options.forEach((o) => {
    acc[o.id] = o.label;
  });
  return acc;
}, {});

/* Journal history — one morning check-in per night that had a session
 * (no session Thu Oct 8 / Fri Oct 9 → no check-in). Tags are what the user
 * logged; the AHI column comes straight from history.js so it always matches
 * Tonight, Trends and compliance. Newest first. */
const CHECKIN_TAGS = {
  '2026-10-10': ['tired', 'alcohol', 'late_meal'],
  '2026-10-07': ['tired', 'worked_late'],
  '2026-10-06': ['sore', 'headache', 'late_meal'],
  '2026-10-05': ['rested', 'exercised'],
  '2026-10-04': ['rested'],
  '2026-10-03': ['tired', 'alcohol'],
  '2026-10-02': ['rested', 'exercised'],
  '2026-10-01': ['foggy', 'late_meal'],
  '2026-09-30': ['anxious', 'tired'], // first night on CPAP
};

export const JOURNAL_HISTORY = NIGHTS.filter((x) => CHECKIN_TAGS[x.date])
  .reverse()
  .map((x) => {
    const d = toDate(x.date);
    const total = ahiTotal(x);
    return {
      date: fmtDayShort(x.date),
      month: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      tags: CHECKIN_TAGS[x.date],
      ahi: total == null ? '—' : total.toFixed(1),
    };
  });
