/* Nocta — You tab. Profile, journal history, settings, account. */
import { useStore } from '../lib/store.jsx';
import { JOURNAL_HISTORY, TAG_LABELS } from '../data/journal.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';

const SETTINGS = [
  { icon: 'bell', title: 'Notifications', sub: 'Morning check-in reminder · 7:00 AM' },
  { icon: 'shield', title: 'Medical disclaimer', sub: 'Nocta is a wellness companion, not a device' },
  { icon: 'lock', title: 'Privacy & data', sub: 'How your SleepHQ data is stored and used' },
  { icon: 'download', title: 'Export my data', sub: 'Download everything Nocta holds' },
];

export function YouScreen() {
  const { checkin, resetCheckin, resetOnboarding } = useStore();

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll">
        <header className="page-head">
          <h1>You</h1>
        </header>

        <div className="profile-head">
          <div className="avatar">J</div>
          <div>
            <div className="ph-name">Jonathan Chiang</div>
            <div className="ph-sub">OSA · therapy day 11 of 30 · AirSense 11</div>
          </div>
        </div>

        <div className="section-head">
          <h3>Journal history</h3>
          <span className="meta">{JOURNAL_HISTORY.length} nights</span>
        </div>
        <div className="list">
          {JOURNAL_HISTORY.map((j) => (
            <div className="list-row" key={j.date}>
              <div className="lr-main">
                <div className="lr-title">{j.date}</div>
                <div className="lr-sub">
                  {j.tags.map((t) => TAG_LABELS[t] || t).join(' · ')}
                </div>
              </div>
              <div className="lr-right tnum">AHI {j.ahi}</div>
            </div>
          ))}
        </div>

        <div className="section-head">
          <h3>Account &amp; settings</h3>
        </div>
        <div className="list">
          {SETTINGS.map((s) => (
            <button className="list-row" key={s.title}>
              <div className="lr-icon bare">
                <Icon name={s.icon} size={17} />
              </div>
              <div className="lr-main">
                <div className="lr-title">{s.title}</div>
                <div className="lr-sub">{s.sub}</div>
              </div>
              <Icon name="chevronRight" size={17} />
            </button>
          ))}
          <button className="list-row">
            <div className="lr-icon bare">
              <Icon name="logout" size={17} />
            </div>
            <div className="lr-main">
              <div className="lr-title">Sign out</div>
            </div>
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
