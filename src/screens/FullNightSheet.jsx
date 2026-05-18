/* Nocta — full-night detail. Morning check-in + time-aligned chart stack + episodes. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES, EPISODES } from '../data/fixtures.js';
import { TAG_LABELS } from '../data/journal.js';
import { genBreathing, genSeries } from '../lib/format.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { LineChart, Waveform, Bars, EventWave } from '../components/Charts.jsx';

const WAVE_COLOR = { CSA: 'alert', OSA: 'watch', Hypopnea: 'data' };

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
  const { fixtureId, closeSheet, checkin, openSheet } = useStore();
  const fx = FIXTURES[fixtureId];
  const episodes = EPISODES[fixtureId] || [];
  const tags = [
    ...checkin.tags.feel,
    ...checkin.tags.lastnight,
    ...checkin.tags.yesterday,
  ];

  const flow = genBreathing(fixtureId + 'flow', 72);
  const pressure = genSeries(fixtureId + 'pr', 60, 6.2, 1.6);
  const leak = genSeries(fixtureId + 'lk', 48, 10, 14);
  const snore = genSeries(fixtureId + 'sn', 40, 2.4, 3).map((v) => Math.min(10, v));

  return (
    <Sheet
      full
      eyebrow={`${fx.dayName} · ${fx.session.start} – ${fx.session.end}`}
      title="The full night"
      onClose={closeSheet}
    >
      {(close) => (
        <>
          <div className="fn-summary">
            <div className="fn-stat">
              <div className="fs-k">AHI</div>
              <div className="fs-v">
                {fx.ahi.value != null ? fx.ahi.value.toFixed(1) : '—'}
              </div>
            </div>
            <div className="fn-stat">
              <div className="fs-k">Events</div>
              <div className="fs-v">{fx.timeline.eventCount}</div>
            </div>
            <div className="fn-stat">
              <div className="fs-k">Hours</div>
              <div className="fs-v">{fx.session.durationHours}</div>
            </div>
          </div>

          <div className="section-head">
            <h3>Morning check-in</h3>
            <span className="meta">{checkin.done ? 'logged' : 'not done'}</span>
          </div>
          {checkin.done ? (
            <div className="fn-checkin">
              {tags.length > 0 ? (
                <div className="ci-tags">
                  {tags.map((t) => (
                    <span key={t} className="ci-tag">
                      {TAG_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="fn-checkin-empty">No tags logged for last night.</p>
              )}
            </div>
          ) : (
            <div className="connect-cta">
              <p>
                Tell Nocta how you slept and what shaped your night — it sharpens
                tonight's insight.
              </p>
              <button className="btn ghost" onClick={() => openSheet('checkin')}>
                Do morning check-in
              </button>
            </div>
          )}

          <div className="section-head">
            <h3>Sleep stages</h3>
            <span className="meta">needs a wearable</span>
          </div>
          <div className="connect-cta">
            <p>
              Connect a watch or ring and Nocta can line your sleep stages up against your
              events.
            </p>
            <button className="btn ghost" onClick={close}>
              Connect a wearable
            </button>
          </div>

          <div className="section-head">
            <h3>Flow rate</h3>
            <span className="meta">breath by breath</span>
          </div>
          <div className="chart-card">
            <Waveform amps={flow} color="data" />
            <div className="chart-axis">
              <span>12AM</span><span>2AM</span><span>4AM</span><span>6AM</span>
            </div>
          </div>

          <div className="section-head">
            <h3>Pressure</h3>
            <span className="meta">cmH₂O</span>
          </div>
          <div className="chart-card">
            <LineChart values={pressure} color="data" />
            <div className="chart-axis">
              <span>12AM</span><span>2AM</span><span>4AM</span><span>6AM</span>
            </div>
          </div>

          <div className="section-head">
            <h3>Leak rate</h3>
            <span className="meta">L/min · 24 threshold</span>
          </div>
          <div className="chart-card">
            <LineChart values={leak} color="accent" threshold={24} />
            <div className="chart-axis">
              <span>12AM</span><span>2AM</span><span>4AM</span><span>6AM</span>
            </div>
          </div>

          <div className="section-head">
            <h3>Snore index</h3>
            <span className="meta">0 – 10</span>
          </div>
          <div className="chart-card">
            <Bars values={snore} color="watch" />
            <div className="chart-axis">
              <span>12AM</span><span>2AM</span><span>4AM</span><span>6AM</span>
            </div>
          </div>

          <div className="section-head">
            <h3>Episodes</h3>
            <span className="meta">{episodes.length} shown</span>
          </div>
          {episodes.map((ep, i) => (
            <Episode key={i} ep={ep} />
          ))}

          <p className="disclaimer">
            Charts show what your machine recorded. Tap any episode to see the breath
            trace.
          </p>
        </>
      )}
    </Sheet>
  );
}
