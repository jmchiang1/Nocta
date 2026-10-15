/* Nocta — what the person told us in onboarding (and later, through the
 * "a few quick questions" reminders). Kept on this device; the insights read
 * it (lib/insights.js) so a question someone answered changes what Nox says,
 * and one they skipped is simply not assumed.
 *
 *   answers    the onboarding fields (sleepPosition, sleepConditions, …)
 *   reminders  { off, snoozedUntil, lastShown } — the gentle nudge to answer
 *              what was skipped; `off` is the person's "don't ask again"
 *
 * Not a React store: plain getters so non-React modules (insights) can read
 * it. The app store mirrors it in state and calls save() through
 * setProfileAnswers / setReminderPrefs so screens re-render. */

const KEY = 'nocta.profile.v1';

/* the questions worth asking again, in the order they matter to the
 * insights. `answered(a)` says whether the person has given an answer
 * (an explicit "Not sure" / "Prefer not to say" counts — it's an answer). */
export const PROFILE_QUESTIONS = [
  {
    id: 'sleepPosition',
    title: 'How do you usually sleep?',
    why: 'Position often changes how your airway behaves, so it shapes what Nox suggests.',
    answered: (a) => Boolean(a.sleepPosition),
  },
  {
    id: 'complianceWindow',
    title: 'Are you in an insurance compliance window?',
    why: 'If you are, Nox keeps an eye on the 4-hour nights your insurer counts.',
    answered: (a) => Boolean(a.complianceWindow),
  },
  {
    id: 'sleepConditions',
    title: 'Anything else affecting your sleep?',
    why: 'It helps Nox tell what’s CPAP-related and what isn’t.',
    answered: (a) => Array.isArray(a.sleepConditions) && a.sleepConditions.length > 0,
  },
  {
    id: 'maskModel',
    title: 'Which mask do you use?',
    why: 'Leak looks different on every mask, and Nox reminds you before parts wear out.',
    answered: (a) => Boolean(a.maskModel),
  },
  {
    id: 'goals',
    title: 'What brings you to Nocta?',
    why: 'Nox leads with the insights that fit what you care about.',
    answered: (a) => Array.isArray(a.goals) && a.goals.length > 0,
  },
  {
    id: 'birthYear',
    title: 'What year were you born?',
    why: 'It helps Nox read your numbers against the right baseline.',
    answered: (a) => Boolean(a.birthYear),
  },
];

const EMPTY = {
  answers: {},
  photo: null, // a photo they uploaded (a small JPEG data URL), kept on this device
  checkinReminder: null, // their choice in onboarding / Settings (true / false / null = never asked)
  completedAt: null, // when onboarding finished (null: never went through it)
  reminders: { off: false, snoozedUntil: null, lastShown: null },
};

let profile = load();
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw) return { ...EMPTY, ...raw, reminders: { ...EMPTY.reminders, ...raw.reminders } };
  } catch {
    /* ignore */
  }
  return structuredClone(EMPTY);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(profile));
}

export const getProfile = () => profile;
export const getAnswers = () => profile.answers;
export const onProfile = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/* onboarding finished: keep its answers (empty strings / empty lists are
 * "skipped", so they're dropped rather than stored as answers) */
export function saveOnboardingAnswers(data) {
  const answers = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v == null || v === '' || v === false) return;
    if (Array.isArray(v) && !v.length) return;
    answers[k] = v;
  });
  profile = {
    ...profile,
    answers: { ...profile.answers, ...answers },
    checkinReminder: data.notify ? true : profile.checkinReminder ?? false,
    completedAt: new Date().toISOString(),
  };
  save();
}

export function setAnswers(patch) {
  profile = { ...profile, answers: { ...profile.answers, ...patch } };
  save();
}

export function setPhoto(dataUrl) {
  profile = { ...profile, photo: dataUrl };
  save();
}

export function setCheckinReminder(on) {
  profile = { ...profile, checkinReminder: on };
  save();
}

export function setReminders(patch) {
  profile = { ...profile, reminders: { ...profile.reminders, ...patch } };
  save();
}

export function clearProfile() {
  profile = structuredClone(EMPTY);
  save();
}

/* the questions still unanswered */
export const missingQuestions = (p = profile) => PROFILE_QUESTIONS.filter((q) => !q.answered(p.answers));

/* ---- when to remind ----
 * Gentle on purpose: not in the first two days after setup (they just
 * answered a lot), then at most once every REMIND_EVERY_DAYS, and "Not now"
 * snoozes for the same. "Don't ask again" stops it for good (Settings can
 * turn it back on). Guests never see it: nothing of theirs is saved. */
export const REMIND_EVERY_DAYS = 3;
const GRACE_DAYS = 2;
const DAY = 864e5;

export function shouldRemind(p = profile, now = Date.now()) {
  if (p.reminders.off || !missingQuestions(p).length) return false;
  if (p.completedAt && now - Date.parse(p.completedAt) < GRACE_DAYS * DAY) return false;
  if (p.reminders.snoozedUntil && now < Date.parse(p.reminders.snoozedUntil)) return false;
  return true;
}

export const snoozeReminders = (now = Date.now()) =>
  setReminders({ snoozedUntil: new Date(now + REMIND_EVERY_DAYS * DAY).toISOString(), lastShown: new Date(now).toISOString() });
