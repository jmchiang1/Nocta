/* Nocta — Account subpage. Full-screen sheet from the You tab: how you're
 * signed in. Sign-in is real when Supabase is configured (lib/auth.jsx). */
import { useStore } from '../lib/store.jsx';
import { PROVIDERS, isRelayEmail } from '../data/auth.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

const PROVIDER_LOGO = { apple: '/brands/apple.svg', google: '/brands/google.svg' };

/* how the account is signed in. A guest has nothing saved, so their way
 * forward is a real account: Sign in with Google leaves guest mode and runs
 * setup (or restores, if that Google account already uses Nocta). */
function SignInSection({ onSignOut }) {
  const { authUser, switchToAccount } = useStore();
  // the demo opened straight into the app (DevPanel) has no session: show the mock account
  const who = authUser;
  const guest = who?.kind === 'guest';
  const relay = isRelayEmail(who?.email);

  return (
    <>
      <div className="section-head">
        <h3>Sign in</h3>
      </div>
      <div className="list">
        {guest ? (
          <div className="list-row">
            <div className="lr-icon bare">
              <Icon name="lock" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">No account</div>
              <div className="lr-sub">Exploring with sample data. Nothing is saved.</div>
            </div>
          </div>
        ) : (
          who && (
            <div className="list-row">
              <div className="lr-icon bare">
                {PROVIDER_LOGO[who.kind] ? (
                  <img className="acct-provider" src={PROVIDER_LOGO[who.kind]} alt="" />
                ) : (
                  <Icon name="mail" size={17} />
                )}
              </div>
              <div className="lr-main">
                <div className="lr-title">
                  Signed in with {PROVIDERS[who.kind]?.label ?? 'email'}
                </div>
                <div className="lr-sub">{relay ? 'Using Hide My Email' : who.email}</div>
              </div>
            </div>
          )
        )}
        <button className="list-row" onClick={onSignOut}>
          <div className="lr-icon bare">
            <Icon name="logout" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">{guest ? 'Leave guest mode' : 'Sign out'}</div>
            <div className="lr-sub">
              {guest ? 'Back to the welcome screen' : 'You can sign back in from the welcome screen'}
            </div>
          </div>
        </button>
      </div>

      {guest && (
        <div className="acct-save">
          <p className="settings-note">
            Make an account to bring in your own CPAP data and keep your check-ins.
          </p>
          <button className="btn primary" onClick={() => switchToAccount('signup')}>
            Create an account
          </button>
          <button className="btn subtle" onClick={() => switchToAccount('signin')}>
            I already have one
          </button>
        </div>
      )}
    </>
  );
}

/* the page's sections, shared with the desktop You page (rendered inline
 * there, after Your data). Therapy facts (nights on the machine, since when)
 * live on the profile card, so they aren't repeated here. */
export function AccountContent({ onSignOut }) {
  return <SignInSection onSignOut={onSignOut} />;
}

export function AccountSheet() {
  const { closeSheet, resetOnboarding } = useStore();

  return (
    <Sheet title="Account" onClose={closeSheet} variant="page">
      {(close) => (
        <AccountContent
          onSignOut={() => {
            close();
            setTimeout(resetOnboarding, 320);
          }}
        />
      )}
    </Sheet>
  );
}
