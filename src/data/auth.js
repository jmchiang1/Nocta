/* Nocta — sign-in copy and the mock used when Supabase isn't configured.
 * Real sign-in lives in lib/auth.jsx. In mock mode the DevPanel picks what the
 * Google account you "use" looks like, so every branch can be walked without
 * real accounts. Google and Microsoft are the ways in (no email + password:
 * that needs an email sender of our own). Apple returns before the App Store. */

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

/* `id`: the provider's name in Supabase (Microsoft is "azure" there) */
export const PROVIDERS = {
  apple: { id: 'apple', label: 'Apple', account: 'your Apple ID' },
  google: { id: 'google', label: 'Google', account: 'your Google account' },
  microsoft: { id: 'azure', label: 'Microsoft', account: 'your Microsoft account' },
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
  deleteFailed: "Your account couldn't be deleted right now. Nothing was deleted. Please try again later.",
  unavailable: (label) =>
    `${label} sign-in isn't available right now. Try another way in, or look around without an account.`,
};
