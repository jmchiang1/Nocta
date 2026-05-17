# Nocta

An AI-powered CPAP companion app that turns complex CPAP therapy data into a single
per-night causal narrative the user can act on.

> Functional prototype — v1. React + Vite, mock data only (no live SleepHQ / OpenAI calls).

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5180
npm run build    # production build to dist/
```

## What this is

A complete, clickable prototype of Nocta v1: four tabs (Tonight, Trends, Therapy, You), the
Morning Check-In flow, the full-night detail view, and the Nocta Coach chat — all driven by
hand-authored mock fixtures. The hero "why-card" exercises all five states (anomaly,
steady, win, escalation, insufficient data) via a dev fixture switcher on the Tonight tab.

## Project docs

Read in this order:

1. [`CLAUDE.md`](CLAUDE.md) — rules, conventions, stack, safety rails
2. [`docs/BRIEF.md`](docs/BRIEF.md) — what Nocta is, who it's for
3. [`docs/FEATURES.md`](docs/FEATURES.md) — v1 feature spec + AI insight JSON schema
4. [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens, type, components
5. [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) — phased build order
6. [`reference/nocta-home.html`](reference/nocta-home.html) — canonical visual reference

## A note on tone

The single most important non-visual thing about Nocta is its voice: honest over
encouraging, hedged on cause, one action per insight, never a diagnosis, never a pressure
recommendation. If a build decision conflicts with the voice rules, the voice wins.
