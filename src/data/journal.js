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

/* journal history shown on the You tab */
export const JOURNAL_HISTORY = [
  { date: 'Fri, Jun 6', tags: ['tired', 'late_meal', 'worked_late'], ahi: '6.4' },
  { date: 'Thu, Jun 5', tags: ['rested', 'exercised'], ahi: '3.1' },
  { date: 'Wed, Jun 4', tags: ['foggy', 'alcohol'], ahi: '7.8' },
  { date: 'Tue, Jun 3', tags: ['rested', 'nothing_lastnight'], ahi: '4.2' },
  { date: 'Mon, Jun 2', tags: ['sore', 'headache', 'late_meal'], ahi: '12.1' },
  { date: 'Sun, Jun 1', tags: ['rested', 'exercised'], ahi: '2.6' },
];
