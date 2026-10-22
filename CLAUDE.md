# Nocta — Project context for Claude Code

You are helping build **Nocta**, an AI-powered CPAP companion app that turns complex
CPAP therapy data into a single per-night causal narrative the user can act on.

**Read these in order before doing anything on a new session:**

1. `docs/BRIEF.md` — what Nocta is, who it's for, why it exists, the design decisions already made
2. `docs/FEATURES.md` — the v1 feature scope and what's deliberately out of scope
3. `docs/DESIGN_SYSTEM.md` — tokens, typography, components, the visual language
4. `docs/BUILD_PLAN.md` — phased build order, where to start
5. `reference/nocta-home.html` — the canonical home-screen design reference; open it in a browser before styling new screens

---

## Stack (decided for v1)

The original handoff specified vanilla HTML/CSS/JS with no build step. **That was changed
to React + Vite at build kickoff** — the five-state why-card and fixture-driven
re-rendering are materially cleaner as components. Everything else in the handoff stands.

- **Frontend**: React 18 + Vite. Plain `.jsx` components. No UI component library.
- **Styling**: hand-written CSS in plain stylesheets under `src/styles/`, token-driven via
  CSS variables (see `docs/DESIGN_SYSTEM.md`). **No Tailwind, no Bootstrap, no CSS-in-JS.**
- **Charts**: Chart.js via `react-chartjs-2` — the one approved third-party rendering
  library, used for every chart in `src/components/Charts.jsx`. Chosen at the user's
  direction (chart animations + tooltips). Canvas can't read CSS variables, so the token
  hexes are mirrored into `Charts.jsx`; keep them in sync with `styles/tokens.css`.
- **Real CPAP data**: ResMed SD card import, parsed in the browser by `src/lib/resmed/`
  (EDF reader + card reader), stored on the device in IndexedDB. Not yet wired into
  Tonight / Trends, which still read the fixtures.
- **Data (v1)**: a parsed ResMed SD card drives every screen (`src/lib/dataset.js`): the
  card imported on the device; else the bundled sample week `src/data/demoCard.json`
  (rebuild it with `node scripts/build-demo-card.mjs "CPAP Data 7 Days"`), but only for
  someone looking around without an account, on a device that has never held their own
  data; else no nights at all (Tonight and Trends show the SD import card). Once someone
  imports, the sample never shows again on that device, even after they remove the card. `history.js`
  and `fixtures.js` derive from it. No live SleepHQ or OpenAI calls — each night's
  insight JSON comes from the rule engine in `src/lib/insights.js` (detect → one
  action → the `FEATURES.md` schema), never hand-authored.
- **Auth**: Supabase Auth (`@supabase/supabase-js`, version pinned) on the shared Supabase
  project "General": Google and email + password (Apple returns before the App Store).
  "Look around without an account" is a local-only guest who skips setup; nothing of
  theirs is saved. Real when
  `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` are set in `.env.local`, mock
  otherwise. See `docs/AUTH_SETUP.md`. Never put the secret/service_role key in the app.
- **Wearables**: Oura, Fitbit (via the Google Health API), Whoop and Withings connect for real through the Supabase edge
  function `nocta-wearables` (`supabase/functions/`, tokens server-side only). Synced
  nights are cached on the device by date (`src/lib/wearables.js`) and feed only the
  "Your body overnight" cards (`src/lib/bodySource.js`), never insights or escalation.
  Needs a signed-in account; other devices are "coming soon". See `docs/WEARABLES_SETUP.md`.
- **AI (Nox chat)**: Nox is the pre-written version for now (`src/data/coach.js`). A
  smart Nox on Claude (`claude-opus-5-5`, edge function `nocta-nox`, `src/lib/nox.js`)
  is built but switched off by `VITE_NOX_SMART`; turning it on is in
  `docs/NOX_SETUP.md`, privacy-policy update included. The why-card insights are the
  rule engine (`src/lib/insights.js`), not an LLM.
- **Analytics**: PostHog (`posthog-js`, version pinned) via `src/lib/analytics.js`:
  named events only (`track()`), properties from an allowlist, never CPAP data,
  check-in answers or anything typed. Off without `VITE_POSTHOG_KEY`; people can opt
  out in Settings. Adding an event means updating `docs/ANALYTICS_SETUP.md` too.
- **Feedback**: Settings › Send feedback and a now-and-then card on Tonight write to
  Supabase `nocta_feedback` (insert-only from the app). See `docs/ANALYTICS_SETUP.md`.
- **Demo controls**: removed (2026-10-22). Test states from the browser console in dev via
  `window.__nocta` (the app store: `setTab`, `openSheet`, …).
- **Security headers**: `vercel.json` sets a strict Content-Security-Policy. Anything new
  the browser loads or calls from another host (a script, font, API, image CDN) must be
  added there, or it's blocked on the live site. Inline `<script>` is blocked too (the
  doctor report's print script is allowed by its hash; change the script, update the hash).
- **Data source (future)**: SleepHQ API (OAuth2 password grant).
- **Hosting target**: static site host (Vercel / Netlify / GitHub Pages). A serverless
  function layer is added only when real APIs come online (BUILD_PLAN Phases 3–4).

If a request would pull in a UI framework or CSS framework, push back and ask first.

---

## Project conventions

- **CSS variables for everything.** The design system is token-driven (see
  `docs/DESIGN_SYSTEM.md`). Never hardcode hex values in component CSS — pull from `:root`.
- **No CSS frameworks.** Custom CSS only, in plain stylesheets.
- **Fonts**: DM Sans (display + numerals) and Inter (body + UI). Loaded from Google Fonts
  in `index.html`.
- **Mobile-first**, 390px design width. A real responsive web app, no phone mockup: under
  768px the mobile app fills the screen; from 768px up, the desktop dashboard
  (`src/components/desktop/`). The layout follows the window width.
- **Accessibility floors**: 17pt body minimum, 48pt touch targets minimum (56pt for primary
  CTAs), WCAG AA contrast everywhere, AAA on critical numbers like AHI.
- **No emoji in UI** except inside the sleep journal context badges (food, drink, etc.).
- **Semantic HTML** in JSX. Use `<section>`, `<article>`, `<nav>`, `<button>` correctly.
  Charts get `role="img"` with a descriptive `aria-label`.
- **Tabular figures** on every numerical readout: `font-feature-settings: "tnum" 1;`.

---

## Voice and copy rules

This is the single most important non-visual constraint. Nocta's tone is what
differentiates it from myAir.

- **Honest over encouraging.** Never say "great job!" Never gamify with streaks-as-trophies.
  If the night was bad, the card says so calmly.
- **Hedged on cause.** Use "often suggests," "this pattern commonly indicates," "may be
  related to." Never "this means" or "you have."
- **One suggested action per insight.** Never bullet lists of recommendations.
- **No diagnosis language.** Never name a condition (UARS, complex apnea, CSR). Never
  recommend a pressure change. Always escalate those to "talk to your doctor."
- **Plain language.** Reading level around 7th grade.
- **Second person, present tense.** "Your AHI was 10.5 last night" — not "User's AHI..."

---

## AI safety rails — non-negotiable

The app sits in a regulatory gray zone. Cross these lines and Nocta becomes a regulated
medical device.

**Never have the AI:**
- Recommend a specific pressure setting
- Name a diagnosis or condition
- Suggest stopping or modifying therapy
- Output red/green/yellow scoring bands for clinical metrics

**Always escalate to physician (set `escalation_flag` in the insight schema):**
- Central apneas appearing or trending up in an OSA patient
- SpO₂ desaturation patterns (if connected oximeter)
- Persistent AHI > 5 after hygiene fixes (mask, position) over multiple weeks
- Anything implying complex apnea or treatment-emergent central apnea

**Every AI insight must:**
- Be shaped as typed JSON matching the schema in `FEATURES.md`
- Cite the specific data points it's reasoning from
- Include a confidence label (high / medium / low)
- Include the standard disclaimer footer

---

## Working style

- **Start small.** Build the smallest version first, get it on screen, then iterate.
- **Mock the API before integrating it.** Build against `src/data/` fixtures until the UI
  is settled.
- **Match the mockup, don't reinvent.** `reference/nocta-home.html` is the source of truth
  for visual language. New screens extend it, they don't depart from it.
- **Ask before adding a feature.** If a request implies scope creep (smart wake, social
  features, gamification), surface it and check.
- **Don't pretend a problem is solved that isn't.** If you can't get something working,
  say so explicitly with what you tried.
