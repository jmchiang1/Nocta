/* Nocta — delete account, its own flow (Settings › Your data):
 *   1. what   what gets deleted, what doesn't, and a chance to export first
 *   2. confirm type DELETE (a deliberate step, not one tap)
 *   3. working → the account is deleted on the server (lib/auth.jsx), then
 *              everything on this device is wiped (lib/accountData.js), and
 *              the app returns to the splash
 * If the server can't delete it, nothing is wiped and it says so.
 * A guest has no account: the same flow clears this device instead. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { exportMyData, wipeLocalData } from '../lib/accountData.js';

const WORD = 'DELETE';

export function DeleteAccountSheet() {
  const { closeSheet, authUser, deleteAccount, removeCardImport, resetOnboarding, showToast } = useStore();
  const guest = !authUser || authUser.kind === 'guest';
  const [step, setStep] = useState('what');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(null);

  async function run(close) {
    setStep('working');
    setError(null);
    if (!guest) {
      const r = await deleteAccount();
      if (r.status === 'error') {
        setError(r.message);
        setStep('confirm');
        return;
      }
    }
    await wipeLocalData();
    await removeCardImport();
    close();
    setTimeout(() => {
      resetOnboarding();
      showToast(guest ? 'This device’s data was erased' : 'Your account was deleted', 'check');
    }, 320);
  }

  return (
    <Sheet title={guest ? 'Erase this device’s data' : 'Delete account'} onClose={closeSheet} variant="page">
      {(close) =>
        step === 'what' ? (
          <div className="del">
            <p className="settings-note del-lede">
              {guest
                ? 'You’re using Nocta without an account, so there’s nothing on a server. This erases what Nocta keeps on this device.'
                : 'This permanently deletes your Nocta account and everything Nocta keeps about you. It can’t be undone.'}
            </p>
            <h4 className="del-h">Deleted</h4>
            <ul className="del-list">
              {!guest && <li>Your Nocta account and sign-in ({authUser.email ?? authUser.kind})</li>}
              <li>CPAP nights imported on this device</li>
              <li>Your morning check-ins</li>
              <li>Your setup answers and profile photo</li>
              <li>Equipment replacement dates</li>
            </ul>
            <h4 className="del-h">Not touched</h4>
            <ul className="del-list keep">
              <li>The SD card in your machine, and your machine’s own records</li>
              {authUser?.kind === 'google' && <li>Your Google account</li>}
            </ul>
            <button className="btn ghost del-export" type="button" onClick={() => exportMyData(authUser)}>
              <Icon name="download" size={17} />
              Export my data first
            </button>
            <button className="btn destructive" type="button" onClick={() => setStep('confirm')}>
              Continue
            </button>
          </div>
        ) : (
          <form
            className="del"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim().toUpperCase() === WORD && step !== 'working') run(close);
            }}
          >
            <p className="settings-note del-lede">
              To confirm, type <strong>{WORD}</strong> below.
            </p>
            <input
              className="ob-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${WORD} to confirm`}
              autoFocus
            />
            {error && (
              <p className="au-field-err" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn destructive del-go"
              type="submit"
              disabled={typed.trim().toUpperCase() !== WORD || step === 'working'}
              aria-busy={step === 'working' || undefined}
            >
              {step === 'working' ? 'Deleting…' : guest ? 'Erase everything' : 'Delete my account'}
            </button>
            <button className="btn subtle" type="button" onClick={close} disabled={step === 'working'}>
              {guest ? 'Cancel' : 'Keep my account'}
            </button>
          </form>
        )
      }
    </Sheet>
  );
}
