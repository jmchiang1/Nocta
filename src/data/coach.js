/* Nocta Coach — the pre-written Nox, for guests (signed-in accounts get the
 * real one: lib/nox.js). Keyword-matched replies written to the voice + safety
 * rules in docs/FEATURES.md and CLAUDE.md. Replies that quote numbers read
 * them from the person's nights, never a fixed script.
 *
 * Checked in order, first match wins: safety → specific presets → the card
 * follow-ups (REPLIES) → general presets → small talk → the default. */

import { NIGHTS, NIGHTS_ON_THERAPY, fmtShort, ahiTotal, averages, COMPLIANCE_MIN_HOURS } from './history.js';
import { metricStat } from './nightMetrics.js';
import { nightSeries } from '../lib/nightSeries.js';
import { baselineFor } from '../lib/insights.js';
import { equipmentStatus } from '../lib/equipment.js';
import { getCard } from '../lib/dataset.js';
import { NOX_SMART_ON } from '../lib/nox.js';

/* only mention the smart Nox once it exists (lib/nox.js › NOX_SMART_ON) */
const SIGN_IN_FOR_SMART = NOX_SMART_ON ? ' Sign in, and I can answer questions about your own nights.' : '';

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


/* ================================================================ presets
 * The questions a new or test user is likely to type. */

const scoredNights = (n) => NIGHTS.slice(-n).filter((x) => x.ahi);
const fxLeak = (fx) => fx?.secondary?.find((s) => s.key === 'leak');

/* safety first: these win over everything */
const SAFETY = [
  {
    match: ['chest pain', "can't breathe", 'cant breathe', 'cannot breathe', 'emergency', 'heart attack', 'stroke', 'passed out', 'fainted', 'choking'],
    text: "If you're having trouble breathing, chest pain, or feel that something is seriously wrong right now, please call **911** or your local emergency number now. I can't help in an emergency, and no one is watching this chat.",
  },
  {
    match: ['suicid', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself'],
    text: "I'm really sorry you're feeling this way, and I'm glad you said it. Please reach out to a person right now: in the US, call or text **988** to reach the Suicide & Crisis Lifeline, any time, day or night. Outside the US, your local emergency number can connect you. You don't have to go through this alone.",
  },
  {
    match: ['quit cpap', 'quit using', 'stop using', 'stop cpap', 'stop my cpap', 'give up', 'stop therapy', 'quit therapy', 'want to quit', 'hate my machine', 'hate cpap', 'hate my mask', 'hate this', "can't stand", 'sick of', 'fed up', 'frustrat', 'so hard'],
    text: "That's a really common feeling, especially in the first weeks, and it's worth saying out loud. Please don't stop on your own, though: talk to your sleep doctor or your equipment supplier first. Often the fix is a different mask or a fitting, not giving up. Tell them exactly what bothers you most; that's the fastest way to a change that helps.",
  },
  {
    match: ['sleeping pill', 'melatonin', 'ambien', 'medication', 'medicine', ' meds', 'antidepressant', 'opioid'],
    text: "I can't advise on medications. Some can change breathing during sleep, so that's a question for your doctor or pharmacist. What I *can* do is help you spot a pattern: tag it in your morning check-in, and I'll compare those nights with the rest.",
  },
];

/* specific questions, checked before the card follow-ups */
const PRESETS_FIRST = [
  /* ---- your numbers ---- */
  {
    match: [/what('?s| is| was) my ahi/, 'ahi last night', 'my ahi', 'how many events'],
    text: (fx) =>
      fx?.ahi?.value != null
        ? `On ${fmtShort(fx.id)} your AHI was **${fx.ahi.value}** events an hour, over **${fx.session.durationHours} hours** on the mask.${fx.ahi.avgSoFar != null ? ` Your usual is about **${fx.ahi.avgSoFar}**.` : ''}`
        : "This night wasn't long enough to score. Nocta needs at least **2 hours** on the mask to read AHI reliably.",
  },
  {
    match: [/how (long|many hours) did i (sleep|use|wear)/, 'hours last night', 'how long was i on', 'how long did i wear'],
    text: (fx) =>
      fx?.session
        ? `On ${fmtShort(fx.id)} you had the mask on for **${fx.session.durationHours} hours**, from **${fx.session.start}** to **${fx.session.end}**. That's time on the machine, not time asleep; your machine can't tell those apart.`
        : "I don't have a session for that night.",
  },
  {
    match: ['average', 'my usual ahi', 'typical ahi', 'mean ahi', 'on average'],
    text: () => {
      const a = averages(NIGHTS.slice(-30));
      return a.ahi == null
        ? "There aren't enough scored nights yet to give you an average. After about a week, there will be."
        : `Over your last 30 nights your AHI averaged **${a.ahi}** an hour, with **${a.hours} hours** a night on the mask and leak around **${a.leak ?? '—'} L/min**. That's your usual, the line I compare each new night against.`;
    },
  },
  {
    match: ['best night this week', 'best night of the week', 'my best night', 'lowest ahi', 'best this week'],
    text: () => {
      const week = scoredNights(7);
      if (!week.length) return "There's no scored night in the past week to compare.";
      const best = week.reduce((a, b) => (ahiTotal(b) < ahiTotal(a) ? b : a));
      return `Your lowest night this past week was **${fmtShort(best.date)}**: AHI **${ahiTotal(best)}** over **${best.hours} hours**. Your check-in from that morning is the best clue to what went right.`;
    },
  },
  {
    match: ['worst night', 'highest ahi', 'roughest night', 'bad night this week'],
    text: () => {
      const week = scoredNights(7);
      if (!week.length) return "There's no scored night in the past week to compare.";
      const worst = week.reduce((a, b) => (ahiTotal(b) > ahiTotal(a) ? b : a));
      return `Your roughest night this past week was **${fmtShort(worst.date)}**: AHI **${ahiTotal(worst)}** over **${worst.hours} hours**${worst.leak != null ? `, with leak around **${worst.leak} L/min**` : ''}. Open it on Tonight and I'll walk you through what changed.`;
    },
  },
  {
    match: ['compliance', '4 hours', 'four hours', 'insurance', 'how many nights'],
    text: () => {
      const month = NIGHTS.slice(-30);
      const met = month.filter((x) => (x.rawHours ?? x.hours) >= COMPLIANCE_MIN_HOURS).length;
      return `In your last **${month.length}** nights, you wore the mask for **${COMPLIANCE_MIN_HOURS} hours or more** on **${met}** of them. Many insurers count nights like that, often wanting 70% of nights in a 30-day stretch, but check your plan's exact rule.`;
    },
  },
  {
    match: ['getting better', 'getting worse', 'improving', 'is it working', 'am i doing', 'progress'],
    text: () => {
      const week = averages(NIGHTS.slice(-7));
      const before = averages(NIGHTS.slice(-37, -7));
      if (week.ahi == null || before.ahi == null) return "I need a few more weeks of nights before I can say which way things are heading.";
      const dir = Math.abs(week.ahi - before.ahi) < 0.5 ? 'about the same as' : week.ahi < before.ahi ? 'lower than' : 'higher than';
      return `This past week your AHI averaged **${week.ahi}**, ${dir} the month before (**${before.ahi}**). One week is a short window, so I'd watch it for another week or two before reading much into it.`;
    },
  },
  {
    match: [/what (is|was|'s) my pressure/, 'my pressure last night', 'what pressure am i', 'pressure was i'],
    text: (fx) => {
      const p = fx?.secondary?.find((s) => s.key === 'pressure');
      const s = getCard()?.settings;
      const range = s?.minPressure != null ? ` Your machine is set to work between **${s.minPressure}** and **${s.maxPressure} cmH₂O**.` : '';
      return `${p && p.value !== '—' ? `On ${fmtShort(fx.id)} your median pressure was **${p.value} cmH₂O**.` : "I don't have a pressure reading for that night."}${range} I can't suggest changing it; that's your sleep doctor's call.`;
    },
  },
  {
    match: ['streak'],
    text: "Nocta doesn't do streaks. A missed night isn't a failure, and I'd rather show you what's actually happening night to night. Your Trends tab shows how many nights you've used the mask.",
  },
  {
    match: ['95th', 'percentile'],
    text: "The **95th percentile** is the level your leak stayed under for 95% of the night. It ignores the brief spikes, like when you roll over, so it gives a fairer picture of how your mask sealed overall.",
  },
  {
    match: ['ahi zero', 'ahi of 0', 'zero events', 'why not zero', "isn't zero", 'still have events'],
    text: "Almost nobody gets to zero, even on therapy. A handful of events an hour can show up on any night. What I watch is how your number compares with your own usual, and whether it holds steady.",
  },

  {
    match: ['alcohol', 'drink', 'beer', 'wine', 'whiskey', 'drunk'],
    text: "Alcohol relaxes the muscles around your airway, so many people see more events on nights they drink, especially close to bedtime. Tag it in your morning check-in and I'll compare those nights with the rest of yours.",
  },
  {
    match: ['coffee', 'caffeine'],
    text: "Caffeine late in the day can make it harder to fall asleep, which can mean fewer hours on the mask. Tag it in your check-in and I'll show you whether those nights look different.",
  },
  {
    match: ['every night', 'how many hours should', 'how long should i wear', 'important to wear', 'skip a night', 'miss a night', 'skipped a night', 'missed a night'],
    text: "Wearing it every night, for as much of the night as you can, is what makes CPAP work: the pauses come back on any night you go without it. Missing a night now and then happens, so just pick it back up the next night. Many insurers look for at least **4 hours** a night.",
  },

  /* ---- CPAP basics ---- */
  {
    match: ['what is cpap', 'what does cpap', 'how does cpap', 'how does my machine'],
    text: "CPAP stands for **continuous positive airway pressure**. Your machine blows a gentle stream of air through the mask that holds your airway open while you sleep, so your breathing doesn't keep pausing. It works best when you wear it every night, for most of the night.",
  },
  {
    match: ['what is sleep apnea', 'what is osa', 'what is apnea', 'what causes sleep apnea'],
    text: "Sleep apnea means your breathing repeatedly pauses or gets shallow while you sleep. With the most common type, the airway relaxes and narrows. CPAP keeps it open with air pressure. Your sleep doctor is the right person to explain your own situation.",
  },
  {
    match: ['hypopnea', 'obstructive', 'apnea vs', 'difference between'],
    text: "An **apnea** is a pause in breathing of at least 10 seconds. A **hypopnea** is a stretch where breathing gets shallow rather than stopping. **Obstructive** means the airway was blocked; **central** means the signal to breathe briefly dropped. Your AHI adds them all up per hour.",
  },
  {
    match: [/\bepr\b/, 'exhale', 'breathe out'],
    text: "**EPR** (expiratory pressure relief) lowers the pressure a little each time you breathe out, so exhaling against the air feels easier. Your SD card shows whether it's on and at what level. Changing it is a setting your doctor or equipment supplier handles.",
  },
  {
    match: [/\bramp\b/],
    text: "**Ramp** starts your machine at a low pressure and builds up over a set time, usually 5 to 45 minutes, so falling asleep feels less like a gust of wind. Your SD card shows your ramp time. If it feels too short or too long, mention it to your supplier.",
  },
  {
    match: ['dry mouth', 'dry nose', 'nosebleed', 'nose bleed', 'humidifier', 'humidity', 'rainout', 'condensation', /water in (my|the) (mask|tube|tubing|hose)/],
    text: "Dryness is one of the most common CPAP complaints. A heated humidifier helps; your card shows its level. Water collecting in the tube or mask (**rainout**) often happens when the room is cold, and a tubing cover or heated tube usually helps. Your supplier can walk you through the settings.",
  },
  {
    match: ['mouth breath', 'chin strap', /mouth (falls |stays |hangs |is )?open/, 'mouth tape'],
    text: "If your mouth falls open on a nasal mask, air escapes and leak goes up. People often try a chin strap or a full-face mask for that. A higher leak on nights you woke with a dry mouth would be a clue; tag it in your check-in and I'll compare.",
  },
  {
    match: ['congest', 'stuffy', 'blocked nose', 'allerg', /\b(a|have a|got a) cold\b/, /\b(i'?m|been|got|feel|feeling) sick\b/, /\bflu\b/, 'covid'],
    text: "A blocked nose makes CPAP harder, especially with a nasal mask, and your numbers often look rougher on those nights. Many people keep using it while sick with the humidifier turned up. Tag it in your check-in so those nights don't skew your usual. If you're unsure whether to keep going, ask your doctor.",
  },
  {
    match: ['swallow air', 'swallowing air', 'bloat', 'burp', 'gassy', 'aerophagia', 'stomach hurts'],
    text: "Waking up bloated or burping can happen when some air goes down into your stomach instead of your lungs. It's common, and worth mentioning to your sleep doctor, because the fix usually involves your settings, which they handle. Tag it in your check-in so you can show them which nights it happened.",
  },
  {
    match: ['which mask', 'best mask', 'mask type', 'nasal pillow', 'full face', 'full-face', 'new mask'],
    text: "There are three main types: **nasal pillows** (small cushions at the nostrils), **nasal masks** (over the nose), and **full-face masks** (nose and mouth). The best one is the one that seals and that you'll keep on all night. I can't pick one for you, but your equipment supplier can fit you, and most let you try another.",
  },
  {
    match: ['marks on my face', 'red marks', 'sore nose', 'bridge of my nose', 'skin', 'pressure sore', 'mask marks'],
    text: "Marks or soreness usually mean the straps are tighter than they need to be. A mask should seal snug, not tight; loosen a little and re-check while lying down. A worn cushion can also make you tighten more to stop leaks. If soreness keeps coming back, ask your supplier about a different size or style.",
  },
  {
    match: ['claustrophob', 'panic', 'anxious', 'anxiety', 'suffocat', 'feel trapped'],
    text: "Feeling closed in by the mask is common, and it often eases with practice. Many people wear it for a few minutes while awake, watching TV, to get used to it. A smaller mask like nasal pillows can feel less confining. If it's hard to get past, your sleep doctor can help.",
  },
  {
    match: ['take it off', 'took it off', 'pull it off', 'pulled it off', 'rip it off', 'mask off in my sleep', 'wake up without'],
    text: "Pulling the mask off while half-asleep is really common, especially early on. It's often a sign of discomfort: dryness, leak, or the mask feeling too tight. Your hours on Tonight show when sessions ended. If it keeps happening, mention it to your supplier.",
  },
  {
    match: ['noise', 'noisy', 'loud', 'whistl', 'my partner', 'my wife', 'my husband'],
    text: "Most machines are quiet; a whistle or hiss usually comes from the mask, not the machine. That often means a small leak at the cushion or a vent pointed at the pillow. Re-seating the mask usually fixes it.",
  },
  {
    match: ['clean', /\bwash(ing)?\b/, 'soap', 'disinfect', 'mold', 'smell'],
    text: "Most suppliers suggest washing the mask cushion daily with mild soap and warm water, and the tubing and water chamber weekly, then letting them air-dry out of sunlight. Check your mask's manual for its exact steps. A clean cushion also seals better.",
  },
  {
    match: ['distilled', 'tap water', 'what water', 'bottled water'],
    text: "Most manufacturers recommend **distilled water** in the humidifier, because tap water can leave mineral buildup in the chamber. Empty and refill it each day rather than topping it up.",
  },
  {
    match: ['travel', 'flight', /\bfly(ing)?\b/, 'airplane', /\bplane\b/, 'airport', 'camping', 'hotel', 'vacation', /\btrip\b/],
    text: "CPAP machines count as medical devices, so on most US flights they're carried on and don't count toward your bag limit. Bring an extension cord and distilled water if you can. For camping, a CPAP battery or power station works. Your SD card keeps recording either way.",
  },
  {
    match: ['power outage', 'battery', 'no power', 'electricity'],
    text: "Without power the machine can't run. Some people keep a CPAP battery or power station for outages and camping. If you're worried about going without it, ask your supplier which battery fits your model.",
  },
  {
    match: [/\bnaps?\b/, 'napping'],
    text: "Using CPAP for naps is generally a good idea, since your airway behaves the same way during the day. Naps under 2 hours just won't get an AHI score in Nocta.",
  },
  {
    match: ['how long until', 'when will i feel', 'when does it start working', 'how long does it take'],
    text: "It varies a lot. Some people feel a difference within days; for others it takes weeks of steady use. Wearing it every night, for most of the night, makes the biggest difference. If you still feel no better after a month or two, tell your sleep doctor.",
  },
  {
    match: ['dream', 'nightmare'],
    text: "Lots of people notice vivid dreams when they start CPAP. A common explanation is that steadier sleep lets you spend more time in REM, the dreaming stage, after nights of interrupted sleep. It usually settles down.",
  },
  {
    match: ['headache', 'head ache', 'migraine'],
    text: "Morning headaches can have many causes, so I can't tell you what's behind yours. Tag them in your morning check-in and I'll show you whether they line up with particular nights. That's useful to bring to your doctor.",
  },

  /* ---- the app ---- */
  {
    match: ['sd card', /\bimport(ing|ed)?\b/, 'upload', 'sample data', 'demo data', 'is this my data', 'real data', 'fake data', 'my own data'],
    text: "Right now you may be seeing Nocta's sample nights. To see your own, take the SD card out of your machine, put it in your computer, and open **Therapy › Import SD card** in Nocta. Your card is read in your browser, and with an account it's saved to it so it's on all your devices.",
  },
  {
    match: ['privacy', 'private', 'who can see', 'sell my data', 'secure', 'safe is my', 'my data safe'],
    text: "With an account, your data is saved to it so it's on all your devices, and only you can read it. Without one, it stays in this browser. Nocta doesn't sell data, show ads, or share it with insurers or employers. The full details are in **Settings › Privacy Policy**.",
  },
  {
    match: ['delete my account', 'delete my data', 'erase', 'remove my data'],
    text: "You can do that from **Settings**: Delete account removes your account and erases Nocta's data from this device. You can download a copy first with Export my data.",
  },
  {
    match: ['oura', 'fitbit', 'whoop', 'withings', 'apple watch', 'garmin', 'wearable', 'smartwatch', 'smart watch'],
    text: "With an account, you can connect **Oura**, **Fitbit**, **Whoop**, or **Withings** from **You › Wearables**. Their sleep stages, heart rate and breathing then show up next to your CPAP nights. Apple Watch, Garmin and Samsung are coming later.",
  },
  {
    match: ['check-in', 'check in', 'checkin', 'journal', /\btags?\b/],
    text: "The morning check-in takes a few seconds: tap how you feel and anything from the night before, like a late meal, a drink, or a stuffy nose. Your machine can't see any of that, so it's how I find out what lines up with your better and rougher nights.",
  },
  {
    match: ['doctor summary', 'report for my doctor', /\bpdf\b/, 'share with my doctor', /\bprint\b/],
    text: "Nocta can put your recent nights on one page for your doctor, numbers only. Open a night on Tonight and tap **Prepare doctor summary**. It opens ready to print or save as a PDF.",
  },
  {
    match: ['what is nocta', 'what does nocta', 'what is this app', 'how does this app', 'what does this app'],
    text: "Nocta reads the data your CPAP machine writes to its SD card and explains each night in plain language: what changed, and one thing worth trying. It's a wellness companion, not a medical device, so anything clinical goes to your doctor.",
  },
  {
    match: ['smart nox', 'smart version', 'sign in', 'log in', 'login', 'create an account', 'ai version', 'real answers', 'basic version'],
    text: NOX_SMART_ON
      ? "Right now I'm the basic version of Nox: my answers are written ahead of time. Sign in with an account and I can answer real questions about your own nights. You'll find it under **You › Account**."
      : "You can sign in or create an account under **You › Account**. My answers here are written ahead of time, so I know common questions about CPAP, your mask, and your numbers.",
  },
];

/* broader topics, checked after the card follow-ups so they don't steal them */
const PRESETS_LATE = [
  {
    match: ['weight', 'lose weight', 'diet', 'exercise'],
    text: "Weight can affect how easily the airway narrows, so changes in weight sometimes show up in your numbers over months. Any change to your therapy because of it is a conversation for your doctor.",
  },
  {
    match: ['tired', 'exhausted', 'sleepy', 'fatigue', 'no energy'],
    text: "Feeling tired can come from many things: short nights, a rough night on the mask, or things outside CPAP entirely. Your hours on the mask are a good first thing to check. If you keep feeling this way despite steady use, tell your sleep doctor.",
  },
];

/* small talk and the things people type to test a chat */
const SMALLTALK = [
  {
    match: [/^(hi|hello|hey|heya|hiya|yo|howdy|sup|good (morning|afternoon|evening))\b/],
    text: "Hi! I'm Nox. Ask me about last night, your mask, or any number on your screen. Try *What was my AHI last night?*",
  },
  {
    match: [/how are you|how's it going|hows it going|what'?s up|how you doing/],
    text: "I'm doing fine, thanks for asking. More importantly, how did you sleep? Ask me about last night and I'll walk you through it.",
  },
  {
    match: [/\b(thanks|thank you|thx|ty|appreciate it)\b/],
    text: "You're welcome. I'm here whenever you want to look at a night.",
  },
  {
    match: [/^(ok|okay|k|kk|cool|nice|great|got it|sounds good|alright|awesome|sure|yes|no|yep|nope)\W*$/],
    text: "Anything else you'd like to look at? Your leak, your hours, or a night that felt off are all good places to start.",
  },
  {
    match: [/\b(bye|goodbye|good night|goodnight|see you|see ya|later|gn)\b/],
    text: "Good night. Sleep well, and I'll have your numbers ready in the morning.",
  },
  {
    match: [/\b(lol|lmao|haha+|hehe+)\b/],
    text: "Glad something made you smile. Anything about your nights I can help with?",
  },
  {
    match: [/who are you|what are you|your name|are you (a )?(bot|robot|ai|human|real|person)|chatgpt|\bgpt\b|claude/],
    text: `I'm **Nox**, Nocta's coach. I explain your CPAP data in plain language. My answers here are written ahead of time.${SIGN_IN_FOR_SMART}`,
  },
  {
    match: [/what can you do|how do you work|what do you know|^help\W*$|can you help/],
    text: "I can explain any number on your screen, tell you what changed on a night, and help with common CPAP problems like leak, dryness or mask fit. Try *How can I reduce my leak?* or *What does AHI mean?*",
  },
  {
    match: ['joke', 'funny', 'make me laugh'],
    text: "I'm better with numbers than jokes, but here's one: my CPAP and I have a great relationship. It's all about *give and take*. Anything about your nights I can help with?",
  },
  {
    match: [/stupid|dumb|useless|hate you|shut up|you suck|worst app/],
    text: `Sorry I'm not getting it right. My answers are written ahead of time, so I only know common questions. Try asking about your AHI, your leak, or your mask.${SIGN_IN_FOR_SMART}`,
  },
  {
    match: [/love you|marry me|you're cute|youre cute/],
    text: "That's kind of you. I'll show my appreciation the only way I know how: by watching your leak numbers closely.",
  },
  {
    match: [/weather|recipe|cook|sports|stock|bitcoin|crypto|movie|music|homework|\bcode\b|programming|math|news|politic|president|election|capital of/],
    text: "That's outside what I know. I'm here just for your sleep therapy: your CPAP numbers, your mask, and how your nights are going.",
  },
  {
    match: [/^(test|testing|asdf|qwerty|123+|abc|hmm+|\?+|\.+)\W*$/, /^.{1,2}$/],
    text: "I'm here and listening. Ask me anything about your CPAP nights, like *What was my AHI last night?*",
  },
];

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
      "I can't suggest a pressure setting. That one is genuinely your sleep doctor's call, and changing it on your own can mask what the data is telling them. What helps is bringing them a clean summary of your recent nights: it's in Therapy, under *Summary for your doctor*, ready to print or save.",
  },
  {
    match: ['diagnos', 'do i have', 'is this csa', 'central sleep apnea', 'complex apnea'],
    text:
      () => {
        const c = centralNights(365);
        const shows = c
          ? `central-type events ran at ${c.joined}, against a usual **${c.usual}**. That's worth showing your sleep doctor. Therapy › *Summary for your doctor* puts your recent nights on one page.`
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
      "AHI is **apnea–hypopnea index**, the number of times per hour your breathing paused or got shallow. It's the headline number, but a single night's AHI bounces around; the *trend* over a couple of weeks, against your own usual, tells you far more. Your doctor can tell you what number they're aiming for with you.",
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

const DEFAULT_REPLY = `I don't have an answer written for that one yet. I know common questions about CPAP, your mask, and your numbers: try *What was my AHI last night?* or *How can I reduce my leak?*${SIGN_IN_FOR_SMART}`;

const ALL_REPLIES = [...SAFETY, ...PRESETS_FIRST, ...REPLIES, ...PRESETS_LATE, ...SMALLTALK];
const matches = (q, m) => (m instanceof RegExp ? m.test(q) : q.includes(m));

/* fx: the night being viewed, so replies quote its numbers, not a fixed night */
export function coachReply(text, fx) {
  const q = text.toLowerCase().trim();
  for (const r of ALL_REPLIES) {
    if (r.match.some((m) => matches(q, m))) return typeof r.text === 'function' ? r.text(fx) : r.text;
  }
  return DEFAULT_REPLY;
}
