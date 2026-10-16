/* Nocta Coach — mock conversational layer. No real LLM; keyword-matched canned replies
 * written to the voice + safety rules in docs/FEATURES.md and CLAUDE.md. */

import { NIGHTS, NIGHTS_ON_THERAPY, fmtShort } from './history.js';
import { metricStat } from './nightMetrics.js';
import { nightSeries } from '../lib/nightSeries.js';
import { baselineFor } from '../lib/insights.js';
import { equipmentStatus } from '../lib/equipment.js';
import { getCard } from '../lib/dataset.js';

/* recent nights where central events ran above 5 an hour (the hard
 * escalation line), newest first, with the usual level before them */
function centralNights(days = 30) {
  const recent = NIGHTS.filter((x) => x.ahi && x.ahi.csa > 5).slice(-4).reverse();
  const fresh = recent.filter((x) => x.date >= NIGHTS.at(-days)?.date);
  if (!fresh.length) return null;
  const usual = baselineFor(fresh.at(-1).date).csa;
  const list = fresh.map((x) => `**${x.ahi.csa}** an hour on ${fmtShort(x.date)}`);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
  return { joined, usual };
}

export const SUGGESTED_PROMPTS = [
  'Why was last night different?',
  'How can I reduce my leak rate?',
  'What does AHI actually mean?',
];

/* the opening bubble, plus three follow-up questions, when Nox is opened from
 * a specific card. Nox assumes the question is about what you were just
 * looking at. Every question below has a matching reply in REPLIES. */
const strip = (t) => String(t).replace(/\*\*/g, '');

function whyOpener(fx) {
  const ins = fx.insight;
  const g = ins.glance ?? {};
  const where =
    g.peak_window && g.peak_position
      ? `, with most events ${g.peak_window} while you slept on your ${g.peak_position}`
      : '';
  const lead = g.detail ? `You're looking at last night: **${g.detail}**${where}.` : "You're looking at last night.";
  const by = {
    anomaly: {
      tail: ' What would you like to dig into?',
      prompts: [
        `What does an AHI of ${fx.ahi.value} mean?`,
        /leak/i.test(g.headline ?? '') ? 'How can I reduce my leak?' : 'Why was last night different?',
        'How sure are you about this?',
      ],
    },
    steady: {
      tail: ' Nothing stood out from your usual. Ask me anything about it.',
      prompts: ['What counts as my usual range?', 'What does AHI mean?', 'How sure are you about this?'],
    },
    win: {
      tail: ' One of your lowest nights in a while. Want the details?',
      prompts: ['Why was this my best night?', 'How do I repeat it?', 'What does AHI mean?'],
    },
    escalation: {
      tail: " That's the kind of change worth showing your sleep doctor, and I can help you prepare.",
      prompts: ['What are central events?', 'What should I tell my doctor?', 'Can I change anything myself?'],
    },
    insufficient_data: {
      tail: " There wasn't enough recorded to read it reliably.",
      prompts: ["Why wasn't last night scored?", 'How long do I need to sleep for a reading?', 'What does AHI mean?'],
    },
  }[ins.card_state] ?? { tail: '', prompts: ['Why was last night different?', 'What does AHI mean?'] };
  return { text: lead + by.tail, prompts: by.prompts };
}

const METRIC_PROMPTS = {
  leak: ['What is a normal leak rate?', 'How can I reduce my leak?', 'Why does leak matter?'],
  pressure: ['Why does my pressure change overnight?', 'Should my pressure be higher?', 'What is AutoSet?'],
  resp: ['Is my breathing rate normal?', 'What makes it change overnight?', 'What does AHI mean?'],
  snore: ['Is snoring on CPAP normal?', 'What makes the snore index go up?', 'Does snoring mean my mask is wrong?'],
};

export function contextOpener(context, fx) {
  if (!context) return null;
  if (context.kind === 'why' && fx) return whyOpener(fx);
  if (context.kind === 'trends') {
    // "Past 7 nights · through Oct 6" → "your past 7 nights · through Oct 6"
    const r = /^Past/.test(context.range)
      ? `your ${context.range[0].toLowerCase()}${context.range.slice(1)}`
      : context.range;
    const summary = context.summary ? ` ${context.summary}` : '';
    const worstDay = context.worst ? context.worst.split(',')[0] : null;
    return {
      text: `Looking at ${r}:${summary || ' the overall line matters more than any single night.'} Ask me about a spike, your leak, or what to bring to your doctor.`,
      prompts: [
        worstDay ? `Why did my AHI spike on ${worstDay}?` : 'Why was last night different?',
        'Is my leak rate okay?',
        'When does Nox call something a trend?',
      ],
    };
  }
  if (context.kind === 'metric') {
    const label = context.label.toLowerCase();
    return {
      text: context.sentence
        ? `Looking at your ${label} last night: ${context.sentence}. What would you like to know?`
        : `Happy to talk through your ${label}. What are you curious about?`,
      prompts: METRIC_PROMPTS[context.metric] ?? [`What does ${label} mean?`],
    };
  }
  return null;
}

const REPLIES = [
  /* ---- follow-ups offered by the openers above ---- */
  {
    match: ['how sure', 'confident'],
    text: (fx) => {
      const c = fx?.insight?.confidence ?? 'medium';
      const n = fx?.insight?.time_window?.nights_analyzed;
      const why =
        c === 'high'
          ? "The numbers are clear on this one, so I'm comfortable saying it plainly."
          : c === 'low'
            ? "There's very little to go on yet, so treat it as a first read, not a finding."
            : `The pattern lines up, but it rests on only ${n ? `**${n}** nights` : 'a few nights'} so far.`;
      return `I'd call this **${c}** confidence. ${why} A couple more weeks of nights, and your morning check-ins, will firm it up or rule it out. I'll say so either way.`;
    },
  },
  {
    match: ['usual range'],
    text: (fx) =>
      fx?.ahi?.avgSoFar != null
        ? `Your usual range comes from your own nights, not a chart of other people. Before this night your typical AHI was about **${fx.ahi.avgSoFar.toFixed(1)}** events an hour. A night close to that is "your usual", even if it's not the lowest you've had.`
        : "Your usual range comes from your own nights, not a chart of other people. There aren't enough nights yet to say what yours is; after about a week, there will be.",
  },
  {
    match: ['best night', 'lowest', 'repeat it'],
    text: (fx) => {
      const n = fx?.insight?.time_window?.nights_analyzed;
      const head =
        fx?.ahi?.value != null
          ? `This night came in at **${fx.ahi.value}** across **${fx.session.durationHours} hours**${n ? `, against your last ${n} nights` : ''}.`
          : 'This was one of your better nights.';
      return `${head} Your machine can't see what you did differently, so your morning check-in is the best way to find out what's worth repeating: bedtime, what you ate or drank, how you slept.`;
    },
  },
  {
    match: ['scored', 'how long do i need'],
    text: (fx) =>
      `Nocta needs at least **2 hours** on the mask to score a night.${fx?.ahi?.value == null && fx?.session ? ` This session was **${fx.session.durationHours} hours**, so there wasn't enough to read reliably.` : ''} Short nights still count toward learning your routine, and a full night gets you a proper read.`,
  },
  {
    match: ['tell my doctor', 'bring to my doctor', 'what should i tell'],
    text: () => {
      const c = centralNights();
      const nights = c
        ? `the nights central events ran high: ${c.joined}, against a usual **${c.usual}**`
        : 'your recent nights';
      return `Bring ${nights}, and how you felt those mornings. I can put it all on one page for them. Tap *Prepare doctor summary* on the night's card.`;
    },
  },
  {
    match: ['change anything myself', 'anything myself'],
    text:
      "For central events, I wouldn't try. They're about the signal to breathe, not your mask or position, so they're your doctor's area. Keep using your machine as usual, and bring the summary to your next appointment.",
  },
  {
    match: ['call something a trend', 'trend'],
    text: () =>
      NIGHTS_ON_THERAPY >= 14
        ? `I hold off on calling anything a trend until about **two weeks** of nights, so one bad night can't pass for a pattern. You have **${NIGHTS_ON_THERAPY}** nights of history, so the Trends tab has plenty to go on. I compare each night with your last 30.`
        : `I hold off on calling anything a trend until about **two weeks** of nights. Before that, a single bad night can look like a pattern when it isn't. You're **${NIGHTS_ON_THERAPY}** nights in, so for now I'll point out early signals and say how sure I am.`,
  },
  {
    match: ['normal leak'],
    text: (fx) => {
      const leak = fx ? metricStat('leak', nightSeries(fx.id), fx) : null;
      const night =
        !leak || leak.value === '—'
          ? "This night didn't record enough leak data to say."
          : leak.sub.startsWith('Above')
            ? `This night ran above 24 for about ${leak.sub.match(/(\d+) min/)[1]} minutes, which is worth a look but not a worry on its own.`
            : `This night stayed under 24 the whole way, topping out at **${leak.value} L/min**.`;
      return `Under **24 L/min** is the line most machines use. Your mask is designed to vent a little air on purpose, and that's not counted. ${night}`;
    },
  },
  {
    match: ['leak matter'],
    text:
      "When air escapes, your machine has a harder time holding the pressure your airway needs, and a jet of air at your face can wake you. A bit of leak is normal. Long stretches above **24 L/min** often line up with a rougher night.",
  },
  {
    match: ['change overnight', 'autoset'],
    // only what the card records about the mode; nothing assumed
    text: () => {
      const s = getCard()?.settings;
      const range = s?.minPressure != null && s?.maxPressure != null ? ` between **${s.minPressure}** and **${s.maxPressure} cmH₂O**` : '';
      if (s?.mode === 'CPAP')
        return `Your card shows your machine on fixed **CPAP**${s.setPressure != null ? ` at **${s.setPressure} cmH₂O**` : ''}. It holds one pressure all night, so small wiggles in the chart come from your breathing and mask, not the machine adjusting.`;
      if (s?.mode === 'AutoSet' || s?.mode === 'HerAuto' || s?.mode === 'APAP')
        return `Your card shows your machine on **${s.mode === 'HerAuto' ? 'AutoSet for Her' : 'AutoSet'}**: it adjusts pressure through the night on its own${range}, the range your doctor set. When your airway starts to narrow, it nudges pressure up; when things settle, it eases off.`;
      return "An auto-adjusting machine raises pressure through the night when your airway starts to narrow and eases off when things settle. Your card doesn't say which mode yours is set to.";
    },
  },
  {
    match: ['breathing rate', 'change overnight'],
    text: (fx) => {
      const stat = fx ? metricStat('resp', nightSeries(fx.id), fx) : null;
      const yours =
        stat && stat.value !== '—'
          ? `Your machine counted about **${stat.value} breaths a minute** through this night.`
          : "Your machine didn't record a breathing rate this night.";
      return `${yours} Many adults sit somewhere around 12 to 20 at rest. It dips and rises a little with sleep stages and events, and what matters most is how steady it stays from night to night.`;
    },
  },
  {
    match: ['snoring on cpap', 'snore index go up', 'snoring mean'],
    text:
      "A little snoring on CPAP is common. The snore index often rises when your airway narrows a bit, when you're on your back or stomach, or when the mask isn't sealing well. A long stretch of high snoring is worth mentioning to your doctor, but on its own it doesn't mean your mask is wrong.",
  },
  {
    match: ['pressure', 'cmh2o', 'turn up', 'turn down', 'raise', 'increase my'],
    text:
      "I can't suggest a pressure setting. That one is genuinely your sleep doctor's call, and changing it on your own can mask what the data is telling them. What I *can* do is prepare a clean summary of your recent nights so the conversation with them is quick. Want me to start that?",
  },
  {
    match: ['diagnos', 'do i have', 'is this csa', 'central sleep apnea', 'complex apnea'],
    text:
      () => {
        const c = centralNights(365);
        const shows = c
          ? `central-type events ran at ${c.joined}, against a usual **${c.usual}**. That's worth showing your sleep doctor, and I can package it for you.`
          : 'your numbers, night by night, and how they compare with your usual. If something is worth a doctor’s look, I’ll say so plainly.';
        return `I won't put a name to it. That's a clinical call, and I'm a companion, not a doctor. What I can tell you is *what the data shows*: ${shows}`;
      },
  },
  {
    match: ['leak', 'mask leak', 'air leak'],
    // the cushion's age only if they logged it on Therapy
    text: () => {
      const c = equipmentStatus().find((p) => p.id === 'cushion');
      const age =
        c?.ageDays == null
          ? " You haven't logged when you last replaced your cushion; if you're not sure, that's worth checking first."
          : c.ageDays >= c.lifespanDays
            ? ` Your cushion is **${c.ageDays} days old**, past its ${c.lifespanDays}-day window, so I'd start there.`
            : ` Your cushion is **${c.ageDays} days old**, inside its ${c.lifespanDays}-day window, so I'd start with the straps.`;
      return `Leak usually creeps up for one of three reasons: the cushion has aged past its seal, the straps loosen as you move, or you shift onto your back and the mask gets pushed.${age} A snug-but-not-tight fit, re-checked sitting up, fixes most of it.`;
    },
  },
  {
    match: ['stomach', 'position', 'side sleep', 'on my back'],
    text:
      "Position matters more than most people expect. On your back, the airway is easier to crowd; on your side it tends to stay open. Your machine can't see how you slept, so note it in your morning check-in and I'll compare those nights for you. A body pillow against your chest makes side-sleeping easier to *hold* through the night.",
  },
  {
    match: ['ahi', 'what does ahi', 'events per hour'],
    text:
      "AHI is **apnea–hypopnea index**, the number of times per hour your breathing paused or got shallow. Under 5 is considered well-controlled on therapy. It's the headline number, but a single night's AHI bounces around; the *trend* over a couple of weeks tells you far more.",
  },
  {
    match: ['central', 'csa', 'cai'],
    text:
      "Central events are pauses where the signal to breathe briefly drops. That's different from obstructive events, where the airway is blocked. A few here and there is normal. A *run* of them across several nights is the kind of thing your doctor wants to know about, which is why I flag it rather than brush past it.",
  },
  {
    match: ['why', 'last night', 'different', 'bad night'],
    // the night's own observation, so the numbers match the card it came from
    text: (fx) =>
      fx?.insight?.observation
        ? `Here's what I'm seeing. ${fx.insight.observation}`
        : NIGHTS.length
          ? "Pick a night on Tonight and I'll walk you through what changed against your usual: the events, when they happened, and what leak was doing."
          : "I don't have any nights from you yet. Once your SD card is in, I'll walk you through what changed against your usual: the events, when they happened, and what leak was doing.",
  },
  {
    match: ['cushion', 'replace', 'filter', 'equipment'],
    // ages only from what they logged on Therapy
    text: () => {
      const parts = equipmentStatus();
      const logged = parts.filter((p) => p.ageDays != null);
      if (!logged.length)
        return "Worn parts quietly drag your numbers down. You haven't logged any replacements yet, so I can't tell what's due. On the Therapy tab, tap **Replaced today** (or pick a date) for each part, and I'll keep track from there.";
      const due = logged.filter((p) => p.ageDays >= p.lifespanDays * 0.8);
      const list = (xs) => xs.map((p) => p.name.toLowerCase()).join(', ');
      return due.length
        ? `Worn parts quietly drag your numbers down. From what you've logged, your **${list(due)}** ${due.length === 1 ? 'is' : 'are'} due or close to it. ${parts.length - logged.length ? `${parts.length - logged.length} parts aren't logged yet.` : ''}`
        : `Worn parts quietly drag your numbers down. Nothing you've logged is due yet. ${parts.length - logged.length ? `${parts.length - logged.length} parts aren't logged yet, so I can't say for those.` : ''}`;
    },
  },
];

const DEFAULT_REPLY =
  "Good question. I read your CPAP data each night and look for what changed against your usual: leak, timing, the events themselves, how long you wore the mask. Ask me about any metric on your screen, or about a night that looked off, and I'll talk you through what I see.";

/* fx: the night being viewed, so replies quote its numbers, not a fixed night */
export function coachReply(text, fx) {
  const q = text.toLowerCase();
  for (const r of REPLIES) {
    if (r.match.some((m) => q.includes(m))) return typeof r.text === 'function' ? r.text(fx) : r.text;
  }
  return DEFAULT_REPLY;
}
