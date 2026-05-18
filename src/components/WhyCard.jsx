/* Nocta — the hero "why-card". One verdict + one action; forensic detail collapsed
 * into a tappable receipts row. Renders all five insight states. See docs/FEATURES.md. */
import { useState } from 'react';
import { Icon } from './Icons.jsx';
import { Rich } from './Rich.jsx';
import { Sparkline } from './Charts.jsx';

const STATE_CLASS = {
  anomaly: 'state-anomaly',
  steady: 'state-steady',
  win: 'state-win',
  escalation: 'state-escalation',
  insufficient_data: 'state-insufficient',
};

// steady & insufficient-data states carry no action box
const NO_ACTION = new Set(['steady', 'insufficient_data']);

export function WhyCard({ insight, spark, sparkKind }) {
  const [open, setOpen] = useState(false);
  const state = insight.card_state;
  const cls = STATE_CLASS[state] || 'state-insufficient';
  const showAction = !NO_ACTION.has(state) && insight.recommended_action;

  return (
    <article
      className={`why-card ${cls} card-enter`}
      role="region"
      aria-label="Last night's insight"
    >
      <h2 className="headline">
        <Rich text={insight.headline} />
      </h2>

      {spark && spark.length > 0 && (
        <div className="why-spark">
          <Sparkline values={spark} kinds={sparkKind} height={32} />
        </div>
      )}

      {showAction && (
        <div className="action">
          <span className="arrow" aria-hidden="true">
            →
          </span>
          <div className="action-text">{insight.recommended_action.action}</div>
        </div>
      )}

      <button
        className="receipts"
        type="button"
        aria-expanded={open}
        aria-controls="why-receipts-detail"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="receipts-text">
          <Rich text={insight.receipts} />
        </span>
        <Icon name="chevronDown" size={14} className="chev" />
      </button>
      <div className={`receipts-collapse${open ? ' open' : ''}`}>
        <div className="receipts-detail">
          <div id="why-receipts-detail" className="receipts-detail-inner">
            <Rich text={insight.observation} />
          </div>
        </div>
      </div>
    </article>
  );
}
