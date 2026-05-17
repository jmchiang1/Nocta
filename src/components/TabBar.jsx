/* Nocta — floating bottom tab bar */
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';

const TABS = [
  { id: 'tonight', label: 'Tonight', icon: 'tonight' },
  { id: 'trends', label: 'Trends', icon: 'trends' },
  { id: 'therapy', label: 'Therapy', icon: 'therapy' },
  { id: 'you', label: 'You', icon: 'you' },
];

export function TabBar() {
  const { tab, setTab } = useStore();
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab${tab === t.id ? ' active' : ''}`}
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
        >
          <Icon name={t.icon} size={22} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}
