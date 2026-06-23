# Nocta — Brief

## One-line position

**Nocta is the first CPAP companion app that respects you enough to tell you the truth, beautifully.**

Bridging the gap between *"your score is 92, great job!"* (myAir) and *"here's a
breath-by-breath flow rate waveform with custom event flags"* (OSCAR), with AI that earns
trust by showing its work and a warm dark interface that signals comfort rather than clinic.

## The problem

Sleep apnea affects roughly 30 million Americans, but only ~6.8% are diagnosed *and* stick
with treatment long term. CPAP therapy is dropped because it feels opaque — users can't
tell why a night was good or bad, can't self-diagnose simple problems (mask leak, position,
mouth breathing), and can't tell whether trends are improving.

The CPAP app market today is bimodal:

- **Manufacturer apps** (ResMed myAir, Philips DreamMapper) gamify compliance with
  composite scores that can read 81/100 while AHI is at 16 (untreated). The 0–100 score
  weights usage hours at 70% and AHI at 5%. Users discover the score lies, lose trust, and
  "graduate" to OSCAR.
- **Power-user tools** (OSCAR, SleepHQ) show every breath, every waveform, every event —
  but they're built by and for engineers. *"I have always found looking at OSCAR reports
  to be hard to understand"* is the recurring forum complaint.

**Nobody owns the unfilled middle**: clinically honest depth, delivered in a calm, modern
interface, with AI that turns the data into a single per-night narrative.

## The user

- Age 50–75 typically, skewing male (~60/40).
- Recently or recently-ish diagnosed with OSA, prescribed a CPAP, anxious about compliance
  and side effects.
- Mid-to-low tech literacy. May struggle with Bluetooth pairing, definitely won't read
  OSCAR documentation.
- Reads small type with difficulty. Opens the app at 6 a.m. exhausted.
- Often emotionally invested — apnea diagnoses come with mortality fears, especially in
  users with cardiovascular comorbidities.

The user is **already anxious**. Every design and copy decision should reduce that anxiety,
not amplify it.

## The category gap Nocta owns

From the competitive research, eight unfilled spaces. Nocta v1 targets the first two;
everything else is a future direction.

1. **The actionable AI interpreter** — nobody outputs *"Your AHI rose to 6.2 because of a
   mask leak spike between 2:30–4:00 a.m. Try a smaller cushion tonight."* ResMed Dawn is
   closest but locked to AirSense 11.
2. **Beautiful clinical data** — SleepHQ has depth, no polish; Oura has polish, no CPAP.
   Nocta is both.
3. Compare nights side-by-side (deferred).
4. Sleep journal with causal linking — **in v1**, paired with #1.
5. Cross-device support (Nocta is brand-agnostic via SleepHQ).
6. Wearable fusion (deferred).
7. Compliance projection, not just tracking (in v1 as a small reframe).
8. Honest, non-paternalistic tone (in v1, system-wide).

## The two killer features

### Causal "why" cards

Every morning, the top of the Tonight tab is a single card explaining *why last night was
what it was*, citing specific data, with one suggested next action. The card adapts to the
night type:

- **Anomaly** — something off-baseline. Full narrative, one action.
- **Steady** — a normal night. Brief, affirming, no invented drama.
- **Win** — measurably better, with attribution if possible.
- **Escalation** — concerning pattern (rising CAI, SpO₂ desat, persistent high AHI).
  Recommends physician conversation. Never diagnoses.
- **Insufficient data** — honest acknowledgment, no fake insight.

### Sleep journal with causal linking

Tag-based, not free-text. Five-second logging via the Morning Check-In: alcohol, late meal,
illness, mood, mask change, etc. After ~14–21 days the correlation engine surfaces patterns:

- *"On nights you drink alcohol, your AHI averages 38% higher (5.4 vs 3.9). 7 nights of data."*
- *"Your best AHI nights this month all came after exercise. 4 nights."*

The journal also feeds context into the why-cards, making them dramatically more specific
than CPAP-data alone could support.

## Design direction (the visual decisions already made)

- **Deep tinted navy** ground (`#0B1020`), warmer surfaces stepping up. Never pure black.
- **Sunrise peach accent** (`#F0A47A`) — the *exclusive* color for AI/Coach moments.
  Differentiates from every clinical-blue competitor.
- **Restrained chart palette** — muted data blue for default series; sage/amber/coral
  reserved for semantic states.
- **DM Sans** for headlines and numerals (italic accents on AI Coach moments
  specifically). **Inter** for body and chrome.
- **No donut gauges** — they imply false ceilings on open-ended medical metrics. Use
  horizontal baseline strips or sparkline + tabular value.
- **Single primary metric per surface** — AHI on Home, with secondary metrics as a compact
  row below.
- **The night as a single horizontal timeline** with sleep-stage bands, event markers as
  shape-coded flags, journal icons above. Full chart stack is one tap deeper.
- **Hero why-card commands the top of every Tonight visit.** Bury it = lose the differentiator.

See `DESIGN_SYSTEM.md` for tokens and `reference/nocta-home.html` for the executed visual
reference.

## What we are *not* building (and why)

- **Pressure setting recommendations** — regulated SaMD territory. Always physician.
- **Diagnosis suggestions** — same line. The moment Nocta says "this looks like UARS," it
  needs FDA clearance.
- **Red/green/yellow score bands** for clinical metrics — the WHOOP FDA warning letter made
  clear visual diagnostic signaling is regulated regardless of disclaimer text.
- **Compliance gamification with streaks and badges** — myAir reviewers say it dies after
  day 21. CPAP isn't Duolingo.
- **Live human sleep coaches** — Lofta's model. Operational complexity, competes with AI
  thesis.
- **Apnea event audio playback** — phone microphone is a separate data pipeline, defer.
- **Telehealth booking** — partner, don't build.

## Success criteria for v1

The user opens Nocta on day 1 and gets a why-card grounded in their actual SleepHQ data,
with one clear action. By day 7 they've logged enough journal entries to see at least one
correlation pattern. By day 14 they trust Nocta to tell them honestly when a night was bad,
*and* they've never been told to change a pressure setting or given a diagnosis.

If those three things hold, v1 has shipped.
