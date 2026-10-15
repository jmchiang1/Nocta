/* Nocta — when each part was last replaced, as the person logged it. The CPAP
 * card can't know this, so a part with no logged date has no age: it says
 * "not logged", never a guess. Kept on this device (localStorage). */

const KEY = 'nocta.equipment.v1';

/* recommended replacement intervals (FEATURES.md › Equipment) */
export const PARTS = [
  { id: 'cushion', name: 'Mask cushion', lifespanDays: 30 },
  { id: 'frame', name: 'Mask frame', lifespanDays: 90 },
  { id: 'filter', name: 'Air filter', lifespanDays: 30 },
  { id: 'tubing', name: 'Tubing', lifespanDays: 90 },
  { id: 'chamber', name: 'Water chamber', lifespanDays: 180 },
  { id: 'headgear', name: 'Headgear', lifespanDays: 180 },
];

let logged = load();
const listeners = new Set();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export const onEquipment = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/* date: 'YYYY-MM-DD', or null to clear */
export function logReplaced(partId, date) {
  logged = { ...logged };
  if (date) logged[partId] = date;
  else delete logged[partId];
  try {
    localStorage.setItem(KEY, JSON.stringify(logged));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(logged));
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const TODAY = todayIso;

/* every part with its logged date and age in days (null when not logged) */
export function equipmentStatus() {
  const today = Date.parse(`${todayIso()}T00:00:00`);
  return PARTS.map((p) => {
    const on = logged[p.id] ?? null;
    const ageDays = on ? Math.max(0, Math.round((today - Date.parse(`${on}T00:00:00`)) / 864e5)) : null;
    return { ...p, replacedOn: on, ageDays };
  });
}
