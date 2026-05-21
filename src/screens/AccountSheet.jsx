/* Nocta — Account subpage. Full-screen sheet from the You tab.
 * Profile, plan, therapy status, and sign-out. Display-only in v1. */
import { useStore } from '../lib/store.jsx';
import { USER } from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

export function AccountSheet() {
  const { closeSheet, resetOnboarding } = useStore();

  return (
    <Sheet title="Account" onClose={closeSheet} variant="page">
      {(close) => (
        <>
          <div className="profile-head" style={{ marginBottom: 20 }}>
            <div className="avatar">{USER.initials}</div>
            <div>
              <div className="ph-name">{USER.name}</div>
              <div className="ph-sub">{USER.email}</div>
            </div>
          </div>

          <div className="section-head">
            <h3>Plan</h3>
          </div>
          <div className="list">
            <div className="list-row">
              <div className="lr-icon bare accent">
                <Icon name="star" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">{USER.plan}</div>
                <div className="lr-sub">{USER.planSub}</div>
              </div>
            </div>
            <button className="list-row">
              <div className="lr-icon bare">
                <Icon name="calendar" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">Manage subscription</div>
                <div className="lr-sub">Change plan or billing</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
          </div>

          <div className="section-head">
            <h3>Therapy</h3>
          </div>
          <div className="list">
            <div className="list-row">
              <div className="lr-icon bare">
                <Icon name="therapy" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">{USER.condition} · day {USER.daysOnTherapy} of 30</div>
                <div className="lr-sub">Starting Nocta tracker</div>
              </div>
            </div>
            <div className="list-row">
              <div className="lr-icon bare">
                <Icon name="clock" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">Member since</div>
                <div className="lr-sub">{USER.joinedDate}</div>
              </div>
            </div>
          </div>

          <div className="section-head">
            <h3>Sign in</h3>
          </div>
          <div className="list">
            <button className="list-row">
              <div className="lr-icon bare">
                <Icon name="lock" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">Change password</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
            <button
              className="list-row"
              onClick={() => {
                close();
                setTimeout(resetOnboarding, 320);
              }}
            >
              <div className="lr-icon bare">
                <Icon name="logout" size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">Sign out</div>
                <div className="lr-sub">Returns to onboarding</div>
              </div>
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
