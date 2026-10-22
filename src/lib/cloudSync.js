/* Nocta — an account's data follows it to every device.
 *
 * Everything Nocta keeps lives on the device first (each account in its own
 * space, lib/owner.js). With a real account, a copy is also saved to it:
 *
 *   profile            setup answers, photo, reminder choices  (nocta_user_data)
 *   checkins           morning check-ins + which were added late
 *   equipment          parts' replacement dates
 *   wearable:<p>       a connected wearable's synced nights
 *   card               the imported SD card: a gzipped file in the private
 *                      nocta-cards bucket, plus a small marker row
 *
 * Only the signed-in person can read or write their own rows and folder (RLS,
 * supabase/migrations/20261022120000_nocta_user_data.sql). Guests and the
 * mock sign-in never sync.
 *
 * How it stays in step, per kind of data:
 *   - a local change is noted (cloudChanged) and pushed a moment later
 *   - on sign-in, and when the app comes back to the front, the account's
 *     copy is pulled:
 *       changed only there  → take it
 *       changed only here   → push this one
 *       changed on both     → combine (check-ins and nights by date, the
 *                             card night by night like a re-import), push
 *   "Changed" is measured against the last time this device synced it, so a
 *   check-in deleted on one device stays deleted on the next. */
import { supabase, authConfigured } from './supabase.js';
import { getOwner, ownKey } from './owner.js';
import { loadImport, saveImport, putImport, clearImport, getItem, putItem } from './importStore.js';
import { LIVE_WEARABLES } from './wearables.js';

const TABLE = 'nocta_user_data';
const BUCKET = 'nocta-cards';
const PUSH_AFTER_MS = 1500;

/* ---- the kinds of data, and where each lives on the device ---- */
const readLS = (base) => {
  try {
    return JSON.parse(localStorage.getItem(ownKey(base)));
  } catch {
    return null;
  }
};
const writeLS = (base, value) => {
  try {
    if (value == null) localStorage.removeItem(ownKey(base));
    else localStorage.setItem(ownKey(base), JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

/* newer side wins a key both have; keys only one side has are kept */
const unionBy = (older, newer) => ({ ...(older ?? {}), ...(newer ?? {}) });
const unionNights = (older, newer) => {
  const byDate = new Map((older?.nights ?? []).map((n) => [n.date, n]));
  (newer?.nights ?? []).forEach((n) => byDate.set(n.date, n));
  return { ...(older ?? {}), ...(newer ?? {}), nights: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
};

const DOCS = {
  profile: {
    read: () => readLS('nocta.profile.v1'),
    write: (v) => writeLS('nocta.profile.v1', v),
    merge: (older, newer) => ({
      ...older,
      ...newer,
      answers: unionBy(older.answers, newer.answers),
      photo: newer.photo ?? older.photo ?? null,
    }),
  },
  checkins: {
    read: () => {
      const byDate = readLS('nocta.checkins.v2');
      const late = readLS('nocta.checkins.late.v1');
      return byDate || late ? { byDate: byDate ?? {}, late: late ?? [] } : null;
    },
    write: (v) => {
      writeLS('nocta.checkins.v2', v?.byDate ?? null);
      writeLS('nocta.checkins.late.v1', v?.late ?? null);
    },
    merge: (older, newer) => ({
      byDate: unionBy(older.byDate, newer.byDate),
      late: [...new Set([...(older.late ?? []), ...(newer.late ?? [])])],
    }),
  },
  equipment: {
    read: () => readLS('nocta.equipment.v1'),
    write: (v) => writeLS('nocta.equipment.v1', v),
    merge: unionBy,
  },
  ...Object.fromEntries(
    LIVE_WEARABLES.map((p) => [
      `wearable:${p}`,
      {
        read: () => getItem(`wearable:${p}`),
        write: (v) => putItem(`wearable:${p}`, v),
        merge: unionNights,
      },
    ])
  ),
};
const DOC_NAMES = [...Object.keys(DOCS), 'card'];

/* ---- this device's sync record, per account ----
 * changed[doc]: when it last changed here; synced[doc]: the account copy's
 * timestamp the last time this device was in step with it */
const META = 'nocta.syncMeta.v1';
const meta = () => {
  const m = readLS(META) ?? {};
  return { changed: m.changed ?? {}, synced: m.synced ?? {} };
};
const saveMeta = (m) => writeLS(META, m);

/* ---- who: only a real, signed-in account whose space is on screen ---- */
async function account() {
  if (!authConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  return id && getOwner() === `acct:${id}` ? id : null;
}

/* ---- the card file ---- */
const cardPath = (uid) => `${uid}/card.json.gz`;
async function gzipJson(value) {
  const stream = new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
async function gunzipJson(blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

/* ---- push: send this device's copy of one kind of data ---- */
async function pushDoc(uid, doc) {
  const updatedAt = new Date().toISOString();
  let value;
  if (doc === 'card') {
    const card = await loadImport();
    if (card) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(cardPath(uid), await gzipJson(card), { upsert: true, contentType: 'application/gzip' });
      if (error) throw error;
      value = { nights: card.nights.length, range: card.range ?? null };
    } else {
      await supabase.storage.from(BUCKET).remove([cardPath(uid)]);
      value = { removed: true };
    }
  } else {
    value = (await DOCS[doc].read()) ?? { removed: true };
  }
  const { error } = await supabase.from(TABLE).upsert({ user_id: uid, key: doc, value, updated_at: updatedAt });
  if (error) throw error;
  const m = meta();
  m.synced[doc] = Date.parse(updatedAt);
  saveMeta(m);
}

/* ---- noting a change made here ---- */
const timers = {};
let chain = Promise.resolve();
/* one push at a time, in order (so a fast double edit can't land out of order) */
const queue = (fn) => (chain = chain.then(fn, fn));

export function cloudChanged(doc) {
  if (!authConfigured || !DOC_NAMES.includes(doc) || !getOwner().startsWith('acct:')) return;
  const m = meta();
  m.changed[doc] = Date.now();
  saveMeta(m);
  clearTimeout(timers[doc]);
  timers[doc] = setTimeout(
    () =>
      queue(async () => {
        const uid = await account();
        if (!uid) return;
        await pushDoc(uid, doc).catch((e) => console.warn(`[sync] couldn't save ${doc}`, e));
      }),
    PUSH_AFTER_MS
  );
}

/* ---- pull: bring this device in step with the account ----
 * Resolves to the set of kinds that changed here (so screens re-read them). */
export function syncNow() {
  return queue(async () => {
    const changedHere = new Set();
    const uid = await account();
    if (!uid) return changedHere;
    const { data: rows, error } = await supabase.from(TABLE).select('key, value, updated_at');
    if (error) {
      console.warn('[sync] couldn’t read your saved data', error);
      return changedHere;
    }
    const remote = new Map(rows.map((r) => [r.key, r]));

    for (const doc of DOC_NAMES) {
      const m = meta();
      const row = remote.get(doc);
      const synced = m.synced[doc] ?? 0;
      const local = doc === 'card' ? await loadImport() : await DOCS[doc].read();
      // data from before sync existed has no record yet: it counts as a change
      const localDirty = local != null && ((m.changed[doc] ?? 0) > synced || synced === 0);
      const remoteTs = row ? Date.parse(row.updated_at) : 0;
      const remoteNew = row != null && remoteTs > synced;
      const removedThere = row?.value?.removed === true;

      try {
        if (remoteNew && !localDirty) {
          // changed only on another device: take theirs
          if (doc === 'card') {
            if (removedThere) {
              if (local) await clearImport();
            } else {
              const { data: blob, error: dl } = await supabase.storage.from(BUCKET).download(cardPath(uid));
              if (dl) throw dl;
              await putImport(await gunzipJson(blob));
            }
          } else {
            await DOCS[doc].write(removedThere ? null : row.value);
          }
          m.synced[doc] = remoteTs;
          saveMeta(m);
          changedHere.add(doc);
        } else if (remoteNew && localDirty && !removedThere) {
          // changed on both: combine, keep the combination here, send it back
          if (doc === 'card') {
            const { data: blob, error: dl } = await supabase.storage.from(BUCKET).download(cardPath(uid));
            if (dl) throw dl;
            await saveImport(await gunzipJson(blob)); // night by night, like a re-import
          } else {
            const newerIsHere = (m.changed[doc] ?? 0) > remoteTs;
            const [older, newer] = newerIsHere ? [row.value, local] : [local, row.value];
            await DOCS[doc].write(DOCS[doc].merge(older, newer));
          }
          changedHere.add(doc);
          await pushDoc(uid, doc);
        } else if (localDirty) {
          // changed only here (or removed there before this device's edit)
          await pushDoc(uid, doc);
        }
      } catch (e) {
        console.warn(`[sync] couldn't sync ${doc}`, e);
      }
    }
    return changedHere;
  });
}
