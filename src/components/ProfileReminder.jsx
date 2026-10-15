/* Nocta — the gentle nudge to answer a skipped onboarding question, on
 * Tonight (phone + desktop). Shows the most useful unanswered question; it
 * appears only when lib/profile.js says it's time (not in the first days
 * after setup, at most every few days, never once turned off), only on last
 * night, and never for guests (nothing of theirs is saved). */
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';
import { missingQuestions, shouldRemind, snoozeReminders } from '../lib/profile.js';
import { LAST_NIGHT } from '../data/history.js';

export function ProfileReminder() {
  const { profile, authUser, fixtureId, openSheet } = useStore();
  if (authUser?.kind === 'guest' || fixtureId !== LAST_NIGHT || !shouldRemind(profile)) return null;
  const left = missingQuestions(profile);
  const q = left[0];

  return (
    <section className="tn-module pq-card" aria-label="A quick question for Nox">
      <div className="pq-card-head">
        <span className="pq-card-eyebrow">
          A quick question{left.length > 1 ? ` · ${left.length} left` : ''}
        </span>
        <button className="pq-card-later" type="button" onClick={() => snoozeReminders()}>
          Not now
        </button>
      </div>
      <button className="pq-card-main" type="button" onClick={() => openSheet('profileQuestions')}>
        <span className="pq-card-text">
          <span className="pq-card-q">{q.title}</span>
          <span className="pq-card-why">{q.why}</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
    </section>
  );
}
