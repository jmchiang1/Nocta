/* Nocta — desktop You view, laid out like most desktop settings: one
 * readable column of sections, top to bottom. On a wide screen the Account
 * and Settings pages don't need to hide one click away: their sections render
 * inline (the same AccountContent / SettingsContent the mobile pages use)
 * under the profile. Each device row still opens its detail (with
 * disconnect). Prototype-only resets live in the DevPanel. */
import { useStore } from '../../lib/store.jsx';
import { wearableStatusLine } from '../../lib/wearables.js';
import { USER, CONNECTED_DEVICES, DEVICE_PHOTO, maskById } from '../../data/account.js';
import { machineName } from '../../data/therapy.js';
import { EditableAvatar, PhotoLinks } from '../EditableAvatar.jsx';
import { Icon } from '../Icons.jsx';
import { AccountContent } from '../../screens/AccountSheet.jsx';
import { SettingsContent } from '../../screens/SettingsSheet.jsx';

export function DesktopYou() {
  const { openSheet, deviceConnections, machineId, maskId, resetOnboarding, authUser, authConfigured, wearables } =
    useStore();
  const connectedDevices = CONNECTED_DEVICES.filter((d) => deviceConnections[d.key]);
  const machine = machineName(machineId);
  const mask = maskById(maskId);

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">You</h1>
        </div>
      </header>

      <div className="dash-settings">
        <section className="profile-card dash-profile" aria-label="Your profile">
          <div className="profile-head">
            <EditableAvatar />
            <div>
              {/* who: from sign-in; nothing filled in when it isn't known */}
              <div className="ph-name">{authUser?.name ?? authUser?.email ?? 'Your profile'}</div>
              {authUser?.name && authUser?.email && <div className="ph-sub">{authUser.email}</div>}
              <PhotoLinks />
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

        {/* the order of a desktop settings page: devices, reminders, your
         * data, then how you're signed in, with the disclaimer last */}
        <div className="section-head">
          <h3>Connected devices</h3>
        </div>
        <div className="list">
          {connectedDevices.map((d) => {
            const photo = DEVICE_PHOTO[d.key];
            return (
              <button key={d.key} className="list-row" onClick={() => openSheet('deviceDetail', { deviceKey: d.key })}>
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
                  <div className="lr-sub">{wearableStatusLine(wearables.links[d.key])}</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            );
          })}
          {connectedDevices.length === 0 && (
            <div className="list-row empty">
              <div className="lr-main">
                <div className="lr-title">No devices connected</div>
                <div className="lr-sub">
                  {authConfigured
                    ? 'Connect a wearable to see your body overnight.'
                    : 'Nocta reads your CPAP’s SD card. Wearables can’t be connected yet.'}
                </div>
              </div>
            </div>
          )}
          <button className="list-row add" onClick={() => openSheet('addDevice')}>
            <div className="lr-icon bare accent">
              <Icon name="plus" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Wearables</div>
              <div className="lr-sub">{authConfigured ? 'Oura, Fitbit, Whoop, Withings' : 'Coming soon'}</div>
            </div>
            <Icon name="chevronRight" size={17} />
          </button>
        </div>

        <SettingsContent>
          <AccountContent onSignOut={resetOnboarding} />
        </SettingsContent>
      </div>
    </>
  );
}
