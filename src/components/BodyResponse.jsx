/* Nocta — "your body overnight" card, one per connected wearable
 * (lib/bodySource.js builds the data from synced nights). Four collapsible
 * sections (heart and breathing, blood oxygen, sleep stages, awakenings),
 * each collapsed by default with a key stat on its summary row. A section
 * shows only what that wearable measured. Data display only: no scoring, no
 * diagnosis. */
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
  const series = hr?.series?.length ? hr.series : null;
  const avgHr = hr?.avg ?? (series ? avgOf(series) : null);
  const lowHr = hr?.low ?? (series ? Math.round(Math.min(...series)) : null);
  const restingHr = hr?.resting ?? null;
  const hasHeart = avgHr != null || restingHr != null || hrv || respRate;
  const heartSummary =
    avgHr != null
      ? `${avgHr} bpm avg`
      : restingHr != null
        ? `${restingHr} bpm resting`
        : hrv
          ? `${hrv.value} ms HRV`
          : `${respRate?.value} br/min`;
  const asleepH = stages ? stages.deep + stages.rem + stages.light : 0;
  const asleepPct = sleep ? Math.min(100, (sleep.asleepHours / sleep.maskOnHours) * 100) : 0;
  const hasAwakenings = awakenings != null;

  return (
    <section className="body-card" aria-label={`Body response from your ${source || 'wearable'}`}>
      {source && <div className="bc-source">{source}</div>}
      {hasHeart && (
        <Section title={avgHr != null || restingHr != null ? 'Heart rate' : 'Heart and breathing'} summary={heartSummary}>
          {series && <LineChart values={series} color="data" height={94} yMin={40} band={hr.typical ?? undefined} />}
          {series && hr.typical && (
            <div className="band-key">
              Shaded: your usual average over recent nights, {hr.typical[0]}–{hr.typical[1]} bpm
            </div>
          )}
          {note && <p className="bc-note">{note}</p>}
          <div className="bc-stats">
            {avgHr != null && <Stat label="Avg HR" value={avgHr} unit="bpm" />}
            {lowHr != null && <Stat label="Low HR" value={lowHr} unit="bpm" />}
            {restingHr != null && <Stat label="Resting HR" value={restingHr} unit="bpm" />}
            {hrv && <Stat label="HRV" value={hrv.value} unit={hrv.unit} />}
            {respRate && <Stat label="Resp" value={respRate.value} unit={respRate.unit} />}
          </div>
        </Section>
      )}

      {spo2 && (
        <Section title="Blood oxygen" summary={`${spo2.avg}% avg`}>
          <div className="bc-stats">
            <Stat label="Avg O₂" value={spo2.avg} unit={spo2.unit} />
            {spo2.low != null && <Stat label="Low O₂" value={spo2.low} unit={spo2.unit} />}
          </div>
          {spo2.flag && (
            <p className="bc-flag">
              <Icon name="info" size={14} />
              <span>{spo2.flag}</span>
            </p>
          )}
        </Section>
      )}

      {stages && (
        <Section title="Sleep stages" summary={`${fmtDur(asleepH)} asleep`}>
          <SleepStages stages={stages} session={session} />
          {sleep && (
            <div className="bc-sleep">
              <div className="bc-sleep-label">
                Asleep <strong>{sleep.asleepHours}h</strong> · mask on <strong>{sleep.maskOnHours}h</strong>
              </div>
              <ProgressBar pct={asleepPct} color="data" height={8} />
            </div>
          )}
        </Section>
      )}

      {hasAwakenings && (
        <Section title="Awakenings" summary={`${awakenings}×`}>
          <div className="bc-stats">
            <Stat label="Wake-ups" value={awakenings} />
            {latencyMin != null && <Stat label="Fell asleep" value={latencyMin} unit="min" />}
          </div>
        </Section>
      )}
    </section>
  );
}
