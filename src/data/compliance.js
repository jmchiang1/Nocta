/* Nocta — insurance compliance: the plan the person is on, and where they
 * stand against it. Shown only to someone with an account who said they're
 * in a compliance window (onboarding › Insurance & compliance, then Your
 * compliance plan); a guest's or anyone else's Therapy tab has no
 * compliance card, because Nocta doesn't know they're on one.
 *
 * The plan: when the window started (they tell us; it's rarely the first
 * night on the card) and what their insurer asks for. The one rule Nocta
 * states as fact is Medicare's (CMS: 4+ hours on 70% of nights, i.e. 21, in
 * any 30 consecutive days within the first 90). Most private plans follow it,
 * but Nocta doesn't claim any one insurer's rule: the person can set theirs.
 *
 * The count runs on calendar days from the start date. A day before the
 * card's first night is "unknown": Nocta can't see it, so it never counts
 * toward the bar (and is said so). */
import { NIGHTS, THERAPY_START, LAST_NIGHT, addDays, fmtShort } from './history.js';
import { getAnswers } from '../lib/profile.js';

export const MEDICARE_RULE = { minHours: 4, nights: 21, window: 30, within: 90 };

/* the rule shapes offered before "my plan is different": Medicare's (the
 * one stated as a fact), then the same bar over a shorter stretch. Each says
 * only what it counts, never which insurer uses it. */
export const RULE_PRESETS = [
  { id: 'medicare', label: '21 of any 30 days, first 90', sub: 'Medicare’s rule, which many plans follow', rule: MEDICARE_RULE },
  { id: 'first30', label: '21 of your first 30 days', sub: 'Only your first month counts', rule: { minHours: 4, nights: 21, window: 30, within: 30 } },
  { id: 'first60', label: '21 of any 30 days, first 60', sub: 'A 60-day deadline instead of 90', rule: { minHours: 4, nights: 21, window: 30, within: 60 } },
];
const sameRule = (a, b) => ['minHours', 'nights', 'window', 'within'].every((k) => a[k] === b[k]);
/* which preset a saved rule is, or 'custom' */
export const presetOf = (answers) => {
  const r = ruleFor(answers);
  return RULE_PRESETS.find((p) => sameRule(p.rule, r))?.id ?? 'custom';
};

/* a rule that can actually be met: nights ≤ days in the stretch ≤ deadline */
export function saneRule(r) {
  const window = Math.max(1, r.window);
  return { ...r, window, nights: Math.min(r.nights, window), within: Math.max(r.within, window) };
}

/* today on this device, as YYYY-MM-DD */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/* the earliest start that's still a window someone is "in now" */
export const earliestStart = (rule, today = todayIso()) => addDays(today, -(rule.within - 1));

/* what's wrong with a start date, or null: it has to be a real date, not
 * in the future, and recent enough that the window is still running */
export function startProblem(iso, rule = MEDICARE_RULE, today = todayIso()) {
  if (!iso) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(Date.parse(`${iso}T00:00:00`))) return 'Enter the full date.';
  if (iso > today) return 'That’s in the future. Pick the day your window started.';
  if (iso < earliestStart(rule, today)) {
    return `That’s more than ${rule.within} days ago, so that window has already ended. If you’ve cleared it, you don’t need to track it.`;
  }
  return null;
}

/* the rule in force: what they set, else Medicare's */
export const ruleFor = (answers = getAnswers()) => ({ ...MEDICARE_RULE, ...(answers.complianceRule ?? {}) });

/* where the rule comes from, said plainly (never a claim about an insurer
 * Nocta hasn't checked) */
export function ruleSource(answers = getAnswers()) {
  if (answers.complianceRule) return 'The rule you set for your plan.';
  if (answers.insuranceProvider === 'medicare') return 'Medicare’s rule.';
  return 'Medicare’s rule, which most plans follow. If yours is different, change it here.';
}

export const ruleText = (r) =>
  `${r.minHours}+ hours a night on ${r.nights} of any ${r.window} days, within your first ${r.within} days`;

/* compliance only for an account that said it's in a window */
export function tracksCompliance(authUser, answers = getAnswers()) {
  const signedIn = authUser && authUser.kind !== 'guest';
  return Boolean(signedIn && answers.complianceWindow === 'yes');
}

const byDate = () => new Map(NIGHTS.map((x) => [x.date, x]));
export const dayDiff = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/* where they stand as of a night: { needsStart } when there's no start date
 * yet, else the card's headline, body, the 30-day bar and its labels */
/* `anchor`: the night it's shown as of (the card's newest, or an older one
 * being looked back on). `today`: the real day, when that's later than the
 * anchor: days after the card's newest night are still counted as days of
 * the period, but as "pending" (not on the card yet, so neither met nor
 * missed, and still able to count). */
export function complianceAsOf(anchor = LAST_NIGHT, answers = getAnswers(), today = anchor) {
  if (today < anchor) today = anchor;
  const start = answers.complianceStart;
  if (!start) return { needsStart: true };
  const rule = ruleFor(answers);
  const rows = byDate();
  const h = rule.minHours;

  // each day of the deadline period: met / missed / unknown (before the
  // card) / future (not yet happened, as of the anchor)
  const statusOf = (date) => {
    if (date > today) return 'future';
    if (date > anchor) return 'pending';
    if (THERAPY_START && date < THERAPY_START) return 'unknown';
    const x = rows.get(date);
    return x && (x.rawHours ?? x.hours) >= h ? 'met' : 'missed';
  };
  const days = Array.from({ length: rule.within }, (_, i) => {
    const date = addDays(start, i);
    return { date, status: statusOf(date) };
  });
  const dayNo = Math.min(rule.within, Math.max(0, dayDiff(start, today) + 1)); // today, as day N
  const before = dayDiff(start, today) < 0;
  const after = dayDiff(start, today) + 1 > rule.within;
  const open = (d) => d.status === 'future' || d.status === 'pending'; // can still be met

  // every consecutive window inside the period: met so far, and whether it
  // can still reach the bar if every night from here is a full one
  let best = null; // the window with the most met nights so far
  let cleared = null; // the first window that reached the bar
  let earliest = null; // the soonest day the bar can be reached
  let earliestNeed = null; // and how many more full nights that takes
  for (let s = 0; s + rule.window <= rule.within; s += 1) {
    const w = days.slice(s, s + rule.window);
    const met = w.filter((d) => d.status === 'met').length;
    const future = w.filter(open).length;
    if (!best || met > best.met) best = { s, met };
    if (met >= rule.nights && cleared == null) {
      // the day the bar was reached inside this window
      let n = 0;
      const at = w.findIndex((d) => d.status === 'met' && ++n === rule.nights);
      cleared = { s, day: s + at + 1, met };
    }
    if (met + future >= rule.nights && met < rule.nights) {
      // the first future day in the window, then one more met night a day
      const firstFuture = w.findIndex(open);
      const day = s + firstFuture + (rule.nights - met);
      if (earliest == null || day < earliest) {
        earliest = day;
        earliestNeed = rule.nights - met;
      }
    }
  }
  const unknown = days.slice(0, dayNo).some((d) => d.status === 'unknown');
  const pending = days.slice(0, dayNo).some((d) => d.status === 'pending');

  // the bar: the first window while it's still being filled, then the
  // latest 30 days up to today
  const barStart = dayNo <= rule.window ? 0 : Math.min(rule.within - rule.window, dayNo - rule.window);
  const bar = days.slice(barStart, barStart + rule.window);
  const barMet = bar.filter((d) => d.status === 'met').length;
  const dateOfDay = (n) => fmtShort(addDays(start, n - 1));
  const markerDay = !cleared && earliest != null && earliest > barStart && earliest <= barStart + rule.window ? earliest : null;

  const base = {
    rule,
    dayNo,
    nights: bar.map((d) => d.status),
    met: barMet,
    marker: markerDay == null ? null : markerDay - barStart, // 1-based slot in the bar
    scale: [
      `Day ${barStart + 1} · ${dateOfDay(barStart + 1)}`,
      markerDay != null ? `Day ${markerDay} · earliest` : '',
      `Day ${barStart + rule.window}`,
    ],
    unknownNote: unknown
      ? `Nocta can’t see nights before your card’s first, ${fmtShort(THERAPY_START)}, so those days don’t count here.`
      : null,
    pendingNote: pending
      ? `Nights after ${fmtShort(anchor)} aren’t on your card yet. Bring in your SD card to count them.`
      : null,
  };

  if (before) {
    return {
      ...base,
      eyebrow: 'Compliance',
      headline: `Your window starts *${fmtShort(start)}*.`,
      body: `From then, your plan asks for ${ruleText(rule)}.`,
    };
  }
  if (cleared) {
    return {
      ...base,
      eyebrow: `Compliance · day ${dayNo} of ${rule.within}`,
      headline: 'You’ve *cleared* compliance.',
      body: `${cleared.met} of the ${rule.window} days from ${dateOfDay(cleared.s + 1)} had ${h}+ hours, which meets your plan’s ${rule.nights} of ${rule.window}. You reached it on day ${cleared.day}, ${dateOfDay(cleared.day)}.`,
    };
  }
  // the window ran mostly before the card's first night: Nocta can't say,
  // rather than call nights it never saw a miss
  if ((after || earliest == null) && unknown) {
    return {
      ...base,
      eyebrow: `Compliance · day ${dayNo} of ${rule.within}`,
      headline: 'Nocta can’t see *most of your window*.',
      body: `Your window started ${fmtShort(start)}, before the first night on your card (${fmtShort(THERAPY_START)}), so those nights can’t be counted here. Your equipment supplier can tell you where you stand.`,
      unknownNote: null,
    };
  }
  if (after || earliest == null) {
    return {
      ...base,
      eyebrow: `Compliance · day ${dayNo} of ${rule.within}`,
      headline: after ? 'Your first *' + rule.within + ' days* have ended.' : 'Compliance is *out of reach* this window.',
      body: `No ${rule.window}-day stretch ${after ? 'reached' : 'can still reach'} ${rule.nights} nights of ${h}+ hours (the best had ${best?.met ?? 0}). Worth a call to your equipment provider about what happens next.`,
    };
  }
  const need = earliestNeed;
  return {
    ...base,
    eyebrow: `Compliance · day ${dayNo} of ${rule.within}`,
    headline: `You’re on track to clear compliance by *day ${earliest}*, ${dateOfDay(earliest)}.`,
    body: `Your plan asks for ${ruleText(rule)}. ${need} more ${need === 1 ? 'night' : 'nights'} of ${h}+ hours in a row gets you there${
      pending ? `, counting the nights since ${fmtShort(anchor)} that aren’t on your card yet` : ''
    }.`,
  };
}
