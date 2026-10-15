/* Nocta — "a few quick questions": the onboarding questions someone skipped,
 * asked again one at a time (lib/profile.js decides when). Each answer is
 * saved as it's given, so stopping halfway keeps what was answered.
 *   Save              keep this answer, on to the next
 *   Skip this one     on to the next; it may be asked again another day
 *   Stop asking me    no more reminders (Settings can turn them back on)
 * Closing with questions left snoozes the reminder for a few days. */
import { useState, useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { ChipGroup, SelectInput } from './Onboarding.jsx';
import { GOALS, BIRTH_YEARS, SLEEP_POSITIONS, SLEEP_CONDITIONS, COMPLIANCE_WINDOW } from '../data/onboarding.js';
import { missingQuestions, setAnswers, setReminders, snoozeReminders } from '../lib/profile.js';

/* the input for each question, and what an empty answer looks like */
const INPUTS = {
  sleepPosition: { empty: null, render: (v, set) => <ChipGroup options={SLEEP_POSITIONS} value={v} onChange={set} /> },
  complianceWindow: { empty: null, render: (v, set) => <ChipGroup options={COMPLIANCE_WINDOW} value={v} onChange={set} /> },
  sleepConditions: { empty: [], render: (v, set) => <ChipGroup multi options={SLEEP_CONDITIONS} value={v} onChange={set} /> },
  goals: { empty: [], render: (v, set) => <ChipGroup multi options={GOALS} value={v} onChange={set} /> },
  birthYear: {
    empty: null,
    render: (v, set) => <SelectInput placeholder="Select year" value={v} onChange={set} options={BIRTH_YEARS} />,
  },
};
const filled = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export function ProfileQuestionsSheet() {
  const { closeSheet, pushSheet, profile, showToast } = useStore();
  // the questions left when the sheet opened, in priority order
  const queue = useRef(missingQuestions(profile)).current;
  const [i, setI] = useState(0);
  const [value, setValue] = useState(null);
  const answeredCount = useRef(0);

  const q = queue[i];
  // the mask is picked in its own sheet; once it's answered, move along
  const maskDone = q?.id === 'maskModel' && q.answered(profile.answers);

  const finish = (close) => {
    if (missingQuestions().length) snoozeReminders();
    if (answeredCount.current) showToast('Thanks. Nox will use that.', 'check');
    close();
  };
  const advance = (close) => {
    setValue(null);
    if (i + 1 < queue.length) setI(i + 1);
    else finish(close);
  };

  return (
    <Sheet eyebrow="A few quick questions" title={q ? q.title : 'All done'} onClose={() => finish(closeSheet)} className="pq-sheet">
      {(close) =>
        q && (
          <div className="pq">
            <p className="pq-why">{q.why}</p>
            <p className="pq-count tnum" aria-live="polite">
              {i + 1} of {queue.length}
            </p>

            {q.id === 'maskModel' ? (
              <button className="btn ghost pq-mask" type="button" onClick={() => pushSheet('maskPicker')}>
                <Icon name="pillow" size={18} />
                {maskDone ? 'Mask saved. Change it' : 'Choose my mask'}
              </button>
            ) : (
              INPUTS[q.id].render(value ?? INPUTS[q.id].empty, setValue)
            )}

            <div className="pq-actions">
              <button
                className={`btn primary${filled(value) || maskDone ? '' : ' not-ready'}`}
                aria-disabled={!(filled(value) || maskDone) || undefined}
                onClick={() => {
                  if (q.id === 'maskModel') {
                    if (!maskDone) return;
                  } else {
                    if (!filled(value)) return;
                    setAnswers({ [q.id]: value });
                  }
                  answeredCount.current += 1;
                  advance(close);
                }}
              >
                {i + 1 < queue.length ? 'Save' : 'Save and finish'}
              </button>
              <button className="btn subtle" onClick={() => advance(close)}>
                Skip this one
              </button>
            </div>

            <button
              className="pq-stop"
              type="button"
              onClick={() => {
                setReminders({ off: true });
                showToast('Okay, no more of these. You can turn them back on in Settings.', 'check');
                close();
              }}
            >
              Stop asking me these
            </button>
          </div>
        )
      }
    </Sheet>
  );
}
