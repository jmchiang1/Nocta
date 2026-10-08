/* Nocta — journal correlation card. Sage accent: a learned pattern, not tonight's AI. */
import { CountUp } from '../lib/motion.jsx';

export function PatternCard({ pattern, window }) {
  const span = pattern.window || window; // the pattern knows its own data window
  // "Early signal" until there's enough history to call it a pattern
  const label = pattern.label || 'Pattern';
  return (
    <section className="pattern card-enter" aria-label="Journal pattern">
      <div className="p-eyebrow">
        {label}
        {span ? ` · ${span}` : ''}
      </div>
      <h4>{pattern.headline}</h4>
      <p>{pattern.body}</p>
      <div className="small-stat">
        {pattern.stats.map((s, i) => (
          <div key={i}>
            <strong className="tnum">
              <CountUp value={s.v} duration={800} delay={250 + i * 80} />
            </strong>
            {s.k}
          </div>
        ))}
      </div>
    </section>
  );
}
