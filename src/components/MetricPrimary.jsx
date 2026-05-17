/* Nocta — AHI primary metric card with the baseline strip (replaces donut gauges). */
import { Icon } from './Icons.jsx';

export function MetricPrimary({ ahi }) {
  const hasValue = ahi.value != null;
  const dirClass = ahi.dir === 'down' ? 'good' : ahi.dir === 'flat' ? 'flat' : '';
  const [rLo, rHi] = ahi.rangePct;

  return (
    <section className="ahi-card card-enter" aria-label="AHI for last night">
      <div className="ahi-top">
        <div>
          <div className="label">AHI · Events per hour</div>
          <div className="ahi-value tnum">{hasValue ? ahi.value.toFixed(1) : '—'}</div>
          <div className="ahi-unit">
            {hasValue ? `vs. 14-day average ${ahi.avg14.toFixed(1)}` : 'Last night was too short to score'}
          </div>
        </div>
        {hasValue && ahi.delta != null && (
          <span className={`delta-pill ${dirClass}`} aria-label={`${ahi.dir} ${ahi.delta}`}>
            {ahi.dir !== 'flat' && <Icon name={ahi.dir === 'down' ? 'triDown' : 'triUp'} size={10} />}
            {ahi.delta.toFixed(1)}
          </span>
        )}
      </div>

      <div className="baseline" aria-hidden="true">
        <div className="range" style={{ left: `${rLo}%`, width: `${rHi - rLo}%` }} />
        {hasValue && ahi.markerPct != null && (
          <div className="marker" style={{ left: `${ahi.markerPct}%` }} />
        )}
      </div>
      <div className="baseline-labels">
        <span>0</span>
        <span className="you">{hasValue ? `You · ${ahi.value.toFixed(1)}` : 'Not scored'}</span>
        <span>30+</span>
      </div>
    </section>
  );
}
