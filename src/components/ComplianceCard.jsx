/* Nocta — compliance outlook, for someone with an account who said they're in
 * an insurance compliance window (data/compliance.js decides who sees it).
 * Counted on calendar days from the day their window started, against their
 * plan's rule (Medicare's unless they set their own). One bar, one segment
 * per day of the 30-day stretch on show (met / under / still to come /
 * before the card, unknown); while the bar can still be reached, a marker
 * stands at the earliest day it can be, labelled underneath. Pass
 * `fixtureId` to show it as of a different night. */
import { useStore } from '../lib/store.jsx';
import { complianceAsOf, todayIso } from '../data/compliance.js';
import { dateForFixture, LAST_NIGHT } from '../data/history.js';
import { Rich } from './Rich.jsx';

export function ComplianceCard({ fixtureId }) {
  const { profile, openSheet } = useStore();
  // as of the night on show; on the newest one, counted up to today (the
  // days since the card's last night are "pending", not missed)
  const night = dateForFixture(fixtureId);
  const p = complianceAsOf(night, profile.answers, night === LAST_NIGHT ? todayIso() : night);
  const edit = (
    <button type="button" className="pj-edit" onClick={() => openSheet('compliancePlan')}>
      {p.needsStart ? 'Set it up' : 'Your plan'}
    </button>
  );

  // they're in a window, but Nocta doesn't know when it started yet
  if (p.needsStart) {
    return (
      <section className="projection" aria-label="Compliance">
        <div className="pj-eyebrow">Compliance</div>
        <h4>When did your compliance window start?</h4>
        <p>Nocta counts your nights from that day, against what your plan asks for. It takes a moment.</p>
        {edit}
      </section>
    );
  }

  const n = p.nights.length;
  // the marker sits in the middle of its day's segment
  const markerAt = p.marker != null ? ((p.marker - 0.5) / n) * 100 : null;
  const [first, middle, last] = p.scale;

  return (
    <section className="projection" aria-label="Compliance outlook">
      <div className="pj-top">
        <div className="pj-eyebrow">{p.eyebrow}</div>
        {edit}
      </div>
      <h4>
        <Rich text={p.headline} />
      </h4>
      <p>{p.body}</p>
      <div
        className="pj-track"
        role="img"
        aria-label={`Compliance per day: ${p.met} of these ${n} days had ${p.rule.minHours} or more hours`}
        style={{ '--n': n }}
      >
        {p.nights.map((status, i) => (
          <span key={i} className={`pj-seg ${status}`} style={{ '--i': i }} />
        ))}
        {markerAt != null && <span className="pj-marker" style={{ left: `${markerAt}%` }} aria-hidden="true" />}
      </div>
      {/* the marker's label wins over an end label it would run into */}
      <div className="pj-scale tnum">
        <span style={markerAt != null && markerAt < 30 ? { visibility: 'hidden' } : undefined}>{first}</span>
        {markerAt != null ? (
          <span className="pj-scale-mark" style={{ left: `${markerAt}%` }}>
            {middle}
          </span>
        ) : (
          <span>{middle}</span>
        )}
        <span style={markerAt != null && markerAt > 70 ? { visibility: 'hidden' } : undefined}>{last}</span>
      </div>
      {p.unknownNote && <p className="pj-note">{p.unknownNote}</p>}
      {p.pendingNote && <p className="pj-note">{p.pendingNote}</p>}
    </section>
  );
}
