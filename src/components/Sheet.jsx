/* Nocta — modal slide-up sheet. Animates in on mount and out on close.
 * `children` / `footer` may be a render function receiving `close` so in-content
 * buttons trigger the same smooth dismissal.
 *
 * `variant`: 'sheet' (default) slides up from the bottom; 'page' pushes in from
 * the right edge — used for navigation drill-downs off the You tab (Account,
 * Settings, Device Detail) where the surface is hierarchical rather than modal.
 *
 * Gestures: a sheet can be dragged down by its grip/header to dismiss; a page
 * can be swiped right from its header or left edge to go back (iOS-style).
 * Past the threshold — or flicked fast enough — it closes; otherwise it springs
 * back. Escape also closes. */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';
import { StatusBar } from './StatusBar.jsx';
import { useStore } from '../lib/store.jsx';

const EXIT_MS = 300;
const DRAG_SLOP = 6; // px of travel before a press becomes a drag
const DISMISS_PX = 110;
const DISMISS_VELOCITY = 0.55; // px/ms

export function Sheet({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  footerClass,
  full = false,
  headRight,
  variant = 'sheet',
  className = '',
}) {
  const { setSheetLeaving } = useStore();
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const sheetRef = useRef(null);
  const scrimRef = useRef(null);
  const drag = useRef(null);

  const isPage = variant === 'page';
  const isFull = full || isPage;

  const closingRef = useRef(false);
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setSheetLeaving(true);
    setTimeout(onClose, EXIT_MS);
  }, [onClose, setSheetLeaving]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  /* ---- drag-to-dismiss ----
   * Moves are tracked on window from pointerdown on, so a fast swipe that
   * leaves the small grab zone (the 22px page edge especially) still counts.
   * No pointer capture: the close/back buttons inside the header must keep
   * receiving their own clicks. */
  function onPointerDown(e) {
    // gestures are a phone affordance — the desktop modal reuses this markup
    if (closing || !entered || e.button > 0 || !sheetRef.current?.closest('.phone')) return;
    if (e.currentTarget.classList.contains('sheet-edge')) e.preventDefault(); // no text selection
    const g = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      active: false,
      d: 0,
      v: 0,
    };
    drag.current = g;

    const move = (ev) => {
      if (ev.pointerId !== g.id) return;
      const raw = isPage ? ev.clientX - g.x0 : ev.clientY - g.y0;
      if (!g.active) {
        const cross = isPage ? ev.clientY - g.y0 : ev.clientX - g.x0;
        if (Math.abs(raw) < DRAG_SLOP || Math.abs(cross) > Math.abs(raw)) return;
        g.active = true;
        sheetRef.current.style.transition = 'none';
        sheetRef.current.classList.add('dragging');
      }
      // resist dragging the wrong way with a soft rubber band
      const d = raw > 0 ? raw : raw * 0.15;
      g.d = d;
      g.v = d / Math.max(1, performance.now() - g.t0);
      sheetRef.current.style.transform = isPage ? `translateX(${d}px)` : `translateY(${d}px)`;
      if (scrimRef.current) {
        const size = isPage ? sheetRef.current.offsetWidth : sheetRef.current.offsetHeight;
        scrimRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, d) / size));
      }
    };

    const end = (ev) => {
      if (ev.pointerId !== g.id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      drag.current = null;
      if (!g.active) return;
      const el = sheetRef.current;
      el.classList.remove('dragging');
      if (g.d > DISMISS_PX || g.v > DISMISS_VELOCITY) {
        // the exit keyframes only declare `to`, so they start from the
        // dragged position instead of snapping back first
        close();
        return;
      }
      el.style.transition = `transform 420ms var(--ease-spring)`;
      el.style.transform = '';
      if (scrimRef.current) {
        scrimRef.current.style.transition = 'opacity 300ms ease';
        scrimRef.current.style.opacity = '';
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  const dragHandlers = { onPointerDown };

  const body = typeof children === 'function' ? children(close) : children;
  const foot = typeof footer === 'function' ? footer(close) : footer;

  return (
    <>
      <div ref={scrimRef} className={`sheet-scrim${closing ? ' closing' : ''}`} onClick={close} />
      <div
        ref={sheetRef}
        className={`sheet${className ? ` ${className}` : ''}${isFull ? ' full' : ''}${isPage ? ' page' : ''}${entered ? ' entered' : ''}${
          closing ? ' closing' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && !closing) setEntered(true);
        }}
      >
        {/* full-height pages cover the app's status bar, so they carry their own */}
        {isFull && <StatusBar />}
        {isPage && <div className="sheet-edge" aria-hidden="true" {...dragHandlers} />}
        <div className="sheet-drag" {...dragHandlers}>
          {!isFull && <div className="sheet-grip" />}
          {/* pushed pages navigate *back* (chevron, leading edge, iOS-style);
           * modals dismiss with an X on the trailing edge */}
          <div className={`sheet-head${isPage ? ' with-back' : ''}`}>
            {isPage && (
              <button className="sheet-back glass" onClick={close} aria-label="Back">
                <Icon name="chevronLeft" size={19} />
              </button>
            )}
            {/* pages: centred nav title with the eyebrow as a quiet subtitle
             * underneath; modals keep the left-aligned eyebrow-over-title */}
            <div className="sheet-title">
              {eyebrow && !isPage && <div className="eyebrow">{eyebrow}</div>}
              <h3>{title}</h3>
              {eyebrow && isPage && <div className="sheet-subtitle">{eyebrow}</div>}
            </div>
            {headRight ||
              (!isPage && (
                <button className="sheet-close glass" onClick={close} aria-label="Close">
                  <Icon name="x" size={17} />
                </button>
              ))}
          </div>
        </div>
        <div className="sheet-body">{body}</div>
        {foot && (
          <div className={`sheet-foot${footerClass ? ` ${footerClass}` : ''}`}>{foot}</div>
        )}
      </div>
    </>
  );
}
