/* Nocta — the now-and-then ask on Tonight (mobile and desktop): once someone
 * has opened Nocta on a few different days, a small card asks how it's
 * going (lib/feedback.js decides when). "Share feedback" opens the form;
 * "Not now" puts the card away for two weeks; "Don't ask again" for good.
 * Settings › Send feedback is always there either way. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { shouldAsk, markAsked, neverAsk } from '../lib/feedback.js';
import { track } from '../lib/analytics.js';
import { Icon } from './Icons.jsx';

export function FeedbackPrompt() {
  const { openSheet } = useStore();
  const [show, setShow] = useState(shouldAsk);
  if (!show) return null;

  function away(forGood) {
    if (forGood) neverAsk();
    else markAsked();
    track('feedback_prompt_dismissed', { choice: forGood ? 'never' : 'later' });
    setShow(false);
  }

  // the same card as the skipped-question reminder (ProfileReminder), so the
  // two read as one family
  return (
    <section className="tn-module pq-card fb-prompt" aria-label="Feedback for Nocta">
      <div className="pq-card-head">
        <span className="pq-card-eyebrow">A minute of your time</span>
        <button className="pq-card-later" type="button" onClick={() => away(false)}>
          Not now
        </button>
      </div>
      <button
        className="pq-card-main"
        type="button"
        onClick={() => {
          markAsked();
          setShow(false);
          openSheet('feedback', { source: 'prompt' });
        }}
      >
        <span className="pq-card-text">
          <span className="pq-card-q">How’s Nocta working for you?</span>
          <span className="pq-card-why">Tell us what helps and what doesn’t. It shapes what we fix and build next.</span>
        </span>
        <Icon name="chevronRight" size={18} />
      </button>
      <button className="fb-prompt-never" type="button" onClick={() => away(true)}>
        Don’t ask again
      </button>
    </section>
  );
}
