/* Nocta — sign up / sign in, the screen after the splash's "Get started" or
 * "I already have an account". (Keeps the splash to one decision.)
 *
 *   choose (signup | signin) ─┬─ Google ───────────── redirect → setup / restore
 *                             └─ Continue with email → the email form (its own page)
 *   email form ─┬─ sign up ───────────── check your email (confirm link)
 *               ├─ sign in ───────────── in │ not confirmed → check your email
 *               └─ forgot password ───── check your email (reset link)
 *   NewPassword: back from a reset link, before anything else
 *
 * Edge cases: malformed email, short password, an email that already has an
 * account (→ sign in, email kept), wrong password, unconfirmed email, resend
 * cooldown, offline, rate limits, a link opened in another browser, an
 * expired link, Supabase's mailer refusing outside addresses. */
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Step, ErrorNote } from './onboardingParts.jsx';
import { isEmail, MIN_PASSWORD, RESEND_SECONDS } from '../data/auth.js';

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

function EmailField({ value, onChange, error, autoFocus }) {
  return (
    <div className="au-field">
      <label className="ob-field-label" htmlFor="au-email">
        Email
      </label>
      <input
        id="au-email"
        className={`ob-input${error ? ' invalid' : ''}`}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder="name@example.com"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'au-email-err' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="au-field-err" id="au-email-err">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordField({ value, onChange, error, isNew, label = 'Password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="au-field">
      <label className="ob-field-label" htmlFor="au-pass">
        {label}
      </label>
      <div className="au-pass">
        <input
          id="au-pass"
          className={`ob-input${error ? ' invalid' : ''}`}
          type={show ? 'text' : 'password'}
          autoComplete={isNew ? 'new-password' : 'current-password'}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'au-pass-err' : isNew ? 'au-pass-hint' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="ob-link au-show"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? (
        <p className="au-field-err" id="au-pass-err">
          {error}
        </p>
      ) : (
        isNew && (
          <p className="au-field-hint" id="au-pass-hint">
            At least {MIN_PASSWORD} characters.
          </p>
        )
      )}
    </div>
  );
}

/* "Check your email" — for a sign-up confirmation or a password reset */
function CheckEmail({ kind, email, note, onBack }) {
  const { resendConfirmation, sendPasswordReset, simulateEmailLink, authConfigured } = useStore();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = async () => {
    setBusy(true);
    const r = kind === 'reset' ? await sendPasswordReset(email) : await resendConfirmation(email);
    setBusy(false);
    if (r.status === 'error') setMsg({ tone: 'error', text: r.message });
    else {
      setMsg({ tone: 'info', text: 'Sent again. Use the newest email: older links stop working.' });
      setCooldown(RESEND_SECONDS);
    }
  };

  return (
    <Frame onBack={onBack} screenKey="check">
      <Step
        foot={
          <>
            {!authConfigured && (
              // demo only: there's no inbox in the mock
              <button className="btn ghost" onClick={() => simulateEmailLink(kind === 'reset' ? 'recovery' : 'signup', email)}>
                Open the link (demo)
              </button>
            )}
            <button className="btn ghost" onClick={resend} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? (
                <>
                  Send it again in <span className="tnum">0:{String(cooldown).padStart(2, '0')}</span>
                </>
              ) : busy ? (
                'Sending…'
              ) : (
                'Send it again'
              )}
            </button>
            <button className="btn subtle" onClick={onBack}>
              Use a different email
            </button>
          </>
        }
      >
        <div className="au-mail" aria-hidden="true">
          <Icon name="mail" size={28} />
        </div>
        <h1 className="ob-title">Check your email</h1>
        <p className="ob-copy">
          {note && <>{note} </>}
          We sent a link to <strong className="si-strong">{email}</strong>.{' '}
          {kind === 'reset' ? 'Tap it to choose a new password.' : 'Tap it to finish making your account.'}
        </p>
        <p className="ob-note">
          Open it on this phone. Can’t find it? Check your spam or promotions folder.
        </p>
        {msg && <ErrorNote tone={msg.tone}>{msg.text}</ErrorNote>}
      </Step>
    </Frame>
  );
}

function Forgot({ initialEmail, onSent, onBack }) {
  const { sendPasswordReset } = useStore();
  const [email, setEmail] = useState(initialEmail);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bad = tried && !isEmail(email) ? 'That doesn’t look like a full email address.' : null;

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    if (!isEmail(email)) return;
    setBusy(true);
    const r = await sendPasswordReset(email.trim());
    setBusy(false);
    if (r.status === 'error') setError(r.message);
    else onSent(email.trim());
  };

  return (
    <Frame onBack={onBack} screenKey="forgot">
      <form className="si-screen" onSubmit={submit} noValidate>
        <Step>
          <h1 className="ob-title">Reset your password</h1>
          <p className="ob-copy">Enter your email and we’ll send you a link to choose a new one.</p>
          <EmailField value={email} onChange={setEmail} error={bad} autoFocus />
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn primary au-submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </Step>
      </form>
    </Frame>
  );
}

/* back from a reset link: signed in, owes a new password */
export function NewPassword({ onCancel }) {
  const { updatePassword } = useStore();
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const short = tried && password.length < MIN_PASSWORD ? `Use at least ${MIN_PASSWORD} characters.` : null;

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    if (password.length < MIN_PASSWORD) return;
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (r.status === 'error') setError(r.message);
  };

  return (
    <Frame onBack={onCancel} screenKey="newpass">
      <form className="si-screen" onSubmit={submit} noValidate>
        <Step>
          <h1 className="ob-title">Choose a new password</h1>
          <p className="ob-copy">You’re signed in. Pick a new password for next time.</p>
          <PasswordField value={password} onChange={setPassword} error={short} isNew label="New password" />
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="btn primary au-submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </Step>
      </form>
    </Frame>
  );
}

/* title / copy: override the sign-up wording (the end of setup says "Save
 * your setup"). onGuest: offer "look around without an account" (optional). */
export function AuthScreen({ mode, onMode, onBack, onGuest, note, title, copy, enter }) {
  const { signInWith, signUpWithEmail, signInWithEmail, authError, clearAuthError } = useStore();
  const signup = mode === 'signup';
  // 'choose' (Google or email) → 'email' (the form) → check / forgot / resetSent
  const [screen, setScreen] = useState({ kind: 'choose' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // string, or { exists: true }

  // switching sign up ↔ sign in keeps the email, drops the rest
  useEffect(() => {
    setError(null);
    setTried(false);
    setPassword('');
  }, [mode]);

  const emailErr = tried && !isEmail(email) ? 'That doesn’t look like a full email address.' : null;
  const passErr =
    tried && (signup ? password.length < MIN_PASSWORD : !password)
      ? signup
        ? `Use at least ${MIN_PASSWORD} characters.`
        : 'Enter your password.'
      : null;

  const submit = async (e) => {
    e.preventDefault();
    setTried(true);
    clearAuthError();
    if (!isEmail(email) || (signup ? password.length < MIN_PASSWORD : !password)) return;
    setBusy(true);
    setError(null);
    const addr = email.trim();
    const r = signup ? await signUpWithEmail(addr, password) : await signInWithEmail(addr, password);
    setBusy(false);
    if (r.status === 'confirm') setScreen({ kind: 'check', email: addr });
    else if (r.status === 'unconfirmed')
      setScreen({ kind: 'check', email: addr, note: 'Confirm your email first.' });
    else if (r.status === 'exists') setError({ exists: true });
    else if (r.status === 'error') setError(r.message);
    // signedIn: who's signed in changes and the flow moves on by itself
  };

  const toEmail = () => setScreen({ kind: 'email' });
  if (screen.kind === 'check') {
    return <CheckEmail kind="signup" email={screen.email} note={screen.note} onBack={toEmail} />;
  }
  if (screen.kind === 'resetSent') {
    return <CheckEmail kind="reset" email={screen.email} onBack={toEmail} />;
  }
  if (screen.kind === 'forgot') {
    return (
      <Forgot
        initialEmail={email}
        onBack={toEmail}
        onSent={(addr) => setScreen({ kind: 'resetSent', email: addr })}
      />
    );
  }

  // sign up ↔ sign in, under both screens
  const modeSwitch = (
    <p className="au-switch">
      {signup ? 'Already have an account?' : 'New to Nocta?'}{' '}
      <button type="button" className="ob-link" onClick={() => onMode(signup ? 'signin' : 'signup')}>
        {signup ? 'Sign in' : 'Create an account'}
      </button>
    </p>
  );

  /* first: just the two ways in — Google, or email (its form is the next page).
   * One centred group, so two buttons don't leave the middle of the screen empty */
  if (screen.kind === 'choose') {
    return (
      <Frame onBack={onBack} screenKey={`choose-${mode}`} enter={enter}>
        <Step center>
          <img className="au-mark" src="/Nocta-constellation.svg" alt="" />
          <h1 className="ob-title">{signup ? (title ?? 'Create your account') : 'Welcome back'}</h1>
          <p className="ob-copy">
            {signup
              ? (copy ?? 'So your nights and settings are saved, and follow you to a new phone.')
              : 'Sign in the way you did when you set Nocta up.'}
          </p>
          {/* Google's errors come back to this page (a redirect away and back) */}
          {authError ? <ErrorNote>{authError}</ErrorNote> : note && <ErrorNote tone="info">{note}</ErrorNote>}

          <button type="button" className="btn si-provider au-google" onClick={() => signInWith('google')}>
            <img src="/brands/google.svg" alt="" />
            Continue with Google
          </button>
          <button
            type="button"
            className="btn ghost au-email-choice"
            onClick={() => {
              clearAuthError();
              toEmail();
            }}
          >
            <Icon name="mail" size={19} />
            Continue with email
          </button>
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

  /* then: the email + password form on its own page */
  return (
    <Frame onBack={() => setScreen({ kind: 'choose' })} screenKey={`email-${mode}`}>
      <form className="si-screen" onSubmit={submit} noValidate>
        <Step>
          <h1 className="ob-title">{signup ? 'Sign up with email' : 'Sign in with email'}</h1>
          <p className="ob-copy">
            {signup
              ? 'Use an email you check. We’ll send a link to confirm it’s yours.'
              : 'Use the email and password you signed up with.'}
          </p>
          {error?.exists ? (
            <p className="si-error info au-exists" role="status">
              <Icon name="info" size={17} />
              <span>
                There’s already a Nocta account with that email.{' '}
                <button type="button" className="ob-link" onClick={() => onMode('signin')}>
                  Sign in instead
                </button>
              </span>
            </p>
          ) : (
            <ErrorNote>{error}</ErrorNote>
          )}

          <EmailField value={email} onChange={setEmail} error={emailErr} autoFocus />
          <PasswordField value={password} onChange={setPassword} error={passErr} isNew={signup} />
          {!signup && (
            <button type="button" className="ob-link au-forgot" onClick={() => setScreen({ kind: 'forgot' })}>
              Forgot password?
            </button>
          )}
          <button type="submit" className="btn primary au-submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? (signup ? 'Creating account…' : 'Signing in…') : signup ? 'Create account' : 'Sign in'}
          </button>
          {/* right under the button, not pinned to the bottom of the screen */}
          <div className="au-after">{modeSwitch}</div>
        </Step>
      </form>
    </Frame>
  );
}
