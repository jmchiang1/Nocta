# Nocta — Build plan

> **Stack note (build kickoff):** the original handoff specified vanilla HTML/CSS/JS. The
> build uses **React + Vite** instead — see `CLAUDE.md`. The phase ordering and the
> component breakdown below still hold; "files" map to `.jsx` components and the
> serverless phases (3–4) are deferred. v1 ships Phases 0–2 plus the remaining tabs, all
> driven by mock fixtures.

The build is phased so that something *useful* exists at the end of each phase.

---

## Phase 0 — Project skeleton

Goal: a working app with the design system in place and one mocked screen rendering.

- Vite + React project, design tokens split into `tokens.css` / `base.css` /
  `components.css` / `screens.css`.
- `src/data/fixtures.js` — mock night data.
- `src/lib/store.jsx` — in-memory + localStorage app state.
- Tonight screen rendering from a fixture; other three tabs as placeholders.
- Build the four hardcoded night fixtures (anomaly / steady / win / escalation, plus an
  insufficient-data state). Each is a fully-shaped insight-card JSON matching the schema
  in `FEATURES.md`.
- A dev fixture switcher so all card states can be exercised without an LLM.

**Done when:** Tonight renders from a fixture, you can switch states with a dev toggle,
and the other tabs are reachable placeholders.

---

## Phase 1 — Tonight tab, fully rendered from fixture data

Components to build:

1. **WhyCard** — takes an insight JSON, renders the appropriate state (anomaly / steady /
   win / escalation / insufficient_data).
2. **MetricPrimary** — AHI hero card with the horizontal baseline strip.
3. **MetricSecondary** — 3-column row component with sparkline + delta.
4. **NightTimeline** — the signature viz: stage bands + event flags + journal icons.
5. **CheckinPrompt** — Morning Check-In entry CTA, two states (not-done / done).
6. **PatternCard** — journal correlation card.

**Done when:** Tonight renders correctly from any fixture with zero hardcoded markup
specific to the data shown.

---

## Phase 2 — Full-night detail view + Morning Check-In flow

### 2a — Full-night detail view

A modal sheet (slide-up) reachable from the timeline card or by tapping any event marker.
Stacks vertically, time-aligned: hypnogram (blank "connect a wearable" CTA in v1), apnea
event markers strip, pressure curve, flow rate waveform, leak rate, snore index. Below the
charts: the **Episodes list** — every event as an expandable card with timestamp, pressure,
machine response, sleeping position, mini-waveform.

### 2b — Morning Check-In flow

Three sequential screens of multi-select chips. Skip button always visible. Progress dots.
After completion, return to Tonight with the check-in card in "done" state. Entries persist
in localStorage.

**Done when:** the user can open the full-night view, tap any event for context, and
complete a check-in that persists across reloads.

---

## Phase 3 — SleepHQ integration (deferred past v1)

Serverless auth proxy + aggregation pipeline + onboarding pairing flow. Real CPAP data
replaces fixtures. Deferred — v1 is mock-only.

## Phase 4 — AI Coach (deferred past v1)

Insight generation endpoint with OpenAI Structured Outputs, coach chat endpoint, RAG
knowledge base. Deferred — v1's why-cards are hand-authored fixtures matching the schema.

## Phase 5 — Sleep journal correlation engine

A statistical job (not an LLM) computing tag correlations. In v1 the pattern cards are
fixture-driven; the real engine lands later.

---

## Phase 6 — Trends, Therapy, You tabs

Each tab gets a focused build pass.

### Trends
- 7d / 30d / 90d / custom range selector
- Trend charts: AHI, Leak P95, Hours, Pressure (each its own card)
- Pattern cards section
- Best/worst night comparison card

### Therapy
- Device pairing status + reconnect flow
- Equipment lifecycle tracker
- View-only pressure settings ("Your prescribed range: 5–12 cmH₂O")
- Doctor PDF export button
- Compliance projection ("On track to hit compliance day 64 of 90")

### You
- Profile editing
- Journal history view
- Notification settings
- Account / signout
- Data export / delete

---

## Phase 7 — Onboarding flow

Build last, polish heavily. 8 screens per `FEATURES.md`. Defer signup until after value
has been experienced.

---

## When you get stuck

- If the design pattern in the reference HTML doesn't fit a new screen, propose a new
  pattern and update `DESIGN_SYSTEM.md`. Don't silently diverge.
- If a feature request expands scope, surface it and check before building.
- If a build decision conflicts with the voice rules, the voice wins.
