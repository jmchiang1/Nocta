/* Nocta — Apple Watch "body response" card. Optional: rendered on Tonight only
 * when the night fixture carries a `bodyResponse` block (future HealthKit
 * integration; mock data in v1). Four collapsible sections — heart rate, blood
 * oxygen, sleep stages, awakenings — each collapsed by default, showing a key
 * stat on its summary row. Data display only — no scoring, no diagnosis. */
import { LineChart, ProgressBar } from './Charts.jsx';
import { SleepStages } from './SleepStages.jsx';
import { Icon } from './Icons.jsx';
import { fmtDur } from '../lib/format.js';

function avgOf(series) {
  return Math.round(series.reduce((s, v) => s + v, 0) / series.length);
}

function Stat({ label, value, unit }) {
  return (
    <div className="bc-stat">
      <span className="bc-k">{label}</span>
      <span className="bc-v tnum">
        {value}
        {unit && value !== '—' && <i>{unit}</i>}
      </span>
    </div>
  );
}

/* one collapsible section — collapsed by default (no `open` attribute) */
function Section({ title, summary, children }) {
  return (
    <details className="bc-section">
      <summary className="bc-summary">
        <span className="bc-summary-title">{title}</span>
        <span className="bc-summary-val tnum">{summary}</span>
        <Icon name="chevronDown" size={16} className="bc-chev" />
      </summary>
      <div className="bc-section-body">{children}</div>
    </details>
  );
}

export function BodyResponse({ data, session }) {
  const { source, note, hr, hrv, respRate, sleep, spo2, stages, awakenings, latencyMin } = data;
  const hasHr = hr && hr.series && hr.series.length > 0;
  const avgHr = hasHr ? avgOf(hr.series) : null;
  const lowHr = hasHr ? Math.round(Math.min(...hr.series)) : null;
  const asleepPct = (sleep.asleepHours / sleep.maskOnHours) * 100;
  const asleepH = stages ? stages.deep + stages.rem + stages.light : 0;
  const hasSpo2 = spo2 && spo2.avg !== '—';
  const hasAwakenings = awakenings != null && awakenings !== '—';

  return (
    <section className="body-card" aria-label={`Body response from your ${source || 'wearable'}`}>
      {source && <div className="bc-source">{source}</div>}
      {hasHr && (
        <Section title="Heart rate" summary={`${avgHr} bpm avg`}>
          <LineChart values={hr.series} color="data" height={94} yMin={40} band={hr.typical} />
          {hr.typical && (
            <div className="band-key">Shaded — your usual overnight range, {hr.typical[0]}–{hr.typical[1]} bpm</div>
          )}
          <p className="bc-note">{note}</p>
          <div className="bc-stats">
            <Stat label="Avg HR" value={avgHr} unit="bpm" />
            <Stat label="Low HR" value={lowHr} unit="bpm" />
            {hrv && <Stat label="HRV" value={hrv.value} unit={hrv.unit} />}
            {respRate && <Stat label="Resp" value={respRate.value} unit={respRate.unit} />}
          </div>
        </Section>
      )}

      {spo2 !== null && (
        <Section title="Blood oxygen" summary={hasSpo2 ? `${spo2.avg}% avg` : '—'}>
          <>
            <div className="bc-stats">
              <Stat label="Avg O₂" value={spo2.avg} unit={spo2.unit} />
              <Stat label="Low O₂" value={spo2.low} unit={spo2.unit} />
            </div>
            {spo2.flag && (
              <p className="bc-flag">
                <Icon name="info" size={14} />
                <span>{spo2.flag}</span>
              </p>
            )}
          </>
        </Section>
      )}

      {stages && (
        <Section title="Sleep stages" summary={`${fmtDur(asleepH)} asleep`}>
          <SleepStages stages={stages} session={session} />
          <div className="bc-sleep">
            <div className="bc-sleep-label">
              Asleep <strong>{sleep.asleepHours}h</strong> of <strong>{sleep.maskOnHours}h</strong>{' '}
              with the mask on
            </div>
            <ProgressBar pct={asleepPct} color="data" height={8} />
          </div>
        </Section>
      )}

      {hasAwakenings && (
        <Section title="Awakenings" summary={`${awakenings}×`}>
          <div className="bc-stats">
            <Stat label="Wake-ups" value={awakenings} />
            <Stat label="Fell asleep" value={latencyMin} unit="min" />
          </div>
        </Section>
      )}
    </section>
  );
}
