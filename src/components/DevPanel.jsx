/* Nocta — demo-only control, floating over the app. Switches between the
 * onboarding flow and the app, forces the mobile or desktop layout (Auto
 * follows the window width), and holds the prototype resets that used to sit
 * inside the You tab.
 * Collapsed by default so the app reads as shipped when presenting.
 * Keys work whether it's open or not:
 *   H  hide / show the panel        M  mobile layout    D  desktop layout
 *   O  onboarding                   A  the app          R  reload the prototype
 * (M / D again returns to Auto; a reload replays the launch sync;
 * onboarding/check-in state persists). */
import { useEffect } from 'react';
import { useStore } from '../lib/store.jsx';

export function DevPanel() {
  const {
    onboarded,
    completeOnboarding,
    resetOnboarding,
    layoutPref,
    setViewMode,
    devPanelOpen,
    setDevPanelOpen,
    checkin,
    resetCheckin,
    startSync,
    setTab,
    closeSheet,
  } = useStore();

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        return;
      }
      // leave browser shortcuts (⌘R, ctrl+D…) alone
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // the same actions as the panel's buttons
      const key = e.key.toLowerCase();
      if (key === 'h') setDevPanelOpen(!devPanelOpen);
      // M / D force a layout; pressing the forced one again goes back to Auto
      else if (key === 'm') setViewMode(layoutPref === 'mobile' ? 'auto' : 'mobile');
      else if (key === 'd') setViewMode(layoutPref === 'desktop' ? 'auto' : 'desktop');
      else if (key === 'o') resetOnboarding();
      else if (key === 'a') completeOnboarding();
      else if (key === 'r') window.location.reload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [devPanelOpen, setDevPanelOpen, layoutPref, setViewMode, resetOnboarding, completeOnboarding]);

  if (!devPanelOpen) {
    return (
      <button
        className="dev-handle"
        onClick={() => setDevPanelOpen(true)}
        aria-label="Open demo controls"
      >
        Demo <kbd>H</kbd>
      </button>
    );
  }

  return (
    <div className="dev-panel" role="group" aria-label="Demo controls">
      <div className="dp-top">
        <span className="dp-label">Demo</span>
        <button className="dp-close" onClick={() => setDevPanelOpen(false)} aria-label="Hide demo controls">
          Hide <kbd>H</kbd>
        </button>
      </div>

      <button className="dp-refresh" onClick={() => window.location.reload()}>
        Refresh <kbd>R</kbd>
      </button>

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">View</span>
      <button className={!onboarded ? 'on' : ''} onClick={resetOnboarding}>
        Onboarding <kbd>O</kbd>
      </button>
      <button className={onboarded ? 'on' : ''} onClick={completeOnboarding}>
        App <kbd>A</kbd>
      </button>

      <span className="dp-sep" aria-hidden="true" />

      {/* Auto follows the window width; Mobile / Desktop force one */}
      <span className="dp-label">Layout</span>
      <button className={layoutPref === 'auto' ? 'on' : ''} onClick={() => setViewMode('auto')}>
        Auto
      </button>
      <button className={layoutPref === 'mobile' ? 'on' : ''} onClick={() => setViewMode('mobile')}>
        Mobile <kbd>M</kbd>
      </button>
      <button className={layoutPref === 'desktop' ? 'on' : ''} onClick={() => setViewMode('desktop')}>
        Desktop <kbd>D</kbd>
      </button>

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">Replay</span>
      <button
        onClick={() => {
          closeSheet();
          setTab('tonight');
          startSync({ title: 'Bringing in last night', sub: 'SD card · AirSense 11 AutoSet' });
        }}
        disabled={!onboarded}
      >
        Import sync
      </button>
      <button onClick={resetCheckin} disabled={!checkin.done}>
        Reset check-in
      </button>
    </div>
  );
}
