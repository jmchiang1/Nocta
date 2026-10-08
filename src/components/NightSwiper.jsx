/* Nocta — swipe between nights on the hero card.
 * Drag the why-card sideways (finger or mouse), or two-finger swipe on a
 * trackpad: it follows you, the week strip's highlight slides toward the
 * neighbouring night as you go, and past the threshold it lands on that
 * night. Left = the next (later) night, right = the previous one. At the
 * first/last night it rubber-bands instead.
 * Taps inside the card (receipts, Ask Nocta) still work — a click that ends
 * a real drag is swallowed. */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { prefersReducedMotion } from '../lib/motion.jsx';

const SLOP = 8; // px before a press becomes a horizontal drag
const COMMIT = 0.24; // fraction of card width that commits the swipe
const FLICK = 0.5; // px/ms that commits regardless of distance

export function NightSwiper({ children }) {
  const { fixtureId, setFixtureId, nightOrder, nightDir, setNightDrag } = useStore();
  const ref = useRef(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const idx = nightOrder.indexOf(fixtureId);
  const hasNext = idx < nightOrder.length - 1;
  const hasPrev = idx > 0;

  // resistance past the ends, so the card still answers but can't go anywhere
  const resist = (d) => ((d < 0 && !hasNext) || (d > 0 && !hasPrev) ? d * 0.22 : d);

  const report = (d) => {
    const w = ref.current?.offsetWidth || 1;
    setDx(d);
    setNightDrag(Math.max(-1, Math.min(1, -d / w)));
  };

  const settle = (d, v = 0) => {
    const w = ref.current?.offsetWidth || 1;
    const dir = d < 0 ? 1 : -1;
    const ok = dir > 0 ? hasNext : hasPrev;
    setDragging(false);
    report(0);
    if (ok && (Math.abs(d) > w * COMMIT || Math.abs(v) > FLICK)) {
      setFixtureId(nightOrder[idx + dir]);
    }
  };

  /* ---- pointer drag ---- */
  function onPointerDown(e) {
    if (e.button > 0) return;
    const g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), active: false, d: 0 };
    const move = (ev) => {
      if (ev.pointerId !== g.id) return;
      const ddx = ev.clientX - g.x0;
      const ddy = ev.clientY - g.y0;
      if (!g.active) {
        if (Math.abs(ddx) < SLOP || Math.abs(ddx) < Math.abs(ddy) * 1.2) {
          if (Math.abs(ddy) > SLOP) cleanup(); // it's a vertical scroll
          return;
        }
        g.active = true;
        setDragging(true);
      }
      g.d = resist(ddx);
      report(g.d);
    };
    const up = (ev) => {
      if (ev.pointerId !== g.id) return;
      cleanup();
      if (!g.active) return;
      // swallow the click that would otherwise land on whatever was pressed
      window.addEventListener('click', (c) => c.stopPropagation(), { capture: true, once: true });
      settle(g.d, g.d / Math.max(1, performance.now() - g.t0));
    };
    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /* ---- trackpad two-finger horizontal swipe ---- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let acc = 0;
    let timer = null;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault(); // don't let the browser treat it as back/forward
      acc -= e.deltaX;
      setDragging(true);
      report(resist(acc));
      clearTimeout(timer);
      timer = setTimeout(() => {
        const d = resist(acc);
        acc = 0;
        settle(d);
      }, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(timer);
    };
    // re-bind when the night changes so resist()/settle() see fresh neighbours
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  const w = ref.current?.offsetWidth || 360;
  const enter = prefersReducedMotion() || !nightDir ? '' : nightDir > 0 ? ' enter-next' : ' enter-prev';

  return (
    <div
      ref={ref}
      className={`night-swiper${dragging ? ' dragging' : ''}${enter}`}
      onPointerDown={onPointerDown}
      style={{
        transform: dx ? `translateX(${dx}px) rotate(${dx / 160}deg)` : undefined,
        opacity: dx ? 1 - Math.min(0.35, Math.abs(dx) / w / 2) : undefined,
      }}
    >
      {children}
    </div>
  );
}
