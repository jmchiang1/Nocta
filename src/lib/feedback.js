/* Nocta — feedback to the people making Nocta. Sent to Supabase's
 * nocta_feedback table (supabase/migrations/…_nocta_feedback.sql), which
 * anyone can add to and nobody can read from the app. A message carries a
 * rating and/or a note, where it came from and the app version: never CPAP
 * data.
 *
 * Asking now and then: once someone has opened Nocta on 3 different days,
 * Tonight shows a small card asking how it's going. "Not now" (or sending)
 * puts it away for 14 days; "Don't ask again" for good. Kept on this device. */
import { supabase } from './supabase.js';

export const FEEDBACK_MAX = 2000;

export async function sendFeedback({ rating, message, source, layout }) {
  if (!supabase) return { ok: false, message: 'Feedback can’t be sent from this preview.' };
  const note = message.trim();
  const { error } = await supabase.from('nocta_feedback').insert({
    rating: rating ?? null,
    message: note ? note.slice(0, FEEDBACK_MAX) : null,
    source,
    layout,
    app_version: __APP_VERSION__,
  });
  if (error) return { ok: false, message: 'That didn’t send. Check your connection and try again.' };
  markAsked();
  return { ok: true };
}

/* ---- the periodic ask ---- */

const KEY = 'nocta.feedbackAsk.v1';
const DAYS_BEFORE_ASKING = 3;
const ASK_EVERY_DAYS = 14;
const DAY = 86400000;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}
function write(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

/* call once per app open: counts the distinct days Nocta has been opened */
export function noteVisit() {
  const s = read();
  const days = s.days ?? [];
  if (days.length < DAYS_BEFORE_ASKING && !days.includes(today())) write({ ...s, days: [...days, today()] });
}

export function shouldAsk() {
  const s = read();
  if (s.never || (s.days ?? []).length < DAYS_BEFORE_ASKING) return false;
  return !s.asked || Date.now() - s.asked >= ASK_EVERY_DAYS * DAY;
}

/* "Not now", or sent: ask again in two weeks */
export function markAsked() {
  write({ ...read(), asked: Date.now() });
}

export function neverAsk() {
  write({ ...read(), never: true });
}
