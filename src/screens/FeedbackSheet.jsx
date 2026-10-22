/* Nocta — send feedback (Settings › Send feedback, or the now-and-then card
 * on Tonight). A 1–5 rating and/or a note, sent to the Nocta team
 * (lib/feedback.js). Either one is enough. Never carries CPAP data. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { sendFeedback, FEEDBACK_MAX } from '../lib/feedback.js';
import { track } from '../lib/analytics.js';

const SCALE = [1, 2, 3, 4, 5];

export function FeedbackSheet() {
  const { closeSheet, sheet, viewMode } = useStore();
  const source = sheet?.source === 'prompt' ? 'prompt' : 'settings';
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const empty = rating == null && !note.trim();

  async function send() {
    if (empty || busy) return;
    setBusy(true);
    setError(null);
    const r = await sendFeedback({ rating, message: note, source, layout: viewMode === 'desktop' ? 'desktop' : 'mobile' });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      track('feedback_failed', { source });
      return;
    }
    track('feedback_sent', { source });
    setSent(true);
  }

  return (
    <Sheet title="Send feedback" hideTitle={sent} onClose={closeSheet} className="fb-sheet">
      {(close) =>
        sent ? (
          <div className="fb-done" role="status">
            <Mascot size={88} state="pleased" pop sound="happy" />
            <h2>Thank you</h2>
            <p>It’s on its way to the people making Nocta. We read every one.</p>
            <button type="button" className="btn primary" onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <form
            className="fb-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <fieldset className="fb-field">
              <legend className="ob-field-label">How useful is Nocta for you so far?</legend>
              <div className="fb-scale" role="radiogroup" aria-label="How useful, from 1 (not useful) to 5 (very useful)">
                {SCALE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    className={`fb-step tnum${rating === n ? ' selected' : ''}`}
                    onClick={() => setRating(rating === n ? null : n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="fb-scale-ends" aria-hidden="true">
                <span>Not useful</span>
                <span>Very useful</span>
              </div>
            </fieldset>

            <div className="fb-field">
              <label className="ob-field-label" htmlFor="fb-note">
                Anything you’d like to tell us?
              </label>
              <textarea
                id="fb-note"
                className="ob-input fb-note"
                rows={5}
                maxLength={FEEDBACK_MAX}
                placeholder="What’s working, what’s confusing, what’s missing"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="au-field-hint">
                Please leave out health details you’d rather keep private.
                {note.length > FEEDBACK_MAX - 200 && (
                  <span className="fb-count tnum"> {FEEDBACK_MAX - note.length} left</span>
                )}
              </p>
            </div>

            {error && (
              <p className="au-field-err" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn primary" disabled={empty || busy} aria-busy={busy || undefined}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </form>
        )
      }
    </Sheet>
  );
}
