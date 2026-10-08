/* Nocta Coach — mock conversational layer. No real LLM; keyword-matched canned replies
 * written to the voice + safety rules in docs/FEATURES.md and CLAUDE.md. */

import { NIGHTS_ON_THERAPY } from './history.js';
import { metricStat } from './nightMetrics.js';
import { nightSeries } from '../lib/nightSeries.js';

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
        g.peak_position ? `Why does sleeping on my ${g.peak_position} matter?` : 'Why was last night different?',
        'How sure are you about this?',
      ],
    },
    steady: {
      tail: ' Nothing stood out from your usual. Ask me anything about it.',
      prompts: ['What counts as my usual range?', 'What does AHI mean?', 'How sure are you about this?'],
    },
    win: {
      tail: ' Side sleeping looks like the biggest reason. Want the details?',
      prompts: ['Why was this my best night?', 'How do I sleep on my side more?', 'What does AHI mean?'],
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
  flow: ['What am I looking at here?', 'What do the flat stretches mean?', 'Is my breathing rate normal?'],
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
      `Your usual range comes from your own nights, not a chart of other people. Before this night you averaged about **${(fx?.ahi?.avgSoFar ?? 4.6).toFixed(1)}** events an hour. A night close to that is "your usual", even if it's not the lowest you've had.`,
  },
  {
    match: ['best night', 'lowest'],
    text:
      "Monday came in at **2.1**, your lowest so far. You spent most of it on your side, and you'd exercised that day. Side sleeping keeps showing up on your better nights, so it looks like your biggest lever right now.",
  },
  {
    match: ['scored', 'how long do i need'],
    text:
      "Nocta needs at least **2 hours** on the mask to score a night. Wednesday's session was **1.7 hours**, so there wasn't enough to read reliably. It still helps me learn your routine, and a full night tonight gets you a proper read.",
  },
  {
    match: ['tell my doctor', 'bring to my doctor', 'what should i tell'],
    text:
      "Bring the night itself: central events at **6.8** an hour on Tuesday against a usual **1.2**, and how you felt that morning. I can put your nights so far on one page for them. Tap *Prepare doctor summary* on the night's card.",
  },
  {
    match: ['change anything myself', 'anything myself'],
    text:
      "For central events, I wouldn't try. They're about the signal to breathe, not your mask or position, so they're your doctor's area. Keep using your machine as usual, and bring the summary to your next appointment.",
  },
  {
    match: ['call something a trend', 'trend'],
    text: () =>
      `I hold off on calling anything a trend until about **two weeks** of nights. Before that, a single bad night can look like a pattern when it isn't. You're **${NIGHTS_ON_THERAPY}** nights in, so for now I'll point out early signals and say how sure I am.`,
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
    text:
      "Your machine is on **AutoSet**: it adjusts pressure through the night on its own, within the range your doctor prescribed. When your airway starts to narrow, it nudges pressure up; when things settle, it eases off. A higher stretch usually means it was working harder then.",
  },
  {
    match: ['looking at here', 'flat stretches'],
    text:
      "Each wave is one breath, in and out, as your machine measured it. Even waves mean easy breathing. Where the waves go flat or small, breathing paused or got shallow, and those are the moments your machine counts as events.",
  },
  {
    match: ['breathing rate'],
    text: (fx) =>
      `${fx?.bodyResponse?.respRate?.value != null ? `Your watch measured about **${fx.bodyResponse.respRate.value} breaths a minute** overnight.` : "Your watch didn't record a breathing rate this night."}`
      + " Many adults sit somewhere around 12 to 20 at rest, and what matters most is how steady yours is from night to night. I'll point it out if it starts to drift.",
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
      "I won't put a name to it. That's a clinical call, and I'm a companion, not a doctor. What I can tell you is *what the data shows*: central-type events jumped to **6.8** an hour on Tuesday night, against a usual **1.2**. That's worth showing your sleep doctor, and I can package it for you.",
  },
  {
    match: ['leak', 'mask leak', 'air leak'],
    text:
      "Leak usually creeps up for one of three reasons: the cushion has aged past its seal, the straps loosen as you move, or you shift onto your back and the mask gets pushed. Your cushion is only **11 days old**, well inside its 30-day window, so I'd start with the straps. A snug-but-not-tight fit, re-checked sitting up, fixes most of it.",
  },
  {
    match: ['stomach', 'position', 'side sleep', 'on my back'],
    text:
      "Position matters more than most people expect. On your stomach and back, the airway is easier to crowd; on your side it tends to stay open. Your first few nights already hint at it: all three of your stomach nights ran higher. A body pillow against your chest makes side-sleeping easier to *hold* through the night.",
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
        : "Last night your AHI sat above your usual range, and most of the events were obstructive, bunched between 2 and 5 a.m. You were on your stomach for that stretch. None of those alone explains it, but together they line up with your other stomach nights.",
  },
  {
    match: ['cushion', 'replace', 'filter', 'equipment'],
    text:
      "Worn parts quietly drag your numbers down. Everything you have is **11 days old**. It all came with your machine, so nothing is due yet. Your cushion and filter are next, around **October 30**. The Therapy tab tracks the ages for you.",
  },
];

const DEFAULT_REPLY =
  "Good question. I read your CPAP data each night and look for what changed and why: leak, position, timing, the events themselves. Ask me about any metric on your screen, or about a night that looked off, and I'll talk you through what I see.";

/* fx: the night being viewed, so replies quote its numbers, not a fixed night */
export function coachReply(text, fx) {
  const q = text.toLowerCase();
  for (const r of REPLIES) {
    if (r.match.some((m) => q.includes(m))) return typeof r.text === 'function' ? r.text(fx) : r.text;
  }
  return DEFAULT_REPLY;
}
