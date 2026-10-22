/* Nocta — desktop dashboard shell. Persistent left sidebar + a main view that
 * swaps with the active tab. Shares the same store state as the mobile app, so
 * the Mobile/Desktop toggle keeps you on the same night and tab. */
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { Mascot } from '../Mascot.jsx';
import { StatusPill } from '../StatusPill.jsx';
import { prefersReducedMotion } from '../../lib/motion.jsx';
import { noxLand } from '../../lib/sound.js';
import { DesktopTonight } from './DesktopTonight.jsx';
import { DesktopNoNights } from '../NoNights.jsx';
import { DesktopTrends } from './DesktopTrends.jsx';
import { DesktopTherapy } from './DesktopTherapy.jsx';
import { DesktopYou } from './DesktopYou.jsx';
import { DesktopFullNight } from './DesktopFullNight.jsx';

const NAV = [
  { id: 'tonight', label: 'Tonight', icon: 'tonight' },
  { id: 'trends', label: 'Trends', icon: 'trends' },
  { id: 'therapy', label: 'Therapy', icon: 'therapy' },
  { id: 'you', label: 'You', icon: 'you' },
];

const FLIGHT_MS = 1300;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* a fading peach speck where Nox just was (styles: .nox-sparkle) */
function sparkle(x, y, n) {
  const el = document.createElement('span');
  el.className = `nox-sparkle${n % 3 === 0 ? ' star' : ''}`;
  const size = 5 + Math.random() * 6;
  Object.assign(el.style, {
    left: `${x + (Math.random() - 0.5) * 14 - size / 2}px`,
    top: `${y + (Math.random() - 0.5) * 14 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  });
  el.addEventListener('animationend', () => el.remove());
  document.body.appendChild(el);
}

/* Nox flies from the sidebar's Ask Nox into the coach dialog, a little
 * showily: he crouches, springs up, swoops through a loop-de-loop with his
 * eyes squeezed shut and a trail of sparkles, then lands with a squash and
 * becomes the dialog's intro mascot. The dialog is still popping in while he
 * flies, so the landing spot is re-measured every frame. */
function flyNox(fromEl) {
  if (!fromEl || prefersReducedMotion()) return;
  const from = fromEl.getBoundingClientRect();
  const c0 = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const ghost = fromEl.cloneNode(true);
  ghost.classList.add('nox-flyer');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    zIndex: 800,
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    willChange: 'transform',
  });
  document.body.appendChild(ghost);
  // opacity, not visibility: the copy draws through the original's SVG mask,
  // and a hidden original would hide the mask's contents with it
  fromEl.style.opacity = '0';

  const CROUCH = 0.12; // anticipation, before take-off
  const LAND = 0.86; // touch-down squash after this
  const LOOP_R = 70;
  let target = null;
  let lastSpark = 0;
  let landed = false;
  let sparks = 0;
  const t0 = performance.now();

  const step = (now) => {
    target = target?.isConnected ? target : document.querySelector('.desktop-modal-wrap .ci-avatar .mascot');
    if (target) target.style.visibility = 'hidden';
    const t = Math.min(1, (now - t0) / FLIGHT_MS);
    // until the dialog's mascot exists, aim at the window's centre
    const to = target?.getBoundingClientRect() ?? { left: innerWidth / 2 - 32, top: innerHeight / 2 - 32, width: 64, height: 64 };
    const c1 = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    const end = to.width / from.width;

    let dx = 0;
    let dy = 0;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let shut = false;
    if (t < CROUCH) {
      // crouch: squash down and lean back, winding up
      const a = easeInOut(t / CROUCH);
      sx = 1 + 0.18 * a;
      sy = 1 - 0.24 * a;
      dx = -5 * a;
      dy = 4 * a;
      rot = 12 * a;
    } else if (t < LAND) {
      const f = (t - CROUCH) / (LAND - CROUCH);
      // three beats: speed up to the loop point, loop-de-loop there (barely
      // drifting on, so it reads as a loop and not a wiggle), then swoop the
      // rest of the way in and slow to land. The speeds roughly match at the
      // joins, so the momentum carries through.
      const L0 = 0.25;
      const L1 = 0.68;
      const lu = clamp01((f - L0) / (L1 - L0)); // the loop, at an even pace
      const k =
        f < L0
          ? 0.4 * Math.pow(f / L0, 2)
          : f < L1
            ? 0.4 + 0.08 * lu
            : 0.48 + 0.52 * (1 - Math.pow(1 - (f - L1) / (1 - L1), 3));
      dx = (c1.x - c0.x) * k;
      dy = (c1.y - c0.y) * k - Math.sin(Math.PI * k) * 110; // the big arc
      const th = 2 * Math.PI * lu;
      dx += LOOP_R * Math.sin(th);
      dy -= LOOP_R * (1 - Math.cos(th));
      const s = 1 + (end - 1) * k;
      const stretch = 0.08 * Math.sin(Math.PI * f); // longer while he's fast
      sx = s * (1 - stretch);
      sy = s * (1 + stretch);
      rot = 12 * (1 - k) - 360 * lu; // he rolls with the loop
      shut = lu > 0.02 && lu < 0.98;
      if (now - lastSpark > 28) {
        lastSpark = now;
        sparkle(c0.x + dx, c0.y + dy, sparks++);
      }
    } else {
      if (!landed) {
        landed = true;
        noxLand(); // he touches down in the dialog
      }
      // touch down: squash, then settle at the dialog's size
      const g = (t - LAND) / (1 - LAND);
      const b = Math.sin(Math.PI * g);
      dx = c1.x - c0.x;
      dy = c1.y - c0.y + 5 * b;
      sx = end * (1 + 0.16 * b);
      sy = end * (1 - 0.2 * b);
    }
    ghost.classList.toggle('wheee', shut);
    ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
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


/* the full night replaces the view it was opened from, with no slide (the
 * user's call: the transition read as a glitch). Each way it starts at the
 * top, reset before the first paint so nothing jumps. */
function useNightSwap(nightOpen) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [nightOpen]);
}

export function DesktopApp() {
  const { tab, setTab, tabNonce, openSheet, sheets, closeAllSheets, hasData } = useStore();
  const [collapsed, toggleCollapsed] = useCollapsed();
  // no nights (an account with no card yet): Tonight and Trends say so instead
  const View = !hasData && (tab === 'tonight' || tab === 'trends') ? DesktopNoNights : VIEWS[tab] || DesktopTonight;
  // the full night is a page here, over the current view (kept mounted, so
  // coming back finds it as it was); back from it lands at the top
  const nightOpen = sheets.some((s) => s.kind === 'fullnight');
  useNightSwap(nightOpen);
  // collapsed, the labels are hidden — the native tooltip names each icon
  const tip = (label) => (collapsed ? label : undefined);

  return (
    <div className={`dash${collapsed ? ' collapsed' : ''}`}>
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-logo" aria-hidden="true">
            <img src="/nocta-mark-sm.svg" alt="" />
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
                onClick={() => {
                  if (nightOpen) closeAllSheets();
                  setTab(n.id);
                }}
                aria-current={active && !nightOpen ? 'page' : undefined}
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

      <main className="dash-main" data-page={nightOpen ? 'fullnight' : !hasData && (tab === 'tonight' || tab === 'trends') ? 'empty' : tab}>
        <div hidden={nightOpen}>
          <View key={tabNonce} tab={tab} />
        </div>
        {nightOpen && <DesktopFullNight />}
      </main>

      <StatusPill />
    </div>
  );
}
