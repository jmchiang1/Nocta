/* Nocta — desktop full-night dialog. The same data as the mobile FullNightSheet
 * (stats, chart stack, sleep stages, check-in, episodes) but laid out wide for a
 * desktop modal: stats row, a 2×2 chart grid, then check-in/stages + episodes. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES, EPISODES } from '../../data/fixtures.js';
import { TAG_LABELS } from '../../data/journal.js';
import { genBreathing, genSeries } from '../../lib/format.js';
import { Icon } from '../Icons.jsx';
import { SleepStages } from '../SleepStages.jsx';
import { LineChart, Waveform, Bars, EventWave } from '../Charts.jsx';

const WAVE_COLOR = { CSA: 'alert', OSA: 'data', Hypopnea: 'data' };
const AXIS = ['12AM', '2AM', '4AM', '6AM'];

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

function ChartPanel({ title, meta, children }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="panel-meta">{meta}</span>
      </div>
      {children}
      <div className="chart-axis">{AXIS.map((a) => <span key={a}>{a}</span>)}</div>
    </div>
  );
}

export function DesktopFullNight() {
  const { fixtureId, closeSheet, checkin, openSheet } = useStore();
  const fx = FIXTURES[fixtureId];
  const episodes = EPISODES[fixtureId] || [];
  const tags = [...checkin.tags.feel, ...checkin.tags.lastnight, ...checkin.tags.yesterday];

  const flow = genBreathing(fixtureId + 'flow', 96);
  const pressure = genSeries(fixtureId + 'pr', 72, 6.2, 1.6);
  const leak = genSeries(fixtureId + 'lk', 60, 10, 14);
  const snore = genSeries(fixtureId + 'sn', 52, 2.4, 3).map((v) => Math.min(10, v));

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
        <ChartPanel title="Flow rate" meta="breath by breath"><Waveform amps={flow} color="data" height={120} /></ChartPanel>
        <ChartPanel title="Pressure" meta="cmH₂O"><LineChart values={pressure} color="data" height={120} /></ChartPanel>
        <ChartPanel title="Leak rate" meta="L/min · 24 threshold"><LineChart values={leak} color="data" threshold={24} height={120} /></ChartPanel>
        <ChartPanel title="Snore index" meta="0 – 10"><Bars values={snore} color="data" height={120} /></ChartPanel>
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
              <p>Tell Nocta how you slept and what shaped your night — it sharpens tonight's insight.</p>
              <button className="btn ghost" onClick={() => openSheet('checkin')}>Do morning check-in</button>
            </div>
          )}
        </div>

        <div className="dfn-col">
          <div className="section-head"><h3>Episodes</h3><span className="meta">{episodes.length} shown</span></div>
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
