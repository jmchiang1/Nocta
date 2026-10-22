/* Nocta — product analytics (PostHog). What people do in the app, never what
 * their nights say: events are named actions ("imported a card", "opened a
 * night") with a few plain properties from an allowlist, so a CPAP number,
 * a check-in answer or anything typed can't be sent even by mistake.
 *
 *   VITE_POSTHOG_KEY   phc_…  the project's public key (safe in the browser)
 *   VITE_POSTHOG_HOST  optional, defaults to PostHog's US cloud
 *
 * Without a key nothing loads and track() does nothing. With one, PostHog's
 * script is fetched only once the first event is sent, and only while
 * "Share usage data" (Settings) is on. It's on unless the person turns it
 * off, and turning it off stops capture on this device before anything else
 * is sent. Autocapture, session recording, heatmaps and surveys are all off:
 * nothing is recorded that isn't listed in EVENTS. People with an account
 * are known by their account's id (never their email); a guest is
 * anonymous. See docs/ANALYTICS_SETUP.md. */

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
export const analyticsConfigured = Boolean(KEY);

const PREF_KEY = 'nocta.analytics.v1'; // this device, every account on it
export function analyticsOn() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

/* the only properties an event may carry, and what each may hold. Anything
 * else is dropped before it leaves the device. */
const PROPS = {
  layout: ['mobile', 'desktop'],
  tab: ['tonight', 'trends', 'therapy', 'you'],
  sheet: 'name', // a sheet's kind, e.g. 'fullnight' (App.jsx SHEETS)
  step: 'name', // an onboarding step's id
  method: ['google', 'apple', 'email', 'guest'],
  provider: ['oura', 'fitbit', 'whoop', 'withings'],
  source: ['settings', 'prompt', 'tonight', 'trends', 'nav', 'button'],
  result: ['ok', 'error', 'cancelled'],
  choice: ['later', 'never'],
  late: [true, false],
  reason: 'name', // a short error code, never a message
  nights: 'count',
  files: 'count',
};
const NAME = /^[a-z][a-zA-Z0-9_-]{0,31}$/;

function clean(props = {}) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    const rule = PROPS[k];
    if (!rule) continue;
    if (Array.isArray(rule) ? rule.includes(v) : rule === 'count' ? Number.isInteger(v) && v >= 0 : NAME.test(v)) out[k] = v;
  }
  return out;
}

let ph = null; // the loaded client
let loading = null;
let queue = [];

function load() {
  if (!KEY || !analyticsOn()) return null;
  if (ph || loading) return loading;
  loading = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'localStorage', // no cookies
      person_profiles: 'identified_only', // guests stay anonymous
      autocapture: false,
      capture_pageview: false, // one page; tabs and sheets are tracked as events
      capture_pageleave: false,
      capture_dead_clicks: false,
      enable_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_performance: false,
      advanced_disable_feature_flags: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      // the page address carries no data here, but keep only its path
      sanitize_properties: (p) => {
        if (p.$current_url) p.$current_url = location.origin + location.pathname;
        return p;
      },
    });
    posthog.register({ $geoip_disable: true }); // no location looked up from the IP
    ph = posthog;
    if (import.meta.env.DEV) window.__posthog = posthog; // for checking what's sent
    queue.forEach((fn) => fn(ph));
    queue = [];
    return ph;
  });
  return loading;
}

function withClient(fn) {
  if (!KEY || !analyticsOn()) return;
  if (ph) fn(ph);
  else {
    queue.push(fn);
    load();
  }
}

/* an action. `event` is one of EVENTS (docs/ANALYTICS_SETUP.md) */
export function track(event, props) {
  const p = { ...clean(props), app_version: __APP_VERSION__ };
  withClient((c) => c.capture(event, p));
}

/* who's using it: an account by its id, a guest (or nobody) anonymous */
let known = null;
export function identify(authUser) {
  const id = authUser && authUser.kind !== 'guest' ? authUser.id : null;
  if (id === known) return;
  const was = known;
  known = id;
  if (id) withClient((c) => c.identify(id, { method: clean({ method: authUser.kind }).method }));
  else if (was) withClient((c) => c.reset()); // signed out: the next person starts fresh
}

/* Settings › Share usage data */
export function setAnalytics(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (!on) {
    queue = [];
    if (ph) {
      ph.opt_out_capturing();
      ph.reset();
    }
  } else if (ph) {
    ph.opt_in_capturing();
  }
}
