/* Nocta — which CPAP card the app is showing. One parsed card (lib/resmed
 * card.js shape) drives every screen: the one imported on this device
 * (importStore, IndexedDB) or, until there is one, the bundled demo year
 * (data/demoCard.json, built by scripts/build-demo-card.mjs).
 *
 * The data modules (history, fixtures, …) derive everything from the card
 * and register a rebuild with onDataset(); setCard() swaps the card and
 * re-runs them in registration order (history first — the others read it).
 * The store bumps its state alongside, so the screens re-render. */
import { loadImport } from './importStore.js';

let card = null;
let imported = false;
let version = 0;
let demo = null;
const rebuilds = [];

const loadDemo = async () => {
  demo ??= (await import('../data/demoCard.json')).default;
  return demo;
};

function apply(next, isImport) {
  card = next;
  imported = isImport;
  version += 1;
  rebuilds.forEach((fn) => fn(card));
}

/* before the first render: the device's import, else the demo year */
export async function initDataset() {
  const saved = await loadImport();
  apply(saved ?? (await loadDemo()), Boolean(saved));
}

/* after an import (or a removal: null → back to the demo year) */
export async function setCard(next) {
  apply(next ?? (await loadDemo()), Boolean(next));
}

/* a data module derives from the card: run now if there is one, and again
 * whenever it changes */
export function onDataset(fn) {
  rebuilds.push(fn);
  if (card) fn(card);
}

export const getCard = () => card;
export const isDemoData = () => !imported;
export const datasetVersion = () => version;
