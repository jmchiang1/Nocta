/* Nocta — Settings subpage. Full-screen sheet from the You tab.
 * Notifications, privacy, medical disclaimer, data export. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { SETTINGS_DEFAULTS, PRIVACY_NOTE, MEDICAL_NOTE } from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

/* accessible on/off switch — same one used in YouScreen */
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

export function SettingsSheet() {
  const { closeSheet } = useStore();
  const [checkin, setCheckin] = useState(SETTINGS_DEFAULTS.checkinReminder);
  const [weekly, setWeekly] = useState(SETTINGS_DEFAULTS.weeklySummary);
  const [cellular, setCellular] = useState(SETTINGS_DEFAULTS.syncOverCellular);
  const [exported, setExported] = useState(false);

  return (
    <Sheet title="Settings" onClose={closeSheet} variant="page">
      <div className="section-head">
        <h3>Notifications</h3>
      </div>
      <div className="list">
        <div className="list-row">
          <div className="lr-icon bare">
            <Icon name="bell" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Morning check-in</div>
            <div className="lr-sub">7:00 AM · weekdays and weekends</div>
          </div>
          <Switch on={checkin} onChange={setCheckin} label="Morning check-in reminder" />
        </div>
        <div className="list-row">
          <div className="lr-icon bare">
            <Icon name="calendar" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Weekly summary</div>
            <div className="lr-sub">Sundays at 9:00 AM</div>
          </div>
          <Switch on={weekly} onChange={setWeekly} label="Weekly summary" />
        </div>
      </div>

      <div className="section-head">
        <h3>Sync</h3>
      </div>
      <div className="list">
        <div className="list-row">
          <div className="lr-icon bare">
            <Icon name="refresh" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Sync over cellular</div>
            <div className="lr-sub">Use mobile data when Wi-Fi is unavailable</div>
          </div>
          <Switch on={cellular} onChange={setCellular} label="Sync over cellular" />
        </div>
      </div>

      <div className="section-head">
        <h3>Privacy &amp; data</h3>
      </div>
      <p className="settings-note">{PRIVACY_NOTE}</p>
      <div className="list">
        <button className="list-row" onClick={() => setExported(true)}>
          <div className="lr-icon bare accent">
            <Icon name="download" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">Export my data</div>
            <div className="lr-sub">
              {exported
                ? 'Export queued — you’ll get an email when it’s ready'
                : 'Download everything Nocta holds'}
            </div>
          </div>
          <Icon name={exported ? 'check' : 'chevronRight'} size={17} />
        </button>
        <button className="list-row">
          <div className="lr-icon bare">
            <Icon name="x" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title destructive">Delete account</div>
            <div className="lr-sub">Permanently remove all your data</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

      <div className="section-head">
        <h3>Medical disclaimer</h3>
      </div>
      <p className="settings-note">{MEDICAL_NOTE}</p>

      <p className="disclaimer">Nocta v1 prototype · mock data · no live SleepHQ or OpenAI calls.</p>
    </Sheet>
  );
}
