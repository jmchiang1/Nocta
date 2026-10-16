/* Nocta — real wearables: Oura, Fitbit (through the Google Health API), Whoop,
 * Withings. The app never sees a provider token. It talks to the nocta-wearables edge function
 * (supabase/functions, docs/WEARABLES_SETUP.md), which holds the tokens and
 * hands back nights in one shape (see providers.ts for the fields).
 *
 * Synced nights are kept on this device (IndexedDB, beside the SD card) and in
 * memory for rendering, keyed by date: the evening the night started, the same
 * id every CPAP night has. lib/bodySource.js reads them per night.
 *
 * Connecting needs a real account: a guest has no Supabase user to tie the
 * connection to. */
import { supabase, authConfigured } from './supabase.js';
import { getItem, putItem, deleteItem } from './importStore.js';

export const LIVE_WEARABLES = ['oura', 'fitbit', 'whoop', 'withings'];
export const isLiveWearable = (key) => LIVE_WEARABLES.includes(key);

/* Supabase is set up and someone is signed in (not a guest) */
export const wearablesReadyFor = (authUser) => authConfigured && !!authUser && authUser.kind !== 'guest';

/* ---- coming back from the provider's approve screen ----
 * Connect opens the provider in a new tab. The function sends that tab back to
 * Nocta with ?wearable=<p>&result=connected|denied|error, plus our own
 * wearable_tab=1 marker. That tab only reports the result over a
 * BroadcastChannel and closes (main.jsx → finishWearableTab); the tab that
 * started Connect hears it (listenForWearableReturn). A marker in the URL
 * rather than window.name: browsers can clear a tab's name when it visits
 * another site.
 *
 * If the tab was blocked, this tab went instead: the result is read here at
 * startup and the store acts on it after the session is restored. */
const CHANNEL = 'nocta-wearables';
let pendingReturn = null;
if (typeof window !== 'undefined') {
  const url = new URL(window.location.href);
  const provider = url.searchParams.get('wearable');
  const result = url.searchParams.get('result');
  if (provider && result) {
    if (isLiveWearable(provider)) pendingReturn = { provider, result, tab: url.searchParams.get('wearable_tab') === '1' };
    ['wearable', 'result', 'wearable_tab'].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, '', url.toString());
  }
}

/* this tab is the one the provider sent back: report and close, no app */
export const isWearableTab = () => pendingReturn?.tab === true;

const TAB_STYLE =
  'margin:0;background:#090d1a;color:#9aa3c0;font:15px/1.5 Inter,system-ui,sans-serif;display:grid;place-items:center;height:100vh;text-align:center;padding:0 24px';

export function finishWearableTab() {
  const back = takeWearableReturn();
  document.body.style.cssText = TAB_STYLE;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ provider: back.provider, result: back.result });
    ch.close();
  } catch {
    /* the Nocta tab still sees the connection the next time it checks */
  }
  window.close();
  // some browsers keep a tab that wasn't closable: say what happened
  document.getElementById('root').textContent =
    back.result === 'connected'
      ? 'Connected. You can close this tab and go back to Nocta.'
      : 'That didn’t finish connecting. You can close this tab and try again in Nocta.';
}

/* the Nocta tab's side: hear how the provider tab went */
export function listenForWearableReturn(onReturn) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e) => {
    if (isLiveWearable(e.data?.provider)) onReturn(e.data);
  };
  return () => ch.close();
}

export function takeWearableReturn() {
  const r = pendingReturn;
  pendingReturn = null;
  return r;
}

/* ---- the edge function ---- */
async function call(route, body = {}) {
  const { data, error } = await supabase.functions.invoke(`nocta-wearables/${route}`, { body });
  if (error) {
    let code = 'failed';
    try {
      code = (await error.context.json()).error ?? code;
    } catch {
      /* not JSON: network or gateway */
    }
    const err = new Error(`[wearables] ${route}: ${code}`);
    err.code = code;
    throw err;
  }
  return data;
}

/* { available: ['oura', …] (set up on the server), links: [{ provider, connectedAt, lastSyncAt }] } */
export const fetchWearableStatus = () => call('status');

/* Opens the provider's approve screen in a new tab. The tab is opened on the
 * click itself, before anything is awaited, so popup blockers allow it; if
 * it's blocked anyway, this tab goes instead. → 'tab' | 'redirect' */
export async function startWearableConnect(provider, title = 'your wearable') {
  const tab = window.open('', '_blank');
  if (tab) {
    try {
      tab.document.title = `Connect ${title}`;
      tab.document.body.style.cssText = TAB_STYLE;
      tab.document.body.textContent = `Opening ${title}…`;
    } catch {
      /* nothing to dress up */
    }
  }
  try {
    const here = window.location.origin + window.location.pathname;
    const { url } = await call('start', { provider, returnTo: tab ? `${here}?wearable_tab=1` : here });
    if (tab && !tab.closed) {
      tab.opener = null; // the provider's pages get no handle back to Nocta
      tab.location.href = url;
      return 'tab';
    }
    window.location.assign(url);
    return 'redirect';
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export async function disconnectWearable(provider) {
  await call('disconnect', { provider });
}

/* ---- synced nights: memory for render, IndexedDB for the next open ---- */
const nights = Object.fromEntries(LIVE_WEARABLES.map((p) => [p, new Map()]));
const storeKey = (p) => `wearable:${p}`;

export async function loadWearableCache() {
  await Promise.all(
    LIVE_WEARABLES.map(async (p) => {
      const saved = await getItem(storeKey(p));
      nights[p] = new Map((saved?.nights ?? []).map((n) => [n.date, n]));
    })
  );
}

/* signing out: this device shouldn't keep someone's nights */
export async function clearWearableCache() {
  LIVE_WEARABLES.forEach((p) => nights[p].clear());
  await Promise.all(LIVE_WEARABLES.map((p) => deleteItem(storeKey(p)).catch(() => {})));
}

export const wearableNight = (provider, date) => nights[provider]?.get(date) ?? null;

/* every synced night, per wearable that has any (Export my data) */
export const allWearableNights = () =>
  Object.fromEntries(
    LIVE_WEARABLES.filter((p) => nights[p].size)
      .map((p) => [p, [...nights[p].values()].sort((a, b) => a.date.localeCompare(b.date))])
  );

/* the nights before `date` (newest first), for "your usual" ranges */
export function wearableNightsBefore(provider, date, n) {
  return [...(nights[provider]?.values() ?? [])]
    .filter((x) => x.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

const shiftDate = (ymd, days) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/* Pull new nights. The first sync backfills 90 nights; later ones start two
 * nights before the newest we have, since a wearable can rescore a recent
 * night. One sync per provider at a time: Whoop's refresh tokens rotate,
 * so two at once can knock each other out.
 * → { nights: how many came back, syncedAt, throttled? } */
const inflight = {};
export function syncWearable(provider) {
  inflight[provider] ??= (async () => {
    try {
      const have = [...nights[provider].keys()].sort();
      const since = have.length ? shiftDate(have.at(-1), -2) : undefined;
      const res = await call('sync', { provider, since });
      if (res.throttled) return { nights: 0, syncedAt: res.syncedAt, throttled: true };
      res.nights.forEach((n) => nights[provider].set(n.date, n));
      await putItem(storeKey(provider), { nights: [...nights[provider].values()], syncedAt: res.syncedAt });
      return { nights: res.nights.length, syncedAt: res.syncedAt };
    } finally {
      delete inflight[provider];
    }
  })();
  return inflight[provider];
}

/* '2026-10-15T23:40:00Z' → 'just now' · '12 min ago' · '3 h ago' · 'yesterday' · 'Oct 12' */
export function syncedAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  if (mins < 48 * 60) return 'yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* the one-line status under a connected wearable's row (You tab) */
export function wearableStatusLine(link) {
  if (!link) return 'Connected';
  if (link.needsReconnect) return 'Needs reconnecting';
  if (link.syncing) return 'Syncing…';
  if (link.test) return 'Test data (sandbox)';
  return link.lastSyncAt ? `Synced ${syncedAgo(link.lastSyncAt)}` : 'Connected';
}
