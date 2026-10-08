import { NIGHTS, LAST_NIGHT, ahiTotal, toDate, fmtDayShort } from './history.js';

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
    id: 'during',
    question: 'During the night…',
    hint: 'Anything that woke you or bothered the mask.',
    options: [
      { id: 'mask_off', label: 'Took my mask off' },
      { id: 'mask_leak', label: 'Mask felt leaky' },
      { id: 'bathroom', label: 'Got up for the bathroom' },
      { id: 'woke_noise', label: 'Woken by noise or a partner' },
      { id: 'nothing_during', label: 'Nothing I noticed', exclusive: true },
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
      { id: 'sleep_aid', label: 'Something to help me sleep' },
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
      { id: 'napped', label: 'Took a nap' },
      { id: 'new_place', label: 'Slept somewhere new' },
      { id: 'nothing_yesterday', label: 'Nothing unusual', exclusive: true },
    ],
  },
];

/* an empty answer set, one list per question, and every logged tag in
 * question order (older saved check-ins may lack a newer question's list) */
export const EMPTY_CHECKIN_TAGS = Object.fromEntries(CHECKIN_SCREENS.map((s) => [s.id, []]));
export const allCheckinTags = (tags = {}) => CHECKIN_SCREENS.flatMap((s) => tags[s.id] ?? []);

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
 * Tonight, Trends and compliance. Newest first. Last night's entry comes
 * from this morning's check-in (journalHistory), so it only counts once done. */
const CHECKIN_TAGS = {
  '2026-10-07': ['tired', 'worked_late'],
  '2026-10-06': ['sore', 'headache', 'late_meal'],
  '2026-10-05': ['rested', 'exercised'],
  '2026-10-04': ['rested'],
  '2026-10-03': ['tired', 'alcohol'],
  '2026-10-02': ['rested', 'exercised'],
  '2026-10-01': ['foggy', 'late_meal'],
  '2026-09-30': ['anxious', 'tired'], // first night on CPAP
};

const entry = (x, tags) => {
  const total = ahiTotal(x);
  return {
    date: fmtDayShort(x.date),
    month: toDate(x.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    tags,
    ahi: total == null ? '—' : total.toFixed(1),
  };
};

export const JOURNAL_HISTORY = NIGHTS.filter((x) => CHECKIN_TAGS[x.date])
  .reverse()
  .map((x) => entry(x, CHECKIN_TAGS[x.date]));

/* the journal including this morning's check-in, once it's done */
export function journalHistory(checkin) {
  if (!checkin?.done) return JOURNAL_HISTORY;
  const last = NIGHTS.find((x) => x.date === LAST_NIGHT);
  const tags = allCheckinTags(checkin.tags).filter((id) => !id.startsWith('nothing_'));
  return [entry(last, tags), ...JOURNAL_HISTORY];
}
