/* Nocta — desktop full-night dialog. The same content as the mobile
 * FullNightSheet (summary, events by type, sleep stages, the machine graphs,
 * episodes) laid out wide: the event timeline full width, the four machine
 * graphs as a 2×2 grid (each opens its metric page, as on mobile), then
 * sleep stages beside the episode list. The morning check-in lives on Tonight. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES, EPISODES } from '../../data/fixtures.js';
import { nightSeries } from '../../lib/nightSeries.js';
import { TimeAxis } from '../TimeAxis.jsx';
import { NightTimeline } from '../NightTimeline.jsx';
import { Icon } from '../Icons.jsx';
import { SleepStages } from '../SleepStages.jsx';
import { LineChart, Bars } from '../Charts.jsx';

/* central apneas are the escalation signal per the safety rails, so they get
 * coral; everything else is the metric blue */

const CHART_H = 120;

function Episode({ ep }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="episode">
      <button className="episode-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`ep-badge ${ep.type}`}>{ep.type.toUpperCase()}</span>
        <span className="ep-time">{ep.time}</span>
        <span className="ep-dur">{ep.dur}s</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      <div className={`episode-collapse${open ? ' open' : ''}`}>
        <div className="episode-body">
          <div className="episode-body-inner">
            <div className="ep-detail"><span className="ed-k">Pressure that minute</span><span className="ed-v">{ep.pressure}</span></div>
            <div className="ep-detail"><span className="ed-k">Next 3 minutes</span><span className="ed-v">{ep.response}</span></div>
            {/* the machine can't tell how you slept; a wearable could */}
            {ep.position && (
              <div className="ep-detail"><span className="ed-k">Sleeping position</span><span className="ed-v">{ep.position}</span></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* a machine graph that opens its own metric page (MetricDetailSheet) */
function ChartPanel({ title, meta, session, onOpen, children }) {
  return (
    <button className="panel dfn-metric" type="button" onClick={onOpen}>
      <span className="panel-head">
        <h3>{title}</h3>
        <span className="panel-meta">
          {meta}
          <Icon name="chevronRight" size={14} />
        </span>
      </span>
      {children}
      <TimeAxis session={session} />
    </button>
  );
}

export function DesktopFullNight() {
  const { fixtureId, closeSheet, pushSheet } = useStore();
  const fx = FIXTURES[fixtureId];
  const episodes = EPISODES[fixtureId] || [];

  // the same series the mobile full-night page and metric pages draw
  const { resp, pressure, leak, snore } = nightSeries(fixtureId);
  const stages = fx.bodyResponse?.stages;
  const s = fx.session;
  const open = (metric) => pushSheet('metricDetail', { metric });

  return (
    <div className="dfn">
      <header className="dfn-head">
        <div>
          <div className="dfn-eyebrow">{fx.dayName} · {s.start} – {s.end}</div>
          <h2 className="dfn-title">The full night</h2>
        </div>
        <button className="dfn-close" onClick={closeSheet} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
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

      {/* events split by type: obstructive vs central matters most on a
       * doctor-worthy night, so it leads the detail */}
      <div className="section-head">
        <h3>Events by type</h3>
      </div>
      <NightTimeline
        timeline={fx.timeline}
        session={s}
        ahi={fx.ahi.value}
        escalated={fx.insight.escalation_flag === 'hard'}
        fixtureId={fixtureId}
        sleepStages={fx.bodyResponse?.stages}
      />

      <div className="section-head">
        <h3>What your machine recorded</h3>
        <span className="meta">click a graph for detail</span>
      </div>
      <div className="dfn-charts">
        <ChartPanel title="Breathing rate" meta="breaths a minute" session={s} onOpen={() => open('resp')}>
          {resp ? (
            <LineChart values={resp} color="data" height={CHART_H} />
          ) : (
            <span className="fn-nodata">No breathing rate recorded this night</span>
          )}
        </ChartPanel>
        <ChartPanel title="Pressure" meta="cmH₂O" session={s} onOpen={() => open('pressure')}>
          {pressure ? (
            <LineChart values={pressure} color="data" height={CHART_H} />
          ) : (
            <span className="fn-nodata">No pressure recorded this night</span>
          )}
        </ChartPanel>
        <ChartPanel title="Leak rate" meta="L/min · 24 threshold" session={s} onOpen={() => open('leak')}>
          {leak ? (
            <LineChart values={leak} color="data" threshold={24} height={CHART_H} />
          ) : (
            <span className="fn-nodata">No leak recorded this night</span>
          )}
        </ChartPanel>
        <ChartPanel title="Snore index" meta="from the machine" session={s} onOpen={() => open('snore')}>
          {snore ? <Bars values={snore} color="data" height={CHART_H} /> : <span className="fn-nodata">No snore data this night</span>}
        </ChartPanel>
      </div>

      {/* sleep stages only with a connected wearable; without one the
       * episode list takes the row */}
      <div className={`dfn-lower${stages ? '' : ' solo'}`}>
        {stages && (
          <div className="dfn-col">
            <div className="section-head">
              <h3>Sleep stages</h3>
              <span className="meta">{fx.bodyResponse.source}</span>
            </div>
            <div className="chart-card">
              <SleepStages stages={stages} session={s} />
            </div>
          </div>
        )}

        <div className="dfn-col">
          <div className="section-head">
            {/* a hand-picked sample, so say plainly how it relates to the total */}
            <h3>{episodes.length < fx.timeline.eventCount ? 'Longest events' : 'Events'}</h3>
            <span className="meta tnum">
              {episodes.length < fx.timeline.eventCount
                ? `${episodes.length} of ${fx.timeline.eventCount}`
                : `all ${episodes.length}`}
            </span>
          </div>
          {episodes.length > 0 ? (
            episodes.map((ep, i) => <Episode key={i} ep={ep} />)
          ) : (
            <div className="connect-cta">
              <p>No flagged episodes for this night.</p>
            </div>
          )}
        </div>
      </div>

      <p className="disclaimer">Charts show what your machine recorded, minute by minute.</p>
    </div>
  );
}
