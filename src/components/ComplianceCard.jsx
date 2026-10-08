/* Nocta — compliance outlook: nights over 4 h toward the 21-of-30 insurance
 * bar, with the earliest night it can be cleared and a dot per night.
 * Leads the Therapy tab, as of the real last night. Pass `fixtureId` to
 * show it as of a different night (projectionAsOf in data/therapy.js). */
import { projectionAsOf } from '../data/therapy.js';
import { dateForFixture } from '../data/history.js';
import { Rich } from './Rich.jsx';
import { ProgressBar } from './Charts.jsx';

export function ComplianceCard({ fixtureId }) {
  const p = projectionAsOf(dateForFixture(fixtureId));
  return (
    <section className="projection" aria-label="Compliance outlook">
      <div className="pj-eyebrow">{p.eyebrow}</div>
      <h4>
        <Rich text={p.headline} />
      </h4>
      <p>{p.body}</p>
      <ProgressBar pct={p.progressPct} marker={p.targetPct} gradient height={8} />
      <div className="compliance-dots" role="img" aria-label={`Compliance status per night: ${p.met} of ${p.met + p.missed} nights over 4 hours`}>
        {p.nights.map((status, i) => (
          <span key={i} className={`compliance-dot ${status}`} style={{ '--i': i }} />
        ))}
      </div>
      <div className="pj-scale">
        {p.scale.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
    </section>
  );
}
