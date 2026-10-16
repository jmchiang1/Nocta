/* Nocta — the chrome every tab screen shares.
 *  - Content scrolls *under* the status bar, iOS-style.
 *  - Once the large page title scrolls away, a compact title bar fades in
 *    over a blurred backdrop so you always know where you are.
 *  - Scrolling down compacts the tab bar (it shrinks toward the bottom edge,
 *    never leaves); scrolling up — or reaching the top or bottom — restores it.
 *  - No pull-to-refresh: data only arrives by SD card import (Therapy), so
 *    there's nothing for a pull to fetch. */
import { useRef, useState } from 'react';
import { StatusBar } from './StatusBar.jsx';
import { TonightSky } from './NightSky.jsx';

const COMPACT_AT = 64; // px scrolled before the compact title appears

/* `sky`: Tonight's night-sky backdrop (components/NightSky.jsx), pinned to
 * the top of the screen behind the content. Pass a weather condition
 * ('clear' | 'bright' | 'hazy' | 'overcast' | 'faint') — it reflects the
 * night as weather, never as a red/green grade — or `true` for 'clear'.
 * `stickyTitle`: keep a compact title pinned once the page title scrolls away
 * (Tonight only — its day and date). Other tabs just scroll, with a short fade
 * under the status bar so content never runs into the clock. */
export function ScreenFrame({ title, children, className = '', sky = false, stickyTitle = false }) {
  const scrollRef = useRef(null);
  const [compact, setCompact] = useState(false);

  function onScroll(e) {
    const el = e.currentTarget;
    const y = el.scrollTop;
    // 0 → 1 over the first COMPACT_AT px; on sky screens it fades content out
    // under the clear title bar (CSS mask) without re-rendering
    el.style.setProperty('--k', Math.min(1, y / COMPACT_AT).toFixed(3));
    setCompact(y > COMPACT_AT);
    // the tab bar stays as it is while scrolling (it no longer tucks away)
  }

  return (
    <div
      className={`screen framed${compact ? ' scrolled' : ''}${stickyTitle ? ' sticky-title' : ' no-sticky'}${className ? ` ${className}` : ''}`}
    >
      {sky && <TonightSky condition={sky === true ? 'clear' : sky} />}
      <StatusBar />
      {stickyTitle && (
        <div className="compact-bar" aria-hidden={!compact}>
          <span className="cb-title">{title}</span>
        </div>
      )}

      <div ref={scrollRef} className="scroll" onScroll={onScroll}>
        <div className="scroll-content">{children}</div>
      </div>
    </div>
  );
}
