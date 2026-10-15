/* Nocta — desktop You view. On a wide screen the Account and Settings pages
 * don't need to hide one click away: their sections render inline (the same
 * AccountContent / SettingsContent the mobile pages use), with the profile and
 * connected devices alongside. Each device row still opens its detail (with
 * disconnect). Prototype-only resets live in the DevPanel. */
import { useStore } from '../../lib/store.jsx';
import { USER, CONNECTED_DEVICES, DEVICE_PHOTO, maskById } from '../../data/account.js';
import { machineName } from '../../data/therapy.js';
import { ProfileAvatar } from '../ProfileAvatar.jsx';
import { Icon } from '../Icons.jsx';
import { AccountContent } from '../../screens/AccountSheet.jsx';
import { SettingsContent } from '../../screens/SettingsSheet.jsx';

export function DesktopYou() {
  const { openSheet, deviceConnections, machineId, maskId, resetOnboarding, authUser } = useStore();
  const connectedDevices = CONNECTED_DEVICES.filter((d) => deviceConnections[d.key]);
  const machine = machineName(machineId);
  const mask = maskById(maskId);

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">You</h1>
          <div className="dash-sub">Profile, account, settings, and devices</div>
        </div>
      </header>

      <section className="profile-card dash-profile" aria-label="Your profile">
        <div className="profile-head">
          <div className="avatar">
            <ProfileAvatar user={authUser} />
          </div>
          <div>
            {/* who: from sign-in; nothing filled in when it isn't known */}
            <div className="ph-name">{authUser?.name ?? authUser?.email ?? 'Your profile'}</div>
            {authUser?.name && authUser?.email && <div className="ph-sub">{authUser.email}</div>}
          </div>
        </div>
        {/* plain facts, no scores: compliance and AHI live on Therapy and Trends */}
        <dl className="dash-profile-facts">
          <div>
            <dt>On the machine</dt>
            <dd className="tnum">{USER.daysOnTherapy} nights</dd>
          </div>
          <div>
            <dt>Since</dt>
            <dd>{USER.therapyStart ?? '—'}</dd>
          </div>
          <div>
            <dt>Machine</dt>
            <dd>{machine.short}</dd>
          </div>
          <div>
            <dt>Mask</dt>
            <dd>{mask ? mask.name : 'Not set'}</dd>
          </div>
        </dl>
      </section>

      <div className="dash-you">
        <div className="dash-col">
          <h2 className="dash-you-title">Account</h2>
          {/* devices sit inside Account, just above Sign in */}
          <AccountContent onSignOut={resetOnboarding}>
            <div className="section-head">
              <h3>Connected devices</h3>
              {connectedDevices.length > 0 && <span className="meta">click to manage</span>}
            </div>
            <div className="list">
              {connectedDevices.map((d) => {
                const photo = DEVICE_PHOTO[d.key];
                return (
                  <button
                    key={d.key}
                    className="list-row"
                    onClick={() => openSheet('deviceDetail', { deviceKey: d.key })}
                  >
                    {photo ? (
                      <div className="lr-icon app">
                        <img src={photo} alt="" />
                      </div>
                    ) : (
                      <div className="lr-icon">
                        <Icon name={d.icon} size={17} />
                      </div>
                    )}
                    <div className="lr-main">
                      <div className="lr-title">{d.title}</div>
                      <div className="lr-sub">Connected</div>
                    </div>
                    <Icon name="chevronRight" size={17} />
                  </button>
                );
              })}
              {connectedDevices.length === 0 && (
                <div className="list-row empty">
                  <div className="lr-main">
                    <div className="lr-title">No devices connected</div>
                    <div className="lr-sub">Nocta reads your CPAP’s SD card. Wearables can’t be connected yet.</div>
                  </div>
                </div>
              )}
              <button className="list-row add" onClick={() => openSheet('addDevice')}>
                <div className="lr-icon bare accent">
                  <Icon name="plus" size={17} />
                </div>
                <div className="lr-main">
                  <div className="lr-title">Wearables</div>
                  <div className="lr-sub">Coming soon</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
          </AccountContent>
        </div>

        <div className="dash-col">
          <h2 className="dash-you-title">Settings</h2>
          <SettingsContent />
        </div>
      </div>
    </>
  );
}
