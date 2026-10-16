/* Nocta — everything Nocta holds about someone, in one place: to hand it to
 * them (Export my data) and to erase it (Delete account / guest reset).
 * All of it lives on this device; the account itself is with the sign-in
 * provider (Supabase), deleted separately by lib/auth.jsx. */
import { getProfile, clearProfile } from './profile.js';
import { checkinDates, getCheckin, clearCheckin, isLateCheckin } from './checkins.js';
import { equipmentStatus, logReplaced, PARTS } from './equipment.js';
import { loadImport, clearImport } from './importStore.js';
import { allWearableNights, clearWearableCache } from './wearables.js';

/* every key Nocta writes to localStorage (the dev panel's own is left) */
const LOCAL_KEYS = [
  'nocta.profile.v1',
  'nocta.checkins.v2',
  'nocta.checkins.late.v1',
  'nocta.checkin.v1',
  'nocta.equipment.v1',
  'nocta.setupDraft.v1',
  'nocta.onboarded.v1',
  'nocta.mockauth.v1',
  'nocta.guest.v1',
  'nocta.wearableAutoSync.v1',
];

/* a JSON file of everything, downloaded straight to the device */
export async function exportMyData(authUser) {
  const card = await loadImport();
  const p = getProfile();
  const data = {
    exportedAt: new Date().toISOString(),
    note: 'Everything Nocta holds about you. Your CPAP nights are what was read from your SD card.',
    account: authUser && authUser.kind !== 'guest' ? { signIn: authUser.kind, name: authUser.name ?? null, email: authUser.email ?? null } : null,
    profile: { answers: p.answers, setUpAt: p.completedAt, checkinReminder: p.checkinReminder, quickQuestions: p.reminders, hasPhoto: Boolean(p.photo) },
    // each night's tags, and whether it was added later rather than that morning
    checkins: Object.fromEntries(checkinDates().map((d) => [d, { tags: getCheckin(d), addedLater: isLateCheckin(d) }])),
    equipment: equipmentStatus().map(({ id, name, replacedOn }) => ({ id, name, replacedOn })),
    cpap: card ? { device: card.device, settings: card.settings, importedAt: card.importedAt, nights: card.nights } : null,
    // nights synced from connected wearables (lib/wearables.js)
    wearables: allWearableNights(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date(); // the local date, not UTC
  a.download = `nocta-my-data-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { nights: card?.nights.length ?? 0, checkins: checkinDates().length, bytes: blob.size };
}

/* erase everything Nocta keeps on this device */
export async function wipeLocalData() {
  await clearImport().catch(() => {});
  await clearWearableCache().catch(() => {});
  clearProfile();
  checkinDates().forEach(clearCheckin);
  PARTS.forEach((p) => logReplaced(p.id, null));
  LOCAL_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}
