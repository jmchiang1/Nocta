/* Nocta — Morning Check-In. A tall (92%) modal over a dawn-lit night sky:
 * three multi-select questions, one per step, then a quiet "logged" state that
 * plays back what was picked. Options reuse onboarding's option cards so the
 * two flows feel like one product. Opened over the full-night page it stacks
 * on top (store.pushSheet), so closing returns there. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { CHECKIN_SCREENS, EMPTY_CHECKIN_TAGS, TAG_LABELS, allCheckinTags } from '../data/journal.js';
import { FIXTURES } from '../data/fixtures.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { Mascot } from '../components/Mascot.jsx';

const Tick = ({ on }) => (
  <span className={`ob-tick multi${on ? ' on' : ''}`} aria-hidden="true">
    {on && <Icon name="check" size={13} />}
  </span>
);

export function CheckinSheet() {
  const { closeSheet, completeCheckin, fixtureId, sheet, checkin } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('fwd'); // which way the question slides in
  // starts from an answer tapped on Tonight's card, or this morning's picks when editing
  const [picks, setPicks] = useState(() => ({
    ...EMPTY_CHECKIN_TAGS,
    ...(sheet?.initial ?? (checkin.done ? checkin.tags : {})),
  }));

  const total = CHECKIN_SCREENS.length;
  const done = step >= total;
  const screen = done ? null : CHECKIN_SCREENS[step];
  const morning = `${FIXTURES[fixtureId]?.dayName ?? 'This'} morning`;

  function toggle(opt) {
    const key = screen.id;
    setPicks((prev) => {
      const cur = prev[key];
      let next;
      if (cur.includes(opt.id)) {
        next = cur.filter((x) => x !== opt.id);
      } else if (opt.exclusive) {
        next = [opt.id];
      } else {
        next = [...cur.filter((x) => !screen.options.find((o) => o.id === x)?.exclusive), opt.id];
      }
      return { ...prev, [key]: next };
    });
  }

  function advance() {
    if (step === total - 1) completeCheckin(picks);
    setDir('fwd');
    setStep(step + 1);
  }
  function back() {
    setDir('back');
    setStep((s) => Math.max(0, s - 1));
  }

  if (done) {
    const logged = allCheckinTags(picks).filter((id) => !id.startsWith('nothing_'));
    return (
      <Sheet
        eyebrow={morning}
        title="Morning check-in"
        className="ck-sheet"
        onClose={closeSheet}
        footer={(close) => (
          <button className="btn primary" onClick={close}>
            Done
          </button>
        )}
      >
        <div className="ck-done">
          {/* Nox is pleased about the check-in itself, never about the night */}
          <div className="ck-nox">
            <Mascot size={104} state="pleased" />
          </div>
          <h2 className="ck-done-title">Logged. Thank you.</h2>
          <p className="ck-done-copy">
            Nocta will fold this into how it reads tonight. A couple of weeks of check-ins is
            when the patterns start to show.
          </p>
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
      </Sheet>
    );
  }

  const isLast = step === total - 1;
  const wide = screen.options.some((o) => o.label.length > 12);

  return (
    <Sheet
      eyebrow={morning}
      title="Morning check-in"
      className="ck-sheet"
      onClose={closeSheet}
      footer={
        <>
          <button className="btn primary" onClick={advance}>
            {isLast ? 'Complete check-in' : 'Next'}
          </button>
          <button className="btn subtle" onClick={advance}>
            {isLast ? 'Skip and finish' : 'Skip this question'}
          </button>
        </>
      }
    >
      <div className="ck-progress-row">
        {step > 0 ? (
          <button className="ck-back" type="button" onClick={back} aria-label="Previous question">
            <Icon name="chevronLeft" size={20} />
          </button>
        ) : null}
        <div
          className="ck-progress"
          role="progressbar"
          aria-label="Check-in progress"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <span className="ck-count tnum">
          {step + 1}/{total}
        </span>
      </div>

      {/* keyed on step so each question slides in fresh */}
      <div className={`ck-step ${dir}`} key={step}>
        <h2 className="ck-question">{screen.question}</h2>
        <p className="ck-hint">{screen.hint}</p>
        <div className={`ck-grid${wide ? ' wide' : ''}`}>
          {screen.options.map((opt, i) => {
            const on = picks[screen.id].includes(opt.id);
            return (
              <button
                key={opt.id}
                className={`ob-option${on ? ' selected' : ''}`}
                style={{ '--i': i }}
                aria-pressed={on}
                onClick={() => toggle(opt)}
              >
                <span>{opt.label}</span>
                <Tick on={on} />
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
