# Nocta — Design system

The visual language is documented as design tokens. The reference implementation lives in
`reference/nocta-home.html` — match that, don't reinvent it.

## Core decisions (already made, do not relitigate)

- **Dark first.** A sleep app opens at 6am exhausted. Dark mode is default.
- **Tinted darks, not pure black.** Pure `#000` causes halation and visual fatigue.
- **One accent color, used meaningfully.** Warm peach is the *exclusive* AI/Coach color.
- **No CSS framework.** Tokens are CSS variables. Components are plain CSS.

---

## Color tokens

```css
:root {
  /* surfaces */
  --bg-base:           #0b1020;  /* deep midnight navy */
  --bg-grad-top:       #121830;  /* hero gradient top */
  --bg-grad-bottom:    #080d1c;  /* hero gradient bottom */
  --surface-1:         #141a2e;  /* default card */
  --surface-2:         #1c233e;  /* elevated card */
  --surface-3:         #242c4d;  /* modal / sheet */
  --hairline:          rgba(255,255,255,0.06);
  --hairline-strong:   rgba(255,255,255,0.10);

  /* text */
  --text-primary:      #ecf0fb;  /* off-white, never pure white */
  --text-secondary:    #9aa3c0;
  --text-tertiary:     #6b7396;
  --text-on-accent:    #1a1424;  /* near-black for type on peach */

  /* brand — AI/Coach moments only */
  --accent:            #f0a47a;  /* sunrise peach */
  --accent-soft:       #f4b896;
  --accent-deep:       #d97f4f;
  --accent-glow:       rgba(240,164,122,0.18);

  /* semantic state */
  --good:              #7dc99a;  /* muted sage */
  --watch:             #e6b85c;  /* amber */
  --alert:             #e07a6a;  /* warm coral, never pure red */

  /* data viz — default chart palette */
  --data-1:            #7b95d8;  /* primary data blue */
  --data-2:            #5f7bc4;
  --data-faint:        rgba(123,149,216,0.25);

  /* sleep stages — used only on hypnograms */
  --stage-awake:       #e07a6a;
  --stage-rem:         #b587d9;
  --stage-light:       #7c95c8;
  --stage-deep:        #2e4180;
}
```

### Color usage rules

- **Peach is sacred.** It appears on: hero why-card accent rail, hero CTA chip, Coach FAB,
  "Ask Nocta" chips, journal icons, AI Coach voice italics. It does **not** appear on
  charts, on neutral CTAs, or as decoration.
- **Semantic colors only signal state.** Sage = in-range / win. Amber = watch / mild.
  Coral = alert / out-of-range.
- **Charts default to a single muted blue.** Color bars semantically only when the value
  crosses a threshold. Never a rainbow palette.
- **Event markers use shape AND color** so they're distinguishable to colorblind users:
  CSA = triangle, OSA = diamond, leak = circle.

---

## Typography

Two fonts, loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **Fraunces** — display headlines, large numerals, AI Coach voice. Italic for AI Coach
  emphasis only.
- **Inter** — body, UI chrome, labels, metric subtitles, all buttons.

```css
:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body:    'Inter', -apple-system, system-ui, sans-serif;
}
```

### Type scale

| Token | Size / Font | Use |
|---|---|---|
| `--type-display-xl` | 64px / Fraunces 400 | Hero numerals (AHI value) |
| `--type-display-lg` | 32px / Fraunces 500 | Page titles ("Saturday") |
| `--type-display-md` | 26px / Fraunces 400 | Hero why-card headline |
| `--type-display-sm` | 22px / Fraunces 500 | Secondary metric values |
| `--type-body-lg` | 17px / Inter 500 | Insight observation body (min body size) |
| `--type-body-md` | 14.5px / Inter 400 | Default body |
| `--type-body-sm` | 13px / Inter 500 | Chips, button labels |
| `--type-label` | 11px / Inter 600, 0.12em tracking, uppercase | Eyebrows, metric labels |
| `--type-footnote` | 11px / Inter 500 | Disclaimers, axis labels |

**Rules:**

- **17pt minimum on body text, 18pt ideal.** Never weight 300, anywhere.
- **All numerical readouts use `font-feature-settings: "tnum" 1;`**.
- **Italic Fraunces is reserved for AI Coach voice moments** in display headlines.
- The `--type-label` style is the only place we use caps.

---

## Spacing scale

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px; --space-5: 20px;
  --space-6: 24px; --space-7: 32px; --space-8: 40px; --space-9: 56px; --space-10: 72px;
}
```

- Card padding: `--space-5` to `--space-6`
- Card-to-card gap: `--space-5`
- Touch target minimum height: 48px

## Radius scale

```css
:root {
  --r-sm: 10px;   /* chips, tags */
  --r-md: 16px;   /* metric cards */
  --r-lg: 22px;   /* primary cards */
  --r-xl: 28px;   /* hero cards, sheets */
  --r-pill: 999px;
}
```

## Shadows

```css
:root {
  --shadow-card:
    0 1px 0 rgba(255,255,255,0.04) inset,
    0 18px 40px -20px rgba(0,0,0,0.7);

  --shadow-fab:
    0 0 0 1px rgba(255,255,255,0.06),
    0 18px 36px -10px rgba(240,164,122,0.45),
    0 6px 14px -4px rgba(0,0,0,0.4);
}
```

Use shadows sparingly. The inset highlight + soft drop is the canonical card treatment.

---

## Component patterns

### The why-card (hero state)

The signature component. Lives at the top of Tonight tab. It surfaces **one verdict and
one action**, with the forensic detail collapsed into a tappable receipts row — never a
wall of text.

**Structure (consistent across all five states), top to bottom:**

1. **Eyebrow** — who / when, e.g. "Nocta Coach · Last night". State-coloured.
2. **Headline** — one idea, the verdict. Fraunces 30px. ≤ 9 words ideal, ≤ 14 hard max.
   Single italic emphasis via `<em>` (`accent-soft`, weight 500).
3. **Sparkline** — 32px tall. Carries timing/shape visually so the headline doesn't have to.
4. **Action box** — second-largest visual element; one concrete next step. **Omitted
   entirely for steady and insufficient-data states.**
5. **Receipts row** — tappable, collapsed by default. Format: `**{value}** · {qualifier} ·
   {time-window}`, tabular figures, bold on the primary number only. Expands to a short
   observation paragraph.
6. **Trust footer** — one line, two halves: confidence bars + "Not medical advice".

**No chip row.** The Coach FAB carries the chat affordance globally; the in-card chip was
redundant.

**Per-state styling:**

| State | Accent rail | Action box? | Eyebrow colour |
|---|---|---|---|
| Anomaly | peach | yes, peach-tinted | peach |
| Steady | sage | no | sage |
| Win | sage | yes, sage-tinted (attribution, not praise) | sage |
| Escalation | coral | yes, coral-tinted ("prepare doctor summary") | coral |
| Insufficient data | muted gray | no | muted |

**Copy rules:**

- Headline = one idea. Never a three-clause sentence.
- Win-state action is an *attribution* ("Worth noting: you logged no alcohol yesterday"),
  never praise — never "great job!".
- Escalation action is "Worth bringing up with your sleep doctor" or similar — never names
  a diagnosis.

### The pattern card (correlation insight)

- Sage accent (no peach — this is a learned pattern, not AI-generated for this night)
- 135deg radial sage tint at top-left
- Headline in Fraunces 400 18pt
- Always includes a small-stat row at bottom: three numbers in Fraunces 500 (effect size,
  sample size, data window)

### Metric cards

- **Primary metric** (AHI on Home): full-width card, 64px display numeral, baseline strip
  below, delta pill in top-right
- **Secondary metric** (in 3-column row): compact card, 22px Fraunces value, 16px
  sparkline, single-line context
- **Tertiary metric** (Trends grids): mini-tile with 18px value and sparkline

The baseline strip is the canonical "where you sit today vs. your normal range"
visualization. It replaces all donut gauges.

### Chips

- Pill-shaped, 9px 14px padding, 13px Inter 500
- Three variants: primary (peach), default (translucent), ghost (border only)
- Minimum touch target: 44px height

### Tab bar

- Floating, 16px from screen edges, 14px from bottom
- 72px tall, `--r-xl` radius
- `rgba(20,26,46,0.78)` background with `backdrop-filter: blur(28px) saturate(140%)`
- Active tab uses `var(--accent)`, inactive uses `var(--text-tertiary)`
- 4 tabs: Tonight / Trends / Therapy / You

### Coach FAB

- 48px circle, peach background, dark icon
- Bottom-right, clears the tab bar
- Static — no pulsing ring. The peach fill + glow shadow carry it; a flashing
  control reads as an alert, which is the wrong tone for a calm sleep app.
- Tap = opens Coach chat sheet (modal slide-up)

### Sparklines

- 16–36px tall depending on context
- Bars 2–3px wide with 2–3px gap
- Default bar color `var(--data-faint)`; "hot" bars `var(--data-1)` or `var(--accent)`
- Never label axes on a sparkline.

### The night timeline (signature viz)

- 76px tall canvas, background gradient `#0e1428` to `#0a0f22`
- Sleep stage bands as horizontal stripes, 64–80% opacity, `--stage-*` tokens
- Event markers absolutely positioned at their time-on-night percentage:
  - CSA: small coral triangle pointing up, coral glow
  - OSA: amber diamond (rotated square), amber glow
  - Leak: peach circle, peach glow
- Journal icons in a 22px row *above* the timeline, peach circle backgrounds
- Time axis below: 5 marks (11PM / 1AM / 3AM / 5AM / 7AM)
- Legend below: shape + label, 11px

### Forms (Morning Check-In chips)

- Multi-select chip grids
- Selected: peach background, dark text. Unselected: surface-1, secondary text.
- Min chip touch target: 48px height

---

## Motion

Minimal but intentional. Calm, not flashy.

- **Card entry**: 200ms ease-out, 8px translateY + opacity 0→1
- **Chip tap**: 100ms scale 0.97 in, 200ms scale 1 out
- **Sheet slide-up**: 300ms ease-out from bottom

Honor `prefers-reduced-motion: reduce` — disable all non-essential animation.

---

## Accessibility floors

- **Body text 17pt minimum, 18pt ideal.** Never weight 300.
- **Touch targets 48px minimum, 56px for primary CTAs.**
- **Contrast**: body ≥ 4.5:1 (AA); critical numbers/escalation ≥ 7:1 (AAA); chrome ≥ 3:1.
- **Always pair colored indicators with a shape and a text label.**
- **VoiceOver labels on every interactive element including charts.**
- **Three visible tabs always.** No hamburger menu.

---

## Patterns to deliberately avoid

- **Donut gauges** for open-ended medical metrics.
- **Rainbow chart palettes** where each metric has its own decorative hue.
- **Trophy / streak / badge gamification** of compliance.
- **Cheerleader copy** ("Great job!", "Crushing it!").
- **Red/green/yellow score bands** for clinical metrics.
- **Pure white text on pure black background.**
- **Stock photography of older people.**
- **Generic system fonts.** Fraunces + Inter is the commitment.
