/* Nocta — the morning check-in on Tonight. It sits right under the night's
 * suggestion, because the check-in is half of what Nox learns from: the
 * first question is answerable right here (tap "Tired" and the full check-in
 * opens with it already picked). Once logged it folds to one slim line: done,
 * how many notes, and Edit. The tags themselves live where Nox uses them
 * (the full-night page), not repeated back on the home screen. */
import { CHECKIN_SCREENS, allCheckinTags } from '../data/journal.js';
import { Mascot } from './Mascot.jsx';

const FIRST = CHECKIN_SCREENS[0];
const QUICK = FIRST.options.slice(0, 5); // the five most common answers, inline

export function CheckinPrompt({ checkin, onStart }) {
  if (checkin.done) {
    const n = allCheckinTags(checkin.tags).filter((id) => !id.startsWith('nothing_')).length;
    return (
      <section className="tn-module ck-card done" aria-label="Morning check-in, done">
        <div className="ck-card-head">
          <Mascot size={26} />
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

  return (
    <section className="tn-module ck-card" aria-label="Morning check-in">
      <div className="ck-card-head">
        <Mascot size={34} state="idle" />
        <div className="ck-card-titles">
          <span className="ck-card-eyebrow">Morning check-in · 20 seconds</span>
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
