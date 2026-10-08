/* Nocta — demo-only control, on the stage outside the phone frame.
 * Switches between the onboarding flow and the app, picks which night
 * fixture the Tonight tab shows (exercises every why-card state), and holds
 * the prototype resets that used to sit inside the You tab.
 * Collapsed by default so the phone reads as a shipped app when presenting;
 * press D (or click the tab) to open it. R reloads the whole prototype —
 * the launch sync replays; onboarding/check-in state persists. */
import { useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES, FIXTURE_ORDER } from '../data/fixtures.js';

export function DevPanel() {
  const {
    onboarded,
    completeOnboarding,
    resetOnboarding,
    fixtureId,
    setFixtureId,
    viewMode,
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
      if (e.key === 'd' || e.key === 'D') setDevPanelOpen(!devPanelOpen);
      if (e.key === 'r' || e.key === 'R') window.location.reload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [devPanelOpen, setDevPanelOpen]);

  if (!devPanelOpen) {
    return (
      <button
        className="dev-handle"
        onClick={() => setDevPanelOpen(true)}
        aria-label="Open demo controls"
      >
        Demo <kbd>D</kbd>
      </button>
    );
  }

  return (
    <div className="dev-panel" role="group" aria-label="Demo controls">
      <div className="dp-top">
        <span className="dp-label">Demo</span>
        <button className="dp-close" onClick={() => setDevPanelOpen(false)} aria-label="Hide demo controls">
          Hide <kbd>D</kbd>
        </button>
      </div>

      <button className="dp-refresh" onClick={() => window.location.reload()}>
        Refresh <kbd>R</kbd>
      </button>

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">View</span>
      <button className={!onboarded ? 'on' : ''} onClick={resetOnboarding}>
        Onboarding
      </button>
      <button className={onboarded ? 'on' : ''} onClick={completeOnboarding}>
        App
      </button>

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">Layout</span>
      <button className={viewMode === 'mobile' ? 'on' : ''} onClick={() => setViewMode('mobile')}>
        Mobile
      </button>
      <button className={viewMode === 'desktop' ? 'on' : ''} onClick={() => setViewMode('desktop')}>
        Desktop
      </button>

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">Night</span>
      {FIXTURE_ORDER.map((id) => (
        <button
          key={id}
          className={onboarded && id === fixtureId ? 'on' : ''}
          onClick={() => {
            setFixtureId(id);
            completeOnboarding();
          }}
        >
          {FIXTURES[id].label}
        </button>
      ))}

      <span className="dp-sep" aria-hidden="true" />

      <span className="dp-label">Replay</span>
      <button
        onClick={() => {
          closeSheet();
          setTab('tonight');
          startSync();
        }}
        disabled={!onboarded}
      >
        Morning sync
      </button>
      <button onClick={resetCheckin} disabled={!checkin.done}>
        Reset check-in
      </button>
    </div>
  );
}
