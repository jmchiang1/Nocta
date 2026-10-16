/* Nocta — the morning check-in on Tonight. It sits right under the night's
 * suggestion, because the check-in is half of what Nox learns from: the
 * first question is answerable right here (tap "Tired" and the full check-in
 * opens with it already picked). Once logged it folds to one slim line: done,
 * how many notes, and Edit. The tags themselves live where Nox uses them
 * (the full-night page), not repeated back on the home screen. */
import { CHECKIN_SCREENS, allCheckinTags } from '../data/journal.js';
import { Mascot } from './Mascot.jsx';
import { Icon } from './Icons.jsx';
import { getCheckin, isLateCheckin } from '../lib/checkins.js';

const FIRST = CHECKIN_SCREENS[0];
const QUICK = FIRST.options.slice(0, 5); // the five most common answers, inline

/* Nox, big, tucked into the card's bottom-right corner behind the answers:
 * the card is him asking. He tilts his head now and then and his eyes keep
 * glancing around (the idle state). Decorative, so hidden from screen readers. */
const BigNox = ({ size }) => <Mascot size={size} state="idle" className="ck-card-nox" />;

/* `mascot={false}` drops Nox. `wide`: the desktop dashboard's version,
 * with every answer to the first question inline. */
export function CheckinPrompt({ checkin, onStart, mascot = true, wide = false }) {
  if (checkin.done) {
    const n = allCheckinTags(checkin.tags).filter((id) => !id.startsWith('nothing_')).length;
    return (
      <section className="tn-module ck-card done" aria-label="Morning check-in, done">
        <div className="ck-card-head">
          <span className="ck-card-done tnum">
            Checked in
            <span className="ck-card-count"> · {n === 0 ? 'nothing unusual' : `${n} ${n === 1 ? 'note' : 'notes'}`}</span>
          </span>
          <button className="ck-card-edit" type="button" onClick={() => onStart(checkin.tags)}>
            Edit
          </button>
        </div>
      </section>
    );
  }

  if (wide) {
    // desktop: every answer inline (there's room). Picking one opens the
    // check-in with it chosen, so there's no separate Start button.
    return (
      <section className={`tn-module ck-card wide${mascot ? ' has-nox' : ''}`} aria-label="Morning check-in">
        {mascot && <BigNox size={230} />}
        <div className="ck-card-head">
          <div className="ck-card-titles">
            <span className="ck-card-eyebrow">Morning check-in</span>
            <h3 className="ck-card-q">{FIRST.question}</h3>
          </div>
        </div>
        <div className="ck-card-quick" role="group" aria-label={`${FIRST.question} Pick one to start`}>
          {FIRST.options.map((o) => (
            <button key={o.id} type="button" className="ob-pill" onClick={() => onStart({ [FIRST.id]: [o.id] })}>
              {o.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={`tn-module ck-card${mascot ? ' has-nox' : ''}`} aria-label="Morning check-in">
      {mascot && <BigNox size={172} />}
      <div className="ck-card-head">
        <div className="ck-card-titles">
          <span className="ck-card-eyebrow">Morning check-in</span>
          <h3 className="ck-card-q">{FIRST.question}</h3>
        </div>
      </div>
      <div className="ck-card-quick">
        {QUICK.map((o) => (
          <button key={o.id} type="button" className="ob-pill" onClick={() => onStart({ [FIRST.id]: [o.id] })}>
            {o.label}
          </button>
        ))}
        <button type="button" className="ob-pill ck-card-more" onClick={() => onStart()}>
          More…
        </button>
      </div>
    </section>
  );
}

/* An older night: no morning card (that morning has passed), just a quiet
 * row in the night's card to add one from memory, or to edit it once added.
 * Late entries are marked as such and the insights weigh them less
 * (lib/checkins.js). */
export function LateCheckin({ date, onStart }) {
  const tags = getCheckin(date);
  const n = tags ? allCheckinTags(tags).filter((id) => !id.startsWith('nothing_')).length : 0;
  return (
    <button className="row-cta ck-late" type="button" onClick={() => onStart(tags ?? undefined)}>
      <span>
        {tags ? (isLateCheckin(date) ? 'Check-in added later' : 'Checked in that morning') : 'Add how that morning went'}
        {tags && (
          <span className="ck-late-count tnum"> · {n === 0 ? 'nothing unusual' : `${n} ${n === 1 ? 'note' : 'notes'}`}</span>
        )}
      </span>
      <span className="ck-late-go">
        {tags && 'Edit'}
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  );
}
