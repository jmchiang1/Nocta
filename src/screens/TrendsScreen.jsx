/* Nocta — Trends tab. Range selector, trend charts, journal patterns, best/worst night. */
import { useState } from 'react';
import { THERAPY_START, LAST_NIGHT } from '../data/history.js';
import { getTrends } from '../data/trends.js';
import { PRESSURE_RANGE } from '../data/therapy.js';
import { JOURNAL_HISTORY } from '../data/journal.js';
import { useStore } from '../lib/store.jsx';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { CountUp } from '../lib/motion.jsx';
import { Icon } from '../components/Icons.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { Rich } from '../components/Rich.jsx';
import { PatternCard } from '../components/PatternCard.jsx';
import { LineChart, StackedBars, Bars, MetricSpark } from '../components/Charts.jsx';

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

/* 'YYYY-MM-DD' → 'Oct 10' (parsed as local time so the day doesn't shift) */
function fmtDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrendsScreen() {
  const { fixtureId, openSheet } = useStore();
  const [range, setRange] = useState('7d');
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
  const ahiTotals = t.ahiSeries.map((d) => d.csa + d.osa + d.hyp);
  const sparks = {
    ahi: norm(ahiTotals),
    leak: norm(t.leakSeries),
    hours: norm(t.hoursSeries),
    pressure: norm(t.pressureSeries.slice(0, 14)),
  };

  const rangeIndex = RANGE_TABS.indexOf(range);

  return (
    <ScreenFrame title="Trends">
      <header className="page-head">
        <div>
          <h1>Trends</h1>
          <div className="sub">{t.rangeLabel}</div>
        </div>
      </header>

      <div className="segmented glass" role="tablist" style={{ '--seg-n': RANGE_TABS.length }}>
        <span
          className="seg-thumb"
          aria-hidden="true"
          style={{ transform: `translateX(calc(${rangeIndex * 100}% + ${rangeIndex * 3}px))` }}
        />
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
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </label>
          <label className="dr-field">
            <span>To</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              max={LAST_NIGHT}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="trend-grid">
        {t.tiles.map((tile) => {
          const tone = tileTone(tile.key, tile.dir);
          return (
            <div key={tile.key} className="trend-tile">
              <div className="tt-label">{tile.label}</div>
              <div className="tt-value tnum">
                <CountUp value={tile.value} duration={800} />
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
          onClick={() => openSheet('coach', { context: { kind: 'trends', range: t.rangeLabel } })}
        >
          <Mascot size={22} />
          <span>Ask Nocta about these trends</span>
          <Icon name="chevronRight" size={15} className="ask-chev" />
        </button>
      </section>

      <div className="section-head">
        <h3>AHI events</h3>
        <span className="meta">avg {t.ahiAvg}/h</span>
      </div>
      <div className="chart-card">
        <div className="legend" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', marginBottom: 10 }}>
          <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--alert)' }} /> Central</span>
          <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--data-deep)' }} /> Obstructive</span>
          <span><span className="swatch" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--data-1)' }} /> Hypopnea</span>
        </div>
        <StackedBars series={t.ahiSeries} />
        <div className="chart-axis">
          {t.xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h3>Pressure</h3>
        <span className="meta">cmH₂O · shaded: prescribed {PRESSURE_RANGE[0]}–{PRESSURE_RANGE[1]}</span>
      </div>
      <div className="chart-card">
        <LineChart values={t.pressureSeries} color="data" band={PRESSURE_RANGE} />
        <div className="chart-axis">
          {t.xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h3>Leak rate</h3>
        <span className="meta">L/min · 24 threshold</span>
      </div>
      <div className="chart-card">
        <LineChart values={t.leakSeries} color="data" threshold={24} />
        <div className="chart-axis">
          {t.xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>

      <div className="section-head">
        <h3>Usage</h3>
        <span className="meta">hours · 4h compliance bar</span>
      </div>
      <div className="chart-card">
        <Bars values={t.hoursSeries} color="data" target={4} />
        <div className="chart-axis">
          {t.xLabels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>

      {t.bestWorst && (
        <>
          <div className="section-head">
            <h3>Best &amp; worst night</h3>
          </div>
          <div className="compare">
            <div className="cmp-card best">
              <div className="cmp-tag">Best</div>
              <div className="cmp-date">{t.bestWorst.best.date}</div>
              <div className="cmp-ahi tnum">
                <CountUp value={t.bestWorst.best.ahi} duration={900} />
              </div>
              <div className="cmp-sub">{t.bestWorst.best.note}</div>
            </div>
            <div className="cmp-card worst">
              <div className="cmp-tag">Worst</div>
              <div className="cmp-date">{t.bestWorst.worst.date}</div>
              <div className="cmp-ahi tnum">
                <CountUp value={t.bestWorst.worst.ahi} duration={900} />
              </div>
              <div className="cmp-sub">{t.bestWorst.worst.note}</div>
            </div>
          </div>
        </>
      )}

      {t.patterns.length > 0 && (
        <>
          <div className="section-head">
            <h3>Patterns</h3>
            <span className="meta">from your journal</span>
          </div>
          {t.patterns.map((p, i) => (
            <PatternCard key={i} pattern={p} window={t.window} />
          ))}
        </>
      )}

      <div className="section-head">
        <h3>Sleep journal</h3>
      </div>
      <div className="list">
        <button className="list-row" onClick={() => openSheet('journal')}>
          <div className="lr-icon bare">
            <Icon name="doc" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">View all entries</div>
            <div className="lr-sub">{JOURNAL_HISTORY.length} nights logged</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>

      <p className="disclaimer">Trends describe your data. They are not a diagnosis.</p>
    </ScreenFrame>
  );
}
