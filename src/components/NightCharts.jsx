/* Nocta — the full night's machine charts, shared by the phone page and the
 * desktop page so both show the same charts in the same order. Every chart
 * plots the card's readings as they are (lib/nightSeries.js,
 * lib/nightDetail.js); the charts fit the data, never the other way round.
 * Plain readouts in the metric blue: no scoring colours, no advice. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nightSeries, metricAxes } from '../lib/nightSeries.js';
import { nightDetail } from '../lib/nightDetail.js';
import { wavesFor, traceFor } from '../lib/waves.js';
import { FIXTURES, allEpisodes } from '../data/fixtures.js';
import { LineChart, Bars, SessionsChart, PressureHistogram, BreathTrace } from './Charts.jsx';
import { TrendLegend } from './TrendLegend.jsx';
import { Icon } from './Icons.jsx';
import { useStore } from '../lib/store.jsx';

const none = (text) => <span className="fn-nodata">{text}</span>;

/* the night's charts, in order: [{ key, title, onOpen?, wide?, body }].
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
      body: d?.spans.length ? <SessionsChart spans={d.spans} height={72} /> : none('No mask sessions recorded this night'),
    },
    {
      key: 'resp',
      title: 'Breathing rate',
      onOpen: () => open('resp'),
      body: series.resp ? <LineChart values={series.resp} height={height} axes={axes('resp')} /> : none(summaryOnly ?? 'No breathing rate recorded this night'),
    },
    {
      key: 'pressure',
      title: 'Mask pressure',
      onOpen: () => open('pressure'),
      body: series.pressure ? <LineChart values={series.pressure} height={height} axes={axes('pressure')} /> : none(summaryOnly ?? 'No pressure recorded this night'),
    },
    {
      key: 'setPressure',
      onOpen: () => open('setPressure'),
      title: 'Set pressure and your range',
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
      onOpen: () => open('leak'),
      body: series.leak ? <LineChart values={series.leak} threshold={24} height={height} axes={axes('leak')} /> : none(summaryOnly ?? 'No leak recorded this night'),
    },
    {
      key: 'flow',
      onOpen: () => open('flow'),
      title: 'Flow limitation',
      body: series.flow ? <LineChart values={series.flow} height={height} axes={axes('flow')} /> : none(summaryOnly ?? 'No flow limitation recorded this night'),
    },
    {
      key: 'snore',
      title: 'Snore index',
      onOpen: () => open('snore'),
      body: series.snore ? <Bars values={series.snore} height={height} axes={axes('snore')} /> : none(summaryOnly ?? 'No snore data this night'),
    },
    {
      key: 'tidal',
      onOpen: () => open('tidal'),
      title: 'Breath size',
      body: series.tidal ? <LineChart values={series.tidal} height={height} axes={axes('tidal')} /> : none(summaryOnly ?? 'Import your card again to see breath size for this night'),
    },
    {
      key: 'minVent',
      onOpen: () => open('minVent'),
      title: 'Air moved a minute',
      body: series.minVent ? <LineChart values={series.minVent} height={height} axes={axes('minVent')} /> : none(summaryOnly ?? 'Import your card again to see this for this night'),
    },
  ];
}

/* ---- the night's events, each opening to its breathing waveform ---- */
function EventRow({ ep, escalated }) {
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
        <span className={`ep-badge ${ep.type}${escalated && ep.type === 'CSA' ? ' flag' : ''}`}>{TYPE_NAME[ep.type] ?? ep.type}</span>
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

/* the night's events, each with its breathing ("Events by type"): "Show"
 * picks which types (chips, with counts) and "Sort" the order (a dropdown
 * pill), side by side in one row so the two never look alike. On a phone
 * there's no room for both, so they fold into one button that slides up a
 * sheet with the two choices (screens/EventFilterSheet.jsx). */
export const SORTS = [
  { id: 'time', label: 'Time' },
  { id: 'duration', label: 'Longest' },
  { id: 'type', label: 'Type' },
];
const TYPE_ORDER = ['CSA', 'OSA', 'Hypopnea', 'Apnea'];
export const TYPE_NAME = { CSA: 'Central', OSA: 'Obstructive', Hypopnea: 'Hypopnea', Apnea: 'Unclassified' };
const SHOW = 8; // the first stretch of the list; "Show all" for the rest
const byTime = (a, b) => a.at.localeCompare(b.at);
const SORTERS = {
  time: byTime,
  type: (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || byTime(a, b),
  duration: (a, b) => b.dur - a.dur || byTime(a, b),
};

export function NightEvents({ fixtureId }) {
  const { viewMode, pushSheet } = useStore();
  const [sort, setSort] = useState('time');
  const [type, setType] = useState('all');
  const [all, setAll] = useState(false);
  const events = allEpisodes(fixtureId);
  const types = TYPE_ORDER.filter((t) => events.some((e) => e.type === t));
  const list = events.filter((e) => type === 'all' || e.type === type).sort(SORTERS[sort]);
  const shown = all ? list : list.slice(0, SHOW);
  // central events turn coral only on a night flagged for the doctor, as in
  // the Events summary chart above
  const escalated = FIXTURES[fixtureId]?.insight.escalation_flag === 'hard';
  // switching between All / Central / … keeps the list the same height (room
  // for the first eight rows and the Show all button), so the page doesn't
  // jump; one row's height is measured, since it follows the type size
  const listRef = useRef(null);
  const [rowH, setRowH] = useState(55);
  useLayoutEffect(() => {
    const row = listRef.current?.querySelector('.episode');
    if (!row) return;
    const h = row.offsetHeight + parseFloat(getComputedStyle(row).marginBottom || 0);
    if (h > 0 && Math.abs(h - rowH) > 0.5) setRowH(h);
  });
  const reserve = all ? 0 : Math.min(SHOW, events.length);
  const moreSlot = !all && events.length > SHOW; // any filter could need "Show all"

  return (
    <section className="fn-events" aria-label="Events by type">
      <div className="section-head">
        <h3>Events by type</h3>
      </div>

      {/* one row: which events (Show chips) on the left, their order (Sort)
       * on the right; on a phone the chips scroll between the two */}
      {events.length > 1 && viewMode !== 'desktop' && (
        <div className="ev-bar">
          {/* the phone: one button, both choices in a sheet */}
          <button
            type="button"
            className="ev-filter-btn"
            onClick={() =>
              pushSheet('eventFilter', {
                types: ['all', ...types].map((t) => ({
                  id: t,
                  label: t === 'all' ? 'All' : TYPE_NAME[t],
                  n: t === 'all' ? events.length : events.filter((e) => e.type === t).length,
                })),
                type,
                sort,
                onType: (t) => {
                  setType(t);
                  setAll(false);
                },
                onSort: setSort,
              })
            }
          >
            <Icon name="sliders" size={17} />
            <span className="ev-filter-v">
              {type === 'all' ? 'All' : TYPE_NAME[type]} · {SORTS.find((o) => o.id === sort).label}
            </span>
            <Icon name="chevronDown" size={14} />
          </button>
          <span className="ev-filter-n tnum">
            {list.length} {list.length === 1 ? 'event' : 'events'}
          </span>
        </div>
      )}
      {events.length > 1 && viewMode === 'desktop' && (
        <div className="ev-bar">
          {types.length > 1 && (
            <div className="ev-show" role="radiogroup" aria-label="Show events">
              <span className="ev-show-k" aria-hidden="true">
                Show
              </span>
              <div className="ev-chips">
                {['all', ...types].map((t) => {
                  const n = t === 'all' ? events.length : events.filter((e) => e.type === t).length;
                  const on = type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`ev-chip${on ? ' on' : ''}`}
                      onClick={() => {
                        setType(t);
                        setAll(false);
                      }}
                    >
                      {t === 'all' ? 'All' : TYPE_NAME[t]}
                      <span className="ev-chip-n tnum">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* the pill shows the choice; the native select lies invisibly over
           * all of it, so a click or tap anywhere opens the picker */}
          <label className="ev-sort">
            <span className="ev-sort-k">Sort</span>
            <span className="ev-sort-v">{SORTS.find((o) => o.id === sort).label}</span>
            <Icon name="chevronDown" size={14} />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort events by">
              {SORTS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {shown.length ? (
        <div className="ev-list" ref={listRef} style={{ minHeight: reserve * rowH }}>
          {shown.map((ep) => (
            <EventRow key={ep.at} ep={ep} escalated={escalated} />
          ))}
        </div>
      ) : (
        <div className="connect-cta">
          <p>No events recorded this night.</p>
        </div>
      )}
      {shown.length < list.length ? (
        <button type="button" className="btn ghost fn-all-events" onClick={() => setAll(true)}>
          Show all {list.length}
          {type !== 'all' && ` ${TYPE_NAME[type].toLowerCase()}`} events
        </button>
      ) : (
        // the button's room, kept while another filter would show it
        moreSlot && <div className="btn fn-all-events ev-slot" aria-hidden="true" />
      )}
    </section>
  );
}
