/* Nocta — first-run welcome. Shown once, after "One important thing" and
 * before the home screen. Sits on the flow's shared night sky (twinkling
 * stars, the occasional comet — see NightSky in Onboarding).
 *
 * A calm ~2-second arrival, centred (no confetti — CLAUDE.md voice rules):
 * the mark settles with two soft rings, the greeting arrives a word at a time, and what onboarding set
 * up appears as a row of glass pills — honest about anything skipped. "See
 * last night" lifts it away into Tonight, where the first sync plays in the
 * Dynamic Island. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { USER, maskById } from '../data/account.js';
import { machineById } from '../data/therapy.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { RevealText } from '../lib/motion.jsx';

const EXIT_MS = 720;

export function Welcome({ data, onDone }) {
  const { machineId } = useStore();
  const [leaving, setLeaving] = useState(false);
  const first = USER.name.split(' ')[0];
  const machine = machineById(machineId);

  // what onboarding actually set up; skipped steps read as "add later"
  const pills = [
    data.sleephq
      ? { icon: 'therapy', text: `${machine.short} connected` }
      : { icon: 'therapy', text: 'CPAP · connect later', later: true },
    data.maskModel
      ? { icon: 'pillow', text: maskById(data.maskModel).name }
      : { icon: 'pillow', text: 'Mask · add later', later: true },
    data.notify
      ? { icon: 'bell', text: 'Check-in at 7:00 AM' }
      : { icon: 'bell', text: 'Reminders off', later: true },
  ];

  function go() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, EXIT_MS);
  }

  return (
    <div className={`welcome${leaving ? ' leaving' : ''}`} role="dialog" aria-label="Welcome to Nocta">
      <StatusBar />

      <div className="wl-body">
        <div className="wl-mark" aria-hidden="true">
          <span className="wl-ring" />
          <span className="wl-ring r2" />
          <img src="/Nocta-constellation.svg" alt="" />
        </div>

        <h1 className="wl-title">
          <RevealText text={`You’re all set, *${first}*.`} />
        </h1>
        <p className="wl-sub">
          Each morning, Nocta reads your CPAP data and tells you, plainly, what changed and
          why.
        </p>

        <ul className="wl-pills" aria-label="What's set up">
          {pills.map((p, i) => (
            <li key={p.text} className={`wl-pill glass${p.later ? ' later' : ''}`} style={{ '--i': i }}>
              <Icon name={p.icon} size={15} />
              {p.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="wl-foot">
        <button className="btn primary" onClick={go} disabled={leaving}>
          See last night
        </button>
      </div>
    </div>
  );
}
