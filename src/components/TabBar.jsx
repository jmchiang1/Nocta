/* Nocta — floating bottom tab bar. A single soft pill glides behind the active
 * tab (rather than each tab lighting up independently), and the active icon
 * gets one small settle so the tap feels received. Icon-only on screen; each
 * label stays in the DOM (visually hidden) so VoiceOver still reads it.
 * Outline glyphs at rest, filled when selected (iOS); You is your photo,
 * ringed in peach when selected. */
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';
import { USER } from '../data/account.js';

const TABS = [
  { id: 'tonight', label: 'Tonight', icon: 'tonight' },
  { id: 'trends', label: 'Trends', icon: 'trends' },
  { id: 'therapy', label: 'Therapy', icon: 'therapy' },
  { id: 'you', label: 'You', photo: true },
];

export function TabBar() {
  const { tab, setTab, tabBarHidden } = useStore();
  const index = Math.max(0, TABS.findIndex((t) => t.id === tab));

  return (
    <nav className={`tabbar${tabBarHidden ? ' tucked' : ''}`} aria-label="Primary">
      <span
        className="tab-indicator"
        aria-hidden="true"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            className={`tab${active ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            aria-current={active ? 'page' : undefined}
          >
            {/* keyed on active so the settle animation replays on selection */}
            <span className="tab-icon" key={active ? 'on' : 'off'}>
              {t.photo ? (
                <img className="tab-avatar" src={USER.photo} alt="" />
              ) : (
                <Icon name={active ? `${t.icon}On` : t.icon} size={24} />
              )}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
