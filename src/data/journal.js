import { NIGHTS, ahiTotal, toDate, fmtDayShort } from './history.js';
import { checkinTags } from '../lib/checkins.js';

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

/* Journal history — the morning check-ins you've actually done, one per
 * night (lib/checkins.js). The CPAP card can't know how you felt or what you
 * did before bed, so nothing is filled in. Tags are what you logged; the AHI
 * column comes straight from history.js so it always matches Tonight, Trends
 * and compliance. Newest first. */
const entry = (x, tags) => {
  const total = ahiTotal(x);
  return {
    date: fmtDayShort(x.date),
    month: toDate(x.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    tags,
    ahi: total == null ? '—' : total.toFixed(1),
  };
};

/* `checkin` (the store's last-night entry) is only a re-render hint: every
 * saved night is read from the per-night store */
export function journalHistory(_checkin) {
  return NIGHTS.filter((x) => checkinTags(x.date))
    .reverse()
    .map((x) => entry(x, checkinTags(x.date)));
}
