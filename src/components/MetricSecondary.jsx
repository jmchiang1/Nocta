/* Nocta — secondary metrics: a 3-column row of compact readouts. Each carries
 * its own reference line ("Usually about 11"), so no extra mini-graph.
 * Read-only — not tappable. */
import { CountUp } from '../lib/motion.jsx';

export function MetricSecondary({ items }) {
  return (
    <div className="metrics-row">
      {items.map((m, i) => (
        <section key={m.key} className="metric card-enter" aria-label={m.label}>
          <div className="m-label">{m.label}</div>
          <div className="m-value tnum">
            <CountUp value={m.value} delay={200 + i * 60} />
            {m.unit && <span className="u">{m.unit}</span>}
          </div>
          <div className="m-unit">{m.sub}</div>
        </section>
      ))}
    </div>
  );
}
