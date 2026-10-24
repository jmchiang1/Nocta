/* Nocta — Account subpage. Full-screen sheet from the You tab: how you're
 * signed in. Sign-in is real when Supabase is configured (lib/auth.jsx). */
import { useStore } from '../lib/store.jsx';
import { PROVIDERS, isRelayEmail } from '../data/auth.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

const PROVIDER_LOGO = {
  apple: '/brands/apple.svg',
  google: '/brands/google.svg',
  microsoft: '/brands/microsoft.svg',
};

/* how the account is signed in. A guest's way to an account is the card at
 * the top of You (GuestAccountCard); here they can only leave guest mode. */
function SignInSection({ onSignOut }) {
  const { authUser } = useStore();
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
        {guest ? null : (
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
          </div>
        </button>
      </div>

    </>
  );
}

/* a guest's You page leads with this instead of a profile: they're looking
 * at sample nights, and an account is how their own come in and stay */
/* one way out: back to the welcome screen, where they can make an account
 * or sign in to one they have */
export function GuestAccountCard() {
  const { resetOnboarding } = useStore();
  return (
    <section className="guest-card" aria-label="You're looking around">
      <div className="guest-card-top">
        <h2>You’re looking around</h2>
        <p>
          These are sample nights. Make an account to bring in your own CPAP data and keep your
          check-ins and settings.
        </p>
      </div>
      <button className="btn primary" onClick={resetOnboarding}>
        Create an account or sign in
      </button>
    </section>
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
