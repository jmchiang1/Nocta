/* Nocta — the full night's machine charts, shared by the phone page and the
 * desktop page so both show the same charts in the same order. Every chart
 * plots the card's readings as they are (lib/nightSeries.js,
 * lib/nightDetail.js); the charts fit the data, never the other way round.
 * Plain readouts in the metric blue: no scoring colours, no advice. */
import { useEffect, useState } from 'react';
import { nightSeries, metricAxes } from '../lib/nightSeries.js';
import { nightDetail, duration } from '../lib/nightDetail.js';
import { wavesFor, traceFor } from '../lib/waves.js';
import { EPISODES, allEpisodes } from '../data/fixtures.js';
import { LineChart, Bars, SessionsChart, PressureHistogram, BreathTrace } from './Charts.jsx';
import { TrendLegend } from './TrendLegend.jsx';
import { Icon } from './Icons.jsx';

const none = (text) => <span className="fn-nodata">{text}</span>;

/* the night's charts, in order: [{ key, title, meta, onOpen?, body }].
 * `open(metric)` opens a chart's own metric page where it has one. */
export function nightPanels(fixtureId, { height, open }) {
  const series = nightSeries(fixtureId);
  const d = nightDetail(fixtureId);
  const axes = (k) => metricAxes(k, series);
  const summaryOnly = d && !d.detailed ? 'The card only kept a summary of this night' : null;
  const rangeText = d?.range ? (d.range[0] === d.range[1] ? `${d.range[0]}` : `${d.range[0]}–${d.range[1]}`) : null;

  return [
    {
      key: 'sessions',
      onOpen: () => open('sessions'),
      wide: true, // a single row of bars: the full width, not half
      title: 'Mask on and off',
      meta: d?.sessionCount
        ? `${d.sessionCount === 1 ? 'one session' : `${d.sessionCount} sessions`}${d.maskOff >= 1 ? ` · off ${duration(d.maskOff)}` : ''}`
        : null,
      body: d?.spans.length ? <SessionsChart spans={d.spans} height={72} /> : none('No mask sessions recorded this night'),
    },
    {
      key: 'resp',
      title: 'Breathing rate',
      meta: 'breaths a minute',
      onOpen: () => open('resp'),
      body: series.resp ? <LineChart values={series.resp} height={height} axes={axes('resp')} /> : none(summaryOnly ?? 'No breathing rate recorded this night'),
    },
    {
      key: 'pressure',
      title: 'Mask pressure',
      meta: 'cmH₂O',
      onOpen: () => open('pressure'),
      body: series.pressure ? <LineChart values={series.pressure} height={height} axes={axes('pressure')} /> : none(summaryOnly ?? 'No pressure recorded this night'),
    },
    {
      key: 'setPressure',
      onOpen: () => open('setPressure'),
      title: 'Set pressure and your range',
      meta: [d?.mode, rangeText && `${rangeText} cmH₂O${d.rangeInferred ? ' (latest settings)' : ''}`].filter(Boolean).join(' · '),
      body: series.inhale ? (
        <>
          <TrendLegend
            items={[
              { kind: 'line', color: 'var(--data-1)', label: 'Breathing in' },
              ...(series.exhale ? [{ kind: 'line', color: 'var(--stage-rem)', label: d?.eprLevel ? `Breathing out (exhale relief ${d.eprLevel})` : 'Breathing out' }] : []),
              ...(d?.range && d.range[0] !== d.range[1] ? [{ kind: 'band', label: 'Your range' }] : []),
            ]}
          />
          <LineChart
            values={series.inhale}
            label="Breathing in"
            second={series.exhale ? { values: series.exhale, label: 'Breathing out' } : undefined}
            band={d?.range && d.range[0] !== d.range[1] ? d.range : undefined}
            height={height}
            axes={axes('inhale')}
          />
        </>
      ) : (
        none(summaryOnly ?? 'Import your card again to see the set pressure for this night')
      ),
    },
    {
      key: 'pressureTime',
      onOpen: () => open('pressureTime'),
      title: 'Time at each pressure',
      meta:
        d?.atMaxMin == null
          ? null
          : d.atMaxMin < 1
            ? `none at your ${d.range?.[1]} maximum`
            : `${duration(d.atMaxMin)} at your ${d.range?.[1]} maximum`,
      body: d?.hist ? (
        <>
          {d.range && d.range[0] !== d.range[1] && <TrendLegend items={[{ kind: 'band', label: `Your range, ${rangeText} cmH₂O` }]} />}
          <PressureHistogram hist={d.hist} range={d.range && d.range[0] !== d.range[1] ? d.range : null} height={height} />
        </>
      ) : (
        none(summaryOnly ?? 'Import your card again to see this for this night')
      ),
    },
    {
      key: 'leak',
      title: 'Leak rate',
      meta: `L/min${d?.largeLeakMin != null ? ` · ${d.largeLeakMin < 1 ? 'none' : duration(d.largeLeakMin)} above 24` : ' · 24 line'}`,
      onOpen: () => open('leak'),
      body: series.leak ? <LineChart values={series.leak} threshold={24} height={height} axes={axes('leak')} /> : none(summaryOnly ?? 'No leak recorded this night'),
    },
    {
      key: 'flow',
      onOpen: () => open('flow'),
      title: 'Flow limitation',
      meta: '0 open · 1 restricted',
      body: series.flow ? <LineChart values={series.flow} height={height} axes={axes('flow')} /> : none(summaryOnly ?? 'No flow limitation recorded this night'),
    },
    {
      key: 'snore',
      title: 'Snore index',
      meta: 'from the machine',
      onOpen: () => open('snore'),
      body: series.snore ? <Bars values={series.snore} height={height} axes={axes('snore')} /> : none(summaryOnly ?? 'No snore data this night'),
    },
    {
      key: 'tidal',
      onOpen: () => open('tidal'),
      title: 'Breath size',
      meta: 'mL a breath',
      body: series.tidal ? <LineChart values={series.tidal} height={height} axes={axes('tidal')} /> : none(summaryOnly ?? 'Import your card again to see breath size for this night'),
    },
    {
      key: 'minVent',
      onOpen: () => open('minVent'),
      title: 'Air moved a minute',
      meta: 'L/min',
      body: series.minVent ? <LineChart values={series.minVent} height={height} axes={axes('minVent')} /> : none(summaryOnly ?? 'Import your card again to see this for this night'),
    },
  ];
}

/* ---- the night's events, each opening to its breathing waveform ---- */
function EventRow({ ep }) {
  const [open, setOpen] = useState(false);
  const [trace, setTrace] = useState(undefined); // undefined: not loaded; null: none kept
  useEffect(() => {
    if (!open || trace !== undefined) return undefined;
    let live = true;
    wavesFor(ep.date).then((w) => live && setTrace(traceFor(w, ep.at, ep.dur)));
    return () => {
      live = false;
    };
  }, [open, trace, ep]);

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
            {open &&
              (trace === undefined ? (
                <p className="ep-trace-note">Loading the breathing around it…</p>
              ) : trace ? (
                <BreathTrace trace={trace} />
              ) : (
                <p className="ep-trace-note">The card didn’t keep the breathing detail for this night.</p>
              ))}
            <div className="ep-detail">
              <span className="ed-k">Pressure that minute</span>
              <span className="ed-v">{ep.pressure}</span>
            </div>
            <div className="ep-detail">
              <span className="ed-k">Next 3 minutes</span>
              <span className="ed-v">{ep.response}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NightEvents({ fixtureId }) {
  const [all, setAll] = useState(false);
  const longest = EPISODES[fixtureId] || [];
  const every = all ? allEpisodes(fixtureId) : longest;
  const count = allEpisodes(fixtureId).length;
  return (
    <section className="fn-events" aria-label="Events">
      <div className="section-head">
        <h3>{!all && longest.length < count ? 'Longest events' : 'Events'}</h3>
        <span className="meta tnum">
          {!all && longest.length < count ? `${longest.length} of ${count}` : `all ${count}`} · tap for the breathing
        </span>
      </div>
      {every.length ? (
        every.map((ep) => <EventRow key={ep.at} ep={ep} />)
      ) : (
        <div className="connect-cta">
          <p>No events recorded this night.</p>
        </div>
      )}
      {!all && longest.length < count && (
        <button type="button" className="btn ghost fn-all-events" onClick={() => setAll(true)}>
          Show all {count} events
        </button>
      )}
    </section>
  );
}
