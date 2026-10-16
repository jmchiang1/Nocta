/* Nocta — who's signed in. Three ways in (screens/AuthScreen.jsx):
 *   Continue with Google       Supabase OAuth (a redirect away and back)
 *   Email + password           Supabase email auth: sign up (confirm by email
 *                              link), sign in, forgot password → set a new one
 *   Look around without one    a guest: nothing is saved, so no setup either —
 *                              a local flag on this phone, not a Supabase user
 * A guest who wants to keep things signs in with Google from You › Account,
 * which starts them as a new (or returning) account.
 *
 * With Supabase configured (lib/supabase.js) Google is real; without it, a mock
 * with the same shape runs, driven by the DevPanel's sign-in scenario.
 *
 * user: { kind: 'guest' | 'google' | 'apple' | 'email', name, email,
 *         returning,            // finished setup before, on any device
 *         deletion?, sleephqExpired? }   // mock-only account states */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, authConfigured, enabledProviders } from './supabase.js';
import { openSignInPopup, listenForPopup } from './authPopup.js';
/* mock mode only (no Supabase configured): the account a pretend Google
 * sign-in returns, standing in for what Google would share */
const MOCK_GOOGLE = { name: 'Jonathan Chiang', email: 'jonathan@example.com', photo: null };
import { AUTH_COPY } from '../data/auth.js';

const MOCK_KEY = 'nocta.mockauth.v1';
const GUEST_KEY = 'nocta.guest.v1';
const MOCK_PROVIDER_MS = 1600; // the Google sheet, mocked

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
  if (err.code === 'otp_expired') return AUTH_COPY.linkExpired;
  // they backed out of Google's screen: that's a choice, not an error
  if (err.error === 'access_denied' || /cancel/i.test(err.description ?? '')) return null;
  console.warn('[auth] sign-in failed:', err);
  return AUTH_COPY.generic;
}

const REDIRECT = authConfigured ? readRedirect() : null;
export const AUTH_LANDING = Boolean(REDIRECT?.landing);

/* Supabase email-auth errors → what the person reads */
function emailError(err) {
  const code = err?.code;
  if (err?.name === 'AuthRetryableFetchError' || err?.status === 0) return AUTH_COPY.offline;
  if (err?.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return AUTH_COPY.rateLimited;
  if (code === 'invalid_credentials') return AUTH_COPY.badLogin;
  if (code === 'weak_password') return AUTH_COPY.weakPassword;
  if (code === 'same_password') return AUTH_COPY.samePassword;
  if (code === 'email_address_invalid' || code === 'validation_failed') return AUTH_COPY.badEmail;
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return AUTH_COPY.signupClosed;
  if (code === 'email_address_not_authorized') {
    // Supabase's built-in mailer only sends to the project's team members
    console.warn('[auth] Supabase can only email team members until custom SMTP is set up (docs/AUTH_SETUP.md)');
    return AUTH_COPY.cantEmail;
  }
  console.warn('[auth]', err);
  return AUTH_COPY.generic;
}

/* Supabase user → Nocta's shape */
function fromSupabase(u) {
  if (!u) return null;
  const providers = (u.identities ?? []).map((i) => i.provider);
  const kind = providers.includes('google') ? 'google' : providers.includes('apple') ? 'apple' : 'email';
  const m = u.user_metadata ?? {};
  return {
    id: u.id, // whose data this device shows (lib/owner.js)
    kind,
    name: m.full_name || m.name || null,
    photo: m.avatar_url || m.picture || null, // what Google shares
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
function mockAccount(provider, scenario, email = MOCK_GOOGLE.email) {
  return {
    kind: provider,
    name: provider === 'email' ? null : MOCK_GOOGLE.name,
    photo: provider === 'email' ? null : MOCK_GOOGLE.photo,
    email,
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
  const [pending, setPending] = useState(null); // 'google' while the sheet is up
  const [error, setError] = useState(null); // shown on the splash
  // back from a "reset your password" link: signed in, owes a new password
  const [recovery, setRecovery] = useState(false);
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
      // an email link opened in another browser can't finish (the PKCE
      // verifier lives where sign-up started)
      else if (REDIRECT?.landing && !data.session) setError(AUTH_COPY.linkElsewhere);
      if (REDIRECT?.error) cleanUrl();
      setStatus('ready');
    });
    // keep this callback synchronous: no supabase calls inside it
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setAccount(fromSupabase(session?.user));
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
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

  /* Google's sign-in runs in a popup (lib/authPopup.js); this hears how it
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
        const popup = openSignInPopup();
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
          if (!on[provider]) {
            console.warn(`[auth] ${provider} isn't enabled in Supabase (docs/AUTH_SETUP.md)`);
            giveUp(AUTH_COPY.unavailable);
            return;
          }
        } catch (e) {
          console.warn('[auth]', e);
          giveUp(AUTH_COPY.offline);
          return;
        }
        // Google comes back to this URL with ?code=… (or ?error=…): in the
        // popup when there is one, otherwise by leaving and returning to the page
        const { data, error: err } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin + window.location.pathname,
            skipBrowserRedirect: Boolean(popup),
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

  /* backing out of Google's sign-in: Cancel on the page closes the popup
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

  /* ---- email + password ----
   * Each returns { status, message? } for the screen to act on:
   *   signedIn · confirm (check your inbox) · exists · unconfirmed · sent · error */
  const redirectTo = () => window.location.origin + window.location.pathname;
  const mockWait = () => new Promise((r) => setTimeout(r, 700));

  const signUpWithEmail = useCallback(
    async (email, password) => {
      if (offline()) return { status: 'error', message: AUTH_COPY.offline };
      if (!authConfigured) {
        await mockWait();
        return scenario === 'new' ? { status: 'confirm' } : { status: 'exists' };
      }
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo() },
      });
      if (err) {
        if (err.code === 'user_already_exists') return { status: 'exists' };
        return { status: 'error', message: emailError(err) };
      }
      // with email confirmation on, an address that's already registered comes
      // back as a user with no identities (Supabase hides which emails exist)
      if (data.user && !data.session && (data.user.identities ?? []).length === 0) return { status: 'exists' };
      if (data.session) return { status: 'signedIn' };
      return { status: 'confirm' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario]
  );

  const signInWithEmail = useCallback(
    async (email, password) => {
      if (offline()) return { status: 'error', message: AUTH_COPY.offline };
      if (!authConfigured) {
        await mockWait();
        if (scenario === 'new') return { status: 'error', message: AUTH_COPY.badLogin };
        setAccount(mockAccount('email', scenario, email));
        return { status: 'signedIn' };
      }
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err?.code === 'email_not_confirmed') return { status: 'unconfirmed' };
      if (err) return { status: 'error', message: emailError(err) };
      return { status: 'signedIn' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario]
  );

  const resendConfirmation = useCallback(
    async (email) => {
      if (offline()) return { status: 'error', message: AUTH_COPY.offline };
      if (!authConfigured) {
        await mockWait();
        return { status: 'sent' };
      }
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      return err ? { status: 'error', message: emailError(err) } : { status: 'sent' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario]
  );

  /* always reports "sent": saying otherwise would reveal who has an account */
  const sendPasswordReset = useCallback(
    async (email) => {
      if (offline()) return { status: 'error', message: AUTH_COPY.offline };
      if (!authConfigured) {
        await mockWait();
        return { status: 'sent' };
      }
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
      if (err && (err.status === 429 || err.name === 'AuthRetryableFetchError')) {
        return { status: 'error', message: emailError(err) };
      }
      if (err) console.warn('[auth]', err);
      return { status: 'sent' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario]
  );

  const updatePassword = useCallback(async (password) => {
    if (!authConfigured) {
      await mockWait();
      setRecovery(false);
      return { status: 'signedIn' };
    }
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) return { status: 'error', message: emailError(err) };
    setRecovery(false);
    return { status: 'signedIn' };
  }, []);

  /* mock only: stand in for tapping the link in the email */
  const simulateEmailLink = useCallback(
    (kind, email) => {
      if (kind === 'signup') setAccount(mockAccount('email', 'new', email));
      if (kind === 'recovery') {
        setAccount(mockAccount('email', scenario === 'new' ? 'returning' : scenario, email));
        setRecovery(true);
      }
    },
    [scenario]
  );

  /* change the password of an email account. The current password is checked
   * first (Supabase would otherwise accept any signed-in session). Google
   * accounts have no Nocta password — the screen says so instead. */
  const changePassword = useCallback(
    async (current, next) => {
      if (offline()) return { status: 'error', message: AUTH_COPY.offline };
      if (!authConfigured) {
        await mockWait();
        return current ? { status: 'done' } : { status: 'error', message: AUTH_COPY.badCurrent };
      }
      const { error: check } = await supabase.auth.signInWithPassword({ email: account?.email, password: current });
      if (check) return { status: 'error', message: check.code === 'invalid_credentials' ? AUTH_COPY.badCurrent : emailError(check) };
      const { error: err } = await supabase.auth.updateUser({ password: next });
      if (err) return { status: 'error', message: emailError(err) };
      return { status: 'done' };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, scenario]
  );

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
    setRecovery(false);
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
    authRecovery: recovery,
    changePassword,
    deleteAccount,
    signUpWithEmail,
    signInWithEmail,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    simulateEmailLink,
    signInWith,
    cancelSignIn,
    startAsGuest,
    signOutAuth,
    markOnboarded,
  };
}
