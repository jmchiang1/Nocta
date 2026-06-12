/* Nocta — the night card: events through the night as a Chart.js stacked bar. */
import { Icon } from './Icons.jsx';
import { StackedBars } from './Charts.jsx';

/* bin the night's events into time buckets for the bar chart */
function binEvents(events, buckets = 9) {
  const bins = Array.from({ length: buckets }, () => ({ csa: 0, osa: 0, hyp: 0 }));
  events.forEach((e) => {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor((e.l / 100) * buckets)));
    if (e.type === 'csa') bins[i].csa += 1;
    else if (e.type === 'osa') bins[i].osa += 1;
    else bins[i].hyp += 1; // leak
  });
  return bins;
}

const SWATCH = (color) => ({
  width: 8,
  height: 8,
  borderRadius: 2,
  background: `var(--${color})`,
});

export function NightTimeline({ timeline, session, onOpen }) {
  const bins = binEvents(timeline.events);

  return (
    <section className="night-card card-enter" aria-label="Overnight timeline">
      <div className="night-meta">
        <span className="time-pill tnum">{session.start}</span>
        <span className="mid">{timeline.eventCount} events</span>
        <span className="time-pill tnum">{session.end}</span>
      </div>

      <StackedBars series={bins} height={104} />
      <div className="axis">
        <span>11PM</span>
        <span>1AM</span>
        <span>3AM</span>
        <span>5AM</span>
        <span>7AM</span>
      </div>

      <div className="legend">
        <span>
          <span className="swatch" style={SWATCH('alert')} /> Central
        </span>
        <span>
          <span className="swatch" style={SWATCH('watch')} /> Obstructive
        </span>
        <span>
          <span className="swatch" style={SWATCH('data-1')} /> Leak
        </span>
      </div>

      <button className="row-cta" onClick={onOpen}>
        <span>Open full-night view</span>
        <Icon name="chevronRight" size={16} />
      </button>
    </section>
  );
}
