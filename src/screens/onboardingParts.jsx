/* Nocta — pieces shared by first-run setup (Onboarding) and returning-user
 * sign-in (Returning): the step layout, the Nocta ··· partner connect visual,
 * and the working / error states. */
import { useState, useEffect } from 'react';
import { Icon } from '../components/Icons.jsx';
import { NoxThinking } from '../components/NoxThinking.jsx';

export const SLEEPHQ_LOGO = '/brands/sleephq.png';
const CONNECT_MS = 1700;

export function Step({ children, foot, center }) {
  return (
    <>
      <div className="ob-body">
        <div className={`ob-content${center ? ' center' : ''}`}>{children}</div>
      </div>
      {foot && <div className="ob-foot">{foot}</div>}
    </>
  );
}

/* Nocta ··· partner, joined by a link that pulses while connecting and
 * draws solid once connected */
export function PairVisual({ logo, state }) {
  return (
    <div className={`ob-pair ${state}`} aria-hidden="true">
      <span className="ob-pair-tile nocta">
        <img src="/Nocta-constellation-sm.svg" alt="" />
      </span>
      <span className="ob-pair-link">
        <i />
        <i />
        <i />
      </span>
      <span className="ob-pair-tile brand">
        <img src={logo} alt="" />
      </span>
    </div>
  );
}

/* the shared pick → connecting → connected rhythm of the connect steps */
export function useConnect(alreadyConnected) {
  const [phase, setPhase] = useState(alreadyConnected ? 'done' : 'pick');
  useEffect(() => {
    if (phase !== 'connecting') return undefined;
    const t = setTimeout(() => setPhase('done'), CONNECT_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return [phase, () => setPhase('connecting')];
}

/* a calm, tinted note — errors are never a red screen. tone 'info' is a
 * neutral hint (no alert role) */
export function ErrorNote({ children, tone = 'error' }) {
  if (!children) return null;
  return (
    <p className={`si-error${tone === 'info' ? ' info' : ''}`} role={tone === 'info' ? 'status' : 'alert'}>
      <Icon name="info" size={17} />
      <span>{children}</span>
    </p>
  );
}

/* a centred "working" state: Nox, thinking it over */
export function Working({ title, copy, foot }) {
  return (
    <Step center foot={foot}>
      <NoxThinking className="si-working" />
      <h1 className="ob-title" aria-live="polite">
        {title}
      </h1>
      {copy && <p className="ob-copy">{copy}</p>}
    </Step>
  );
}
