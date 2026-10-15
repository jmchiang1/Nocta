/* Nocta — desktop dashboard shell. Persistent left sidebar + a main view that
 * swaps with the active tab. Shares the same store state as the mobile app, so
 * the Mobile/Desktop toggle keeps you on the same night and tab. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { Mascot } from '../Mascot.jsx';
import { StatusPill } from '../StatusPill.jsx';
import { prefersReducedMotion } from '../../lib/motion.jsx';
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

const FLIGHT_MS = 640;

/* Nox flies from the sidebar's Ask Nox into the coach dialog: a copy of the
 * sidebar mascot travels on a gentle arc and grows into the dialog's intro
 * mascot, which appears as it lands. The dialog is still popping in while he
 * flies, so the landing spot is re-measured every frame. */
function flyNox(fromEl) {
  if (!fromEl || prefersReducedMotion()) return;
  const from = fromEl.getBoundingClientRect();
  const ghost = fromEl.cloneNode(true);
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    zIndex: 800,
    pointerEvents: 'none',
    transformOrigin: '0 0',
    willChange: 'transform',
  });
  document.body.appendChild(ghost);
  // opacity, not visibility: the copy draws through the original's SVG mask,
  // and a hidden original would hide the mask's contents with it
  fromEl.style.opacity = '0';

  let target = null;
  const t0 = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    target = target?.isConnected ? target : document.querySelector('.desktop-modal-wrap .ci-avatar .mascot');
    if (target) target.style.visibility = 'hidden';
    const t = Math.min(1, (now - t0) / FLIGHT_MS);
    const k = ease(t);
    // until the dialog's mascot exists, aim at the window's centre
    const to = target?.getBoundingClientRect() ?? {
      left: innerWidth / 2 - 32,
      top: innerHeight / 2 - 32,
      width: 64,
    };
    const x = (to.left - from.left) * k;
    const y = (to.top - from.top) * k - Math.sin(Math.PI * k) * 90; // the arc
    const s = 1 + (to.width / from.width - 1) * k;
    ghost.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${(1 - k) * -25}deg)`;
    if (t < 1) {
      requestAnimationFrame(step);
      return;
    }
    if (target) target.style.visibility = '';
    ghost.remove();
    fromEl.style.opacity = '';
  };
  requestAnimationFrame(step);
}

const VIEWS = {
  tonight: DesktopTonight,
  trends: DesktopTrends,
  therapy: DesktopTherapy,
  you: DesktopYou,
};

const COLLAPSE_KEY = 'nocta.sidebar.collapsed.v1';

/* sidebar collapsed (icons only) or expanded, remembered across reloads */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  return [collapsed, toggle];
}


export function DesktopApp() {
  const { tab, setTab, tabNonce, openSheet } = useStore();
  const [collapsed, toggleCollapsed] = useCollapsed();
  const View = VIEWS[tab] || DesktopTonight;
  // collapsed, the labels are hidden — the native tooltip names each icon
  const tip = (label) => (collapsed ? label : undefined);

  return (
    <div className={`dash${collapsed ? ' collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-logo" aria-hidden="true">
            <img src="/Nocta-constellation-sm.svg" alt="" />
          </span>
          <span className="dash-wordmark">Nocta</span>
          <button
            className="dash-collapse"
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name="sidebar" size={18} />
          </button>
        </div>

        <nav className="dash-nav" aria-label="Primary">
          {NAV.map((n) => {
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                className={`dash-nav-item${active ? ' active' : ''}`}
                onClick={() => setTab(n.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? n.label : undefined}
                title={tip(n.label)}
              >
                {/* outline at rest, filled when selected — same as the tab bar */}
                <Icon name={active && n.icon !== 'you' ? `${n.icon}On` : n.icon} size={20} />
                <span className="dash-label">{n.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          className="dash-coach"
          onClick={(e) => {
            openSheet('coach');
            flyNox(e.currentTarget.querySelector('.mascot'));
          }}
          aria-label={collapsed ? 'Ask Nox, your therapy coach' : undefined}
          title={tip('Ask Nox')}
        >
          <span className="dash-coach-icon" aria-hidden="true">
            <Mascot size={28} state="idle" />
          </span>
          <span className="dash-coach-text dash-label">
            <span className="dash-coach-title">Ask Nox</span>
            <span className="dash-coach-sub">Your therapy coach</span>
          </span>
        </button>

      </aside>

      <main className="dash-main">
        <View key={tabNonce} />
      </main>

      <StatusPill />
    </div>
  );
}
