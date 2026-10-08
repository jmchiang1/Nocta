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
import { LineChart, Waveform, Bars, EventWave } from '../components/Charts.jsx';

/* Episode mini-waveform colour: central apneas are the escalation signal per
 * the safety rails, so they get coral. Everything else is the metric blue. */
const WAVE_COLOR = { CSA: 'alert', OSA: 'data', Hypopnea: 'data' };

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
              <span className="ed-k">Pressure at the time</span>
              <span className="ed-v">{ep.pressure}</span>
            </div>
            <div className="ep-detail">
              <span className="ed-k">Machine response</span>
              <span className="ed-v">{ep.response}</span>
            </div>
            <div className="ep-detail">
              <span className="ed-k">Sleeping position</span>
              <span className="ed-v">{ep.position}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <EventWave seed={ep.seed} color={WAVE_COLOR[ep.type]} />
            </div>
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

  const { flow, pressure, leak, snore } = nightSeries(fixtureId);
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

          <div className="section-head">
            <h3>Sleep stages</h3>
            <span className="meta">Apple Watch</span>
          </div>
          {fx.bodyResponse?.stages ? (
            <div className="chart-card">
              <SleepStages stages={fx.bodyResponse.stages} session={fx.session} />
            </div>
          ) : (
            <div className="connect-cta">
              <p>Last night was too short for your watch to chart sleep stages.</p>
            </div>
          )}

          <button className="fn-metric" type="button" onClick={() => open('flow')}>
            <span className="section-head">
              <h3>Flow rate</h3>
              <span className="meta">
                breath by breath
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              <Waveform amps={flow} color="data" />
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
              <LineChart values={pressure} color="data" />
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
                0 – 10
                <Icon name="chevronRight" size={14} />
              </span>
            </span>
            <span className="chart-card">
              <Bars values={snore} color="data" />
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
