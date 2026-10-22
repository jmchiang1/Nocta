/* Nocta — the morning check-in on Tonight. It sits right under the night's
 * suggestion, because the check-in is half of what Nox learns from. On the
 * phone the first question is answerable right here (tap "Tired" and the
 * full check-in opens with it already picked); on the desktop, with room to
 * spare, the whole check-in happens in the card, a question at a time. Once
 * logged it folds to one slim line: done, how many notes, and Edit. The tags
 * themselves live where Nox uses them (the full-night page), not repeated
 * back on the home screen. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { CHECKIN_SCREENS, EMPTY_CHECKIN_TAGS, allCheckinTags } from '../data/journal.js';
import { Mascot } from './Mascot.jsx';
import { Icon } from './Icons.jsx';
import { getCheckin, isLateCheckin, toggleCheckinPick } from '../lib/checkins.js';

const FIRST = CHECKIN_SCREENS[0];
const QUICK = FIRST.options.slice(0, 5); // the five most common answers, inline

/* Nox, big, tucked into the card's bottom-right corner behind the answers:
 * the card is him asking. He tilts his head now and then and his eyes keep
 * glancing around (the idle state). Decorative, so hidden from screen readers. */
const BigNox = ({ size }) => <Mascot size={size} state="idle" className="ck-card-nox" />;

/* the desktop card: all four questions in place, one at a time, multi-
 * select like the sheet. The one button reads Skip until something's picked,
 * then Next (Finish on the last); finishing saves it and the card folds. */
function InlineCheckin() {
  const { completeCheckin } = useStore();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState(EMPTY_CHECKIN_TAGS);
  const screen = CHECKIN_SCREENS[step];
  const total = CHECKIN_SCREENS.length;
  const isLast = step === total - 1;
  const picked = picks[screen.id].length > 0;

  function advance() {
    if (isLast) completeCheckin(picks);
    else setStep(step + 1);
  }

  return (
    <section className="tn-module ck-card wide inline" aria-label="Morning check-in">
      <div className="ck-card-head">
        <div className="ck-card-titles" aria-live="polite">
          <span className="ck-card-eyebrow">Morning check-in</span>
          <h3 className="ck-card-q ck-inline-enter" key={step}>
            {screen.question}
          </h3>
        </div>
      </div>
      <div className="ck-card-quick ck-inline-enter" key={step} role="group" aria-label={`${screen.question} ${screen.hint}`}>
        {screen.options.map((o) => {
          const on = picks[screen.id].includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`ob-pill${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => setPicks((p) => toggleCheckinPick(p, screen, o))}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {/* back on the left, where you are in the middle (a dot per
       * question), Skip / Next on the right */}
      <div className="ck-inline-foot">
        {step > 0 ? (
          <button className="ck-inline-back" type="button" onClick={() => setStep(step - 1)} aria-label="Previous question">
            <Icon name="chevronLeft" size={18} />
          </button>
        ) : (
          <span />
        )}
        <span className="ck-dots">
          <span className="sr-only">
            Question {step + 1} of {total}
          </span>
          {CHECKIN_SCREENS.map((s, i) => (
            <i key={s.id} className={i === step ? 'on' : i < step ? 'done' : undefined} aria-hidden="true" />
          ))}
        </span>
        <button className={`btn ${picked ? 'primary' : 'ghost'} ck-inline-next`} type="button" onClick={advance}>
          {isLast ? (picked ? 'Finish' : 'Skip and finish') : picked ? 'Next' : 'Skip'}
        </button>
      </div>
    </section>
  );
}

/* `mascot={false}` drops Nox (phone). `wide`: the desktop dashboard's
 * version, the whole check-in in the card. */
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

  if (wide) return <InlineCheckin />;

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
