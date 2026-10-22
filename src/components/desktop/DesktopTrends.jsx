/* Nocta — desktop Trends view. Same model as the mobile screen: the four metric
 * tiles are tabs that switch one large chart, so every metric shows once
 * (number on the tile, shape in the chart), with the journal patterns
 * beneath. The reading rail beside it holds what stands out (with the way in
 * to Nox), the best/worst night and the journal. Same getTrends() data. */
import { validDate } from '../../lib/format.js';
import { useState } from 'react';
import { THERAPY_START, LAST_NIGHT } from '../../data/history.js';
import { getTrends, trendAxes } from '../../data/trends.js';
import { pressureRange } from '../../data/therapy.js';
import { journalHistory } from '../../data/journal.js';
import { useStore } from '../../lib/store.jsx';
import { CountUp } from '../../lib/motion.jsx';
import { Icon } from '../Icons.jsx';
import { Mascot } from '../Mascot.jsx';
import { Rich } from '../Rich.jsx';
import { PatternCard } from '../PatternCard.jsx';
import { TrendLegend } from '../TrendLegend.jsx';
import { LineChart, StackedBars, Bars } from '../Charts.jsx';
import { moreTrendCharts } from '../MoreTrends.jsx';

const RANGE_LABEL = { '7d': '7 days', '30d': '30 days', '90d': '90 days', custom: 'Custom' };
const RANGE_TABS = ['7d', '30d', '90d', 'custom'];
const GOOD_WHEN_DOWN = ['ahi', 'leak'];
const CHART_H = 260;

function tileTone(key, dir) {
  if (dir === 'flat') return 'flat';
  const goodDown = GOOD_WHEN_DOWN.includes(key);
  return (dir === 'down') === goodDown ? 'good' : '';
}

/* 'YYYY-MM-DD' → 'Oct 10' (parsed as local time so the day doesn't shift) */
function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DesktopTrends() {
  const { fixtureId, openSheet, checkin } = useStore();
  const [range, setRange] = useState('7d');
  const [metric, setMetric] = useState('ahi'); // which tile's chart is showing
  const [customStart, setCustomStart] = useState(THERAPY_START);
  const [customEnd, setCustomEnd] = useState(LAST_NIGHT);

  const custom =
    range === 'custom'
      ? {
          start: customStart,
          end: customEnd,
          startLabel: fmtDate(customStart),
          endLabel: fmtDate(customEnd),
        }
      : null;

  const t = getTrends(fixtureId, range, custom);
  const rx = pressureRange(); // the prescribed window the machine records, if any

  // every chart carries its own key (components/TrendLegend.jsx), so all four
  // are the same height
  // real axes on every Trends chart: dates across, the metric's unit up
  // settings changes are marked on every chart
  const ax = (k) => trendAxes(k, t.dates, { markers: t.markers });
  const CHARTS = {
    ahi: {
      title: 'AHI (events an hour)',
      meta: `avg ${t.ahiAvg}/h`,
      body: <StackedBars series={t.ahiSeries} height={CHART_H} axes={ax('ahi')} />,
    },
    leak: {
      title: 'Leak rate',
      meta: 'L/min',
      body: <LineChart values={t.leakSeries} color="data" threshold={24} height={CHART_H} axes={ax('leak')} />,
    },
    hours: {
      title: 'Usage',
      meta: 'hours a night',
      body: <Bars values={t.hoursSeries} color="data" target={4} height={CHART_H} axes={ax('hours')} />,
    },
    pressure: {
      title: 'Pressure',
      meta: 'cmH₂O',
      body: <LineChart values={t.pressureSeries} color="data" band={rx ?? undefined} height={CHART_H} axes={ax('pressure')} />,
    },
  };
  const chart = CHARTS[metric];

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">Trends</h1>
          <div className="dash-sub">{t.rangeLabel}</div>
        </div>
        <div className="dash-range">
          <div className="segmented" role="tablist" aria-label="Date range">
            {RANGE_TABS.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={r === range}
                className={r === range ? 'on' : ''}
                onClick={() => setRange(r)}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <div className="date-range">
              <label className="dr-field">
                <span>From</span>
                <input
                  type="date"
                  value={customStart}
                  min={THERAPY_START}
                  max={customEnd}
                  onChange={(e) => {
                const v = validDate(e.target.value, THERAPY_START, customEnd);
                if (v) setCustomStart(v);
              }}
                />
              </label>
              <label className="dr-field">
                <span>To</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  max={LAST_NIGHT}
                  onChange={(e) => {
                const v = validDate(e.target.value, customStart, LAST_NIGHT);
                if (v) setCustomEnd(v);
              }}
                />
              </label>
            </div>
          )}
        </div>
      </header>

      <div className="dash-trends-layout">
        <div className="dash-trends-main">
          {/* the four tiles are tabs: each switches the one large chart below */}
          <div className="trend-grid dash-tiles" role="tablist" aria-label="Choose a metric to chart">
            {t.tiles.map((tile) => {
              const tone = tileTone(tile.key, tile.dir);
              const on = tile.key === metric;
              return (
                <button
                  key={tile.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`trend-tile${on ? ' on' : ''}`}
                  onClick={() => setMetric(tile.key)}
                >
                  <div className="tt-label">{tile.label}</div>
                  <div className="tt-row">
                    <div className="tt-value tnum">
                      <CountUp value={tile.value} duration={800} />
                      <span className="u">{tile.unit}</span>
                    </div>
                    <span className={`delta-pill ${tone}`}>
                      {tile.dir !== 'flat' && <Icon name={tile.dir === 'down' ? 'triDown' : 'triUp'} size={9} />}
                      {tile.dir === 'flat' ? tile.note ?? 'steady' : tile.delta}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="chart-card trend-chart dash-trend-chart" key={`${metric}-${range}`} aria-label={chart.title}>
            <div className="tc-head">
              <h3>{chart.title}</h3>
              <span className="meta">{chart.meta}</span>
            </div>
            <TrendLegend metric={metric} rx={rx} />
            {chart.body}
          </section>

          {/* the power-user trends, always shown, two to a row */}
          <section aria-labelledby="more-trends">
            <div className="dash-head">
              <h3 id="more-trends">More trends</h3>
            </div>
            <div className="dash-more-trends">
              {moreTrendCharts(t, 200).map((c) => (
                <section className="chart-card trend-chart" key={`${c.key}-${range}`} aria-label={c.title}>
                  <div className="tc-head">
                    <h3>{c.title}</h3>
                    {c.meta && <span className="meta">{c.meta}</span>}
                  </div>
                  {c.body}
                </section>
              ))}
            </div>
          </section>

          {t.patterns.length > 0 && (
            <section>
              <div className="dash-head">
                <h3>Patterns</h3>
              </div>
              <div className="dash-patterns">
                {t.patterns.map((p, i) => (
                  <PatternCard key={i} pattern={p} window={t.window} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* under the full-width chart: what stands out on the left; the
         * best/worst nights and the journal on the right */}
        <aside className="dash-rail" aria-label="Trend highlights">
          <div className="dash-rail-group">
            <div className="dash-head">
              <h3>What stands out</h3>
            </div>
            <section className="insight-list" aria-label="Trend insights">
              {t.insights.map((ins, i) => (
                <div className="il-row" key={i}>
                  <div className="il-icon">
                    <Icon name={ins.icon} size={15} />
                  </div>
                  <div className="il-text">
                    <Rich text={ins.text} />
                  </div>
                </div>
              ))}
              <button
                className="ask-row"
                type="button"
                onClick={() =>
                  openSheet('coach', {
                    context: {
                      kind: 'trends',
                      range: t.rangeLabel,
                      summary: t.insights[0]?.text,
                      worst: t.bestWorst?.worst.date,
                    },
                  })
                }
              >
                <Mascot size={22} />
                <span>Ask Nox about these trends</span>
                <Icon name="chevronRight" size={15} className="ask-chev" />
              </button>
            </section>
          </div>

          <div className="dash-rail-group">
            {t.bestWorst && (
              <>
                <div className="dash-head">
                  <h3>Lowest &amp; highest AHI</h3>
                  <button className="dash-head-action" onClick={() => openSheet('compare')}>
                    Compare nights
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
                <div className="compare">
                  <div className="cmp-card best">
                    <div className="cmp-tag">Lowest</div>
                    <div className="cmp-date">{t.bestWorst.best.date}</div>
                    <div className="cmp-ahi tnum">
                      <CountUp value={t.bestWorst.best.ahi} duration={900} />
                    </div>
                    <div className="cmp-sub">{t.bestWorst.best.note}</div>
                  </div>
                  <div className="cmp-card worst">
                    <div className="cmp-tag">Highest</div>
                    <div className="cmp-date">{t.bestWorst.worst.date}</div>
                    <div className="cmp-ahi tnum">
                      <CountUp value={t.bestWorst.worst.ahi} duration={900} />
                    </div>
                    <div className="cmp-sub">{t.bestWorst.worst.note}</div>
                  </div>
                </div>
              </>
            )}

            <div className="dash-head">
              <h3>Sleep journal</h3>
            </div>
            <div className="list">
              <button className="list-row" onClick={() => openSheet('journal')}>
                <div className="lr-icon bare">
                  <Icon name="doc" size={17} />
                </div>
                <div className="lr-main">
                  <div className="lr-title">View all entries</div>
                  <div className="lr-sub">{journalHistory(checkin).length} nights logged</div>
                </div>
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* <p className="disclaimer">Trends describe your data. They are not a diagnosis.</p> */}
    </>
  );
}
