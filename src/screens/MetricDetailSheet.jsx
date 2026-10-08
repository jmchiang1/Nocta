/* Nocta — one machine measurement, full page (Apple Health style): its key
 * number, the night's graph large, and a plain-language "About". Pushed from
 * the full-night page (store.pushSheet), so Back returns there. */
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { NIGHT_METRICS, metricStat } from '../data/nightMetrics.js';
import { nightSeries } from '../lib/nightSeries.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { Mascot } from '../components/Mascot.jsx';
import { LineChart, Waveform, Bars } from '../components/Charts.jsx';
import { TimeAxis } from '../components/TimeAxis.jsx';
import { PRESSURE_RANGE } from '../data/therapy.js';

const CHART_H = 240;

function MetricChart({ metric, series }) {
  if (metric === 'flow') return <Waveform amps={series.flow} color="data" height={CHART_H} />;
  if (metric === 'pressure')
    return <LineChart values={series.pressure} color="data" height={CHART_H} band={PRESSURE_RANGE} />;
  if (metric === 'leak' && !series.leak)
    return <div className="fn-nodata md-nodata">No leak recorded this night</div>;
  if (metric === 'leak') return <LineChart values={series.leak} color="data" height={CHART_H} threshold={24} />;
  return <Bars values={series.snore} color="data" height={CHART_H} />;
}

export function MetricDetailSheet() {
  const { sheet, fixtureId, closeSheet, pushSheet } = useStore();
  const key = sheet?.metric ?? 'leak';
  const m = NIGHT_METRICS[key];
  const fx = FIXTURES[fixtureId];
  const series = nightSeries(fixtureId);
  const stat = metricStat(key, series, fx);
  const unit = stat.unit ?? m.unit;

  return (
    <Sheet
      variant="page"
      eyebrow={`${fx.dayName} · ${fx.session.start} – ${fx.session.end}`}
      title={m.title}
      onClose={closeSheet}
    >
      {() => (
        <div className="md">
          <div className="md-stat">
            <span className="md-k">{stat.label}</span>
            <span className="md-v tnum">
              {stat.value}
              {unit && <span className="md-u">{unit}</span>}
            </span>
            <span className="md-sub">{stat.sub}</span>
          </div>

          <div className="chart-card md-chart" role="img" aria-label={`${m.title} through the night. ${stat.sub}.`}>
            <MetricChart metric={key} series={series} />
            <TimeAxis session={fx.session} />
          </div>
          {key === 'pressure' && (
            <p className="md-note">Shaded: your prescribed range, {PRESSURE_RANGE[0]}–{PRESSURE_RANGE[1]} cmH₂O</p>
          )}
          {key === 'leak' && series.leak && <p className="md-note">Dashed line: 24 L/min</p>}

          <section className="md-about">
            <h3>About {m.title.toLowerCase()}</h3>
            <p>{m.about}</p>
          </section>

          <button
            className="ask-row md-ask"
            type="button"
            onClick={() =>
              pushSheet('coach', {
                context: { kind: 'metric', metric: key, label: m.title, sentence: stat.sentence },
              })
            }
          >
            <Mascot size={22} />
            <span>Ask Nox about {m.title.toLowerCase()}</span>
            <Icon name="chevronRight" size={15} className="ask-chev" />
          </button>
        </div>
      )}
    </Sheet>
  );
}
