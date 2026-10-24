/* Nocta — product analytics (PostHog). What people do in the app, never what
 * their nights say: named events ("imported a card", "opened a night") with a
 * few plain properties from an allowlist, so a CPAP number, a check-in answer
 * or anything typed can't be sent even by mistake; plus masked recordings of
 * how the app is used (below).
 *
 *   VITE_POSTHOG_KEY   phc_…  the project's public key (safe in the browser)
 *   VITE_POSTHOG_HOST  optional, defaults to PostHog's US cloud
 *
 * Without a key nothing loads and track() does nothing. With one, PostHog's
 * script is fetched only once the first event is sent, and only while
 * "Share usage data" (Settings) is on. It's on unless the person turns it
 * off, and turning it off stops capture on this device before anything else
 * is sent.
 *
 * Recorded, with the content hidden (a health app; see the Privacy Policy,
 * "How you use Nocta"): session replay, autocapture (which button, never its
 * text), heatmaps and dead/rage clicks. In replays every piece of text and
 * every input is masked, and charts, the canvas and photos are blocked out
 * whole (a chart's shape alone shows someone's night), so a replay shows the
 * layout, taps and scrolling but no health data. No network bodies or
 * headers, no console. Crash reports: an uncaught error's type, message and
 * code location. IP addresses are kept, for rough location. People with an
 * account are known by their account's id only, never their email or name; a
 * guest is anonymous. See docs/ANALYTICS_SETUP.md. */

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
export const analyticsConfigured = Boolean(KEY);
// a dev server without a key still runs (mock sign-in, other sessions' tests)
if (!KEY && import.meta.env.DEV) console.info('[analytics] no VITE_POSTHOG_KEY: analytics off');

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
  method: ['google', 'microsoft', 'apple', 'email', 'guest'],
  provider: ['oura', 'fitbit', 'whoop', 'withings'],
  source: ['settings', 'prompt', 'tonight', 'trends', 'nav', 'button'],
  result: ['ok', 'error', 'cancelled'],
  choice: ['later', 'never'],
  late: [true, false],
  rating: ['up', 'down'], // Was this helpful?
  state: 'name', // an insight's card_state
  action: 'name', // an insight's action key (which tip), never its words
  reason: 'name', // a short error code, never a message
  nights: 'count',
  files: 'count',
  // appLog lines
  operation: 'name',
  outcome: 'name',
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
      // which element was clicked, never its text or attributes (a chip says
      // "Tired", a card shows an AHI)
      autocapture: { dom_event_allowlist: ['click', 'submit', 'change'], capture_copied_text: false },
      mask_all_text: true,
      mask_all_element_attributes: true,
      capture_pageview: true, // the path only (sanitize_properties)
      capture_pageleave: true,
      capture_dead_clicks: true,
      enable_heatmaps: true,
      capture_performance: false,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
      // replay: the layout and the interaction, none of the content
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '*', // every piece of text, numbers included
        // a blank box instead of: every chart and graphic (role="img" per
        // CLAUDE.md, every SVG, every canvas: a chart's shape or colours show a
        // night even with its numbers hidden), the compliance bar's met and
        // missed days, and any image that isn't one of Nocta's own files (a
        // profile photo). Icons go blank too; the layout still reads.
        // (and bars drawn from someone's data: a wearable's sleep stages, the
        // compliance marker's scale). New data-drawn parts: add their class
        // here, or put `ph-no-capture` on them.
        // Colour, position and dimming count too: the night strip and
        // calendar mark low, missed and escalated nights, the event badges'
        // colour gives the type, the delta pill the trend, dimmed hours the
        // mask coming off, the scrub marks a moment in the night.
        blockSelector: [
          '[role="img"]', 'svg', 'canvas', 'img:not([src^="/"])',
          '.pj-track', '.pj-scale', '.sleep-stages',
          '.week', '.week-indicator', '.day-dot', '.cal-day', '.nl-row', '.hour-row',
          '.ep-badge', '.ev-chip', '.delta-pill', '.er-age.alert', '.equip-summary.alert',
          '.scrub-dim', '.scrub-line',
          '.ph-no-capture',
        ].join(', '),
        // labels for screen readers and tooltips carry the same numbers as
        // the text ("AHI 2.6 on Tuesday"), so they're masked like it
        maskAttributeFn: (name, value) =>
          /^(aria-label|aria-valuetext|aria-valuenow|aria-description|title|alt|placeholder|value)$/.test(name) || name.startsWith('data-')
            ? '*'.repeat(Math.min(value.length, 8))
            : value,
        recordCrossOriginIframes: false,
        recordHeaders: false,
        recordBody: false,
      },
      enable_recording_console_log: false,
      // crash reports: uncaught errors and rejected promises (what broke and
      // where in the code, never the screen); not the console
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      // appLog lines (below) go to PostHog Logs, tagged with the build
      logs: {
        serviceName: 'nocta-web',
        environment: import.meta.env.MODE,
        serviceVersion: __APP_VERSION__,
      },
      // the page address carries no data here, but keep only its path
      sanitize_properties: (p) => {
        if (p.$current_url) p.$current_url = location.origin + location.pathname;
        return p;
      },
    });
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

/* purpose-written operational log lines (PostHog Logs), never the console.
 * The message is a fixed string from the code; attributes go through the
 * same allowlist as events. */
export const appLog = Object.freeze({
  info(body, attributes) {
    withClient((c) => c.logger?.info(body, clean(attributes)));
  },
  error(body, attributes) {
    withClient((c) => c.logger?.error(body, clean(attributes)));
  },
});

/* who's using it: an account by its id only (never its email or name), a
 * guest (or nobody) anonymous */
let known = null;
let wanted = null; // { id, method } for the account signed in, or null

function applyIdentity(client) {
  const id = wanted?.id ?? null;
  if (id === known) return;
  const was = known;
  known = id;
  if (id) {
    if (was) client.reset(); // another account, without signing out between
    client.identify(id, { method: wanted.method });
  } else if (was) client.reset(); // signed out: the next person starts fresh
}

export function identify(authUser) {
  const id = authUser && authUser.kind !== 'guest' ? authUser.id : null;
  wanted = id ? { id, method: clean({ method: authUser.kind }).method } : null;
  withClient(applyIdentity);
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
      ph.reset();
      known = null;
      ph.opt_out_capturing();
    }
  } else if (ph) {
    ph.opt_in_capturing();
    applyIdentity(ph);
  } else {
    withClient(applyIdentity);
  }
}
