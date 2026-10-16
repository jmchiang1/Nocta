/* Nocta — which CPAP card the app is showing. One parsed card (lib/resmed
 * card.js shape) drives every screen:
 *   - the card imported on this device (importStore, IndexedDB), else
 *   - the bundled sample year (data/demoCard.json, built by
 *     scripts/build-demo-card.mjs) — only for someone just looking around
 *     (no account: a guest, or not signed in yet), and only on a device
 *     that has never held their own data, else
 *   - nothing: an empty card, and the screens say so (import your card).
 * Once someone brings in their own card, the sample never comes back on this
 * device, even if they remove it.
 *
 * The data modules (history, fixtures, …) derive everything from the card
 * and register a rebuild with onDataset(); setCard() swaps the card and
 * re-runs them in registration order (history first — the others read it).
 * The store bumps its state alongside, so the screens re-render. */
import { loadImport, moveRecords } from './importStore.js';
import { GUEST, getOwner, setOwner, ownKey, reloadOwner, takeHandoff, moveLocal } from './owner.js';

/* per account, like everything else (lib/owner.js): whose card this is */
const OWN_DATA_KEY = () => ownKey('nocta.ownData.v1');
/* no nights: what an account with no card (or a removed one) sees */
const EMPTY = { nights: [], device: null, settings: null, range: null };

let card = null;
let imported = false;
let version = 0;
let demo = null;
const rebuilds = [];

const loadDemo = async () => {
  demo ??= (await import('../data/demoCard.json')).default;
  return demo;
};

function hadOwnData() {
  try {
    return localStorage.getItem(OWN_DATA_KEY()) === '1';
  } catch {
    return false;
  }
}
function markOwnData() {
  try {
    localStorage.setItem(OWN_DATA_KEY(), '1');
  } catch {
    /* ignore */
  }
}

/* the sample is only for someone without an account (lib/owner.js) */
let sampleAllowed = getOwner() === GUEST;

const fallback = async () => (sampleAllowed && !hadOwnData() ? loadDemo() : EMPTY);

function apply(next, isImport) {
  card = next;
  imported = isImport;
  version += 1;
  rebuilds.forEach((fn) => fn(card));
}

/* setup → a new account: the card imported mid-setup (guest space) becomes
 * the account's. Then everything re-reads the account's space. */
async function adoptSetup(to) {
  await moveRecords(GUEST, to);
  moveLocal(GUEST, to);
  reloadOwner();
}

/* before the first render: this account's import, else the sample (no
 * account only) or nothing */
export async function initDataset() {
  // back from a sign-in redirect at the end of setup
  if (getOwner() !== GUEST && takeHandoff()) await adoptSetup(getOwner());
  const saved = await loadImport();
  if (saved) markOwnData();
  apply(saved ?? (await fallback()), Boolean(saved));
}

/* after an import, or a removal (null → nothing, never the sample again) */
export async function setCard(next) {
  if (next) markOwnData();
  apply(next ?? (await fallback()), Boolean(next));
}

/* sign-in changed (store.jsx): show that account's own data — or, with no
 * account, the guest's (the sample if they have none). Resolves true when
 * the space changed. */
export async function switchOwner(next) {
  const from = getOwner();
  if (next === from) return false;
  if (from === GUEST && next !== GUEST && takeHandoff()) {
    await moveRecords(GUEST, next);
    moveLocal(GUEST, next);
  }
  setOwner(next); // profile, check-ins, equipment re-read (onOwner)
  sampleAllowed = next === GUEST;
  const saved = await loadImport();
  if (saved) markOwnData();
  apply(saved ?? (await fallback()), Boolean(saved));
  return true;
}

/* who's signed in decides whether the sample may show. Resolves true when
 * the card on screen changed. (switchOwner covers it now; kept for callers.) */
export async function setSampleAllowed(allowed) {
  if (allowed === sampleAllowed) return false;
  sampleAllowed = allowed;
  if (imported) return false;
  apply(await fallback(), false);
  return true;
}

/* a data module derives from the card: run now if there is one, and again
 * whenever it changes */
export function onDataset(fn) {
  rebuilds.push(fn);
  if (card) fn(card);
}

export const getCard = () => card;
/* the card imported on this device, or null (the sample, or nothing) */
export const importedCard = () => (imported ? card : null);
/* the sample year is on screen */
export const isDemoData = () => !imported && card === demo && demo != null;
/* any nights at all (false: an account with no card yet, or a removed one) */
export const hasNights = () => (card?.nights?.length ?? 0) > 0;
export const datasetVersion = () => version;
