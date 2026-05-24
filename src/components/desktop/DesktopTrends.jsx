/* Nocta — desktop Trends view. Range selector + summary tiles, then a 2×2 grid
 * of the trend charts, best/worst night, and journal patterns. Reuses the same
 * getTrends() data and chart primitives as the mobile screen. */
import { useState } from 'react';
import { getTrends } from '../../data/trends.js';
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { Rich } from '../Rich.jsx';
import { PatternCard } from '../PatternCard.jsx';
import { LineChart, StackedBars, Bars, MetricSpark } from '../Charts.jsx';

const RANGE_LABEL = { '7d': '7 days', '30d': '30 days', '90d': '90 days', custom: 'Custom' };
const RANGE_TABS = ['7d', '30d', '90d', 'custom'];
const GOOD_WHEN_DOWN = ['ahi', 'leak'];

function norm(arr) {
  const max = Math.max(...arr) || 1;
  return arr.map((v) => v / max);
}
function tileTone(key, dir) {
  if (dir === 'flat') return 'flat';
  const goodDown = GOOD_WHEN_DOWN.includes(key);
  return (dir === 'down') === goodDown ? 'good' : '';
}

/* 'YYYY-MM-DD' → 'Jun 7' (parsed as local time so the day doesn't shift) */
function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
/* inclusive night count between two ISO dates */
function nightCount(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
}

export function DesktopTrends() {
  const { fixtureId } = useStore();
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('2026-05-25');
  const [customEnd, setCustomEnd] = useState('2026-06-07');

  const custom =
    range === 'custom'
      ? {
          nights: Math.max(2, nightCount(customStart, customEnd)),
          startLabel: fmtDate(customStart),
          endLabel: fmtDate(customEnd),
        }
      : null;

  const t = getTrends(fixtureId, range, custom);
  const ahiTotals = t.ahiSeries.map((d) => d.csa + d.osa + d.hyp);
  const sparks = {
    ahi: norm(ahiTotals),
    leak: norm(t.leakSeries),
    hours: norm(t.hoursSeries),
    pressure: norm(t.pressureSeries.slice(0, 14)),
  };

  const insightList = (
    <section className="insight-list" aria-label="Trend insights">
      {t.insights.map((ins, i) => (
        <div className="il-row" key={i}>
          <div className="il-icon"><Icon name={ins.icon} size={15} /></div>
          <div className="il-text"><Rich text={ins.text} /></div>
        </div>
      ))}
    </section>
  );

  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">Trends</h1>
          <div className="dash-sub">{t.rangeLabel}</div>
        </div>
        <div className="dash-range">
          <div className="segmented" role="tablist">
            {RANGE_TABS.map((r) => (
              <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>
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
                  max={customEnd}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <label className="dr-field">
                <span>To</span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>
      </header>

      <div className="dash-tiles">
        {t.tiles.map((tile) => {
          const tone = tileTone(tile.key, tile.dir);
          return (
            <div key={tile.key} className="trend-tile">
              <div className="tt-label">{tile.label}</div>
              <div className="tt-value tnum">
                {tile.value}
                <span className="u">{tile.unit}</span>
              </div>
              <span className={`delta-pill ${tone}`}>
                {tile.dir !== 'flat' && (
                  <Icon name={tile.dir === 'down' ? 'triDown' : 'triUp'} size={9} />
                )}
                {tile.dir === 'flat' ? tile.note ?? 'steady' : tile.delta}
              </span>
              <MetricSpark values={sparks[tile.key]} />
            </div>
          );
        })}
      </div>

      <div className="dash-grid dash-grid-charts">
        <div className="panel">
          <div className="panel-head">
            <h3>AHI events</h3>
            <span className="panel-meta">avg {t.ahiAvg}/h</span>
          </div>
          <div className="legend dash-legend">
            <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--alert)' }} /> Central</span>
            <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--data-deep)' }} /> Obstructive</span>
            <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--data-1)' }} /> Hypopnea</span>
          </div>
          <StackedBars series={t.ahiSeries} height={188} />
          <div className="chart-axis">{t.xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Pressure</h3>
            <span className="panel-meta">cmH₂O</span>
          </div>
          <LineChart values={t.pressureSeries} color="data" height={188} />
          <div className="chart-axis">{t.xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Leak rate</h3>
            <span className="panel-meta">L/min · 24 threshold</span>
          </div>
          <LineChart values={t.leakSeries} color="data" threshold={24} height={188} />
          <div className="chart-axis">{t.xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Usage</h3>
            <span className="panel-meta">hours · 4h compliance</span>
          </div>
          <Bars values={t.hoursSeries} color="data" target={4} height={188} />
          <div className="chart-axis">{t.xLabels.map((l, i) => <span key={i}>{l}</span>)}</div>
        </div>
      </div>

      {t.patterns.length > 0 ? (
        <div className="dash-grid dash-grid-2">
          {insightList}
          <div className="dash-patterns">
            {t.patterns.map((p, i) => (
              <PatternCard key={i} pattern={p} window={t.window} />
            ))}
          </div>
        </div>
      ) : (
        insightList
      )}

      {t.bestWorst && (
        <>
          <div className="dash-head">
            <h3>Best &amp; worst night</h3>
          </div>
          <div className="compare">
            <div className="cmp-card best">
              <div className="cmp-tag">Best</div>
              <div className="cmp-date">{t.bestWorst.best.date}</div>
              <div className="cmp-ahi tnum">{t.bestWorst.best.ahi}</div>
              <div className="cmp-sub">{t.bestWorst.best.note}</div>
            </div>
            <div className="cmp-card worst">
              <div className="cmp-tag">Worst</div>
              <div className="cmp-date">{t.bestWorst.worst.date}</div>
              <div className="cmp-ahi tnum">{t.bestWorst.worst.ahi}</div>
              <div className="cmp-sub">{t.bestWorst.worst.note}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
