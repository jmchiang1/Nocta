/* Nocta — the night card: events through the night as a Chart.js stacked bar.
 * The header ties the two numbers people see together: total events and AHI
 * (events per hour). Colours follow the 2-state palette — event types are
 * shades of the data blue, and central events turn coral only on a night that
 * needs a doctor (escalated). Legend swatches use the same colours as the bars. */
import { useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import { StackedBars } from './Charts.jsx';

const BUCKETS = 9;
const STAGE_NAME = { rem: 'REM', deep: 'Deep sleep', light: 'Light sleep', awake: 'Awake' };

/* '11:42 PM' → minutes since midnight */
function toMin(t) {
  const [, h, m, ap] = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  return ((+h % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + +m;
}
function fmtMin(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/* Scrub layer: hover (mouse) or drag sideways (touch) across the night to
 * read any moment — clock time, sleep stage, and the events in that slice.
 * The other slices dim so the one you're on stands out. */
function Scrubber({ bins, stages, session }) {
  const ref = useRef(null);
  const [f, setF] = useState(null); // 0..1 across the night, or null
  const start = toMin(session.start);
  let end = toMin(session.end);
  if (end <= start) end += 1440;

  const track = (e) => {
    const r = ref.current.getBoundingClientRect();
    setF(Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  let readout = null;
  if (f != null) {
    const i = Math.floor(f * BUCKETS);
    const b = bins[i];
    const stage = stages.find((s) => f * 100 >= s.l && f * 100 < s.l + s.w);
    const parts = [
      b.osa && `${b.osa} obstructive`,
      b.csa && `${b.csa} central`,
      b.leak && 'leak',
    ].filter(Boolean);
    readout = {
      i,
      x: f,
      time: fmtMin(start + f * (end - start)),
      stage: stage ? STAGE_NAME[stage.stage] : null,
      events: parts.length ? parts.join(' · ') : 'No breathing events',
    };
  }

  return (
    <div
      ref={ref}
      className={`scrub${readout ? ' active' : ''}`}
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setF(null)}
      onPointerUp={(e) => e.pointerType !== 'mouse' && setF(null)}
      onPointerCancel={() => setF(null)}
      role="img"
      aria-label="Overnight events chart. Hover or drag across it to read any moment."
    >
      {readout && (
        <>
          <span className="scrub-dim" style={{ left: 0, width: `${(readout.i / BUCKETS) * 100}%` }} />
          <span
            className="scrub-dim"
            style={{ left: `${((readout.i + 1) / BUCKETS) * 100}%`, right: 0 }}
          />
          <span className="scrub-line" style={{ left: `${readout.x * 100}%` }} />
          <span
            className="scrub-readout"
            style={{ left: `clamp(70px, ${readout.x * 100}%, calc(100% - 70px))` }}
            aria-live="polite"
          >
            <b className="tnum">{readout.time}</b>
            {readout.stage && <span> · {readout.stage}</span>}
            <span className="sr-events">{readout.events}</span>
          </span>
        </>
      )}
    </div>
  );
}

/* bin the night's events into time buckets for the bar chart. The fixture
 * stores a sample of event positions; scale the breathing events so the bins
 * add up to the night's real total (AHI × hours). Leak spells stay as-is —
 * they aren't breathing events and aren't in the count. */
function binEvents(events, total, buckets = BUCKETS) {
  const bins = Array.from({ length: buckets }, () => ({ csa: 0, osa: 0, leak: 0 }));
  events.forEach((e) => {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor((e.l / 100) * buckets)));
    bins[i][e.type === 'csa' || e.type === 'osa' ? e.type : 'leak'] += 1;
  });
  const sampled = events.filter((e) => e.type === 'csa' || e.type === 'osa').length;
  if (!sampled || !total) return bins;
  // largest-remainder rounding so the scaled bins sum exactly to `total`
  const k = total / sampled;
  const cells = [];
  bins.forEach((b, i) =>
    ['csa', 'osa'].forEach((t) => {
      const v = b[t] * k;
      b[t] = Math.floor(v);
      cells.push({ i, t, r: v - b[t] });
    })
  );
  let left = total - bins.reduce((s, b) => s + b.csa + b.osa, 0);
  cells.sort((a, b) => b.r - a.r);
  for (let j = 0; left > 0 && j < cells.length; j += 1, left -= 1) bins[cells[j].i][cells[j].t] += 1;
  return bins;
}

export function NightTimeline({ timeline, session, ahi, escalated = false, onOpen }) {
  const bins = binEvents(timeline.events, timeline.eventCount);
  const central = escalated ? 'alert' : 'dataLight';
  const layers = [
    { key: 'osa', color: 'data', label: 'Obstructive' },
    { key: 'csa', color: central, label: 'Central' },
    { key: 'leak', color: 'muted', label: 'Leak' },
  ];
  const swatch = { obstructive: 'data-1', central: escalated ? 'alert' : 'stage-rem', leak: 'text-tertiary' };

  return (
    <section className="night-card card-enter" aria-label="Overnight timeline">
      <div className="night-meta">
        <span className="time-pill tnum">{session.start}</span>
        <span className="mid tnum">
          {timeline.eventCount} events
          {ahi != null && ` · ${ahi.toFixed(1)} an hour`}
        </span>
        <span className="time-pill tnum">{session.end}</span>
      </div>

      <div className="scrub-wrap">
        <StackedBars series={bins} height={104} layers={layers} />
        <Scrubber bins={bins} stages={timeline.stages} session={session} />
      </div>
      <div className="axis">
        <span>11PM</span>
        <span>1AM</span>
        <span>3AM</span>
        <span>5AM</span>
        <span>7AM</span>
      </div>

      <div className="legend">
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.obstructive})` }} /> Obstructive
        </span>
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.central})` }} /> Central
        </span>
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.leak})` }} /> Leak
        </span>
        <span className="legend-hint" aria-hidden="true">
          Drag to explore
        </span>
      </div>

      <button className="row-cta" onClick={onOpen}>
        <span>Open full-night view</span>
        <Icon name="chevronRight" size={16} />
      </button>
    </section>
  );
}
