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
- **Data (v1)**: mock JSON fixtures only (`src/data/`). No live SleepHQ or OpenAI calls —
  the AI insight JSON is hand-authored to match the `FEATURES.md` schema exactly.
- **AI (future)**: OpenAI API with Structured Outputs (strict JSON schema mode).
- **Data source (future)**: SleepHQ API (OAuth2 password grant).
- **Hosting target**: static site host (Vercel / Netlify / GitHub Pages). A serverless
  function layer is added only when real APIs come online (BUILD_PLAN Phases 3–4).

If a request would pull in a UI framework or CSS framework, push back and ask first.

---

## Project conventions

- **CSS variables for everything.** The design system is token-driven (see
  `docs/DESIGN_SYSTEM.md`). Never hardcode hex values in component CSS — pull from `:root`.
- **No CSS frameworks.** Custom CSS only, in plain stylesheets.
- **Fonts**: Fraunces (display + numerals) and Inter (body + UI). Loaded from Google Fonts
  in `index.html`.
- **Mobile-first**, 390px design width. Desktop is a "phone in the middle of the page".
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
