/* Nocta — desktop Tonight view. The nightly story as hero, with metrics, the
 * night timeline, pattern, and connected-device body data laid out as a
 * two-column dashboard. Reuses the same components as the mobile screen. */
import { useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES } from '../../data/fixtures.js';
import { Icon } from '../Icons.jsx';
import { WhyCard } from '../WhyCard.jsx';
import { NightTimeline } from '../NightTimeline.jsx';
import { nightMarks } from '../WeekStrip.jsx';
import { PatternCard } from '../PatternCard.jsx';
import { BodyResponse } from '../BodyResponse.jsx';
import { BaselineBar, MetricSpark } from '../Charts.jsx';
import { activeBodyResponses } from '../../lib/bodySource.js';

/* The desktop top bar shows the current 14-night strip. Therapy started
 * Sep 30 (history.js), so the first three days are before night 1 and there
 * is no older fortnight to page back to. Nights 1–4 had sessions but no
 * authored detail fixture, so they show as logged but aren't clickable. */
const WEEK14 = [
  { key: '2026-09-27', day: '27', fixtureId: null, state: 'none' },
  { key: '2026-09-28', day: '28', fixtureId: null, state: 'none' },
  { key: '2026-09-29', day: '29', fixtureId: null, state: 'none' },
  { key: '2026-09-30', day: '30', fixtureId: null, state: 'logged' },
  { key: '2026-10-01', day: '1', fixtureId: null, state: 'logged' },
  { key: '2026-10-02', day: '2', fixtureId: null, state: 'logged' },
  { key: '2026-10-03', day: '3', fixtureId: null, state: 'logged' },
  { key: '2026-10-04', day: '4', fixtureId: 'steady' },
  { key: '2026-10-05', day: '5', fixtureId: 'win' },
  { key: '2026-10-06', day: '6', fixtureId: 'escalation' },
  { key: '2026-10-07', day: '7', fixtureId: 'insufficient' },
  { key: '2026-10-08', day: '8', fixtureId: null, state: 'missed' },
  { key: '2026-10-09', day: '9', fixtureId: null, state: 'missed' },
  { key: '2026-10-10', day: '10', fixtureId: 'anomaly' },
];

function buildWindow() {
  return WEEK14;
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
  const ahiMax = Math.max(20, Math.ceil(Math.max(fx.ahi.value ?? 0, fx.ahi.avgSoFar) * 1.6));

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
              disabled
              title="Your first night was Sep 30"
              aria-label="Previous 14 nights: none yet, your first night was Sep 30"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <div className="dash-week week" role="group" aria-label="14 nights. Click a night to open it">
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
                const marks = nightMarks(nightFx);
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={`day ${state}${selected ? ' selected' : ''}`}
                    aria-current={selected ? 'date' : undefined}
                    aria-label={`${nightFx.dayName}, ${nightFx.dateLabel}${marks.a11y}`}
                    onClick={() => {
                      setFixtureId(d.fixtureId);
                      setSelectedKey(d.key);
                    }}
                  >
                    {marks.suggests && <span className="day-dot" aria-hidden="true" />}
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
        <WhyCard
          insight={fx.insight}
          spark={fx.spark}
          sparkKind={fx.sparkKind}
          onDoctor={() => openSheet('doctor')}
        />
        {fx.pattern && <PatternCard pattern={fx.pattern} />}
      </div>

      {/* the night itself — the signature timeline, promoted to a full-width
       * band so the story reads top-down: why → the actual night → the numbers */}
      <div className="dash-head">
        <h3>The night</h3>
        <div className="dash-head-right">
          <span className="dash-head-meta">{fx.session.start}–{fx.session.end}</span>
          <button className="dash-head-action" onClick={() => openSheet('compare')}>
            Compare nights
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
      <NightTimeline
        timeline={fx.timeline}
        session={fx.session}
        ahi={fx.ahi.value}
        escalated={fx.insight.escalation_flag === 'hard'}
        onOpen={() => openSheet('fullnight')}
      />

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
            {hasAhi && <BaselineBar value={fx.ahi.value} avg={fx.ahi.avgSoFar} max={ahiMax} height={10} />}
          </div>
          <div className="dash-kpi-sub">
            {hasAhi ? `vs your average so far, ${fx.ahi.avgSoFar.toFixed(1)}` : 'Last night was too short to score'}
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
