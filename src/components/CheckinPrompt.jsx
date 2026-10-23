/* Nocta — the morning check-in on Tonight. It sits right under the night's
 * suggestion, because the check-in is half of what Nox learns from. On the
 * phone the first question is answerable right here (tap "Tired" and the
 * full check-in opens with it already picked); on the desktop, with room to
 * spare, the whole check-in happens in the card, a question at a time. Once
 * logged it folds to one slim line: done, how many notes, and Edit. The tags
 * themselves live where Nox uses them (the full-night page), not repeated
 * back on the home screen. */
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../lib/store.jsx';
import { CHECKIN_SCREENS, EMPTY_CHECKIN_TAGS, TAG_LABELS, allCheckinTags } from '../data/journal.js';
import { Mascot } from './Mascot.jsx';
import { Icon } from './Icons.jsx';
import { getCheckin, isLateCheckin, toggleCheckinPick } from '../lib/checkins.js';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOGGED_MS = 2600; // the desktop card's "Logged" moment, before it folds

const FIRST = CHECKIN_SCREENS[0];
const QUICK = FIRST.options.slice(0, 5); // the five most common answers, inline

/* Nox, big, tucked into the card's bottom-right corner behind the answers:
 * the card is him asking. He tilts his head now and then and his eyes keep
 * glancing around (the idle state). Decorative, so hidden from screen readers. */
const BigNox = ({ size }) => <Mascot size={size} state="idle" className="ck-card-nox" />;

/* the desktop card: all four questions in place, one at a time, multi-
 * select like the sheet, with the sheet's motion: each question slides in
 * from the side you're going (forward from the right, back from the left)
 * and its answers rise in one after another. The one button reads Skip
 * until something's picked, then Next (Finish on the last). Finishing saves
 * it straight away, then Nox is pleased for a moment ("Logged. Thank you."
 * and what was noted pops in, as in the sheet) before the card folds. */
function InlineCheckin({ onLogged }, ref) {
  const { completeCheckin } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('fwd');
  const [picks, setPicks] = useState(EMPTY_CHECKIN_TAGS);
  const [logged, setLogged] = useState(null);
  const screen = CHECKIN_SCREENS[step];
  const total = CHECKIN_SCREENS.length;
  const isLast = step === total - 1;
  const picked = picks[screen.id].length > 0;

  function go(next) {
    setDir(next > step ? 'fwd' : 'back');
    setStep(next);
  }
  function advance() {
    if (!isLast) return go(step + 1);
    onLogged?.(); // the card holds open for the moment below
    completeCheckin(picks);
    setLogged(allCheckinTags(picks).filter((id) => !id.startsWith('nothing_')));
  }

  if (logged) {
    return (
      <section className="tn-module ck-card wide inline ck-card-logged" aria-label="Morning check-in, logged" ref={ref}>
        <div className="ck-done" aria-live="polite">
          <div className="ck-nox">
            <Mascot size={72} state="pleased" pop sound="happy" />
          </div>
          <h3 className="ck-done-title">Logged. Thank you.</h3>
          {logged.length > 0 && (
            <ul className="ck-logged" aria-label="What you logged">
              {logged.map((id, i) => (
                <li key={id} style={{ '--i': i }}>
                  {TAG_LABELS[id]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="tn-module ck-card wide inline" aria-label="Morning check-in" ref={ref}>
      {/* keyed on the step so each question slides in fresh, from the side
       * you're heading */}
      <div className={`ck-step ${dir}`} key={step}>
        <div className="ck-card-head">
          <div className="ck-card-titles" aria-live="polite">
            <span className="ck-card-eyebrow">Morning check-in</span>
            <h3 className="ck-card-q">{screen.question}</h3>
          </div>
        </div>
        <div className="ck-card-quick" role="group" aria-label={`${screen.question} ${screen.hint}`}>
          {screen.options.map((o, i) => {
            const on = picks[screen.id].includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                className={`ob-pill${on ? ' on' : ''}`}
                style={{ '--i': i }}
                aria-pressed={on}
                onClick={() => setPicks((p) => toggleCheckinPick(p, screen, o))}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
      {/* back on the left, where you are in the middle (a dot per
       * question), Skip / Next on the right */}
      <div className="ck-inline-foot">
        {step > 0 ? (
          <button className="ck-inline-back" type="button" onClick={() => go(step - 1)} aria-label="Previous question">
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
const InlineCheckinCard = forwardRef(InlineCheckin);

/* the card changes size when the check-in is done (a tall question → one
 * slim line). It never jumps:
 *   phone    the card's own height eases to its new size, and everything
 *            under it slides up with it. It waits until the check-in sheet
 *            is on its way out, so you see it happen
 *   desktop  the card also moves from half the row to a full-width bar above
 *            last night: the card and its neighbours glide to their new
 *            places (a view transition), after Nox's "Logged" moment
 * Reduced motion: it just changes. */
/* `mascot={false}` drops Nox (phone). `wide`: the desktop dashboard's
 * version, the whole check-in in the card. */
export function CheckinPrompt({ checkin, onStart, mascot = true, wide = false }) {
  const { sheet, sheetLeaving } = useStore();
  // the desktop card's "Logged" moment holds it open a little longer
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef(0);
  useEffect(() => () => clearTimeout(holdTimer.current), []);
  const hold = () => {
    setHolding(true);
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHolding(false), reduced() ? 0 : LOGGED_MS);
  };
  const behindSheet = sheet?.kind === 'checkin' && !sheetLeaving;
  const target = checkin.done && !behindSheet && !holding;
  const [done, setDone] = useState(target);

  // the card, whichever version is showing, and its last settled height
  const cardRef = useRef(null);
  const lastH = useRef(null);
  const animating = useRef(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !('ResizeObserver' in window)) return undefined;
    const ro = new ResizeObserver(() => {
      if (!animating.current) lastH.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  // follow the check-in, with motion
  useEffect(() => {
    if (done === target) return;
    if (wide && !reduced() && document.startViewTransition) {
      document.startViewTransition(() => flushSync(() => setDone(target)));
    } else setDone(target);
  }, [target, done, wide]);

  // phone: ease the card from its old height to its new one
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = cardRef.current;
    const from = lastH.current;
    if (wide || !el || from == null || reduced()) return;
    const to = el.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    animating.current = true;
    el.style.overflow = 'hidden';
    const anim = el.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 520,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    el.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 140, fill: 'backwards' });
    anim.onfinish = anim.oncancel = () => {
      el.style.overflow = '';
      animating.current = false;
      lastH.current = el.offsetHeight;
    };
  }, [done, wide]);

  if (done) {
    const n = allCheckinTags(checkin.tags).filter((id) => !id.startsWith('nothing_')).length;
    return (
      <section className="tn-module ck-card done" aria-label="Morning check-in, done" ref={cardRef}>
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

  if (wide) return <InlineCheckinCard ref={cardRef} onLogged={hold} />;

  return (
    <section className={`tn-module ck-card${mascot ? ' has-nox' : ''}`} aria-label="Morning check-in" ref={cardRef}>      {mascot && <BigNox size={172} />}
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
