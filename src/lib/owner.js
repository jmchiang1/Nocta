/* Nocta — whose data this device is showing. Everything Nocta keeps on the
 * device (the imported card, wearable nights, onboarding answers and photo,
 * check-ins, equipment dates) is kept per account: a new account starts
 * with nothing, and one account never sees another's nights on a shared
 * browser. Someone without an account (a guest, or not signed in) has a
 * space of their own, 'guest'.
 *
 * The owner is known before the first render, from what the sign-in left in
 * localStorage (the mock account, or Supabase's stored session), so the
 * stores load the right space at startup; the app store confirms it once
 * sign-in has resolved (setOwner) and the stores reload on onOwner.
 *
 * Data saved before this existed sits under the old, plain keys. It belonged
 * to no known account, so it isn't shown to anyone (and isn't deleted). */

export const GUEST = 'guest';

/* an account's space; a guest (or nobody) shares the guest space */
export const ownerOf = (authUser) =>
  !authUser || authUser.kind === 'guest' ? GUEST : `acct:${authUser.id ?? authUser.email ?? 'unknown'}`;

function atStart() {
  try {
    if (localStorage.getItem('nocta.guest.v1') === 'true') return GUEST;
    const mock = JSON.parse(localStorage.getItem('nocta.mockauth.v1') || 'null');
    if (mock) return ownerOf(mock);
    const sb = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    const id = sb ? JSON.parse(localStorage.getItem(sb))?.user?.id : null;
    if (id) return `acct:${id}`;
  } catch {
    /* storage blocked: a guest */
  }
  return GUEST;
}

let owner = atStart();
const listeners = new Set();

export const getOwner = () => owner;

/* a storage key inside the current owner's space */
export const ownKey = (base) => `${base}@${owner}`;

/* sign-in changed: returns true when the space did */
export function setOwner(next) {
  if (next === owner) return false;
  owner = next;
  listeners.forEach((fn) => fn(owner));
  return true;
}

export const onOwner = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/* everything listening re-reads the current space (after data moved into it) */
export const reloadOwner = () => listeners.forEach((fn) => fn(owner));

/* setup → a new account: what someone set up before making their account
 * (the card imported mid-setup, saved in the guest space) belongs to that
 * account. Onboarding marks the hand-off at its account step; the account
 * that signs in next takes it over (lib/dataset.js). Signing in to an
 * existing account any other way never picks up the guest's data. */
const HANDOFF_KEY = 'nocta.setupHandoff.v1';
export function markHandoff() {
  try {
    localStorage.setItem(HANDOFF_KEY, '1');
  } catch {
    /* ignore */
  }
}
export function takeHandoff() {
  try {
    const had = localStorage.getItem(HANDOFF_KEY) === '1';
    localStorage.removeItem(HANDOFF_KEY);
    return had;
  } catch {
    return false;
  }
}

/* move one space's localStorage data into another (where the target has none) */
export function moveLocal(from, to) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('nocta.') && k.endsWith(`@${from}`))
      .forEach((k) => {
        const target = `${k.slice(0, -from.length - 1)}@${to}`;
        if (localStorage.getItem(target) == null) localStorage.setItem(target, localStorage.getItem(k));
        localStorage.removeItem(k);
      });
  } catch {
    /* ignore */
  }
}
