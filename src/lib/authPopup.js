/* Nocta — "Continue with Google" in a popup window, so the page never leaves.
 *
 *   page    opens a small named window on the click itself (so popup blockers
 *           allow it), asks Supabase for Google's sign-in URL without
 *           redirecting (skipBrowserRedirect), and points the window there.
 *   popup   Google sends it back to Nocta's own address (already allowed in
 *           Supabase). main.jsx sees the window's name and runs
 *           finishPopupSignIn: Supabase trades the one-time ?code for a
 *           session (saved to this origin's storage, which the page shares),
 *           the page is told over a BroadcastChannel, and the window closes.
 *
 * A BroadcastChannel rather than window.opener: Google's pages cut the link
 * back to the opener, so the popup can't reach it directly. */
import { supabase } from './supabase.js';

export const GOOGLE_POPUP = 'nocta-google';
const CHANNEL = 'nocta-auth';
const W = 480;
const H = 640;

/* open the window now, while we're still inside the click; null if blocked */
export function openSignInPopup() {
  const left = Math.round(window.screenX + (window.outerWidth - W) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - H) / 2.5);
  const win = window.open('', GOOGLE_POPUP, `popup=yes,width=${W},height=${H},left=${left},top=${top}`);
  if (!win) return null;
  try {
    win.document.title = 'Continue with Google';
    win.document.body.style.cssText =
      'margin:0;background:#05080f;color:#9aa3c0;font:15px/1.5 Inter,system-ui,sans-serif;display:grid;place-items:center;height:100vh';
    win.document.body.textContent = 'Opening Google…';
  } catch {
    /* a window left over from an earlier attempt may already be elsewhere */
  }
  return win;
}

/* the page's side: hear how the popup's sign-in went */
export function listenForPopup(onResult) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(CHANNEL);
  ch.onmessage = (e) => onResult(e.data);
  return () => ch.close();
}

/* the popup's side (main.jsx): finish, report, close */
export async function finishPopupSignIn() {
  document.body.style.cssText =
    'margin:0;background:#05080f;color:#9aa3c0;font:15px/1.5 Inter,system-ui,sans-serif;display:grid;place-items:center;height:100vh';
  document.getElementById('root').textContent = 'Signing you in…';
  const params = new URLSearchParams(window.location.search + window.location.hash.replace(/^#/, '&'));
  let result;
  if (params.get('error')) {
    // backing out of Google's screen is a choice, not an error
    const cancelled = params.get('error') === 'access_denied' || /cancel/i.test(params.get('error_description') ?? '');
    result = { type: cancelled ? 'cancelled' : 'error', code: params.get('error_code'), description: params.get('error_description') };
  } else {
    // creating the client already exchanged the ?code (detectSessionInUrl);
    // getSession waits for that to finish
    const { data, error } = await supabase.auth.getSession();
    result = data?.session ? { type: 'signed-in' } : { type: 'error', description: error?.message };
  }
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(result);
    ch.close();
  } catch {
    /* the page also picks up the session from shared storage */
  }
  window.close();
  // some browsers keep a window that wasn't closable: say what happened
  document.getElementById('root').textContent =
    result.type === 'signed-in' ? 'You’re signed in. You can close this window.' : 'Sign-in didn’t finish. You can close this window.';
}
