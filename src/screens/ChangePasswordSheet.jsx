/* Nocta — change password (Settings › Sign-in & security). Email accounts
 * only: the current password is checked, then the new one is saved
 * (lib/auth.jsx changePassword). Google accounts have no Nocta password, so
 * Settings never opens this for them. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { MIN_PASSWORD } from '../data/auth.js';

export function ChangePasswordSheet() {
  const { closeSheet, changePassword, showToast } = useStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const problem =
    !current
      ? 'Enter your current password.'
      : next.length < MIN_PASSWORD
        ? `Use at least ${MIN_PASSWORD} characters for the new password.`
        : next !== again
          ? 'The new passwords don’t match.'
          : next === current
            ? 'That’s your current password. Choose a new one.'
            : null;

  return (
    <Sheet title="Change password" onClose={closeSheet} variant="page">
      {(close) => (
        <form
          className="cp-form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setTried(true);
            if (problem) return;
            setBusy(true);
            setError(null);
            const r = await changePassword(current, next);
            setBusy(false);
            if (r.status === 'error') setError(r.message);
            else {
              showToast('Password changed', 'check');
              close();
            }
          }}
        >
          {[
            ['cp-current', 'Current password', current, setCurrent, 'current-password'],
            ['cp-new', 'New password', next, setNext, 'new-password'],
            ['cp-again', 'New password again', again, setAgain, 'new-password'],
          ].map(([id, label, v, set, ac]) => (
            <div className="au-field" key={id}>
              <label className="ob-field-label" htmlFor={id}>
                {label}
              </label>
              <input id={id} className="ob-input" type="password" autoComplete={ac} maxLength={72} value={v} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
          <p className="au-field-hint">At least {MIN_PASSWORD} characters.</p>
          {tried && problem && <p className="au-field-err" role="alert">{problem}</p>}
          {error && <p className="au-field-err" role="alert">{error}</p>}
          <button type="submit" className="btn primary au-submit" disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </Sheet>
  );
}
