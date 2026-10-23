/* Nocta — sharing nights with Nocta's makers, to improve the insights. With
 * an account, every night goes to the account's rows in nocta_research_nights
 * (supabase/migrations/…_nocta_research_nights*.sql), in full:
 *
 *   cpap        everything the card recorded for the night: sessions, AHI and
 *               every event (the event list), leak, pressure, breathing rate,
 *               oxygen, settings, and the per-minute readings. The waveform
 *               slices around events (night.waves) are left out here: they're
 *               large, and already in the account's card file (cloudSync).
 *   wearables   each connected wearable's night (sleep stages, heart rate,
 *               HRV, breathing rate, oxygen…), as synced; Fitbit only with
 *               its own opt-in (below)
 *   checkin     the morning check-in's tags, and whether it was added later
 *   insight     the one Nocta showed: state, action, escalation, confidence
 *   rating      "Was this helpful?" (lib/insightRatings.js)
 *
 * Who they are (email, name, setup answers) isn't repeated per night: it's
 * already in the account (auth.users, nocta_user_data), joined for analysis
 * in the nocta_research schema's views, which leave out anyone who turned
 * sharing off.
 *
 * On for an account unless they turn it off (Settings; the choice lives in
 * the profile, so it follows the account). Turning it off deletes their rows.
 * Never for a guest or the sample year, which stay on the device. Only the
 * nights that changed since the last send go up (a fingerprint per night,
 * kept per account on the device). */
import { supabase, authConfigured } from './supabase.js';
import { getOwner, ownKey, onOwner } from './owner.js';
import { getProfile } from './profile.js';
import { importedCard, onDataset } from './dataset.js';
import { cardNight } from '../data/history.js';
import { insightFor } from './insights.js';
import { getCheckin, isLateCheckin } from './checkins.js';
import { allWearableNights } from './wearables.js';
import { ratingFor } from './insightRatings.js';

const TABLE = 'nocta_research_nights';
const SENT_KEY = () => ownKey('nocta.researchSent.v1'); // { [date]: fingerprint }
const UNSHARE_KEY = () => ownKey('nocta.researchUnshare.v1'); // turned off, rows not yet deleted
const CHUNK = 20; // a night with its per-minute readings can be tens of KB
const SEND_AFTER_MS = 4000;

export const researchOn = () => getProfile().shareResearch !== false;

async function accountId() {
  if (!authConfigured || !getOwner().startsWith('acct:')) return null;
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  return id && getOwner() === `acct:${id}` ? id : null;
}

const readSent = () => {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY())) ?? {};
  } catch {
    return {};
  }
};
const writeSent = (m) => {
  try {
    if (m) localStorage.setItem(SENT_KEY(), JSON.stringify(m));
    else localStorage.removeItem(SENT_KEY());
  } catch {
    /* ignore */
  }
};

/* one night, as shared: the card's night in full (but its waveform slices),
 * the wearables' nights for that date, the check-in, the insight and the
 * rating. `worn`: { [date]: { [provider]: night } } */
function nightData(date, worn) {
  const x = cardNight(date);
  const wearables = worn[date] ?? null;
  if (!x && !wearables) return null;
  let cpap = null;
  let insight = null;
  if (x) {
    const { waves, demoWaves, ...rest } = x; // eslint-disable-line no-unused-vars
    cpap = rest;
    const found = x.hours > 0 ? insightFor(date) : null;
    const ins = found?.insight;
    if (ins)
      insight = {
        state: ins.card_state ?? null,
        action: found.actionKey ?? null,
        escalation: ins.escalation_flag ?? null,
        confidence: ins.confidence ?? null,
      };
  }
  return {
    cpap,
    wearables,
    checkin: getCheckin(date) ? { tags: getCheckin(date), late: isLateCheckin(date) } : null,
    insight,
    rating: ratingFor(date),
  };
}

/* Fitbit comes through Google's API, whose Limited Use rules (quoted in the
 * Privacy Policy) don't allow people to read it without the person's
 * affirmative agreement, which on-by-default isn't. So Fitbit's nights are
 * shared only once they've turned on "Let Nocta's makers see my Fitbit data"
 * (profile.shareFitbit, the Fitbit page); the other wearables' always are. */
const fitbitShared = () => getProfile().shareFitbit === true;

/* { date: { provider: night } } from every synced wearable that's shared */
function wearablesByDate() {
  const out = {};
  for (const [provider, list] of Object.entries(allWearableNights())) {
    if (provider === 'fitbit' && !fitbitShared()) continue;
    for (const n of list) (out[n.date] ??= {})[provider] = n;
  }
  return out;
}

const fingerprint = (s) => {
  const t = JSON.stringify(s);
  let h = 0;
  for (let i = 0; i < t.length; i += 1) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return h.toString(36);
};

let timer = null;
let running = null;

/* note that something changed (a card imported or synced, a check-in, a
 * rating); the changed nights go up a moment later */
export function researchChanged() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    running = (running ?? Promise.resolve()).then(send, send);
  }, SEND_AFTER_MS);
}

const pendingUnshare = () => {
  try {
    return localStorage.getItem(UNSHARE_KEY()) === '1';
  } catch {
    return false;
  }
};
const setPendingUnshare = (on) => {
  try {
    if (on) localStorage.setItem(UNSHARE_KEY(), '1');
    else localStorage.removeItem(UNSHARE_KEY());
  } catch {
    /* ignore */
  }
};

/* delete everything this account shared (turned off) */
async function unshare(uid) {
  const { error } = await supabase.from(TABLE).delete().eq('user_id', uid);
  if (error) {
    setPendingUnshare(true); // tried again on the next change or sign-in
    return false;
  }
  setPendingUnshare(false);
  writeSent(null);
  return true;
}

async function send() {
  const uid = await accountId();
  if (!uid) return;
  if (!researchOn()) {
    if (pendingUnshare()) await unshare(uid);
    return;
  }
  const card = importedCard();
  const worn = wearablesByDate();
  // every night the card has, and every night a wearable has (worn without CPAP too)
  const dates = [...new Set([...(card?.nights ?? []).map((n) => n.date), ...Object.keys(worn)])].sort();
  // nothing loaded yet (a sign-in still pulling the card): don't read that as
  // "nothing to share" and delete what was
  if (!dates.length) return;
  const sent = readSent();
  // nights sent before that aren't shared any more (Fitbit-only nights after
  // turning Fitbit sharing off, a removed card): delete them
  const keep = new Set(dates);
  const gone = Object.keys(sent).filter((d) => !keep.has(d));
  for (let i = 0; i < gone.length; i += 100) {
    const part = gone.slice(i, i + 100);
    const { error } = await supabase.from(TABLE).delete().eq('user_id', uid).in('night', part);
    if (error) return; // try again on the next change
    part.forEach((d) => delete sent[d]);
    writeSent(sent);
  }
  const rows = [];
  for (const date of dates) {
    const d = nightData(date, worn);
    if (!d) continue;
    const f = fingerprint(d);
    if (sent[date] === f) continue;
    rows.push({ row: { user_id: uid, night: date, data: d, updated_at: new Date().toISOString() }, f });
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(TABLE).upsert(part.map((r) => r.row));
    if (error) {
      console.warn('[research] couldn’t share nights', error.message);
      return; // try again on the next change
    }
    part.forEach((r) => (sent[r.row.night] = r.f));
    writeSent(sent);
  }
}

/* Settings › Share my nights: off deletes what was shared; on sends it all */
export async function setResearchSharing(on) {
  if (on) {
    setPendingUnshare(false);
    writeSent(null);
    researchChanged();
    return { ok: true };
  }
  clearTimeout(timer);
  const uid = await accountId();
  if (!uid) {
    setPendingUnshare(true); // signed out or offline: done at the next sign-in
    return { ok: false };
  }
  return { ok: await unshare(uid) };
}

// a card imported, or pulled from the account: send what's new. Another
// account signed in: start over with its own record of what was sent.
onDataset(() => researchChanged());
onOwner(() => researchChanged());
