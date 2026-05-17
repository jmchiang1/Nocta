/* Nocta — journal correlation card. Sage accent: a learned pattern, not tonight's AI. */
import { Icon } from './Icons.jsx';

export function PatternCard({ pattern, window = '14 nights' }) {
  return (
    <section className="pattern card-enter" aria-label="Journal pattern">
      <div className="p-eyebrow">
        <Icon name="dotRing" size={12} />
        Pattern · {window}
      </div>
      <h4>{pattern.headline}</h4>
      <p>{pattern.body}</p>
      <div className="small-stat">
        {pattern.stats.map((s, i) => (
          <div key={i}>
            <strong className="tnum">{s.v}</strong>
            {s.k}
          </div>
        ))}
      </div>
    </section>
  );
}
