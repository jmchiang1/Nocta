/* Nocta — morning check-ins, one per night (keyed by the night's date, the
 * evening it started). The insights read them (lib/insights.js): what someone
 * logged can back up what the machine saw ("you noted the mask felt leaky"),
 * and a night without a check-in simply leans on the machine alone.
 *
 * Plain module + localStorage, like lib/profile.js; the app store mirrors the
 * current night's entry in state. Migrates the old single check-in
 * (nocta.checkin.v1, which was always "this morning"). */

const KEY = 'nocta.checkins.v2';
const OLD_KEY = 'nocta.checkin.v1';

let byDate = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* ignore */
  }
  return {};
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(byDate));
  } catch {
    /* ignore */
  }
}

/* the one-off move from the old single check-in: it belonged to whatever
 * night was "last night" when it was made, which is the latest night now */
export function migrateOldCheckin(lastNight) {
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (old?.done && lastNight && !byDate[lastNight]) {
      byDate[lastNight] = old.tags;
      save();
    }
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* ignore */
  }
}

/* tags for a night ({ feel:[…], during:[…], … }) or null if none was done */
export const getCheckin = (date) => byDate[date] ?? null;
export const checkinDates = () => Object.keys(byDate).sort();

export function setCheckin(date, tags) {
  byDate = { ...byDate, [date]: tags };
  save();
}

export function clearCheckin(date) {
  const { [date]: _, ...rest } = byDate;
  byDate = rest;
  save();
}

/* every tag id logged for a night, flat (no "nothing_*" placeholders) */
export function checkinTags(date) {
  const t = byDate[date];
  if (!t) return null;
  return Object.values(t)
    .flat()
    .filter((id) => !id.startsWith('nothing_'));
}
