/* Nocta — Nox with Claude behind it (supabase/functions/nocta-nox), for
 * signed-in accounts, when switched on (NOX_SMART_ON below). Guests, the mock
 * sign-in, and everyone while it's off keep the pre-written Nox (data/coach.js).
 *
 * The CPAP data stays on this device. When someone asks a question, this
 * builds a plain-text summary of it: nightly numbers, check-in tags, setup
 * answers, equipment dates, wearable summaries. The summary goes with the
 * question; the function streams the answer back. Nothing is kept between
 * chats. */
import { supabase, authConfigured } from './supabase.js';
import { NIGHTS, LAST_NIGHT, ahiTotal, averages } from '../data/history.js';
import { getCard, isDemoData } from './dataset.js';
import { checkinTags } from './checkins.js';
import { TAG_LABELS } from '../data/journal.js';
import { getAnswers } from './profile.js';
import { equipmentStatus } from './equipment.js';
import { LIVE_WEARABLES, wearableNight } from './wearables.js';
import { deviceByKey, MASKS } from '../data/account.js';

/* The smart Nox is built but off until the Claude API key is set on the
 * server and the function deployed (docs/NOX_SETUP.md). With it off, everyone
 * gets the pre-written Nox and nothing mentions a smarter one. */
export const NOX_SMART_ON = import.meta.env.VITE_NOX_SMART === '1';

/* the real Nox needs a real account: the server counts questions per person */
export const noxLiveFor = (authUser) => NOX_SMART_ON && authConfigured && !!authUser && authUser.kind !== 'guest';

const SUMMARY_NIGHTS = 90;
const USUAL_NIGHTS = 30;

const fmt = (x, digits = 1) => (x == null ? '—' : Number(x).toFixed(digits).replace(/\.0$/, ''));
const list = (xs) => (Array.isArray(xs) ? xs.join(', ') : xs);

function settingsLine(card) {
  const s = card?.settings;
  if (!s) return null;
  const pressure =
    s.setPressure != null ? `fixed ${s.setPressure} cmH2O` : s.minPressure != null ? `${s.minPressure}–${s.maxPressure} cmH2O` : null;
  return [
    s.mode,
    pressure,
    s.epr?.on ? `EPR ${s.epr.level}` : s.epr ? 'EPR off' : null,
    s.rampMinutes != null ? `ramp ${s.rampMinutes} min` : null,
    s.humidifierLevel != null ? `humidifier ${s.humidifierLevel}` : null,
    s.maskType ? `mask type ${s.maskType}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function answersLine() {
  const a = getAnswers() ?? {};
  // exact match: maskById falls back to the first mask, which would be wrong here
  const mask = a.maskModel ? (MASKS.find((m) => m.id === a.maskModel)?.name ?? a.maskModel) : null;
  return [
    a.sleepPosition && `usual sleep position: ${a.sleepPosition}`,
    a.complianceWindow && `insurance compliance window: ${a.complianceWindow}`,
    a.sleepConditions?.length && `other things affecting sleep: ${list(a.sleepConditions)}`,
    mask && `mask: ${mask}`,
    a.goals?.length && `goals: ${list(a.goals)}`,
    a.birthYear && `born ${a.birthYear}`,
  ]
    .filter(Boolean)
    .join('; ');
}

function equipmentLine() {
  const logged = equipmentStatus().filter((p) => p.replacedOn);
  if (!logged.length) return 'no replacement dates logged';
  return logged
    .map((p) => `${p.name} replaced ${p.replacedOn} (${p.ageDays} days ago, usual life ${p.lifespanDays} days)`)
    .join('; ');
}

/* one wearable's night, in a few words */
function wearableBits(date) {
  return LIVE_WEARABLES.map((p) => {
    const n = wearableNight(p, date);
    if (!n) return null;
    const bits = [
      n.hr?.avg != null && `HR avg ${n.hr.avg}`,
      n.hr?.low != null && `low ${n.hr.low}`,
      n.hr?.resting != null && `resting HR ${n.hr.resting}`,
      n.hrv != null && `HRV ${n.hrv} ms`,
      n.respRate != null && `breathing ${n.respRate}/min`,
      n.spo2 != null && `SpO2 avg ${n.spo2}%`,
      n.asleepHours != null && `asleep ${n.asleepHours}h`,
      n.stages && `deep ${n.stages.deep}h REM ${n.stages.rem}h light ${n.stages.light}h awake ${n.stages.awake}h`,
      n.awakenings != null && `${n.awakenings} wake-ups`,
    ].filter(Boolean);
    return bits.length ? `${deviceByKey(p)?.title ?? p}${n.test ? ' (test data)' : ''}: ${bits.join(', ')}` : null;
  })
    .filter(Boolean)
    .join(' / ');
}

function nightLine(x) {
  if (!x.hours) return `${x.date} | no session`;
  const ahi = x.ahi ? `${fmt(ahiTotal(x))} (${fmt(x.ahi.osa)}/${fmt(x.ahi.csa)}/${fmt(x.ahi.hyp)})` : 'not scored (under 2h)';
  const tags = (checkinTags(x.date) ?? []).map((t) => TAG_LABELS[t] ?? t);
  const card = getCard()?.nights?.find((n) => n.date === x.date);
  const spo2 = card?.spo2?.avg != null ? ` | CPAP oximeter SpO2 avg ${card.spo2.avg}%, min ${card.spo2.min}%` : '';
  const wear = wearableBits(x.date);
  return [
    x.date,
    `${fmt(x.hours)}h`,
    ahi,
    x.leak != null ? `leak ${fmt(x.leak)}` : 'leak —',
    x.pressure != null ? `pressure ${fmt(x.pressure)}` : 'pressure —',
    tags.length ? `check-in: ${tags.join(', ')}` : null,
    wear || null,
  ]
    .filter(Boolean)
    .join(' | ')
    .concat(spo2);
}

/* where Nox was opened from: the night's card, or a Trends range */
function focusLines(context, fx) {
  const out = [];
  if (fx) {
    const ins = fx.insight ?? {};
    out.push(`The night they're looking at: ${fx.id}${fx.id === LAST_NIGHT ? ' (last night)' : ''}.`);
    if (ins.headline) out.push(`Nocta's card for that night says: "${String(ins.headline).replace(/\*/g, '')}"`);
    if (ins.observation) out.push(`Card detail: ${String(ins.observation).replace(/\*/g, '')}`);
  }
  if (context?.kind === 'trends') {
    out.push(`They opened Nox from the Trends view (${context.range ?? 'a range of nights'}).`);
    if (context.summary) out.push(`That view's summary: ${String(context.summary).replace(/\*/g, '')}`);
  }
  return out;
}

/* the plain-text summary sent with each question */
export function buildNoxContext({ context, fx } = {}) {
  const card = getCard();
  const recent = NIGHTS.slice(-SUMMARY_NIGHTS).reverse();
  const usual = averages(NIGHTS.slice(-USUAL_NIGHTS));
  const lines = [
    `Today is ${new Date().toISOString().slice(0, 10)}. Their most recent night is ${LAST_NIGHT ?? 'none yet'}.`,
    isDemoData()
      ? "This is Nocta's bundled sample data, not the person's own nights. They haven't imported their SD card yet; say so if it matters to the answer."
      : `Data from their own SD card (${card?.device?.brand ?? ''} ${card?.device?.model ?? 'CPAP'}).`,
    `Machine settings: ${settingsLine(card) ?? 'not on the card'}.`,
    `From setup: ${answersLine() || 'nothing answered'}.`,
    `Equipment: ${equipmentLine()}.`,
    `Their usual over the last ${USUAL_NIGHTS} nights: AHI ${fmt(usual.ahi)}, leak ${fmt(usual.leak)} L/min, ${fmt(usual.hours)}h a night, pressure ${fmt(usual.pressure)} cmH2O (${usual.used} nights used).`,
    ...focusLines(context, fx),
    '',
    'Nights, newest first. Columns: date | hours on the mask | AHI events per hour, total (obstructive/central/hypopnea) | leak, 95th percentile, L/min | median pressure, cmH2O | morning check-in tags | wearable summary.',
    ...recent.map(nightLine),
  ];
  return lines.join('\n');
}

/* Ask Nox. history: [{ role: 'user' | 'assistant', content }], ending with
 * the new question. onText(chunk) per piece of the answer; onReset() when
 * the answer restarts on another model. Resolves when the answer is done;
 * throws an Error with .code: 'daily_limit' | 'unauthorized' | 'refusal' |
 * 'not_configured' | 'failed'. */
export async function askNox(history, { context, fx, conversationId, onText, onReset, signal } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const fail = (code) => Object.assign(new Error(`[nox] ${code}`), { code });
  if (!token) throw fail('unauthorized');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nocta-nox`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages: history, context: buildNoxContext({ context, fx }), conversationId }),
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw fail(body.error ?? 'failed');
  }

  // server-sent events: `data: {...}` blocks separated by a blank line
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let cut;
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      if (!chunk.startsWith('data: ')) continue;
      const event = JSON.parse(chunk.slice(6));
      if (event.type === 'text') onText?.(event.text);
      else if (event.type === 'reset') onReset?.();
      else if (event.type === 'error') throw fail(event.code);
      else if (event.type === 'done') return;
    }
  }
  throw fail('failed'); // the stream ended without finishing
}
