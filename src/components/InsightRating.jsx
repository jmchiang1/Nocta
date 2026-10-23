/* Nocta — "Was this helpful?" under a night's insight (Tonight, phone and
 * desktop). Two plain answers; picking one says thanks and can be changed by
 * picking the other (or the same one again, to take it back). Feeds
 * analytics (which kind of insight and the rating, never the night's
 * numbers) and, for an account sharing its nights, that night's summary
 * (lib/research.js). */
import { useEffect, useState } from 'react';
import { ratingFor, rateInsight, onRatings } from '../lib/insightRatings.js';
import { insightFor } from '../lib/insights.js';
import { track } from '../lib/analytics.js';
import { researchChanged } from '../lib/research.js';

const CHOICES = [
  { value: 'up', label: 'Yes' },
  { value: 'down', label: 'Not really' },
];

export function InsightRating({ date }) {
  const [rating, setRating] = useState(() => ratingFor(date));
  useEffect(() => {
    setRating(ratingFor(date));
    return onRatings(() => setRating(ratingFor(date)));
  }, [date]);
  if (!date) return null;

  function pick(value) {
    const next = rating === value ? null : value;
    rateInsight(date, next);
    if (next) {
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
    <div className="ir" role="group" aria-label="Was this insight helpful?">
      <span className="ir-q" aria-live="polite">
        {rating ? 'Thanks. Nox uses this to learn what helps.' : 'Was this helpful?'}
      </span>
      <div className="ir-choices">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`ir-btn${rating === c.value ? ' on' : ''}`}
            aria-pressed={rating === c.value}
            onClick={() => pick(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
