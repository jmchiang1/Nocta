/* Nocta Coach — mock conversational layer. No real LLM; keyword-matched canned replies
 * written to the voice + safety rules in docs/FEATURES.md and CLAUDE.md. */

export const SUGGESTED_PROMPTS = [
  'Why was last night different?',
  'How can I reduce my leak rate?',
  'What does AHI actually mean?',
];

/* opening bubble when the Coach is launched from a card */
export function contextOpener(context) {
  if (context && context.kind === 'why') {
    return "I can walk you through last night's card. The short version: your numbers moved enough to be worth a look, and I have flagged the most likely reason. What would you like to dig into?";
  }
  if (context && context.kind === 'metric') {
    return `Happy to talk through your ${context.label.toLowerCase()}. What are you curious about?`;
  }
  return null;
}

const REPLIES = [
  {
    match: ['pressure', 'cmh2o', 'turn up', 'turn down', 'raise', 'increase my'],
    text:
      "I can't suggest a pressure setting — that one is genuinely your sleep doctor's call, and changing it on your own can mask what the data is telling them. What I *can* do is prepare a clean summary of your recent nights so the conversation with them is quick. Want me to start that?",
  },
  {
    match: ['diagnos', 'do i have', 'is this csa', 'central sleep apnea', 'complex apnea'],
    text:
      "I won't put a name to it — that's a clinical call, and I'm a companion, not a doctor. What I can tell you is *what the data shows*: a run of central-type events over several nights. That pattern is worth showing your sleep doctor, and I can package it for you.",
  },
  {
    match: ['leak', 'mask leak', 'air leak'],
    text:
      "Leak usually creeps up for one of three reasons: the cushion has aged past its seal, the straps loosen as you move, or you shift onto your back and the mask gets pushed. Your cushion is **24 days old** — still inside its 30-day window, so I'd start with the straps. A snug-but-not-tight fit, re-checked sitting up, fixes most of it.",
  },
  {
    match: ['stomach', 'position', 'side sleep', 'on my back'],
    text:
      "Position matters more than most people expect. On your stomach and back, the airway is easier to crowd; on your side it tends to stay open. Your own data backs this up — stomach nights run noticeably higher. A body pillow against your chest makes side-sleeping easier to *hold* through the night.",
  },
  {
    match: ['ahi', 'what does ahi', 'events per hour'],
    text:
      "AHI is **apnea–hypopnea index** — the number of times per hour your breathing paused or got shallow. Under 5 is considered well-controlled on therapy. It's the headline number, but a single night's AHI bounces around; the *trend* over a couple of weeks tells you far more.",
  },
  {
    match: ['central', 'csa', 'cai'],
    text:
      "Central events are pauses where the signal to breathe briefly drops — different from obstructive events, where the airway is blocked. A few here and there is normal. A *run* of them across several nights is the kind of thing your doctor wants to know about, which is why I flag it rather than brush past it.",
  },
  {
    match: ['why', 'last night', 'different', 'bad night'],
    text:
      "Last night your AHI sat above your usual range, and most of the events were central, bunched between 2 and 5 a.m. You were on your stomach for that stretch and had logged a drink earlier. None of those alone explains it, but together they line up with the pattern I've seen on your higher nights.",
  },
  {
    match: ['cushion', 'replace', 'filter', 'equipment'],
    text:
      "Worn parts quietly drag your numbers down. Your filter is **27 days old** — about due. The cushion has a few days left. Replacing them on schedule is one of the easiest ways to keep leak and comfort where they should be; the Therapy tab tracks the ages for you.",
  },
];

const DEFAULT_REPLY =
  "Good question. I read your CPAP data each night and look for what changed and why — leak, position, timing, the events themselves. Ask me about any metric on your screen, or about a night that looked off, and I'll talk you through what I see.";

export function coachReply(text) {
  const q = text.toLowerCase();
  for (const r of REPLIES) {
    if (r.match.some((m) => q.includes(m))) return r.text;
  }
  return DEFAULT_REPLY;
}
