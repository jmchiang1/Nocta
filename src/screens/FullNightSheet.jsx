/* Nocta — full-night detail: events by type, then the time-aligned chart
 * stack + episodes. (The morning
 * check-in lives on Tonight now, under the night's suggestion.) */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES, EPISODES } from '../data/fixtures.js';
import { TimeAxis } from '../components/TimeAxis.jsx';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { nightSeries } from '../lib/nightSeries.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { SleepStages } from '../components/SleepStages.jsx';
import { LineChart, Bars } from '../components/Charts.jsx';

function Episode({ ep }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="episode">
      <button className="episode-head" onClick={() => setOpen((o) => !o)}>
        <span className={`ep-badge ${ep.type}`}>{ep.type.toUpperCase()}</span>
        <span className="ep-time">{ep.time}</span>
        <span className="ep-dur">{ep.dur}s</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      <div className={`episode-collapse${open ? ' open' : ''}`}>
        <div className="episode-body">
          <div className="episode-body-inner">
            <div className="ep-detail">
              <span className="ed-k">Pressure that minute</span>
              <span className="ed-v">{ep.pressure}</span>
            </div>
            <div className="ep-detail">
              <span className="ed-k">Next 3 minutes</span>
              <span className="ed-v">{ep.response}</span>
            </div>
            {/* the machine can't tell how you slept; a wearable could */}
            {ep.position && (
              <div className="ep-detail">
                <span className="ed-k">Sleeping position</span>
                <span className="ed-v">{ep.position}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FullNightSheet() {
  const { fixtureId, closeSheet, pushSheet } = useStore();
  const fx = FIXTURES[fixtureId];
  const episodes = EPISODES[fixtureId] || [];

  const { resp, pressure, leak, snore } = nightSeries(fixtureId);
  // each machine graph opens its own full page (MetricDetailSheet)
  const open = (metric) => pushSheet('metricDetail', { metric });

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
            sleepStages={fx.bodyResponse?.stages}
          />

          {/* only with a connected wearable: the machine can't see sleep stages */}
          {fx.bodyResponse?.stages && (
            <>
              <div className="section-head">
                <h3>Sleep stages</h3>
                <span className="meta">{fx.bodyResponse.source}</span>
              </div>
              <div className="chart-card">
                <SleepStages stages={fx.bodyResponse.stages} session={fx.session} />
              </div>
            </>
          )}

          <button className="fn-metric" type="button" onClick={() => open('resp')}>
            <span className="section-head">
              <h3>Breathing rate</h3>
              <span className="meta">
                breaths a minute
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              {resp ? (
                <LineChart values={resp} color="data" />
              ) : (
                <span className="fn-nodata">No breathing rate recorded this night</span>
              )}
              <TimeAxis session={fx.session} />
            </span>
          </button>

          <button className="fn-metric" type="button" onClick={() => open('pressure')}>
            <span className="section-head">
              <h3>Pressure</h3>
              <span className="meta">
                cmH₂O
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              {pressure ? <LineChart values={pressure} color="data" /> : <span className="fn-nodata">No pressure recorded this night</span>}
              <TimeAxis session={fx.session} />
            </span>
          </button>

          <button className="fn-metric" type="button" onClick={() => open('leak')}>
            <span className="section-head">
              <h3>Leak rate</h3>
              <span className="meta">
                L/min · 24 threshold
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              {leak ? (
                <LineChart values={leak} color="data" threshold={24} />
              ) : (
                <span className="fn-nodata">No leak recorded this night</span>
              )}
              <TimeAxis session={fx.session} />
            </span>
          </button>

          <button className="fn-metric" type="button" onClick={() => open('snore')}>
            <span className="section-head">
              <h3>Snore index</h3>
              <span className="meta">
                from the machine
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              {snore ? <Bars values={snore} color="data" /> : <span className="fn-nodata">No snore data this night</span>}
              <TimeAxis session={fx.session} />
            </span>
          </button>

          <div className="section-head">
            {/* a hand-picked sample, so say plainly how it relates to the total */}
            <h3>{episodes.length < fx.timeline.eventCount ? 'Longest events' : 'Events'}</h3>
            <span className="meta">
              {episodes.length < fx.timeline.eventCount
                ? `${episodes.length} of ${fx.timeline.eventCount}`
                : `all ${episodes.length}`}
            </span>
          </div>
          {episodes.map((ep, i) => (
            <Episode key={i} ep={ep} />
          ))}

          {/* <p className="disclaimer">
            Charts show what your machine recorded. Tap any episode to see the breath
            trace.
          </p> */}
        </>
      )}
    </Sheet>
  );
}
