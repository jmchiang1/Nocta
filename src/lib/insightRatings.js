/* Nocta — "Was this helpful?" on a night's insight: 'up' or 'down', one per
 * night, kept per account on the device (lib/owner.js). Each answer also goes
 * to analytics as which kind of insight it was and the rating (never the
 * night's numbers), and, for an account that shares its nights
 * (lib/research.js), with that night's summary. */
import { ownKey, onOwner } from './owner.js';

const KEY = () => ownKey('nocta.insightRatings.v1');
let ratings = load();
const listeners = new Set();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY())) ?? {};
  } catch {
    return {};
  }
}
onOwner(() => {
  ratings = load();
  listeners.forEach((fn) => fn());
});

export const ratingFor = (date) => ratings[date] ?? null;

/* `value`: 'up' | 'down', or null to take it back */
export function rateInsight(date, value) {
  ratings = { ...ratings };
  if (value) ratings[date] = value;
  else delete ratings[date];
  try {
    localStorage.setItem(KEY(), JSON.stringify(ratings));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export const onRatings = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
