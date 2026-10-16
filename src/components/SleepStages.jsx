/* Nocta — overnight sleep-stage hypnogram + legend. Shared by the Tonight
 * body-response card and the full-night sheet. `stages` is wearable-measured
 * hours { deep, rem, light, awake }, plus `phases` when the wearable shares
 * its stage-by-stage sequence. */
import { Hypnogram, STAGE_TICKS } from './Charts.jsx';
import { genHypnogram, fmtDur } from '../lib/format.js';
import { sessionSpan, clockAxes } from '../lib/nightSeries.js';

/* awake at the top of the chart, deep at the bottom */
const STAGE_ORDER = [
  { key: 'awake', label: 'Awake' },
  { key: 'rem', label: 'REM' },
  { key: 'light', label: 'Light' },
  { key: 'deep', label: 'Deep' },
];

/* the night's stage sequence; the night chart's scrub readout uses the same
 * one. A wearable that shares its real 5-minute sequence (Oura) is drawn as
 * recorded; one that only gives totals gets a sequence drawn from them. */
export const hypnogramFor = (stages) =>
  stages.phases?.length
    ? stages.phases
    : genHypnogram(`hyp-${stages.deep}-${stages.rem}-${stages.light}-${stages.awake}`, stages);

/* detailed (the full-night page): real axes — clock time across, each stage
 * named up the side — in place of the start/end pills */
export function SleepStages({ stages, session, detailed = false }) {
  const totalH = stages.deep + stages.rem + stages.light + stages.awake;
  const samples = hypnogramFor(stages);
  const { start, span } = sessionSpan(session);
  const axes =
    detailed && start != null
      ? clockAxes(
          // minutes since noon → since midnight; each sample an equal slice
          samples.map((_, i) => start + 720 + Math.floor((i * span) / samples.length)),
          { ...STAGE_TICKS, yTitle: 'Stage' }
        )
      : undefined;
  /* share of the whole night (including awake), so the four bars sum to 100 */
  const pct = (h) => (totalH > 0 ? Math.round((h / totalH) * 100) : 0);

  return (
    <div className="sleep-stages">
      <Hypnogram samples={samples} axes={axes} height={axes ? 170 : undefined} />
      {session && !axes && (
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
