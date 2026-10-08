/* Nocta — secondary metrics: a 3-column row of compact cards with sparklines.
 * Read-only readouts — not tappable. (Coach lives on the why-card instead.) */
import { MetricSpark } from './Charts.jsx';
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
          <MetricSpark values={m.spark} hot={m.hot} />
        </section>
      ))}
    </div>
  );
}
