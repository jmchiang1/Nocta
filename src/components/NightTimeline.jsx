/* Nocta — the night timeline: stage bands + shape-coded event flags + journal icons. */
import { Icon } from './Icons.jsx';

const STAGE_BG = {
  rem: 'rgba(181,135,217,0.32)',
  light: 'rgba(124,149,200,0.35)',
  deep: 'rgba(46,65,128,0.55)',
  awake: 'rgba(224,122,106,0.3)',
};

export function NightTimeline({ timeline, session, onOpen }) {
  const { stages, events, journal, eventCount } = timeline;
  return (
    <section className="night-card card-enter" aria-label="Overnight timeline">
      <div className="night-meta">
        <span>{session.start}</span>
        <span className="mid">{eventCount} events</span>
        <span>{session.end}</span>
      </div>

      {journal.length > 0 && (
        <div className="night-journal">
          <span className="nj-label">You logged</span>
          {journal.map((j, i) => (
            <span key={i} className="nj-chip">
              <span className="nj-emoji">{j.emoji}</span>
              {j.label}
            </span>
          ))}
        </div>
      )}

      <button className="timeline" onClick={onOpen} aria-label="Open full-night view">
        {stages.map((s, i) => (
          <div
            key={i}
            className="stage"
            style={{ left: `${s.l}%`, width: `${s.w}%`, background: STAGE_BG[s.stage] }}
          />
        ))}
        {events.map((e, i) => (
          <span
            key={i}
            className={`ev ${e.type}`}
            style={{ left: `${e.l}%`, top: e.top != null ? `${e.top}%` : undefined }}
          />
        ))}
      </button>

      <div className="axis">
        <span>11PM</span>
        <span>1AM</span>
        <span>3AM</span>
        <span>5AM</span>
        <span>7AM</span>
      </div>

      <div className="legend">
        <span>
          <span className="swatch csa" /> CSA
        </span>
        <span>
          <span className="swatch osa" /> OSA
        </span>
        <span>
          <span className="swatch leak" /> Leak
        </span>
        <span>
          <span className="swatch deep" /> Deep
        </span>
        <span>
          <span className="swatch light" /> Light
        </span>
        <span>
          <span className="swatch rem" /> REM
        </span>
      </div>

      <button className="row-cta" onClick={onOpen}>
        <span>Open full-night view</span>
        <Icon name="chevronRight" size={16} />
      </button>
    </section>
  );
}
