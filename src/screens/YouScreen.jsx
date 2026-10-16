/* Nocta — You tab. Profile, connected devices, then every setting as one
 * long list, as on desktop: the Settings and Account sections render inline
 * (the same SettingsContent / AccountContent the desktop You page uses),
 * not one tap away. Each connected device row
 * opens a device-detail sheet (with disconnect), not a flat toggle.
 * Journal history lives on Trends — it's data, not app config.
 * Prototype-only controls (reset check-in, replay onboarding) live in the
 * DevPanel outside the phone, so the app itself reads as shipped. */
import { useStore } from '../lib/store.jsx';
import { wearableStatusLine } from '../lib/wearables.js';
import { USER, CONNECTED_DEVICES, DEVICE_PHOTO } from '../data/account.js';
import { machineName } from '../data/therapy.js';
import { EditableAvatar, PhotoLinks } from '../components/EditableAvatar.jsx';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { Icon } from '../components/Icons.jsx';
import { SettingsContent } from './SettingsSheet.jsx';
import { AccountContent } from './AccountSheet.jsx';

export function YouScreen() {
  const { openSheet, deviceConnections, machineId, authUser, authConfigured, wearables, resetOnboarding, hasData } =
    useStore();
  const connectedDevices = CONNECTED_DEVICES.filter((d) => deviceConnections[d.key]);

  return (
    <ScreenFrame title="You">
      <header className="page-head">
        <h1>You</h1>
      </header>

      <section className="profile-card" aria-label="Your profile">
        <div className="profile-head">
          <EditableAvatar />
          <div>
            {/* who: from sign-in. What: from the card. Nothing filled in */}
            <div className="ph-name">{authUser?.name ?? authUser?.email ?? 'Your profile'}</div>
            {/* the machine and its nights come from the card: none yet, none shown */}
            {hasData && <div className="ph-sub">{machineName(machineId).name}</div>}
            {/* one plain milestone; compliance and AHI live on Therapy and Trends */}
            <div className="ph-meta tnum">
              {hasData ? (
                <>
                  {USER.daysOnTherapy} nights on the machine
                  {USER.therapyStart && ` · since ${USER.therapyStart}`}
                </>
              ) : (
                'No nights yet'
              )}
            </div>
            <PhotoLinks />
          </div>
        </div>
      </section>

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

      {/* every setting, inline: sign-in & security, reminders, your data,
       * sign in / out, and the medical disclaimer */}
      <SettingsContent>
        <AccountContent onSignOut={resetOnboarding} />
      </SettingsContent>
    </ScreenFrame>
  );
}
