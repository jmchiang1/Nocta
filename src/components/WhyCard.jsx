/* Nocta — the hero "why-card". One verdict + one action; forensic detail collapsed
 * into a tappable receipts row. Renders all five insight states. See docs/FEATURES.md. */
import { useState } from 'react';
import { Icon } from './Icons.jsx';
import { Mascot } from './Mascot.jsx';
import { Rich } from './Rich.jsx';
import { Sparkline } from './Charts.jsx';
import { RevealText } from '../lib/motion.jsx';

const STATE_CLASS = {
  anomaly: 'state-anomaly',
  steady: 'state-steady',
  win: 'state-win',
  escalation: 'state-escalation',
  insufficient_data: 'state-insufficient',
};

// steady & insufficient-data states carry no action box
const NO_ACTION = new Set(['steady', 'insufficient_data']);

// trust line (inside the expanded receipts): confidence as 1–3 bars plus a word, never a colour
const CONFIDENCE = { low: 1, medium: 2, high: 3 };

/* onAsk: optional — when given, the card ends with an "Ask Nocta" row. This
 * is the Coach's primary entry point: right after reading the verdict is
 * when "why?" and "what does that mean?" actually come up.
 * onDoctor: when the insight carries escalation_flag "hard", the action box
 * becomes the doctor path — a button that opens the doctor summary.
 * eyebrow: show the "Nocta Coach · Last night" byline (DESIGN_SYSTEM item 1). */
export function WhyCard({ insight, spark, sparkKind, onAsk, onDoctor, eyebrow = false }) {
  const [open, setOpen] = useState(false);
  const state = insight.card_state;
  const cls = STATE_CLASS[state] || 'state-insufficient';
  const showAction = !NO_ACTION.has(state) && insight.recommended_action;
  const doctorPath = insight.escalation_flag === 'hard' && onDoctor;
  const conf = CONFIDENCE[insight.confidence] || 1;

  return (
    <article
      className={`why-card ${cls} card-enter`}
      role="region"
      aria-label="Last night's insight"
    >
      {/* the verdict arrives a word at a time — the one place the AI "speaks"
       * on Tonight, so it gets the one expressive entrance */}
      {eyebrow && (
        <div className="why-eyebrow">
          <Mascot size={20} />
          <span>Nocta Coach · Last night</span>
        </div>
      )}
      <h2 className="headline">
        <RevealText text={insight.headline} />
      </h2>

      {spark && spark.length > 0 && (
        <div className="why-spark">
          <Sparkline values={spark} kinds={sparkKind} height={32} />
        </div>
      )}

      {showAction &&
        (doctorPath ? (
          <button className="action doctor" type="button" onClick={onDoctor}>
            <span className="action-text">
              <span className="action-title">Prepare doctor summary</span>
              {insight.recommended_action.action}
            </span>
          </button>
        ) : (
          <div className="action">
            <div className="action-text">{insight.recommended_action.action}</div>
          </div>
        ))}

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
            {/* confidence + disclaimer travel with the evidence: one tap away,
             * not on the card face (CLAUDE.md still requires both) */}
            <div className="trust">
              <span className="conf">
                <span className="bars" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={n <= conf ? 'on' : ''} />
                  ))}
                </span>
                {insight.confidence
                  ? `${insight.confidence[0].toUpperCase()}${insight.confidence.slice(1)} confidence`
                  : 'Low confidence'}
              </span>
              <span>Not medical advice</span>
            </div>
          </div>
        </div>
      </div>

      {onAsk && (
        <button className="ask-row" type="button" onClick={onAsk}>
          <Mascot size={22} />
          <span>Ask Nocta about last night</span>
          <Icon name="chevronRight" size={15} className="ask-chev" />
        </button>
      )}
    </article>
  );
}
