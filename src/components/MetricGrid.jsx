/* Nocta — last night's numbers as one 2×2 grid (proposed Tonight layout).
 * Replaces the full-width AHI card + 3-across row: AHI sits in the grid as an
 * equal, so the why-card stays the only hero, and each tile gets room for a
 * plain-language subline at a readable size. Tapping a tile opens the Coach
 * scoped to that metric (DESIGN_SYSTEM › Coach entry › Metric cards). */
import { Icon } from './Icons.jsx';
import { MetricSpark } from './Charts.jsx';
import { CountUp } from '../lib/motion.jsx';
import { getTrends } from '../data/trends.js';

export function MetricGrid({ fixtureId, ahi, items, onMetric }) {
  // AHI's sparkline: the last 7 nights, last night highlighted
  const raw = getTrends(fixtureId, '7d').ahiSeries.map((d) => d.csa + d.osa + d.hyp);
  const peak = Math.max(...raw, 1);
  const week = raw.map((v) => v / peak); // sparklines draw on a 0–1 scale
  const hasAhi = ahi.value != null;
  const tiles = [
    {
      key: 'ahi',
      label: 'AHI',
      value: hasAhi ? ahi.value.toFixed(1) : '—',
      unit: hasAhi ? '/h' : '',
      sub: hasAhi ? `Usually ${ahi.avgSoFar.toFixed(1)}` : 'Too short to score',
      spark: week,
      hot: hasAhi ? [week.length - 1] : [],
    },
    ...items,
  ];

  return (
    <div className="metric-grid">
      {tiles.map((m, i) => (
        <button
          key={m.key}
          type="button"
          className="mg-tile card-enter"
          onClick={() => onMetric(m.label)}
          aria-label={`${m.label} ${m.value}${m.unit ? ` ${m.unit}` : ''}, ${m.sub}. Ask Nox about it`}
        >
          <span className="mg-top">
            <span className="mg-label">{m.label}</span>
            <Icon name="chevronRight" size={15} className="mg-chev" />
          </span>
          <span className="mg-value tnum">
            <CountUp value={m.value} delay={200 + i * 60} />
            {m.unit && <span className="u">{m.unit}</span>}
          </span>
          <span className="mg-sub">{m.sub}</span>
          <MetricSpark values={m.spark} hot={m.hot} height={18} />
        </button>
      ))}
    </div>
  );
}
