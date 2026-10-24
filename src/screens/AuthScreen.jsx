/* Nocta — sign up / sign in, the screen after the splash's "Get started" or
 * "I already have an account". (Keeps the splash to one decision.)
 *
 *   signup | signin ─┬─ Google ──── popup (or redirect) → setup / restore
 *                    └─ Microsoft ─ popup (or redirect) → setup / restore
 *
 * No email + password for now: Supabase can only send its confirmation and
 * reset emails to the public once Nocta has an email sender of its own
 * (docs/AUTH_SETUP.md). A provider's errors come back to this page. */
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Step, ErrorNote } from './onboardingParts.jsx';

function Frame({ onBack, children, screenKey, enter = 'fwd' }) {
  return (
    <div className={`ob-screen ${enter}`}>
      <div className="ob-ambient" aria-hidden="true" />
      <StatusBar />
      <div className="ob-nav">
        {onBack ? (
          <button className="ob-back" onClick={onBack} aria-label="Back">
            <Icon name="chevronLeft" size={20} />
          </button>
        ) : (
          <span className="ob-back-spacer" />
        )}
      </div>
      <div className="si-screen" key={screenKey}>
        {children}
      </div>
    </div>
  );
}

/* making an account means agreeing to the Terms and the Privacy Policy, so
 * say so where it happens (the public pages, in a new tab: setup isn't left),
 * along with the one thing on by default that people should hear up front:
 * sharing nights to improve the insights (lib/research.js) */
function LegalNote() {
  return (
    <p className="au-legal">
      By continuing, you agree to Nocta’s{' '}
      <a href="/terms" target="_blank" rel="noopener noreferrer">
        Terms of Service
      </a>{' '}
      and{' '}
      <a href="/privacy" target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </a>
      . With an account, Nocta’s makers can see your data, including your CPAP and wearable
      nights, check-ins and setup answers, to improve Nocta. You can turn this off any time in
      Settings.
    </p>
  );
}

/* title / copy: override the sign-up wording (the end of setup says "Save
 * your setup"). onGuest: offer "look around without an account" (optional). */
export function AuthScreen({ mode, onMode, onBack, onGuest, note, title, copy, enter }) {
  const { signInWith, authError } = useStore();
  const signup = mode === 'signup';

  // sign up ↔ sign in
  const modeSwitch = (
    <p className="au-switch">
      {signup ? 'Already have an account?' : 'New to Nocta?'}{' '}
      <button type="button" className="ob-link" onClick={() => onMode(signup ? 'signin' : 'signup')}>
        {signup ? 'Sign in' : 'Create an account'}
      </button>
    </p>
  );

  /* the two ways in, one centred group, so two buttons don't leave the
   * middle of the screen empty */
  return (
    <Frame onBack={onBack} screenKey={`choose-${mode}`} enter={enter}>
      <Step center>
        <img className="au-mark" src="/nocta-mark.svg" alt="" />
        <h1 className="ob-title">{signup ? (title ?? 'Create your account') : 'Welcome back'}</h1>
        <p className="ob-copy">
          {signup
            ? (copy ?? 'So your nights and settings are saved, and follow you to a new phone.')
            : 'Sign in the way you did when you set Nocta up.'}
        </p>
        {/* the provider's errors come back to this page */}
        {authError ? <ErrorNote>{authError}</ErrorNote> : note && <ErrorNote tone="info">{note}</ErrorNote>}

        <button type="button" className="btn si-provider au-google" onClick={() => signInWith('google')}>
          <img src="/brands/google.svg" alt="" />
          Continue with Google
        </button>
        <button type="button" className="btn si-provider au-microsoft" onClick={() => signInWith('microsoft')}>
          <img src="/brands/microsoft.svg" alt="" />
          Continue with Microsoft
        </button>
        {signup && <LegalNote />}
        <div className="au-after">
          {modeSwitch}
          {signup && onGuest && (
            <button type="button" className="btn subtle" onClick={onGuest}>
              Look around without an account
            </button>
          )}
        </div>
      </Step>
    </Frame>
  );
}
