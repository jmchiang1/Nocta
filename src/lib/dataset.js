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
import { loadImport } from './importStore.js';

const OWN_DATA_KEY = 'nocta.ownData.v1';
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
    return localStorage.getItem(OWN_DATA_KEY) === '1';
  } catch {
    return false;
  }
}
function markOwnData() {
  try {
    localStorage.setItem(OWN_DATA_KEY, '1');
  } catch {
    /* ignore */
  }
}

/* before auth has loaded: a stored account session (Supabase's, or the
 * mock's) means an account, so no sample; a guest or nobody may look. The
 * store confirms it with setSampleAllowed() once sign-in has resolved. */
function signedInAtStart() {
  try {
    if (localStorage.getItem('nocta.guest.v1') === 'true') return false;
    if (localStorage.getItem('nocta.mockauth.v1')) return true;
    return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch {
    return false;
  }
}
let sampleAllowed = !signedInAtStart();

const fallback = async () => (sampleAllowed && !hadOwnData() ? loadDemo() : EMPTY);

function apply(next, isImport) {
  card = next;
  imported = isImport;
  version += 1;
  rebuilds.forEach((fn) => fn(card));
}

/* before the first render: the device's import, else the sample or nothing */
export async function initDataset() {
  const saved = await loadImport();
  if (saved) markOwnData();
  apply(saved ?? (await fallback()), Boolean(saved));
}

/* after an import, or a removal (null → nothing, never the sample again) */
export async function setCard(next) {
  if (next) markOwnData();
  apply(next ?? (await fallback()), Boolean(next));
}

/* who's signed in decides whether the sample may show (store.jsx, whenever
 * sign-in changes). Resolves true when the card on screen changed. */
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
