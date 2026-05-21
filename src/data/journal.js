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

/* Journal history — every morning check-in across the user's therapy so far.
 * Sorted newest first. `month` is the group label used by the Sleep journal
 * subpage on Trends (collapsible month sections). */
export const JOURNAL_HISTORY = [
  // June 2026
  { date: 'Sat, Jun 6', month: 'June 2026', tags: ['tired', 'late_meal', 'worked_late'], ahi: '6.4' },
  { date: 'Fri, Jun 5', month: 'June 2026', tags: ['rested', 'exercised'], ahi: '3.1' },
  { date: 'Thu, Jun 4', month: 'June 2026', tags: ['foggy', 'alcohol'], ahi: '7.8' },
  { date: 'Wed, Jun 3', month: 'June 2026', tags: ['rested', 'nothing_lastnight'], ahi: '4.2' },
  { date: 'Tue, Jun 2', month: 'June 2026', tags: ['sore', 'headache', 'late_meal'], ahi: '12.1' },
  { date: 'Mon, Jun 1', month: 'June 2026', tags: ['rested', 'exercised'], ahi: '2.6' },
  // May 2026
  { date: 'Sun, May 31', month: 'May 2026', tags: ['rested'], ahi: '3.5' },
  { date: 'Sat, May 30', month: 'May 2026', tags: ['tired', 'alcohol'], ahi: '5.8' },
  { date: 'Fri, May 29', month: 'May 2026', tags: ['rested', 'exercised'], ahi: '2.8' },
  { date: 'Thu, May 28', month: 'May 2026', tags: ['foggy', 'late_meal'], ahi: '6.1' },
  { date: 'Wed, May 27', month: 'May 2026', tags: ['tired', 'worked_late'], ahi: '5.4' },
  { date: 'Tue, May 26', month: 'May 2026', tags: ['rested'], ahi: '3.7' },
  { date: 'Mon, May 25', month: 'May 2026', tags: ['congested', 'cold_meds'], ahi: '7.2' },
  { date: 'Sun, May 24', month: 'May 2026', tags: ['tired', 'traveled'], ahi: '6.8' },
  { date: 'Sat, May 23', month: 'May 2026', tags: ['rested', 'exercised'], ahi: '3.1' },
  { date: 'Fri, May 22', month: 'May 2026', tags: ['sore', 'stressed'], ahi: '4.9' },
  { date: 'Thu, May 21', month: 'May 2026', tags: ['rested'], ahi: '3.4' },
  { date: 'Tue, May 19', month: 'May 2026', tags: ['foggy', 'alcohol'], ahi: '6.5' },
  { date: 'Mon, May 18', month: 'May 2026', tags: ['rested', 'exercised'], ahi: '2.9' },
  { date: 'Fri, May 15', month: 'May 2026', tags: ['tired', 'late_meal'], ahi: '5.7' },
  { date: 'Wed, May 13', month: 'May 2026', tags: ['rested'], ahi: '3.6' },
  { date: 'Sun, May 10', month: 'May 2026', tags: ['tired', 'alcohol', 'late_meal'], ahi: '8.1' },
  { date: 'Fri, May 1', month: 'May 2026', tags: ['rested', 'exercised'], ahi: '3.0' },
  // April 2026
  { date: 'Tue, Apr 28', month: 'April 2026', tags: ['rested'], ahi: '4.0' },
  { date: 'Sat, Apr 25', month: 'April 2026', tags: ['rested', 'exercised'], ahi: '3.2' },
  { date: 'Tue, Apr 21', month: 'April 2026', tags: ['tired', 'worked_late'], ahi: '5.5' },
  { date: 'Sat, Apr 18', month: 'April 2026', tags: ['foggy', 'alcohol'], ahi: '7.0' },
];
