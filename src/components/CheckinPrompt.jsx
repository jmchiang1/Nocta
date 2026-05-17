/* Nocta — Morning Check-In entry card. Two states: not-done / done. */
import { Icon } from './Icons.jsx';
import { TAG_LABELS } from '../data/journal.js';

export function CheckinPrompt({ checkin, onStart }) {
  if (checkin.done) {
    const all = [
      ...checkin.tags.feel,
      ...checkin.tags.lastnight,
      ...checkin.tags.yesterday,
    ];
    return (
      <button className="checkin done card-enter" onClick={onStart}>
        <div>
          <div className="ci-eyebrow">Morning check-in · logged</div>
          <h4>Thanks — Nocta has today's context.</h4>
          {all.length > 0 ? (
            <div className="ci-tags">
              {all.map((t) => (
                <span key={t} className="ci-tag">
                  {TAG_LABELS[t] || t}
                </span>
              ))}
            </div>
          ) : (
            <p>No tags logged for last night.</p>
          )}
        </div>
        <div className="ci-go">
          <Icon name="check" size={20} />
        </div>
      </button>
    );
  }

  return (
    <button className="checkin todo card-enter" onClick={onStart}>
      <div>
        <div className="ci-eyebrow">Morning check-in</div>
        <h4>How do you feel today?</h4>
        <p>A few quick tags help Nocta find what shapes your nights. Takes 20 seconds.</p>
      </div>
      <div className="ci-go">
        <Icon name="chevronRight" size={20} />
      </div>
    </button>
  );
}
