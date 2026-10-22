/* Nocta — the full night on desktop: its own page in the dashboard (not a
 * dialog), so there's room for every chart. The same content as the phone's
 * FullNightSheet: the night in three numbers, events by type full width,
 * sleep stages with a wearable, then every machine chart in a two-column
 * grid (components/NightCharts.jsx — the same charts, same order) and the
 * night's events, each opening to its breathing waveform. Charts with their
 * own metric page open it on top. */
import { useEffect } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES } from '../../data/fixtures.js';
import { NightTimeline } from '../NightTimeline.jsx';
import { primaryBody } from '../../lib/bodySource.js';
import { Icon } from '../Icons.jsx';
import { SleepStages } from '../SleepStages.jsx';
import { nightPanels, NightEvents } from '../NightCharts.jsx';

const CHART_H = 200; // room for the axes

/* a chart panel: a button through to its metric page when it has one */
function ChartPanel({ title, onOpen, wide, children }) {
  const head = (
    <span className="panel-head">
      <h3>{title}</h3>
      {onOpen && <Icon name="chevronRight" size={16} />}
    </span>
  );
  return onOpen ? (
    <button className={`panel dfn-metric${wide ? ' wide' : ''}`} type="button" onClick={onOpen}>
      {head}
      {children}
    </button>
  ) : (
    <section className={`panel dfn-panel${wide ? ' wide' : ''}`}>
      {head}
      {children}
    </section>
  );
}

export function DesktopFullNight() {
  const { fixtureId, closeSheet, pushSheet, deviceConnections, deviceEnabled, deviceReads } = useStore();
  const fx = FIXTURES[fixtureId];
  // a connected wearable's record of this night (lib/bodySource.js)
  const body = primaryBody(fx, deviceConnections, deviceEnabled, deviceReads);
  const stages = body?.stages;
  const s = fx.session;
  const panels = nightPanels(fixtureId, { height: CHART_H, open: (metric) => pushSheet('metricDetail', { metric }) });

  // a page: start at its top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [fixtureId]);

  return (
    <div className="dfn dfn-page">
      <header className="dfn-head">
        <button className="dfn-back" type="button" onClick={closeSheet}>
          <Icon name="chevronLeft" size={18} />
          Tonight
        </button>
        <div className="dfn-heading">
          <h1 className="dfn-title">The full night</h1>
          <div className="dfn-eyebrow tnum">
            {fx.dayName} · {s.start} – {s.end}
          </div>
        </div>
      </header>

      {/* the night in three numbers, one quiet card */}
      <div className="fn-summary-card tnum">
        <div>
          <b>{fx.ahi.value != null ? fx.ahi.value.toFixed(1) : '—'}</b>
          <span>AHI</span>
        </div>
        <div>
          <b>{fx.timeline.eventCount}</b>
          <span>events</span>
        </div>
        <div>
          <b>{s.durationHours}</b>
          <span>hours</span>
        </div>
      </div>

      {/* the night's events at a glance, by hour and type; the full list,
       * each with its breathing, is "Events by type" at the bottom */}
      <NightTimeline
        title="Events summary"
        timeline={fx.timeline}
        session={s}
        ahi={fx.ahi.value}
        escalated={fx.insight.escalation_flag === 'hard'}
        fixtureId={fixtureId}
        detailed
        sleepStages={stages}
      />

      {/* only with a connected wearable: the machine can't see sleep stages */}
      {stages && (
        <div className="chart-card">
          <div className="panel-head">
            <h3>Sleep stages</h3>
            <span className="panel-source">{body.source}</span>
          </div>
          <SleepStages stages={stages} session={s} detailed />
        </div>
      )}

      <div className="section-head">
        <h3>What your machine recorded</h3>
      </div>
      <div className="dfn-charts">
        {panels.map((p) => (
          <ChartPanel key={p.key} title={p.title} onOpen={p.onOpen} wide={p.wide}>
            {p.body}
          </ChartPanel>
        ))}
      </div>

      <NightEvents fixtureId={fixtureId} />
    </div>
  );
}
