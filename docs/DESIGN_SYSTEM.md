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

- **Peach is sacred.** It appears on: hero why-card accent rail, hero CTA chip, the "Ask Nocta" Coach rows,
  "Ask Nocta" chips, journal icons, AI Coach voice italics. It does **not** appear on
  charts, on neutral CTAs, or as decoration.
- **Semantic colors only signal state.** Sage = in-range / win. Amber = watch / mild.
  Coral = alert / out-of-range.
- **Charts default to a single muted blue.** Color bars semantically only when the value
  crosses a threshold. Never a rainbow palette.
- **No red/amber/green on clinical numbers or nights.** The week strip moons are data
  blue for a logged night and coral only for an escalation night. AHI delta pills are
  neutral (the arrow carries direction). Night-chart event types are shades of blue, with
  central events turning coral only on an escalation night. Week-strip nights differ by
  shape instead: solid blue moon = logged, dim outline moon = low data, coral moon =
  escalation, small peach dot = the why-card has a suggested step. Pattern-card stats are
  `--text-primary`; the sage eyebrow marks "a learned pattern", not good news.
- **Event markers use shape AND color** so they're distinguishable to colorblind users:
  CSA = triangle, OSA = diamond, leak = circle.

---

## Typography

Two fonts, loaded from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

- **DM Sans** — display headlines, large numerals, AI Coach voice. Italic for AI Coach
  emphasis only.
- **Inter** — body, UI chrome, labels, metric subtitles, all buttons.

```css
:root {
  --font-display: 'DM Sans', system-ui, sans-serif;
  --font-body:    'Inter', -apple-system, system-ui, sans-serif;
}
```

### Type scale

| Token | Size / Font | Use |
|---|---|---|
| `--type-display-xl` | 64px / DM Sans 400 | Hero numerals (AHI value) |
| `--type-display-lg` | 32px / DM Sans 500 | Page titles ("Saturday") |
| `--type-display-md` | 26px / DM Sans 400 | Hero why-card headline |
| `--type-display-sm` | 22px / DM Sans 500 | Secondary metric values |
| `--type-body-lg` | 17px / Inter 500 | Insight observation body (min body size) |
| `--type-body-md` | 14.5px / Inter 400 | Default body |
| `--type-body-sm` | 13px / Inter 500 | Chips, button labels |
| `--type-label` | 11px / Inter 600, 0.12em tracking, uppercase | Eyebrows, metric labels |
| `--type-footnote` | 11px / Inter 500 | Disclaimers, axis labels |

**Rules:**

- **17pt minimum on body text, 18pt ideal.** Never weight 300, anywhere.
- **All numerical readouts use `font-feature-settings: "tnum" 1;`**.
- **Italic DM Sans is reserved for AI Coach voice moments** in display headlines.
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
2. **Headline** — one idea, the verdict. DM Sans 30px. ≤ 9 words ideal, ≤ 14 hard max.
   Single italic emphasis via `<em>` (`accent-soft`, weight 500).
3. **Sparkline** — 32px tall. Carries timing/shape visually so the headline doesn't have to.
4. **Action box** — second-largest visual element; one concrete next step. **Omitted
   entirely for steady and insufficient-data states.**
5. **Receipts row** — tappable, collapsed by default. Format: `**{value}** · {qualifier} ·
   {time-window}`, tabular figures, bold on the primary number only. Expands to a short
   observation paragraph.
6. **Trust footer** — one line, two halves: confidence bars + "Not medical advice".

**Doctor path.** When `escalation_flag` is `hard`, the action box becomes a button
("Prepare doctor summary") that opens the doctor summary sheet: the insight's cited numbers,
what the PDF contains, and a numbers-only PDF with no AI commentary.

**No chip row.** The card ends with a single "Ask Nocta about last night" row instead (see Coach entry); the in-card chip was
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
- Headline in DM Sans 400 18pt
- Always includes a small-stat row at bottom: three numbers in DM Sans 500 (effect size,
  sample size, data window)

### Metric cards

- **Primary metric** (AHI on Home): full-width card, 64px display numeral, baseline strip
  below, delta pill in top-right
- **Secondary metric** (in 3-column row): compact card, 22px DM Sans value, 16px
  sparkline, single-line context
- **Tertiary metric** (Trends grids): mini-tile with 18px value and sparkline

The baseline strip is the canonical "where you sit today vs. your normal range"
visualization. It replaces all donut gauges.

### Chips

- Pill-shaped, 9px 14px padding, 13px Inter 500
- Three variants: primary (peach), default (translucent), ghost (border only)
- Minimum touch target: 44px height

### Tab bar

- Floating liquid-glass capsule, 16px from screen edges, 14px from bottom, 62px tall,
  31px radius.
- Liquid glass (dark appearance) = a smoky tint (`--glass-fill`) that dims what's behind,
  a 1px specular rim (bright top-left), and an inner shadow at the base. In Chromium the
  backdrop is also **refracted**: `backdrop-filter: url(#lg-bar)` runs an SVG
  feDisplacementMap with a generated rounded-rect normal map (`LiquidGlass.jsx`), so
  content bends around the rim while the centre stays clear. Other browsers fall back to
  `blur(22px) saturate(160%) brightness(0.64)`. Other glass controls (back / close buttons, the Trends range control) use a
  *lighter* `.glass` variant: a clear lens with a faint white lift and no dimming.
- The active tab sits on a lighter glass "lens" capsule that glides between tabs.
- Icon-only, 62px tall. Labels stay in the DOM visually hidden, so VoiceOver still reads them.
- Active tab uses `var(--accent)`, inactive `var(--text-secondary)` (legible on glass).
- Compacts (scales to 80%, anchored to the bottom edge) after a sustained scroll down; returns
  to full size on scroll up / at the top or bottom / on tab change. It never leaves the screen.
- Glass surfaces carry no outer drop shadow — depth comes from the rim light and inner shadow.
- 4 tabs: Tonight / Trends / Therapy / You

### Coach entry — contextual "Ask Nocta" rows

Coach appears where there is something to ask about, not as global chrome:

- **Why-card (Tonight)** — the card's last row: "Ask Nocta about last night". This is the
  primary entry; right after reading the verdict is when "why?" comes up.
- **Insights card (Trends)** — "Ask Nocta about these trends".

Rows are 48px tall, peach text + the 22px mascot + chevron, separated by a hairline. There is
no floating button and nothing in the nav bar: a bottom-right FAB sat where a resting thumb
lands, and a header button put Coach on screens (Therapy, You) where nobody needs it.

### Mascot — the moon

`components/Mascot.jsx`. A small full moon with a bite out of the top-right corner: the
face of the Coach. It is Nocta itself, with no separate name or persona. Inline SVG
coloured from the peach tokens, because the mascot *is* the AI.

- **Where:** the "Ask Nocta" rows (22px), the desktop "Ask Nocta" button (34px), the Coach
  sheet greeting (64px) and beside each reply (24px), and the Dynamic Island during sync.
- **Optical sizes:** at 24px and below the eyes widen, the craters drop out and the bite
  grows, so it still reads at glyph size.
- **States follow the conversation, never the night.** `still` (default), `thinking`
  (Coach typing), `talking` (reply streaming), `asleep` (syncing), `waking` (one blink
  when the sync lands). No smiling at a low AHI and no frowning at a leak: a mood face
  would be a red/green score with eyes.
- Only the in-progress states move, in line with the motion rules below. The global
  reduced-motion rule stops all of it.

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

Minimal but intentional. Calm, not flashy. Tokens live in `tokens.css`; the mobile
interaction layer lives in `styles/motion.css` (scoped to `.phone`).

```css
:root {
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);     /* anything arriving */
  --ease-ios: cubic-bezier(0.32, 0.72, 0, 1);     /* sheets, pushes, indicators */
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1); /* selection moments only */
  --ease-in: cubic-bezier(0.4, 0, 1, 1);          /* anything leaving */
  --dur-press: 120ms; --dur-fast: 200ms; --dur-base: 320ms; --dur-slow: 520ms;
  --stagger: 45ms;
}
```

- **Screen arrival**: top-level blocks rise in 14px with a 45ms stagger; tab switches
  slide content in from the direction of travel.
- **Why-card**: the headline arrives word by word (the one expressive entrance, because
  it is the AI speaking), the emphasis word gets one slow sheen, then sparkline → action
  → receipts follow in reading order.
- **Numbers count up** to their value on arrival (`<CountUp>` in `lib/motion.jsx`).
- **Selection** uses one gliding indicator (tab bar pill, week-strip highlight, segmented
  thumb) rather than each item toggling its own background.
- **Press**: cards scale to 0.97; list rows highlight edge-to-edge like an iOS cell.
- **Sheets**: slide up 340ms; the app behind shrinks to a card (pushed pages parallax
  left). Drag the grip/header down to dismiss; swipe a page right to go back; Esc closes.
- **System feedback** (sync progress, confirmations) expands out of the Dynamic Island
  rather than a separate toast banner. Tonight shows shape-matched skeletons while syncing
  and supports pull-to-refresh (drag or trackpad).
- **Coach** replies stream in a few words at a time with a peach caret.
- **Looping motion only for genuine in-progress states** (sync spinner, preparing an
  export, the device "live" dot). Nothing loops to grab attention.

Honor `prefers-reduced-motion: reduce`: all durations and delays collapse to zero, numbers
land on their final value, streamed text appears whole.

---

### Tonight — interaction patterns

- **One hero.** The why-card is the only card on Tonight. "Last night" (AHI + leak /
  pressure / hours), the night chart and the early-signal pattern sit open on the page:
  big numerals, hairline dividers, no boxes-in-boxes. The non-doctor action reads as a
  sentence with a 2px state-coloured rule, not a box.
- **Swipe between nights.** Drag the why-card sideways (or two-finger swipe on a trackpad):
  it follows the finger with a slight tilt, the week-strip highlight slides toward the
  neighbouring night 1:1, and past ~24% of the card width (or a flick) it commits. The new
  night slides in from the side you swiped. Ends rubber-band. Taps inside still work.
- **Scrub the night.** Hover / drag across the night chart for a guide line, the other time
  slices dimmed, and a readout: clock time · sleep stage · events in that slice.
- **Twilight sky.** A static-palette backdrop (data blues + REM lavender, never peach) of
  three slowly drifting glows and faint stars, fading with slight parallax on scroll. The
  same every night — atmosphere, never a score.

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
- **Generic system fonts.** DM Sans + Inter is the commitment.
