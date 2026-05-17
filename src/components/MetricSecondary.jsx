/* Nocta — secondary metrics: a 3-column row of compact cards with sparklines. */
import { MetricSpark } from './Charts.jsx';

export function MetricSecondary({ items, onMetric }) {
  return (
    <div className="metrics-row">
      {items.map((m) => (
        <button
          key={m.key}
          className="metric card-enter"
          onClick={() => onMetric && onMetric(m.label)}
        >
          <div className="m-label">{m.label}</div>
          <div className="m-value tnum">
            {m.value}
            {m.unit && <span className="u">{m.unit}</span>}
          </div>
          <div className="m-unit">{m.sub}</div>
          <MetricSpark values={m.spark} hot={m.hot} />
        </button>
      ))}
    </div>
  );
}
