/* Nocta — desktop dashboard shell. Persistent left sidebar + a main view that
 * swaps with the active tab. Shares the same store state as the mobile app, so
 * the Mobile/Desktop toggle keeps you on the same night and tab. */
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { USER } from '../../data/account.js';
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
  const { tab, setTab, tabNonce } = useStore();
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

        <div className="dash-side-foot">
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
