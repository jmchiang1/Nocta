/* Nocta — the chrome every tab screen shares.
 *  - Content scrolls *under* the status bar, iOS-style.
 *  - Once the large page title scrolls away, a compact title bar fades in
 *    over a blurred backdrop so you always know where you are.
 *  - Scrolling down compacts the tab bar (it shrinks toward the bottom edge,
 *    never leaves); scrolling up — or reaching the top or bottom — restores it.
 *  - Optional pull-to-refresh (`onRefresh`): works with a mouse/touch drag
 *    and with a trackpad two-finger pull at the top of the page, so it demos
 *    on a laptop. While `refreshing`, the moon spinner holds in the gap. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { StatusBar } from './StatusBar.jsx';
import { Icon } from './Icons.jsx';

const COMPACT_AT = 64; // px scrolled before the compact title appears
/* tab bar compact/full: compacting needs a deliberate, sustained scroll down
 * (so a small nudge while reading doesn't shrink the nav); restoring is quick */
const BAR_HIDE_AFTER = 80; // px of continuous downward travel before it compacts
const BAR_HIDE_BELOW = 160; // never compact while this close to the top
const BAR_SHOW_AFTER = 12; // px of upward travel before it's full size again
const BAR_SHOW_NEAR = 40; // always full size this close to the top/bottom
const PULL_TRIGGER = 72;
const PULL_MAX = 120;
const HOLD_AT = 58;

// diminishing returns the further you pull, like a rubber band
const rubber = (d) => PULL_MAX * (1 - Math.exp(-d / (PULL_MAX * 1.4)));

/* `sky`: Tonight's ambient twilight backdrop — fixed behind the content,
 * drifting slowly, fading (with a little parallax) as you scroll. The same
 * every night: it sets a mood, it never encodes how the night went. */
export function ScreenFrame({ title, children, onRefresh, refreshing = false, className = '', sky = false }) {
  const { setTabBarHidden } = useStore();
  const scrollRef = useRef(null);
  const [compact, setCompact] = useState(false);
  const prevY = useRef(0);
  const dir = useRef(0); // +1 scrolling down, -1 scrolling up
  const anchor = useRef(0); // scrollTop where the current direction began

  function onScroll(e) {
    const el = e.currentTarget;
    const y = el.scrollTop;
    // drives the sky's fade/parallax in CSS without re-rendering
    el.parentElement.style.setProperty('--sy', String(Math.min(y, 600)));
    setCompact(y > COMPACT_AT);
    const delta = y - prevY.current;
    prevY.current = y;
    if (delta === 0) return;
    const d = delta > 0 ? 1 : -1;
    if (d !== dir.current) {
      dir.current = d;
      anchor.current = y - delta;
    }
    const nearEdge = y < BAR_SHOW_NEAR || y + el.clientHeight > el.scrollHeight - BAR_SHOW_NEAR;
    if (nearEdge) setTabBarHidden(false);
    else if (d > 0 && y > BAR_HIDE_BELOW && y - anchor.current > BAR_HIDE_AFTER) setTabBarHidden(true);
    else if (d < 0 && anchor.current - y > BAR_SHOW_AFTER) setTabBarHidden(false);
  }
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const wheel = useRef({ acc: 0, last: 0, armed: false, timer: null });

  // only hold the spinner open for a refresh the user pulled for — a sync
  // started elsewhere (app launch) shouldn't shove the page down
  const [pulled, setPulled] = useState(false);
  useEffect(() => {
    if (!refreshing) setPulled(false);
  }, [refreshing]);
  const holding = refreshing && pulled;

  const armedPast = pull >= PULL_TRIGGER;

  function release(distance) {
    setDragging(false);
    if (distance >= PULL_TRIGGER && onRefresh) {
      setPulled(true);
      onRefresh();
    }
    setPull(0);
  }

  /* ---- pointer (mouse / touch) ---- */
  function onPointerDown(e) {
    if (!onRefresh || refreshing || e.button > 0) return;
    if (scrollRef.current.scrollTop > 0) return;
    gesture.current = { id: e.pointerId, y0: e.clientY, active: false };
  }
  function onPointerMove(e) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y0;
    if (!g.active) {
      if (dy < 8) {
        if (dy < -4) gesture.current = null; // scrolling up — not a pull
        return;
      }
      g.active = true;
      setDragging(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setPull(rubber(Math.max(0, dy)));
  }
  function onPointerUp() {
    const g = gesture.current;
    gesture.current = null;
    if (g?.active) release(pull);
  }

  /* ---- trackpad: a two-finger pull at the very top arrives as wheel
   * events with negative deltaY. Only arm when the gesture *starts* at the
   * top, so momentum from a fast scroll-up can't trigger a refresh. ---- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onRefresh) return undefined;
    const w = wheel.current;
    const onWheel = (e) => {
      if (refreshing) return;
      const now = performance.now();
      const newGesture = now - w.last > 220;
      w.last = now;
      if (newGesture) {
        w.armed = el.scrollTop <= 0 && e.deltaY < 0;
        w.acc = 0;
      }
      if (!w.armed) return;
      if (e.deltaY > 0 && w.acc <= 0) {
        w.armed = false;
        return;
      }
      w.acc = Math.max(0, w.acc - e.deltaY * 0.6);
      setDragging(true);
      setPull(rubber(w.acc));
      clearTimeout(w.timer);
      w.timer = setTimeout(() => {
        w.armed = false;
        const d = rubber(w.acc);
        w.acc = 0;
        release(d);
      }, 160);
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(w.timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefresh, refreshing]);

  const offset = holding ? HOLD_AT : pull;
  const progress = Math.min(1, offset / PULL_TRIGGER);

  return (
    <div className={`screen framed${compact ? ' scrolled' : ''}${className ? ` ${className}` : ''}`}>
      {sky && (
        <div className="sky" aria-hidden="true">
          <span className="sky-glow a" />
          <span className="sky-glow b" />
          <span className="sky-glow c" />
          <span className="sky-stars" />
        </div>
      )}
      <StatusBar />
      <div className="compact-bar" aria-hidden={!compact}>
        <span className="cb-title">{title}</span>
      </div>


      {onRefresh && (
        <div
          className={`ptr${holding ? ' refreshing' : ''}${armedPast ? ' armed' : ''}${
            dragging ? ' dragging' : ''
          }`}
          style={{ opacity: holding ? 1 : progress, '--ptr-y': `${offset}px` }}
          aria-hidden="true"
        >
          <span className="ptr-ring" style={{ '--p': progress }} />
          <span className="ptr-moon" style={{ transform: `rotate(${progress * -40}deg)` }}>
            <Icon name="moon" size={16} />
          </span>
        </div>
      )}

      <div
        ref={scrollRef}
        className={`scroll${dragging ? ' pulling' : ''}`}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={`scroll-content${dragging ? ' dragging' : ''}`}
          style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
