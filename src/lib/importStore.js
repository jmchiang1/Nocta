/* Nocta — imported SD card data, kept on this device in IndexedDB (a year of
 * nights with per-minute series runs a few MB — too big for localStorage).
 * Nothing here leaves the device.
 *
 * Re-importing merges by night: a card only holds so much detail, so older
 * nights from an earlier import are kept; nights on the new card replace them. */

const DB = 'nocta';
const STORE = 'imports';
const KEY = 'resmed-sd';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function loadImport() {
  try {
    return (await tx('readonly', (s) => s.get(KEY))) ?? null;
  } catch {
    return null; // private mode / storage blocked: behave as "nothing imported"
  }
}

/* merge `card` into what's stored; returns the merged result + what changed */
export async function saveImport(card) {
  const prev = await loadImport();
  const byDate = new Map((prev?.nights ?? []).map((n) => [n.date, n]));
  let added = 0;
  for (const n of card.nights) {
    if (!byDate.has(n.date)) added++;
    // detail beats summary: don't let a summary-only row replace a detailed night
    const old = byDate.get(n.date);
    if (old?.source === 'datalog' && n.source === 'summary') continue;
    byDate.set(n.date, n);
  }
  const nights = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const merged = {
    ...card,
    nights,
    range: { first: nights[0].date, last: nights.at(-1).date },
  };
  await tx('readwrite', (s) => s.put(merged, KEY));
  return { card: merged, added, updated: card.nights.length - added };
}

export async function clearImport() {
  await tx('readwrite', (s) => s.delete(KEY));
}

/* other keyed records kept beside the card in the same store (lib/wearables.js
 * keeps each wearable's synced nights here as 'wearable:<provider>') */
export async function getItem(key) {
  try {
    return (await tx('readonly', (s) => s.get(key))) ?? null;
  } catch {
    return null;
  }
}
export const putItem = (key, value) => tx('readwrite', (s) => s.put(value, key));
export const deleteItem = (key) => tx('readwrite', (s) => s.delete(key));
