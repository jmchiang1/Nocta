/* Nocta — overnight sleep-stage hypnogram + legend. Shared by the Tonight
 * body-response card and the full-night sheet. `stages` is watch-measured
 * hours { deep, rem, light, awake }; the hypnogram is generated from them. */
import { Hypnogram } from './Charts.jsx';
import { genHypnogram, fmtDur } from '../lib/format.js';

/* awake at the top of the chart, deep at the bottom */
const STAGE_ORDER = [
  { key: 'awake', label: 'Awake' },
  { key: 'rem', label: 'REM' },
  { key: 'light', label: 'Light' },
  { key: 'deep', label: 'Deep' },
];

export function SleepStages({ stages, session }) {
  const asleepH = stages.deep + stages.rem + stages.light;
  const samples = genHypnogram(
    `hyp-${stages.deep}-${stages.rem}-${stages.light}-${stages.awake}`,
    stages
  );
  const pct = (h) => (asleepH > 0 ? Math.round((h / asleepH) * 100) : 0);

  return (
    <div className="sleep-stages">
      <Hypnogram samples={samples} />
      {session && (
        <div className="ss-axis">
          <span>{session.start}</span>
          <span>{session.end}</span>
        </div>
      )}
      <div className="ss-legend">
        {STAGE_ORDER.map(({ key, label }) => (
          <div key={key} className="ss-row">
            <i className={`ss-dot stage-${key}`} />
            <span className="ss-name">{label}</span>
            <span className="ss-dur tnum">{fmtDur(stages[key])}</span>
            <span className="ss-pct tnum">{key === 'awake' ? '' : `${pct(stages[key])}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
