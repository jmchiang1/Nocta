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
  const totalH = stages.deep + stages.rem + stages.light + stages.awake;
  const samples = genHypnogram(
    `hyp-${stages.deep}-${stages.rem}-${stages.light}-${stages.awake}`,
    stages
  );
  /* share of the whole night (including awake), so the four bars sum to 100 */
  const pct = (h) => (totalH > 0 ? Math.round((h / totalH) * 100) : 0);

  return (
    <div className="sleep-stages">
      <Hypnogram samples={samples} />
      {session && (
        <div className="ss-axis">
          <span className="time-pill tnum">{session.start}</span>
          <span className="time-pill tnum">{session.end}</span>
        </div>
      )}
      <div className="ss-legend">
        {STAGE_ORDER.map(({ key, label }) => (
          <div key={key} className="ss-row">
            <div className="ss-row-top">
              <span className="ss-name">{label}</span>
              <span className="ss-dur tnum">
                {fmtDur(stages[key])}
                <span className="ss-pct tnum"> · {pct(stages[key])}%</span>
              </span>
            </div>
            <div className="ss-track">
              <span className={`ss-fill stage-${key}`} style={{ width: `${pct(stages[key])}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
