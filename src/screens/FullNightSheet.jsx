/* Nocta — the full night (phone): its own page, pushed in from Tonight. The
 * night in three numbers, events by type, then every machine chart
 * (components/NightCharts.jsx, shared with the desktop page) and the night's
 * events, each opening to its breathing waveform. (The morning check-in
 * lives on Tonight, under the night's suggestion.) */
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { SleepStages } from '../components/SleepStages.jsx';
import { primaryBody } from '../lib/bodySource.js';
import { nightPanels, NightEvents } from '../components/NightCharts.jsx';

const CHART_H = 180; // room for the axes

/* a chart section: tappable through to its metric page when it has one */
function Panel({ title, meta, onOpen, children }) {
  const head = (
    <span className="section-head">
      <h3>{title}</h3>
      {(meta || onOpen) && (
        <span className="meta">
          {meta}
          {onOpen && <Icon name="chevronRight" size={14} />}
        </span>
      )}
    </span>
  );
  return onOpen ? (
    <button className="fn-metric" type="button" onClick={onOpen}>
      {head}
      <span className="chart-card">{children}</span>
    </button>
  ) : (
    <section className="fn-metric">
      {head}
      <div className="chart-card">{children}</div>
    </section>
  );
}

export function FullNightSheet() {
  const { fixtureId, closeSheet, pushSheet, deviceConnections, deviceEnabled, deviceReads } = useStore();
  const fx = FIXTURES[fixtureId];
  // a connected wearable's record of this night (lib/bodySource.js)
  const body = primaryBody(fx, deviceConnections, deviceEnabled, deviceReads);
  // each machine graph with its own page opens it (MetricDetailSheet)
  const panels = nightPanels(fixtureId, { height: CHART_H, open: (metric) => pushSheet('metricDetail', { metric }) });

  return (
    <Sheet
      variant="page"
      eyebrow={`${fx.dayName} · ${fx.session.start} – ${fx.session.end}`}
      title="The full night"
      onClose={closeSheet}
    >
      {() => (
        <>
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
              <b>{fx.session.durationHours}</b>
              <span>hours</span>
            </div>
          </div>

          {/* events split by type: obstructive vs central matters most on a
           * doctor-worthy night, so it leads the detail */}
          <div className="section-head">
            <h3>Events by type</h3>
          </div>
          <NightTimeline
            timeline={fx.timeline}
            session={fx.session}
            ahi={fx.ahi.value}
            escalated={fx.insight.escalation_flag === 'hard'}
            fixtureId={fixtureId}
            detailed
            sleepStages={body?.stages}
          />

          {/* only with a connected wearable: the machine can't see sleep stages */}
          {body?.stages && (
            <>
              <div className="section-head">
                <h3>Sleep stages</h3>
                <span className="meta">{body.source}</span>
              </div>
              <div className="chart-card">
                <SleepStages stages={body.stages} session={fx.session} detailed />
              </div>
            </>
          )}

          {panels.map((p) => (
            <Panel key={p.key} title={p.title} meta={p.meta} onOpen={p.onOpen}>
              {p.body}
            </Panel>
          ))}

          <NightEvents fixtureId={fixtureId} />
        </>
      )}
    </Sheet>
  );
}
