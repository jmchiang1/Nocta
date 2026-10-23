/* Nocta — "was this helpful?" on a night's suggestion, as two small thumbs
 * beside it (WhyHorizon), the way chat apps do it. Pick one and it fills, a
 * short thanks shows for a moment, then fades; pick it again to take it
 * back, or the other to change it. Kept per night on the device
 * (lib/insightRatings.js); feeds analytics (which kind of insight and the
 * rating, never the night's numbers) and, for an account sharing its nights,
 * that night's summary (lib/research.js). */
import { useEffect, useRef, useState } from 'react';
import { ratingFor, rateInsight, onRatings } from '../lib/insightRatings.js';
import { insightFor } from '../lib/insights.js';
import { track } from '../lib/analytics.js';
import { researchChanged } from '../lib/research.js';
import { Icon } from './Icons.jsx';

const THANKS_MS = 2200;

export function InsightThumbs({ date }) {
  const [rating, setRating] = useState(() => ratingFor(date));
  const [thanks, setThanks] = useState(false);
  const timer = useRef(0);
  useEffect(() => {
    setRating(ratingFor(date));
    return onRatings(() => setRating(ratingFor(date)));
  }, [date]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!date) return null;

  function pick(value) {
    const next = rating === value ? null : value;
    rateInsight(date, next);
    clearTimeout(timer.current);
    setThanks(Boolean(next));
    if (next) {
      timer.current = setTimeout(() => setThanks(false), THANKS_MS);
      const found = insightFor(date);
      track('insight_rated', {
        rating: next,
        state: found?.insight?.card_state,
        action: found?.actionKey ?? undefined,
      });
    }
    researchChanged(); // an account's shared night carries its rating (lib/research.js)
  }

  return (
    <span className="thumbs" role="group" aria-label="Was this suggestion helpful?">
      <button
        type="button"
        className={`thumb${rating === 'up' ? ' on' : ''}`}
        aria-pressed={rating === 'up'}
        aria-label="Helpful"
        title="Helpful"
        onClick={() => pick('up')}
      >
        <Icon name="thumbUp" size={17} />
      </button>
      <button
        type="button"
        className={`thumb${rating === 'down' ? ' on' : ''}`}
        aria-pressed={rating === 'down'}
        aria-label="Not helpful"
        title="Not helpful"
        onClick={() => pick('down')}
      >
        <Icon name="thumbDown" size={17} />
      </button>
      {/* the thanks fades in, then out; the live region says it once */}
      <span className={`thumbs-thanks${thanks ? ' show' : ''}`} aria-hidden="true">
        Thanks for the feedback
      </span>
      <span className="sr-only" aria-live="polite">
        {thanks ? 'Thanks for the feedback' : ''}
      </span>
    </span>
  );
}
