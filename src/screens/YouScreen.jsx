/* Nocta — You tab. Profile, account, settings, connected devices.
 * Account and Settings push full-screen subpages. Each connected device row
 * opens a device-detail sheet (with disconnect), not a flat toggle.
 * Journal history lives on Trends — it's data, not app config. */
import { useStore } from '../lib/store.jsx';
import { USER, CONNECTED_DEVICES, DEVICE_PHOTO } from '../data/account.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';

export function YouScreen() {
  const { checkin, resetCheckin, resetOnboarding, openSheet, deviceConnections } = useStore();
  const connectedDevices = CONNECTED_DEVICES.filter((d) => deviceConnections[d.key]);
  const availableCount = CONNECTED_DEVICES.length - connectedDevices.length;

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll">
        <header className="page-head">
          <h1>You</h1>
        </header>

        <div className="profile-head">
          <div className="avatar">{USER.initials}</div>
          <div>
            <div className="ph-name">{USER.name}</div>
            <div className="ph-sub">
              {USER.condition} · therapy day {USER.daysOnTherapy} of 30 · AirSense 11
            </div>
          </div>
        </div>

        <div className="section-head">
          <h3>Account &amp; settings</h3>
        </div>
        <div className="list">
          <button className="list-row" onClick={() => openSheet('account')}>
            <div className="lr-icon bare">
              <Icon name="you" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Account</div>
              <div className="lr-sub">Profile, plan, and sign out</div>
            </div>
            <Icon name="chevronRight" size={17} />
          </button>
          <button className="list-row" onClick={() => openSheet('settings')}>
            <div className="lr-icon bare">
              <Icon name="settings" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Settings</div>
              <div className="lr-sub">Notifications, privacy, and data</div>
            </div>
            <Icon name="chevronRight" size={17} />
          </button>
        </div>

        <div className="section-head">
          <h3>Connected devices</h3>
          {connectedDevices.length > 0 && <span className="meta">tap to manage</span>}
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
                  <div className="lr-sub">Connected · synced {d.lastSync || 'just now'}</div>
                </div>
                <span className="conn-dot on" aria-hidden="true" />
                <Icon name="chevronRight" size={17} />
              </button>
            );
          })}
          {connectedDevices.length === 0 && (
            <div className="list-row empty">
              <div className="lr-main">
                <div className="lr-title">No devices connected</div>
                <div className="lr-sub">Pair a wearable to layer heart rate and sleep onto your therapy</div>
              </div>
            </div>
          )}
          <button className="list-row add" onClick={() => openSheet('addDevice')}>
            <div className="lr-icon bare accent">
              <Icon name="plus" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Add a device</div>
              {/* <div className="lr-sub">
                {connectedDevices.length === 0
                  ? 'Apple Watch, Oura Ring, Whoop, or Apple Health'
                  : `${availableCount} more available`}
              </div> */}
            </div>
            <Icon name="chevronRight" size={17} />
          </button>
        </div>

        <div className="section-head">
          <h3>Demo controls</h3>
          <span className="meta">prototype</span>
        </div>
        <div className="list">
          <button className="list-row" onClick={resetCheckin} disabled={!checkin.done}>
            <div className="lr-icon bare accent">
              <Icon name="refresh" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Reset morning check-in</div>
              <div className="lr-sub">
                {checkin.done ? 'Clear logged tags to try the flow again' : 'Check-in not logged yet'}
              </div>
            </div>
          </button>
          <button className="list-row" onClick={resetOnboarding}>
            <div className="lr-icon bare accent">
              <Icon name="sparkles" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Replay onboarding</div>
              <div className="lr-sub">Run the first-time setup flow again</div>
            </div>
          </button>
        </div>

        <p className="disclaimer">Nocta v1 prototype · mock data · no live SleepHQ or OpenAI calls.</p>
      </div>
    </div>
  );
}
