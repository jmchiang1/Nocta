/* Nocta — desktop Tonight view. The nightly story as hero, with metrics, the
 * night timeline, pattern, and connected-device body data laid out as a
 * two-column dashboard. Reuses the same components as the mobile screen. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES } from '../../data/fixtures.js';
import { mulberry32, hashStr } from '../../lib/format.js';
import { Icon } from '../Icons.jsx';
import { WhyCard } from '../WhyCard.jsx';
import { NightTimeline } from '../NightTimeline.jsx';
import { PatternCard } from '../PatternCard.jsx';
import { BodyResponse } from '../BodyResponse.jsx';
import { BaselineBar, MetricSpark } from '../Charts.jsx';
import { activeBodyResponses } from '../../lib/bodySource.js';

/* The desktop top bar shows a 14-night strip you can page through with the
 * arrows. Window 0 is the authored current fortnight (mirrors the mobile WEEK);
 * older windows are generated deterministically so each prior fortnight is
 * distinct but stable. Days reuse the five fixtures — clicking loads that
 * night's data into the dashboard. */
const WEEK14 = [
  { key: '2026-05-25', day: '25', fixtureId: 'steady' },
  { key: '2026-05-26', day: '26', fixtureId: 'win' },
  { key: '2026-05-27', day: '27', fixtureId: null, state: 'missed' },
  { key: '2026-05-28', day: '28', fixtureId: 'win' },
  { key: '2026-05-29', day: '29', fixtureId: 'steady' },
  { key: '2026-05-30', day: '30', fixtureId: 'escalation' },
  { key: '2026-05-31', day: '31', fixtureId: null, state: 'missed' },
  { key: '2026-06-01', day: '1', fixtureId: 'steady' },
  { key: '2026-06-02', day: '2', fixtureId: 'win' },
  { key: '2026-06-03', day: '3', fixtureId: 'escalation' },
  { key: '2026-06-04', day: '4', fixtureId: 'insufficient' },
  { key: '2026-06-05', day: '5', fixtureId: null, state: 'missed' },
  { key: '2026-06-06', day: '6', fixtureId: null, state: 'missed' },
  { key: '2026-06-07', day: '7', fixtureId: 'anomaly' },
];

const WIN0_START = new Date('2026-05-25T00:00:00'); // first day of window 0
const FIX_POOL = ['steady', 'win', 'steady', 'win', 'anomaly', 'escalation', 'insufficient'];

const localISO = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

/* offset 0 → authored current fortnight; offset ≥ 1 → generated older ones */
function buildWindow(offset) {
  if (offset === 0) return WEEK14;
  const end = new Date(WIN0_START);
  end.setDate(end.getDate() - 1 - (offset - 1) * 14);
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(end);
    date.setDate(date.getDate() - i);
    const iso = localISO(date);
    const rnd = mulberry32(hashStr('nocta-night-' + iso));
    let fixtureId = null;
    let state = 'missed';
    if (rnd() > 0.16) {
      fixtureId = FIX_POOL[Math.floor(rnd() * FIX_POOL.length)];
      state = FIXTURES[fixtureId].dayState;
    }
    days.push({ key: iso, day: String(date.getDate()), fixtureId, state });
  }
  return days;
}

const fmtShort = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function DesktopTonight() {
  const { fixtureId, setFixtureId, openSheet, deviceConnections, deviceEnabled, deviceReads } = useStore();
  /* paging through past fortnights; offset 0 = current */
  const [weekOffset, setWeekOffset] = useState(0);
  /* highlight is tracked by the day's unique date (not fixtureId — several days
   * reuse a fixture, so keying on it would light up every steady night). Seed
   * from the current fixture, preferring the most recent matching day. */
  const [selectedKey, setSelectedKey] = useState(
    () => [...WEEK14].reverse().find((d) => d.fixtureId === fixtureId)?.key ?? null
  );
  const days = buildWindow(weekOffset);
  const rangeLabel = `${fmtShort(days[0].key)} – ${fmtShort(days[days.length - 1].key)}`;
  const fx = FIXTURES[fixtureId];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);
  const hasAhi = fx.ahi.value != null;
  const ahiMax = Math.max(20, Math.ceil(Math.max(fx.ahi.value ?? 0, fx.ahi.avg14) * 1.6));

  return (
    <>
      <header className="dash-topbar">
        <div>
          <div className="dash-eyebrow">{fx.greeting}</div>
          <h1 className="dash-h1">{fx.dayName}</h1>
          <div className="dash-sub">{fx.dateLabel}</div>
        </div>
        <div className="dash-weeknav">
          <div className="dash-weeknav-row">
            <button
              className="dash-week-arrow"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Previous 14 nights"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="dash-week week" role="group" aria-label="14 nights — click a night to open it">
              {days.map((d) => {
                const nightFx = d.fixtureId ? FIXTURES[d.fixtureId] : null;
                const state = nightFx ? nightFx.dayState : d.state;
                if (!nightFx) {
                  return (
                    <div key={d.key} className={`day ${state} empty`} aria-hidden="true">
                      <Icon name="moon" size={19} className="day-moon" />
                      <span className="d-label">{d.day}</span>
                    </div>
                  );
                }
                const selected = d.key === selectedKey;
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={`day ${state}${selected ? ' selected' : ''}`}
                    aria-current={selected ? 'date' : undefined}
                    onClick={() => {
                      setFixtureId(d.fixtureId);
                      setSelectedKey(d.key);
                    }}
                  >
                    <Icon name="moon" size={19} className="day-moon" />
                    <span className="d-label">{d.day}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="dash-week-arrow"
              onClick={() => setWeekOffset((o) => Math.max(0, o - 1))}
              disabled={weekOffset === 0}
              aria-label="Next 14 nights"
            >
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
          <div className="dash-week-range">
            {rangeLabel}
            {weekOffset === 0 ? ' · this fortnight' : ''}
          </div>
        </div>
      </header>

      {/* hero row: the nightly story beside its pattern card */}
      <div className={`dash-tonight-hero${fx.pattern ? '' : ' solo'}`}>
        <WhyCard insight={fx.insight} spark={fx.spark} sparkKind={fx.sparkKind} />
        {fx.pattern && <PatternCard pattern={fx.pattern} />}
      </div>

      {/* the night itself — the signature timeline, promoted to a full-width
       * band so the story reads top-down: why → the actual night → the numbers */}
      <div className="dash-head">
        <h3>The night</h3>
        <div className="dash-head-right">
          <span className="dash-head-meta">{fx.session.start} — {fx.session.end}</span>
          <button className="dash-head-action" onClick={() => openSheet('compare')}>
            Compare nights
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
      <NightTimeline timeline={fx.timeline} session={fx.session} onOpen={() => openSheet('fullnight')} />

      {/* KPI row — uniform stat cards fill the full width */}
      <div className="dash-head">
        <h3>Last night</h3>
      </div>
      <div className="dash-kpis">
        <div className="dash-kpi primary">
          <div className="dash-kpi-top">
            <span className="dash-kpi-k">AHI · events/hr</span>
            {hasAhi && fx.ahi.delta != null && (
              <span className={`delta-pill ${fx.ahi.dir === 'down' ? 'good' : ''}`}>
                {fx.ahi.dir !== 'flat' && <Icon name={fx.ahi.dir === 'down' ? 'triDown' : 'triUp'} size={9} />}
                {fx.ahi.delta}
              </span>
            )}
          </div>
          <div className="dash-kpi-v tnum">
            {hasAhi ? fx.ahi.value.toFixed(1) : '—'}
          </div>
          <div className="dash-kpi-chart">
            {hasAhi && <BaselineBar value={fx.ahi.value} avg={fx.ahi.avg14} max={ahiMax} height={10} />}
          </div>
          <div className="dash-kpi-sub">
            {hasAhi ? `vs 14-night avg ${fx.ahi.avg14.toFixed(1)}` : 'Last night was too short to score'}
          </div>
        </div>
        {fx.secondary.map((m) => (
          <button
            key={m.key}
            className="dash-kpi"
            onClick={() => openSheet('coach', { context: { kind: 'metric', label: m.label } })}
          >
            <div className="dash-kpi-top">
              <span className="dash-kpi-k">{m.label}</span>
            </div>
            <div className="dash-kpi-v tnum">
              {m.value}
              <span className="dash-kpi-u">{m.unit}</span>
            </div>
            <div className="dash-kpi-chart">
              <MetricSpark values={m.spark} hot={m.hot} height={38} />
            </div>
            <div className="dash-kpi-sub">{m.sub}</div>
          </button>
        ))}
      </div>

      {/* connected-device body data — wearable cards lay out side by side, the
       * empty state spans the row */}
      <div className="dash-head">
        <h3>Your body overnight</h3>
      </div>
      <div className={`dash-tonight-body${bodyCards.length > 0 ? '' : ' empty'}`}>
        {bodyCards.length > 0 ? (
          bodyCards.map((data) => (
            <BodyResponse key={data.deviceKey} data={data} session={fx.session} />
          ))
        ) : (
          <div className="ghost-card">
            <b>No wearable connected</b>
            <span>
              Pair a watch or ring in the mobile app to see how your heart rate
              and sleep stages responded to therapy overnight.
            </span>
          </div>
        )}
      </div>
    </>
  );
}
