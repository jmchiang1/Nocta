/* Nocta — desktop dashboard shell. Persistent left sidebar + a main view that
 * swaps with the active tab. Shares the same store state as the mobile app, so
 * the Mobile/Desktop toggle keeps you on the same night and tab. */
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { USER } from '../../data/account.js';
import { DEVICE } from '../../data/therapy.js';
import { DesktopTonight } from './DesktopTonight.jsx';
import { DesktopTrends } from './DesktopTrends.jsx';
import { DesktopTherapy } from './DesktopTherapy.jsx';
import { DesktopYou } from './DesktopYou.jsx';

const NAV = [
  { id: 'tonight', label: 'Tonight', icon: 'tonight' },
  { id: 'trends', label: 'Trends', icon: 'trends' },
  { id: 'therapy', label: 'Therapy', icon: 'therapy' },
  { id: 'you', label: 'You', icon: 'you' },
];

const VIEWS = {
  tonight: DesktopTonight,
  trends: DesktopTrends,
  therapy: DesktopTherapy,
  you: DesktopYou,
};

export function DesktopApp() {
  const { tab, setTab, tabNonce, openSheet } = useStore();
  const View = VIEWS[tab] || DesktopTonight;

  return (
    <div className="dash">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-logo" aria-hidden="true">
            <img src="/Nocta-logo.svg" alt="" />
          </span>
          <span className="dash-wordmark">Nocta</span>
        </div>

        <nav className="dash-nav" aria-label="Primary">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`dash-nav-item${tab === n.id ? ' active' : ''}`}
              onClick={() => setTab(n.id)}
              aria-current={tab === n.id ? 'page' : undefined}
            >
              <Icon name={n.icon} size={19} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <button className="dash-coach" onClick={() => openSheet('coach')}>
          <span className="dash-coach-icon" aria-hidden="true">
            <Icon name="coach" size={18} />
          </span>
          <span className="dash-coach-text">
            <span className="dash-coach-title">Ask Nocta</span>
            <span className="dash-coach-sub">Your therapy coach</span>
          </span>
        </button>

        <div className="dash-side-foot">
          <div className="dash-sync" title={DEVICE.source}>
            <span className="dash-sync-dot" aria-hidden="true" />
            <span className="dash-sync-text">{DEVICE.status} · SleepHQ</span>
          </div>
          <div className="dash-user">
            <div className="dash-avatar">{USER.initials}</div>
            <div className="dash-user-meta">
              <div className="dash-user-name">{USER.name}</div>
              <div className="dash-user-sub">{USER.plan}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <View key={tabNonce} />
      </main>
    </div>
  );
}
