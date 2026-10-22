/* Nocta — morning check-ins, one per night (keyed by the night's date, the
 * evening it started). The insights read them (lib/insights.js): what someone
 * logged can back up what the machine saw ("you noted the mask felt leaky"),
 * and a night without a check-in simply leans on the machine alone.
 *
 * Plain module + localStorage, like lib/profile.js; the app store mirrors the
 * current night's entry in state. Migrates the old single check-in
 * (nocta.checkin.v1, which was always "this morning"). */

import { ownKey, onOwner } from './owner.js';
import { cloudChanged } from './cloudSync.js';

// per account (lib/owner.js)
const KEY = () => ownKey('nocta.checkins.v2');
const OLD_KEY = 'nocta.checkin.v1';
/* nights whose check-in was added after that morning (from a past night on
 * Tonight). Recalled later, so the insights weigh it less. Kept apart from
 * the tags so every reader of the tags is unchanged. */
const LATE_KEY = () => ownKey('nocta.checkins.late.v1');

let byDate = load();
let late = new Set(loadLate());
// another account signed in: its own check-ins (the store re-reads them)
onOwner(() => {
  byDate = load();
  late = new Set(loadLate());
});

function loadLate() {
  try {
    const raw = JSON.parse(localStorage.getItem(LATE_KEY()));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function saveLate() {
  try {
    localStorage.setItem(LATE_KEY(), JSON.stringify([...late]));
  } catch {
    /* ignore */
  }
  cloudChanged('checkins');
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY()));
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* ignore */
  }
  return {};
}

function save() {
  try {
    localStorage.setItem(KEY(), JSON.stringify(byDate));
  } catch {
    /* ignore */
  }
  cloudChanged('checkins'); // with an account, a copy follows it (lib/cloudSync.js)
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

/* `{ late: true }` marks a check-in added after that morning; editing an
 * on-time one keeps it on time */
export function setCheckin(date, tags, { late: isLateEntry = false } = {}) {
  const wasOnTime = byDate[date] && !late.has(date);
  byDate = { ...byDate, [date]: tags };
  save();
  if (!isLateEntry) late.delete(date); // made (or redone) that morning
  else if (!wasOnTime) late.add(date); // an on-time entry edited later stays on time
  saveLate();
}

export function clearCheckin(date) {
  const { [date]: _, ...rest } = byDate;
  byDate = rest;
  save();
  late.delete(date);
  saveLate();
}

/* pick or unpick one answer to a check-in question: an "exclusive" answer
 * ("Nothing unusual") clears the others, and any other answer clears it.
 * Shared by the check-in sheet and the desktop card. */
export function toggleCheckinPick(picks, screen, opt) {
  const cur = picks[screen.id] ?? [];
  let next;
  if (cur.includes(opt.id)) next = cur.filter((x) => x !== opt.id);
  else if (opt.exclusive) next = [opt.id];
  else next = [...cur.filter((x) => !screen.options.find((o) => o.id === x)?.exclusive), opt.id];
  return { ...picks, [screen.id]: next };
}

/* was this night's check-in added later rather than that morning? */
export const isLateCheckin = (date) => late.has(date);

/* every tag id logged for a night, flat (no "nothing_*" placeholders) */
export function checkinTags(date) {
  const t = byDate[date];
  if (!t) return null;
  return Object.values(t)
    .flat()
    .filter((id) => !id.startsWith('nothing_'));
}
