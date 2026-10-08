/* Nocta — desktop "compare two nights" dialog. The deferred side-by-side
 * feature (brief #3), built desktop-native: pick any two nights and read their
 * key numbers on a shared axis, with the steadier side quietly noted. Reuses the
 * same fixtures as every other screen. No clinical scoring bands — "steadier"
 * is a neutral, per-metric note in the established sage = in-range language. */
import { useState } from 'react';
import { FIXTURES } from '../../data/fixtures.js';
import { NIGHTS as HISTORY, dateForFixture } from '../../data/history.js';
import { useStore } from '../../lib/store.jsx';
import { Icon } from '../Icons.jsx';
import { Rich } from '../Rich.jsx';

/* friendly { id, label, state } for each authored night */
const NIGHTS = Object.values(FIXTURES).map((f) => ({
  id: f.id,
  label: `${f.dayName} · ${f.dateLabel.split(' · ')[0]}`,
  state: f.insight?.card_state ?? 'steady',
}));

const STATE_LABEL = {
  anomaly: 'Off-baseline',
  steady: 'Steady',
  win: 'Better night',
  escalation: 'Worth watching',
  insufficient_data: 'Not enough data',
};

/* comparable numbers for a night, read from the nightly history (the same
 * source as Trends) so the two never disagree. An unscored night (too short)
 * shows no AHI or event count, so it can't read as the "steadier" side. */
function metricsOf(fx) {
  const night = HISTORY.find((x) => x.date === dateForFixture(fx.id));
  const scored = fx.ahi.value != null;
  return {
    ahi: fx.ahi.value,
    events: scored ? (fx.timeline?.eventCount ?? null) : null,
    leak: night?.leak ?? null,
    hours: night?.hours ?? fx.session.durationHours,
    pressure: night?.pressure ?? null,
  };
}

const ROWS = [
  { key: 'ahi', label: 'AHI', unit: 'events/hr', better: 'low', fixed: 1 },
  { key: 'events', label: 'Events', unit: 'overnight', better: 'low', fixed: 0 },
  { key: 'leak', label: 'Leak (P95)', unit: 'L/min', better: 'low', fixed: 0 },
  { key: 'hours', label: 'Usage', unit: 'hours', better: 'high', fixed: 1 },
  { key: 'pressure', label: 'Pressure', unit: 'cmH₂O', better: 'none', fixed: 1 },
];

/* which side reads steadier for this metric: 'a' | 'b' | null (tie / neutral) */
function steadier(better, a, b) {
  if (better === 'none' || a == null || b == null || a === b) return null;
  if (better === 'low') return a < b ? 'a' : 'b';
  return a > b ? 'a' : 'b';
}

function fmt(v, fixed) {
  return v == null ? '—' : v.toFixed(fixed);
}

function NightSelect({ value, onChange, exclude }) {
  return (
    <div className="cmp2-pick">
      <select
        className="cmp2-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Choose a night to compare"
      >
        {NIGHTS.map((n) => (
          <option key={n.id} value={n.id} disabled={n.id === exclude}>
            {n.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={15} className="cmp2-select-caret" />
    </div>
  );
}

export function DesktopCompare() {
  const { closeSheet, fixtureId } = useStore();
  /* default: the night you're on vs a clearly contrasting one */
  const [aId, setAId] = useState(fixtureId);
  const [bId, setBId] = useState(fixtureId === 'win' ? 'anomaly' : 'win');

  const a = FIXTURES[aId];
  const b = FIXTURES[bId];
  const ma = metricsOf(a);
  const mb = metricsOf(b);

  return (
    <div className="cmp2">
      <div className="cmp2-head">
        <div>
          <div className="cmp2-eyebrow">Compare nights</div>
          <h2 className="cmp2-title">Two nights, side by side</h2>
        </div>
        <button className="dfn-close" onClick={closeSheet} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* column headers: a night picker + its state tag on each side */}
      <div className="cmp2-cols">
        <div className="cmp2-col-head">
          <NightSelect value={aId} onChange={setAId} exclude={bId} />
          <span className={`cmp2-state ${a.insight?.card_state ?? 'steady'}`}>
            {STATE_LABEL[a.insight?.card_state ?? 'steady']}
          </span>
        </div>
        <div className="cmp2-vs" aria-hidden="true">vs</div>
        <div className="cmp2-col-head">
          <NightSelect value={bId} onChange={setBId} exclude={aId} />
          <span className={`cmp2-state ${b.insight?.card_state ?? 'steady'}`}>
            {STATE_LABEL[b.insight?.card_state ?? 'steady']}
          </span>
        </div>
      </div>

      {/* aligned metric rows — value | label | value, steadier side noted */}
      <div className="cmp2-rows">
        {ROWS.map((r) => {
          const va = ma[r.key];
          const vb = mb[r.key];
          const win = steadier(r.better, va, vb);
          return (
            <div className="cmp2-row" key={r.key}>
              <div className={`cmp2-val tnum${win === 'a' ? ' steady' : ''}`}>
                {fmt(va, r.fixed)}
                {win === 'a' && <span className="cmp2-flag">steadier</span>}
              </div>
              <div className="cmp2-metric">
                <span className="cmp2-metric-label">{r.label}</span>
                <span className="cmp2-metric-unit">{r.unit}</span>
              </div>
              <div className={`cmp2-val tnum${win === 'b' ? ' steady' : ''}`}>
                {fmt(vb, r.fixed)}
                {win === 'b' && <span className="cmp2-flag">steadier</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* each night's verdict headline, so the numbers carry a narrative */}
      <div className="cmp2-verdicts">
        <div className="cmp2-verdict">
          <span className="cmp2-verdict-k">That night, Nox said</span>
          <p><Rich text={a.insight?.headline ?? 'No insight for this night.'} /></p>
        </div>
        <div className="cmp2-verdict">
          <span className="cmp2-verdict-k">That night, Nox said</span>
          <p><Rich text={b.insight?.headline ?? 'No insight for this night.'} /></p>
        </div>
      </div>

      <p className="disclaimer">
        Side-by-side readings, not a verdict on your therapy. Patterns across many
        nights matter more than any single comparison. Bring questions to your doctor.
      </p>
    </div>
  );
}
