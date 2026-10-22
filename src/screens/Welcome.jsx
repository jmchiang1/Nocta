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
import { maskById, firstName } from '../data/account.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { RevealText } from '../lib/motion.jsx';

const EXIT_MS = 720;

/* `returning`: a signed-in existing account, so the copy greets them back and
 * the pills say only what's really set up on this device */
export function Welcome({ data, onDone, returning = false }) {
  const { authUser, hasData } = useStore();
  const [leaving, setLeaving] = useState(false);
  // only the name their sign-in shared; an email signup has none to greet
  const first = firstName(authUser);

  // what onboarding actually set up; skipped steps read as "add later"
  const pills = [
    data.cardNights
      ? { icon: 'therapy', text: `${data.cardNights} nights imported` }
      : { icon: 'therapy', text: 'SD card · import later', later: true },
    maskById(data.maskModel)
      ? { icon: 'pillow', text: maskById(data.maskModel).name }
      : { icon: 'pillow', text: 'Mask · add later', later: true },
    data.notify
      ? { icon: 'bell', text: 'Check-in reminder on' }
      : { icon: 'bell', text: returning ? 'Reminders off on this phone' : 'Reminders off', later: true },
  ];

  function go() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, EXIT_MS);
  }

  return (
    <div className={`welcome${leaving ? ' leaving' : ''}`} role="dialog" aria-label={returning ? 'Welcome back to Nocta' : 'Welcome to Nocta'}>
      <StatusBar />

      <div className="wl-body">
        <div className="wl-mark" aria-hidden="true">
          <span className="wl-ring" />
          <span className="wl-ring r2" />
          <img src="/nocta-mark.svg" alt="" />
        </div>

        <h1 className="wl-title">
          <RevealText
            text={
              returning
                ? first
                  ? `Welcome back, *${first}*.`
                  : 'Welcome *back*.'
                : first
                  ? `You’re all set, *${first}*.`
                  : 'You’re all *set*.'
            }
          />
        </h1>
        <p className="wl-sub">
          {returning
            ? 'Your nights, mask, and settings are back, right where you left them.'
            : 'Each morning, Nocta reads your CPAP data and tells you, plainly, what changed and why.'}
        </p>

        <ul className="wl-pills" aria-label="What's set up">
          {pills.map((p, i) => (
            <li key={p.text} className={`wl-pill${p.later ? ' later' : ''}`} style={{ '--i': i }}>
              <Icon name={p.icon} size={15} />
              {p.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="wl-foot">
        <button className="btn primary" onClick={go} disabled={leaving}>
          {/* no card yet (setup skipped it): there's no night to see */}
          {hasData ? 'See last night' : 'Open Nocta'}
        </button>
      </div>
    </div>
  );
}
