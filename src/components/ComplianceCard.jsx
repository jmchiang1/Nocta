/* Nocta — compliance outlook: nights over 4 h toward the 21-of-30 insurance
 * bar. One bar, one segment per night of the 30-night window (green = 4+ h,
 * coral = under, dim = still to come), so the bar and the per-night status
 * are the same thing and can't disagree. In the first 30 nights a marker
 * stands at the earliest night compliance can be cleared, with its label
 * directly under it. Leads the Therapy tab, as of the real last night; pass
 * `fixtureId` to show it as of a different night (projectionAsOf). */
import { projectionAsOf } from '../data/therapy.js';
import { dateForFixture } from '../data/history.js';
import { Rich } from './Rich.jsx';

export function ComplianceCard({ fixtureId }) {
  const p = projectionAsOf(dateForFixture(fixtureId));
  const n = p.nights.length;
  // the marker sits in the middle of its night's segment
  const markerAt = p.earliest != null && p.earliest <= n ? ((p.earliest - 0.5) / n) * 100 : null;
  const [first, middle, last] = p.scale;

  return (
    <section className="projection" aria-label="Compliance outlook">
      <div className="pj-eyebrow">{p.eyebrow}</div>
      <h4>
        <Rich text={p.headline} />
      </h4>
      <p>{p.body}</p>
      <div
        className="pj-track"
        role="img"
        aria-label={`Compliance per night: ${p.met} of ${p.met + p.missed} nights over 4 hours`}
        style={{ '--n': n }}
      >
        {p.nights.map((status, i) => (
          <span key={i} className={`pj-seg ${status}`} style={{ '--i': i }} />
        ))}
        {markerAt != null && <span className="pj-marker" style={{ left: `${markerAt}%` }} aria-hidden="true" />}
      </div>
      <div className="pj-scale tnum">
        <span>{first}</span>
        {markerAt != null ? (
          <span className="pj-scale-mark" style={{ left: `${markerAt}%` }}>
            {middle}
          </span>
        ) : (
          <span>{middle}</span>
        )}
        <span>{last}</span>
      </div>
    </section>
  );
}
