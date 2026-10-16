/* Nocta — the night card: events through the night as a Chart.js stacked bar.
 * The header ties the two numbers people see together: total events and AHI
 * (events per hour). Colours follow the 2-state palette — event types are
 * shades of the data blue, and central events turn coral only on a night that
 * needs a doctor (escalated). Legend swatches use the same colours as the bars. */
import { useRef, useState } from 'react';
import { Icon } from './Icons.jsx';
import { StackedBars } from './Charts.jsx';
import { TimeAxis } from './TimeAxis.jsx';
import { hypnogramFor } from './SleepStages.jsx';
import { nightHours } from '../lib/nightSeries.js';

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
function Scrubber({ bins, stageAt, session, hourly }) {
  const ref = useRef(null);
  const [f, setF] = useState(null); // 0..1 across the night, or null
  const n = bins.length;
  // hourly bars span whole clock hours; the fallback spans the session
  const start = hourly ? bins[0].hour * 60 : toMin(session.start);
  let end = hourly ? start + n * 60 : toMin(session.end);
  if (end <= start) end += 1440;

  const track = (e) => {
    const r = ref.current.getBoundingClientRect();
    setF(Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  let readout = null;
  if (f != null) {
    const i = Math.floor(f * n);
    const b = bins[i];
    const stage = stageAt(f);
    const parts = [
      b.osa && `${b.osa} obstructive`,
      b.hyp && `${b.hyp} hypopnea`,
      b.csa && `${b.csa} central`,
      b.leak && 'leak',
    ].filter(Boolean);
    readout = {
      i,
      x: f,
      // an hourly bar reads as its hour ("2–3 AM"), not a minute it can't resolve
      time: hourly ? `${fmtMin(start + i * 60).replace(':00', '')}–${fmtMin(start + (i + 1) * 60).replace(':00', '')}` : fmtMin(start + f * (end - start)),
      stage: stage ? STAGE_NAME[stage] : null,
      events: hourly && b.worn === 0 ? 'Mask off' : parts.length ? parts.join(' · ') : 'No breathing events',
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
          <span className="scrub-dim" style={{ left: 0, width: `${(readout.i / n) * 100}%` }} />
          <span className="scrub-dim" style={{ left: `${((readout.i + 1) / n) * 100}%`, right: 0 }} />
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
export function binEvents(events, total, buckets = BUCKETS) {
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

/* the hourly chart's axes on the full-night page: every clock hour labelled
 * (every other when narrow), events up the side, and a tooltip that reads the
 * hour like the scrubber does — events by type, sleep stage, mask off */
function hourAxes(bins, stageAt) {
  const n = bins.length;
  const hour = (b) => `${b.hour % 12 || 12} ${b.hour < 12 ? 'AM' : 'PM'}`;
  return {
    labels: bins.map(hour),
    titles: bins.map((b, i) => `${hour(b)}–${hour(bins[i + 1] ?? { hour: (b.hour + 1) % 24 })}`),
    tick: (i, width) => (n * 44 > width - 60 && i % 2 ? null : hour(bins[i])),
    xTitle: 'Time',
    yTitle: 'Events',
    integer: true,
    decimals: 0,
    layerLabel: (ctx) => (ctx.dataset.label === 'Leak' ? 'Leak above 24 L/min' : `${ctx.dataset.label}: ${ctx.raw}`),
    footer: (i) => {
      const stage = stageAt((i + 0.5) / n);
      return [bins[i].worn === 0 && 'Mask off', stage && STAGE_NAME[stage]].filter(Boolean);
    },
  };
}

/* fixtureId: build the bars from the night's shared event data (per-type
 * totals from history, placed around its episodes) so they match the horizon
 * and the episode list. sleepStages: the watch's stages, for the readout.
 * detailed: the full-night page's version, with real axes and a tooltip in
 * place of the scrubber and the hour row. */
export function NightTimeline({ timeline, session, ahi, escalated = false, onOpen, fixtureId, sleepStages, detailed = false }) {
  // a real night: one bar per clock hour, labelled underneath. The older
  // fixture shape (no night id) keeps its proportional buckets.
  const hourly = Boolean(fixtureId);
  const bins = hourly ? nightHours(fixtureId).bins : binEvents(timeline.events, timeline.eventCount);
  const hyp = sleepStages ? hypnogramFor(sleepStages) : null;
  const stageAt = (f) => {
    if (hyp) return hyp[Math.min(hyp.length - 1, Math.floor(f * hyp.length))];
    const s = timeline.stages?.find((x) => f * 100 >= x.l && f * 100 < x.l + x.w);
    return s ? s.stage : null;
  };
  const central = escalated ? 'alert' : 'dataLight';
  const layers = [
    { key: 'osa', color: 'data', label: 'Obstructive' },
    { key: 'hyp', color: 'dataDeep', label: 'Hypopnea' },
    { key: 'csa', color: central, label: 'Central' },
    { key: 'leak', color: 'muted', label: 'Leak' },
  ];
  const swatch = {
    obstructive: 'data-1',
    hypopnea: 'data-deep',
    central: escalated ? 'alert' : 'stage-rem',
    leak: 'text-tertiary',
  };

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

      {detailed && hourly ? (
        <div role="img" aria-label="Overnight events by type, per clock hour. Hover a bar to read that hour.">
          <StackedBars series={bins} height={200} layers={layers} axes={hourAxes(bins, stageAt)} />
        </div>
      ) : (
        <div className="scrub-wrap">
          <StackedBars series={bins} height={104} layers={layers} centered={hourly} />
          <Scrubber bins={bins} stageAt={stageAt} session={session} hourly={hourly} />
        </div>
      )}
      {detailed && hourly ? null : hourly ? (
        // every hour, under its own bar; hours with the mask off are dimmed
        <div className="hour-row tnum" style={{ '--n': bins.length }} aria-hidden="true">
          {bins.map((b, i) => (
            <span key={i} className={b.worn === 0 ? 'off' : undefined}>
              {b.label}
            </span>
          ))}
        </div>
      ) : (
        <TimeAxis session={session} />
      )}

      <div className="legend">
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.obstructive})` }} /> Obstructive
        </span>
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.hypopnea})` }} /> Hypopnea
        </span>
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.central})` }} /> Central
        </span>
        <span>
          <span className="swatch" style={{ background: `var(--${swatch.leak})` }} /> Leak
        </span>
      </div>

      {onOpen && (
        <button className="row-cta" onClick={onOpen}>
          <span>Open full-night view</span>
          <Icon name="chevronRight" size={16} />
        </button>
      )}
    </section>
  );
}
