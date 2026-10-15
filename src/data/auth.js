/* Nocta — sign-in copy and the mock used when Supabase isn't configured.
 * Real sign-in lives in lib/auth.jsx. In mock mode the DevPanel picks what the
 * Google account you "use" looks like, so every branch can be walked without
 * real accounts. (Apple is off for now; it returns before the App Store.) */

/* what Nocta finds for the Google account you sign in with (mock) */
export const SIGNIN_SCENARIOS = [
  { id: 'new', label: 'New to Nocta' },
  { id: 'returning', label: 'Has an account' },
  { id: 'reconnect', label: 'SleepHQ expired' },
  { id: 'deletion', label: 'Pending deletion' },
  { id: 'offline', label: 'Offline' },
];
export const DEFAULT_SIGNIN_SCENARIO = 'new';

/* deleted accounts are kept this long before they're erased for good */
export const DELETION_GRACE_DAYS = 30;
/* how far into the grace window the mock account is */
export const DELETION_DAYS_LEFT = 23;

export const PROVIDERS = {
  apple: { label: 'Apple', account: 'your Apple ID' },
  google: { label: 'Google', account: 'your Google account' },
};

/* Apple's Hide My Email hands out a random relay address — meaningless to
 * show back to the person, so name the account instead */
export const isRelayEmail = (email) => Boolean(email?.endsWith('privaterelay.appleid.com'));
export const accountName = (user) =>
  user?.email && !isRelayEmail(user.email)
    ? user.email
    : (PROVIDERS[user?.kind]?.account ?? 'your account');

export const AUTH_COPY = {
  offline: "Nocta can't reach the internet right now. Check your connection and try again.",
  generic: "Sign-in didn't finish. Please try again.",
  badCurrent: "That isn't your current password. Check it and try again.",
  deleteFailed: "Your account couldn't be deleted right now. Nothing was deleted. Please try again later.",
  unavailable: "Google sign-in isn't available right now. Use your email instead, or look around without an account.",
  rateLimited: 'Too many tries. Wait a few minutes, then try again.',
  badLogin: "That email and password don't match. Check both, or reset your password.",
  badEmail: "That doesn't look like a full email address. Check for a typo.",
  weakPassword: 'Choose a longer password: at least 8 characters, with a mix of letters and numbers.',
  samePassword: "That's your current password. Choose a new one.",
  signupClosed: "New accounts can't be made with email right now. Try Google instead.",
  cantEmail: "Nocta can't send email to that address yet. Try Google instead, or look around without an account.",
  linkExpired: 'That email link has expired. Ask for a new one below.',
  linkElsewhere: 'That link has to be opened on the same phone or browser you signed up on. Open it there, or sign in with your password.',
};

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const MIN_PASSWORD = 8;
export const RESEND_SECONDS = 30;
