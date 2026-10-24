/* Nocta — who's signed in. Three ways in (screens/AuthScreen.jsx):
 *   Continue with Google       Supabase OAuth (in a popup, or a redirect away
 *   Continue with Microsoft    and back); Microsoft is Supabase's "azure"
 *   Look around without one    a guest: nothing is saved, so no setup either —
 *                              a local flag on this phone, not a Supabase user
 * No email + password: Supabase can't send its emails to the public without an
 * email sender of Nocta's own (docs/AUTH_SETUP.md). An email account made
 * before that stays signed in until it signs out.
 * A guest who wants to keep things signs in from You › Account, which starts
 * them as a new (or returning) account.
 *
 * With Supabase configured (lib/supabase.js) sign-in is real; without it, a mock
 * with the same shape runs, driven by the DevPanel's sign-in scenario.
 *
 * user: { kind: 'guest' | 'google' | 'microsoft' | 'apple' | 'email', name, email,
 *         returning,            // finished setup before, on any device
 *         deletion?, sleephqExpired? }   // mock-only account states */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, authConfigured, enabledProviders } from './supabase.js';
import { openSignInPopup, listenForPopup } from './authPopup.js';
/* mock mode only (no Supabase configured): the account a pretend sign-in
 * returns, standing in for what Google or Microsoft would share */
const MOCK_GOOGLE = { name: 'Jonathan Chiang', email: 'jonathan@example.com', photo: null };
import { AUTH_COPY, PROVIDERS } from '../data/auth.js';

const MOCK_KEY = 'nocta.mockauth.v1';
const GUEST_KEY = 'nocta.guest.v1';
const MOCK_PROVIDER_MS = 1600; // the provider's sign-in window, mocked

const GUEST = { kind: 'guest', name: null, email: null, returning: false };

/* ---- redirect results (real mode) ----
 * Supabase sends failures back as ?error=…&error_code=…&error_description=…
 * (query or hash). Read them once, before anything rewrites the URL. */
const AUTH_PARAMS = ['error', 'error_code', 'error_description', 'sb'];

function readRedirect() {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const get = (k) => q.get(k) ?? h.get(k);
  const error = get('error');
  const code = get('error_code');
  return {
    error: error || code ? { error, code, description: get('error_description') } : null,
    // a sign-in redirect is landing right now (the code exchange is in flight)
    landing: Boolean(q.get('code')),
  };
}

function cleanUrl() {
  const url = new URL(window.location.href);
  AUTH_PARAMS.forEach((k) => url.searchParams.delete(k));
  if (/(^#|&)(error|access_token)=/.test(url.hash)) url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
}

/* turn a redirect error into the sentence the user sees (null = say nothing) */
function redirectMessage(err) {
  if (!err) return null;
  // they backed out of the provider's screen: that's a choice, not an error
  if (err.error === 'access_denied' || /cancel/i.test(err.description ?? '')) return null;
  console.warn('[auth] sign-in failed:', err);
  return AUTH_COPY.generic;
}

const REDIRECT = authConfigured ? readRedirect() : null;
export const AUTH_LANDING = Boolean(REDIRECT?.landing);

/* Supabase user → Nocta's shape */
function fromSupabase(u) {
  if (!u) return null;
  const providers = (u.identities ?? []).map((i) => i.provider);
  const kind = providers.includes('google')
    ? 'google'
    : providers.includes('azure')
      ? 'microsoft'
      : providers.includes('apple')
        ? 'apple'
        : 'email';
  const m = u.user_metadata ?? {};
  return {
    id: u.id, // whose data this device shows (lib/owner.js)
    kind,
    name: m.full_name || m.name || null,
    photo: m.avatar_url || m.picture || null, // what Google shares (Microsoft shares none)
    email: u.email || null,
    returning: m.onboarded === true,
  };
}

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* the mock account a sign-in lands on, per scenario */
function mockAccount(provider, scenario) {
  return {
    kind: provider,
    name: MOCK_GOOGLE.name,
    photo: provider === 'google' ? MOCK_GOOGLE.photo : null,
    email: MOCK_GOOGLE.email,
    returning: scenario !== 'new',
    deletion: scenario === 'deletion',
    sleephqExpired: scenario === 'reconnect',
  };
}

export function useAuth(scenario) {
  const [status, setStatus] = useState(authConfigured ? 'loading' : 'ready');
  // a signed-in account (real: Supabase; mock: localStorage)
  const [account, setAccount] = useState(() => (authConfigured ? null : load(MOCK_KEY)));
  const [guest, setGuest] = useState(() => Boolean(load(GUEST_KEY)));
  const [pending, setPending] = useState(null); // 'google' / 'microsoft' while its window is up
  const [error, setError] = useState(null); // shown on the splash
  const timer = useRef(null);

  // real: restore the session (and finish any redirect), then follow changes
  useEffect(() => {
    if (!authConfigured) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAccount(fromSupabase(data.session?.user));
      const msg = redirectMessage(REDIRECT?.error);
      if (msg) setError(msg);
      // a sign-in redirect that came back without a session (its one-time
      // code couldn't be traded, e.g. it was opened in another browser)
      else if (REDIRECT?.landing && !data.session) setError(AUTH_COPY.generic);
      if (REDIRECT?.error) cleanUrl();
      setStatus('ready');
    });
    // keep this callback synchronous: no supabase calls inside it
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(fromSupabase(session?.user));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authConfigured) save(MOCK_KEY, account);
  }, [account]);
  useEffect(() => save(GUEST_KEY, guest), [guest]);
  // a real account always wins over the guest flag
  useEffect(() => {
    if (account && guest) setGuest(false);
  }, [account, guest]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* Google's and Microsoft's sign-in runs in a popup (lib/authPopup.js); this hears how it
   * went. A sign-in also lands through onAuthStateChange (Supabase syncs the
   * new session across windows); asking again here covers browsers that
   * don't pass it on. */
  const popupRef = useRef(null);
  useEffect(() => {
    if (!authConfigured) return undefined;
    return listenForPopup(async (msg) => {
      popupRef.current = null;
      if (msg?.type === 'signed-in') {
        const { data } = await supabase.auth.getSession();
        setAccount(fromSupabase(data.session?.user));
        setPending(null);
      } else if (msg?.type === 'cancelled') {
        setPending(null);
      } else {
        console.warn('[auth] popup sign-in failed:', msg);
        setPending(null);
        setError(AUTH_COPY.generic);
      }
    });
  }, []);

  const offline = () =>
    authConfigured ? typeof navigator !== 'undefined' && navigator.onLine === false : scenario === 'offline';

  const signInWith = useCallback(
    async (provider) => {
      setError(null);
      setGuest(false);
      if (offline()) {
        setError(AUTH_COPY.offline);
        return;
      }
      setPending(provider);
      if (authConfigured) {
        // the popup has to open now, inside the click, or browsers block it;
        // it gets Google's address once we have it. null: blocked, so fall
        // back to leaving the page.
        const { id, label } = PROVIDERS[provider];
        const popup = openSignInPopup(label);
        popupRef.current = popup;
        const giveUp = (msg) => {
          popup?.close();
          popupRef.current = null;
          setPending(null);
          setError(msg);
        };
        // a provider that's switched off in Supabase would strand them on a
        // raw JSON error page — check first and stay on the splash instead
        try {
          const on = await enabledProviders();
          if (!on[id]) {
            console.warn(`[auth] ${id} isn't enabled in Supabase (docs/AUTH_SETUP.md)`);
            giveUp(AUTH_COPY.unavailable(label));
            return;
          }
        } catch (e) {
          console.warn('[auth]', e);
          giveUp(AUTH_COPY.offline);
          return;
        }
        // the provider comes back to this URL with ?code=… (or ?error=…): in
        // the popup when there is one, otherwise by leaving and returning to the page
        const { data, error: err } = await supabase.auth.signInWithOAuth({
          provider: id,
          options: {
            redirectTo: window.location.origin + window.location.pathname,
            skipBrowserRedirect: Boolean(popup),
            // Microsoft leaves the email address out unless it's asked for
            ...(id === 'azure' && { scopes: 'email' }),
          },
        });
        if (err) {
          console.warn('[auth]', err);
          giveUp(AUTH_COPY.generic);
          return;
        }
        if (popup) {
          popup.location.replace(data.url);
          popup.focus();
        }
        return;
      }
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPending(null);
        setAccount(mockAccount(provider, scenario));
      }, MOCK_PROVIDER_MS);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario]
  );

  /* backing out of the provider's sign-in: Cancel on the page closes the popup
   * (mock: stops the pretend sheet) */
  const cancelSignIn = useCallback(() => {
    clearTimeout(timer.current);
    popupRef.current?.close();
    popupRef.current = null;
    setPending(null);
  }, []);

  /* no account, no network needed: straight in, nothing saved */
  const startAsGuest = useCallback(() => {
    setError(null);
    setGuest(true);
  }, []);

  const mockWait = () => new Promise((r) => setTimeout(r, 700));

  /* delete the account on the server (the delete-account Edge Function —
   * a browser can't delete its own user), then sign out here. Local data is
   * wiped by the caller (lib/accountData.js). */
  const deleteAccount = useCallback(async () => {
    if (offline()) return { status: 'error', message: AUTH_COPY.offline };
    if (!authConfigured) {
      await mockWait();
      setAccount(null);
      return { status: 'done' };
    }
    const { error: err } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (err) {
      console.warn('[auth] delete-account failed', err);
      return { status: 'error', message: AUTH_COPY.deleteFailed };
    }
    await supabase.auth.signOut();
    setAccount(null);
    return { status: 'done' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const signOutAuth = useCallback(async () => {
    clearTimeout(timer.current);
    setPending(null);
    setGuest(false);
    setAccount(null);
    if (authConfigured) await supabase.auth.signOut();
  }, []);

  /* setup finished: the next sign-in on any device skips it */
  const markOnboarded = useCallback(async () => {
    setAccount((u) => (u ? { ...u, returning: true } : u));
    if (authConfigured) {
      const { error: err } = await supabase.auth.updateUser({ data: { onboarded: true } });
      if (err) console.warn('[auth] could not save onboarded flag', err);
    }
  }, []);

  return {
    authConfigured,
    authStatus: status,
    authUser: account ?? (guest ? GUEST : null),
    authPending: pending,
    authError: error,
    clearAuthError: useCallback(() => setError(null), []),
    deleteAccount,
    signInWith,
    cancelSignIn,
    startAsGuest,
    signOutAuth,
    markOnboarded,
  };
}
