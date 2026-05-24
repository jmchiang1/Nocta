/* Nocta — desktop You view. Profile banner + tabbed settings (Account,
 * Notifications, Devices, Privacy, Demo) rather than one big grid, so each
 * section reads as a focused settings page in a single readable column. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import {
  USER,
  CONNECTED_DEVICES,
  DEVICE_PHOTO,
  SETTINGS_DEFAULTS,
  PRIVACY_NOTE,
  MEDICAL_NOTE,
} from '../../data/account.js';
import { Icon } from '../Icons.jsx';

function Switch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  );
}

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'devices', label: 'Devices' },
  { id: 'privacy', label: 'Privacy & data' },
  { id: 'demo', label: 'Demo' },
];

export function DesktopYou() {
  const { checkin, resetCheckin, resetOnboarding, deviceConnections } = useStore();
  const connectedDevices = CONNECTED_DEVICES.filter((d) => deviceConnections[d.key]);

  const [tab, setTab] = useState('account');
  const [checkinReminder, setCheckinReminder] = useState(SETTINGS_DEFAULTS.checkinReminder);
  const [weekly, setWeekly] = useState(SETTINGS_DEFAULTS.weeklySummary);
  const [cellular, setCellular] = useState(SETTINGS_DEFAULTS.syncOverCellular);
  const [exported, setExported] = useState(false);

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">You</h1>
          <div className="dash-sub">Profile, account, settings, and devices</div>
        </div>
      </header>

      <div className="panel dash-profile-panel">
        <div className="profile-head">
          <div className="avatar">{USER.initials}</div>
          <div>
            <div className="ph-name">{USER.name}</div>
            <div className="ph-sub">
              {USER.condition} · therapy day {USER.daysOnTherapy} of 30 · AirSense 11
            </div>
          </div>
        </div>
      </div>

      <div className="dash-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`dash-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dash-settings-body">
        {tab === 'account' && (
          <div className="list">
            <div className="list-row static">
              <div className="lr-icon bare accent"><Icon name="star" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">{USER.plan}</div>
                <div className="lr-sub">{USER.planSub}</div>
              </div>
            </div>
            <button className="list-row">
              <div className="lr-icon bare"><Icon name="calendar" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Manage subscription</div>
                <div className="lr-sub">Change plan or billing</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
            <div className="list-row static">
              <div className="lr-icon bare"><Icon name="clock" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Member since</div>
                <div className="lr-sub">{USER.joinedDate}</div>
              </div>
            </div>
            <button className="list-row">
              <div className="lr-icon bare"><Icon name="lock" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Change password</div>
                <div className="lr-sub">{USER.email}</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
            <button className="list-row" onClick={resetOnboarding}>
              <div className="lr-icon bare"><Icon name="logout" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Sign out</div>
                <div className="lr-sub">Returns to onboarding</div>
              </div>
            </button>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="list">
            <div className="list-row static">
              <div className="lr-icon bare"><Icon name="bell" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Morning check-in</div>
                <div className="lr-sub">7:00 AM · weekdays and weekends</div>
              </div>
              <Switch on={checkinReminder} onChange={setCheckinReminder} label="Morning check-in reminder" />
            </div>
            <div className="list-row static">
              <div className="lr-icon bare"><Icon name="calendar" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Weekly summary</div>
                <div className="lr-sub">Sundays at 9:00 AM</div>
              </div>
              <Switch on={weekly} onChange={setWeekly} label="Weekly summary" />
            </div>
            <div className="list-row static">
              <div className="lr-icon bare"><Icon name="refresh" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Sync over cellular</div>
                <div className="lr-sub">Use mobile data when Wi-Fi is unavailable</div>
              </div>
              <Switch on={cellular} onChange={setCellular} label="Sync over cellular" />
            </div>
          </div>
        )}

        {tab === 'devices' && (
          <div className="list">
            {connectedDevices.map((d) => {
              const photo = DEVICE_PHOTO[d.key];
              return (
                <div className="list-row static" key={d.key}>
                  {photo ? (
                    <div className="lr-icon app"><img src={photo} alt="" /></div>
                  ) : (
                    <div className="lr-icon"><Icon name={d.icon} size={17} /></div>
                  )}
                  <div className="lr-main">
                    <div className="lr-title">{d.title}</div>
                    <div className="lr-sub">Connected · synced {d.lastSync || 'just now'}</div>
                  </div>
                  <span className="conn-dot on" aria-hidden="true" />
                </div>
              );
            })}
            {connectedDevices.length === 0 && (
              <div className="list-row static empty">
                <div className="lr-main">
                  <div className="lr-title">No devices connected</div>
                  <div className="lr-sub">Pair a wearable on mobile to layer heart rate and sleep onto your therapy</div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'privacy' && (
          <>
            <p className="settings-note">{PRIVACY_NOTE}</p>
            <div className="list">
              <button className="list-row" onClick={() => setExported(true)}>
                <div className="lr-icon bare accent"><Icon name="download" size={17} /></div>
                <div className="lr-main">
                  <div className="lr-title">Export my data</div>
                  <div className="lr-sub">
                    {exported ? 'Export queued — you’ll get an email when it’s ready' : 'Download everything Nocta holds'}
                  </div>
                </div>
                <Icon name={exported ? 'check' : 'chevronRight'} size={17} />
              </button>
              <button className="list-row">
                <div className="lr-icon bare"><Icon name="x" size={17} /></div>
                <div className="lr-main">
                  <div className="lr-title destructive">Delete account</div>
                  <div className="lr-sub">Permanently remove all your data</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
            <div className="dash-head"><h3>Medical disclaimer</h3></div>
            <p className="settings-note">{MEDICAL_NOTE}</p>
          </>
        )}

        {tab === 'demo' && (
          <div className="list">
            <button className="list-row" onClick={resetCheckin} disabled={!checkin.done}>
              <div className="lr-icon bare accent"><Icon name="refresh" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Reset morning check-in</div>
                <div className="lr-sub">
                  {checkin.done ? 'Clear logged tags to try the flow again' : 'Check-in not logged yet'}
                </div>
              </div>
            </button>
            <button className="list-row" onClick={resetOnboarding}>
              <div className="lr-icon bare accent"><Icon name="sparkles" size={17} /></div>
              <div className="lr-main">
                <div className="lr-title">Replay onboarding</div>
                <div className="lr-sub">Run the first-time setup flow again</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <p className="disclaimer">Nocta v1 prototype · mock data · no live SleepHQ or OpenAI calls.</p>
    </>
  );
}
