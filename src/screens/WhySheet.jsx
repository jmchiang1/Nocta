/* Nocta — "Why Nocta thinks this": the reasoning behind last night's
 * insight, one tap from the info button on Tonight. Evidence with its
 * numbers, confidence and the disclaimer travel together (CLAUDE.md:
 * every insight cites its data, carries a confidence label and the footer). */
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { Sheet } from '../components/Sheet.jsx';
import { Rich } from '../components/Rich.jsx';
import { Icon } from '../components/Icons.jsx';

const CONFIDENCE = { low: 1, medium: 2, high: 3 };

export function WhySheet() {
  const { fixtureId, closeSheet, openSheet, setTab } = useStore();
  const fx = FIXTURES[fixtureId];
  const insight = fx.insight;
  const conf = CONFIDENCE[insight.confidence] || 1;
  const confLabel = insight.confidence
    ? `${insight.confidence[0].toUpperCase()}${insight.confidence.slice(1)} confidence`
    : 'Low confidence';

  return (
    <Sheet
      eyebrow="Nox · last night"
      title="Why Nox thinks this"
      onClose={closeSheet}
      footer={(close) => (
        <button
          className="btn ghost"
          onClick={() => {
            close();
            setTimeout(() => openSheet('coach', { context: { kind: 'why' } }), 320);
          }}
        >
          Ask Nox about last night
        </button>
      )}
    >
      {(close) => (
      <div className="why-sheet">
        <p className="ws-receipts tnum">
          <Rich text={insight.receipts} />
        </p>
        <p className="ws-observation">
          <Rich text={insight.observation} />
        </p>
        {/* multi-night patterns live on Trends; this links the night to one */}
        {fx.pattern && (
          <button
            className="ws-pattern"
            type="button"
            onClick={() => {
              close();
              setTimeout(() => setTab('trends'), 320);
            }}
          >
            <span>This fits a pattern Nox is watching</span>
            <span className="ws-pattern-go">
              Trends
              <Icon name="chevronRight" size={15} />
            </span>
          </button>
        )}
        <div className="ws-trust">
          <span className="ws-conf">
            <span className="ws-bars" aria-hidden="true">
              {[1, 2, 3].map((k) => (
                <span key={k} className={k <= conf ? 'on' : ''} />
              ))}
            </span>
            {confLabel}
          </span>
          <span>Not medical advice</span>
        </div>
      </div>
      )}
    </Sheet>
  );
}
