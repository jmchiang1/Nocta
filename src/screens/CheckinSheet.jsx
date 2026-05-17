/* Nocta — Morning Check-In flow. Three multi-select chip screens, then a done state. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { CHECKIN_SCREENS } from '../data/journal.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

export function CheckinSheet() {
  const { closeSheet, completeCheckin } = useStore();
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState({ feel: [], lastnight: [], yesterday: [] });

  const done = step >= CHECKIN_SCREENS.length;
  const screen = done ? null : CHECKIN_SCREENS[step];

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
    if (step === CHECKIN_SCREENS.length - 1) {
      completeCheckin(picks);
      setStep(step + 1);
    } else {
      setStep(step + 1);
    }
  }

  if (done) {
    return (
      <Sheet eyebrow="Morning check-in" title="All set" onClose={closeSheet}
        footer={<button className="btn primary" onClick={closeSheet}>Back to Tonight</button>}>
        <div className="ci-done">
          <div className="cd-mark">
            <Icon name="check" size={32} />
          </div>
          <h3>Logged — thank you.</h3>
          <p>
            Nocta will fold this into how it reads tonight. A couple of weeks of check-ins is
            when the patterns start to show.
          </p>
        </div>
      </Sheet>
    );
  }

  const isLast = step === CHECKIN_SCREENS.length - 1;

  return (
    <Sheet
      eyebrow={`Morning check-in · ${step + 1} of ${CHECKIN_SCREENS.length}`}
      title="How was last night?"
      onClose={closeSheet}
      footer={
        <>
          <button className="btn primary" onClick={advance}>
            {isLast ? 'Complete check-in' : 'Next'}
          </button>
          <button className="btn subtle" onClick={advance}>
            {isLast ? 'Skip & finish' : 'Skip this question'}
          </button>
        </>
      }
    >
      <div className="ci-progress" aria-hidden="true">
        {CHECKIN_SCREENS.map((s, i) => (
          <span key={s.id} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <h2 className="ci-question">{screen.question}</h2>
      <p className="ci-hint">{screen.hint}</p>
      <div className="ci-grid">
        {screen.options.map((opt) => {
          const on = picks[screen.id].includes(opt.id);
          return (
            <button
              key={opt.id}
              className={`chip${on ? ' selected' : ''}`}
              onClick={() => toggle(opt)}
            >
              {on && <Icon name="check" size={13} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
