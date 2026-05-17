/* Nocta — demo-only control, on the stage outside the phone frame.
 * Switches between the onboarding flow and the app, and picks which night
 * fixture the Tonight tab shows (exercises every why-card state). */
import { useStore } from '../lib/store.jsx';
import { FIXTURES, FIXTURE_ORDER } from '../data/fixtures.js';

export function DevPanel() {
  const { onboarded, completeOnboarding, resetOnboarding, fixtureId, setFixtureId } = useStore();

  return (
    <div className="dev-panel" role="group" aria-label="Demo controls">
      <span className="dp-label">View</span>
      <button className={!onboarded ? 'on' : ''} onClick={resetOnboarding}>
        Onboarding
      </button>
      <button className={onboarded ? 'on' : ''} onClick={completeOnboarding}>
        App
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
    </div>
  );
}
