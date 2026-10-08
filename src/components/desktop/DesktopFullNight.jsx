/* Nocta — desktop full-night dialog. The same data as the mobile FullNightSheet
 * (stats, chart stack, sleep stages, check-in, episodes) but laid out wide for a
 * desktop modal: stats row, a 2×2 chart grid, then check-in/stages + episodes. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES, EPISODES } from '../../data/fixtures.js';
import { allCheckinTags, TAG_LABELS } from '../../data/journal.js';
import { nightSeries } from '../../lib/nightSeries.js';
import { TimeAxis } from '../TimeAxis.jsx';
import { Icon } from '../Icons.jsx';
import { SleepStages } from '../SleepStages.jsx';
import { LineChart, Waveform, Bars, EventWave } from '../Charts.jsx';

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
            <div className="ep-detail"><span className="ed-k">Pressure at the time</span><span className="ed-v">{ep.pressure}</span></div>
            <div className="ep-detail"><span className="ed-k">Machine response</span><span className="ed-v">{ep.response}</span></div>
            <div className="ep-detail"><span className="ed-k">Sleeping position</span><span className="ed-v">{ep.position}</span></div>
            <div style={{ marginTop: 10 }}><EventWave seed={ep.seed} color={WAVE_COLOR[ep.type]} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartPanel({ title, meta, session, children }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="panel-meta">{meta}</span>
      </div>
      {children}
      <TimeAxis session={session} />
    </div>
  );
}

export function DesktopFullNight() {
  const { fixtureId, closeSheet, checkin, openSheet } = useStore();
  const fx = FIXTURES[fixtureId];
  const episodes = EPISODES[fixtureId] || [];
  const tags = allCheckinTags(checkin.tags);

  // the same series the mobile full-night page and metric pages draw
  const { flow, pressure, leak, snore } = nightSeries(fixtureId);
  const s = fx.session;

  return (
    <div className="dfn">
      <header className="dfn-head">
        <div>
          <div className="dfn-eyebrow">{fx.dayName} · {fx.session.start} – {fx.session.end}</div>
          <h2 className="dfn-title">The full night</h2>
        </div>
        <button className="dfn-close" onClick={closeSheet} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="dfn-stats">
        <div className="dfn-stat">
          <span className="dfn-stat-k">AHI</span>
          <b className="tnum">{fx.ahi.value != null ? fx.ahi.value.toFixed(1) : '—'}</b>
        </div>
        <div className="dfn-stat">
          <span className="dfn-stat-k">Events</span>
          <b className="tnum">{fx.timeline.eventCount}</b>
        </div>
        <div className="dfn-stat">
          <span className="dfn-stat-k">Hours</span>
          <b className="tnum">{fx.session.durationHours}</b>
        </div>
      </div>

      <div className="dfn-charts">
        <ChartPanel title="Flow rate" meta="breath by breath" session={s}><Waveform amps={flow} color="data" height={120} /></ChartPanel>
        <ChartPanel title="Pressure" meta="cmH₂O" session={s}><LineChart values={pressure} color="data" height={120} /></ChartPanel>
        <ChartPanel title="Leak rate" meta="L/min · 24 threshold" session={s}>
          {leak ? (
            <LineChart values={leak} color="data" threshold={24} height={120} />
          ) : (
            <span className="fn-nodata">No leak recorded this night</span>
          )}
        </ChartPanel>
        <ChartPanel title="Snore index" meta="0 – 10" session={s}><Bars values={snore} color="data" height={120} /></ChartPanel>
      </div>

      <div className="dfn-lower">
        <div className="dfn-col">
          <div className="section-head"><h3>Sleep stages</h3><span className="meta">Apple Watch</span></div>
          {fx.bodyResponse?.stages ? (
            <div className="chart-card"><SleepStages stages={fx.bodyResponse.stages} session={fx.session} /></div>
          ) : (
            <div className="connect-cta"><p>Last night was too short for your watch to chart sleep stages.</p></div>
          )}

          <div className="section-head"><h3>Morning check-in</h3><span className="meta">{checkin.done ? 'logged' : 'not done'}</span></div>
          {checkin.done ? (
            <div className="fn-checkin">
              {tags.length > 0 ? (
                <div className="ci-tags">
                  {tags.map((t) => <span key={t} className="ci-tag">{TAG_LABELS[t] || t}</span>)}
                </div>
              ) : (
                <p className="fn-checkin-empty">No tags logged for last night.</p>
              )}
            </div>
          ) : (
            <div className="connect-cta">
              <p>Tell Nocta how you slept and what shaped your night. It sharpens tonight's insight.</p>
              <button className="btn ghost" onClick={() => openSheet('checkin')}>Do morning check-in</button>
            </div>
          )}
        </div>

        <div className="dfn-col">
          <div className="section-head">
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
            <div className="connect-cta"><p>No flagged episodes for this night.</p></div>
          )}
        </div>
      </div>

      <p className="disclaimer">Charts show what your machine recorded. Click any episode to see the breath trace.</p>
    </div>
  );
}
