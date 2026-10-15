/* Nocta — an existing account just signed in (Apple / Google, on this or a new
 * phone). No setup questions and no disclaimer (accepted on the account) —
 * restore, settle what's per-phone, and go to Tonight:
 *
 *   deletion? ── restoring ── reconnect? ── notify ── welcome back ── Tonight
 *
 * deletion   the account is inside its deletion grace window: keep it or leave
 * reconnect  the SleepHQ link expired while they were away
 * notify     notification permission belongs to the phone, not the account
 * (deletion + reconnect come from the mock for now; see lib/auth.jsx) */
import { setCheckinReminder } from '../lib/profile.js';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Welcome } from './Welcome.jsx';
import { Step, PairVisual, useConnect, Working, SLEEPHQ_LOGO } from './onboardingParts.jsx';
import { DELETION_DAYS_LEFT } from '../data/auth.js';

const RESTORE_MS = 1500;

const deletionDate = () =>
  new Date(Date.now() + DELETION_DAYS_LEFT * 864e5).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

function PendingDeletion({ onKeep, onLeave }) {
  return (
    <Step
      foot={
        <>
          <button className="btn primary" onClick={onKeep}>
            Keep my account
          </button>
          <button className="btn subtle" onClick={onLeave}>
            Leave it scheduled
          </button>
        </>
      }
    >
      <h1 className="ob-title">Your account is set to be deleted</h1>
      <p className="ob-copy">
        You asked Nocta to delete your account. Your nights and settings will be erased for
        good on <strong className="si-strong">{deletionDate()}</strong>.
      </p>
      <p className="ob-note">Changed your mind? You can keep it, with everything as you left it.</p>
    </Step>
  );
}

/* history is safe; new nights won't arrive until they reconnect */
function Reconnect({ onDone }) {
  const [phase, start] = useConnect(false);
  const done = phase === 'done';

  if (phase !== 'pick') {
    return (
      <Step
        center
        foot={
          done && (
            <button className="btn primary" onClick={() => onDone(true)}>
              Continue
            </button>
          )
        }
      >
        <PairVisual logo={SLEEPHQ_LOGO} state={done ? 'done' : 'connecting'} />
        <h1 className="ob-title">{done ? 'SleepHQ reconnected' : 'Connecting…'}</h1>
        <p className="ob-copy">
          {done ? 'New nights will come in each morning again.' : 'Signing in to SleepHQ.'}
        </p>
      </Step>
    );
  }

  return (
    <Step
      foot={
        <>
          <button className="btn primary" onClick={start}>
            Reconnect SleepHQ
          </button>
          <button className="btn subtle" onClick={() => onDone(false)}>
            Do this later
          </button>
        </>
      }
    >
      <PairVisual logo={SLEEPHQ_LOGO} state="idle" />
      <h1 className="ob-title">Reconnect SleepHQ</h1>
      <p className="ob-copy">
        Your SleepHQ sign-in has expired. Your past nights are safe, but Nocta can't bring in
        new ones until you reconnect.
      </p>
    </Step>
  );
}

function NotifyHere({ onDone }) {
  return (
    <Step
      foot={
        <>
          <button className="btn primary" onClick={() => onDone(true)}>
            Allow on this phone
          </button>
          <button className="btn subtle" onClick={() => onDone(false)}>
            Not on this phone
          </button>
        </>
      }
    >
      <h1 className="ob-title">Morning reminders</h1>
      <p className="ob-copy">
        Want a nudge at 7:00 AM to do your morning check-in? Each phone asks separately, so
        choose for this one.
      </p>
      <p className="ob-note">
        One nudge a day, never more. Reminders come from the iPhone app once it’s out.
      </p>
    </Step>
  );
}

export function ReturningFlow({ onExit, onDone }) {
  const { authUser, maskId, cardData } = useStore();
  const [screen, setScreen] = useState(() => (authUser?.deletion ? 'deletion' : 'restoring'));
  const [restored, setRestored] = useState({ sleephq: true, notify: false });
  const timer = useRef(null);

  useEffect(() => {
    if (screen !== 'restoring') return undefined;
    timer.current = setTimeout(
      () => setScreen(authUser?.sleephqExpired ? 'reconnect' : 'notify'),
      RESTORE_MS
    );
    return () => clearTimeout(timer.current);
  }, [screen, authUser]);

  if (screen === 'welcome') {
    return (
      <Welcome
        returning
        data={{ cardNights: cardData?.nights.length ?? null, maskModel: maskId, notify: restored.notify }}
        onDone={onDone}
      />
    );
  }

  let body;
  if (screen === 'deletion') {
    body = <PendingDeletion onKeep={() => setScreen('restoring')} onLeave={onExit} />;
  } else if (screen === 'restoring') {
    body = (
      <Working
        title="Restoring your account…"
        copy="Bringing back your nights, mask, and settings."
      />
    );
  } else if (screen === 'reconnect') {
    body = (
      <Reconnect
        onDone={(ok) => {
          setRestored((r) => ({ ...r, sleephq: ok }));
          setScreen('notify');
        }}
      />
    );
  } else {
    body = (
      <NotifyHere
        onDone={(on) => {
          setRestored((r) => ({ ...r, notify: on }));
          setCheckinReminder(on); // their choice, the same one Settings shows
          setScreen('welcome');
        }}
      />
    );
  }

  return (
    <div className="ob-screen fwd">
      <div className="ob-ambient" aria-hidden="true" />
      <StatusBar />
      <div className="ob-nav">
        <span className="ob-back-spacer" />
      </div>
      {/* keyed so each screen gets the step slide-in */}
      <div className="si-screen" key={screen}>
        {body}
      </div>
    </div>
  );
}
