/* Nocta — Tonight tab. The hero why-card + last night's metrics + the night timeline. */
import { useStore } from '../lib/store.jsx';
import { FIXTURES, WEEK } from '../data/fixtures.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { WhyCard } from '../components/WhyCard.jsx';
import { MetricPrimary } from '../components/MetricPrimary.jsx';
import { MetricSecondary } from '../components/MetricSecondary.jsx';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { PatternCard } from '../components/PatternCard.jsx';
import { BodyResponse } from '../components/BodyResponse.jsx';
import { activeBodyResponses } from '../lib/bodySource.js';

export function TonightScreen() {
  const {
    fixtureId,
    setFixtureId,
    setTab,
    openSheet,
    deviceConnections,
    deviceEnabled,
    deviceReads,
  } = useStore();
  const fx = FIXTURES[fixtureId];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);

  return (
    <div className="screen">
      <StatusBar />
      <div className="scroll">
        <header className="page-head">
          <div>
            <div className="eyebrow">{fx.greeting}</div>
            <h1>{fx.dayName}</h1>
            <div className="sub">{fx.dateLabel}</div>
          </div>
          <button className="icon-btn" aria-label="Settings" onClick={() => setTab('you')}>
            <Icon name="settings" size={18} />
          </button>
        </header>

        <div className="week" role="group" aria-label="Last 7 nights — tap a night to open it">
          {WEEK.map((d) => {
            const nightFx = d.fixtureId ? FIXTURES[d.fixtureId] : null;
            const state = nightFx ? nightFx.dayState : d.state;

            if (!nightFx) {
              return (
                <div key={d.day} className={`day ${state} empty`} aria-hidden="true">
                  <Icon name="moon" size={19} className="day-moon" />
                  <span className="d-label">{d.day}</span>
                </div>
              );
            }

            const selected = d.fixtureId === fixtureId;
            return (
              <button
                key={d.day}
                type="button"
                className={`day ${state}${selected ? ' selected' : ''}`}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${nightFx.dayName}, ${nightFx.dateLabel}`}
                onClick={() => setFixtureId(d.fixtureId)}
              >
                <Icon name="moon" size={19} className="day-moon" />
                <span className="d-label">{d.day}</span>
              </button>
            );
          })}
        </div>

        <WhyCard insight={fx.insight} spark={fx.spark} sparkKind={fx.sparkKind} />

        <div className="section-head">
          <h3>Last night</h3>
          <span className="meta">
            {fx.session.start} — {fx.session.end}
          </span>
        </div>
        <MetricPrimary ahi={fx.ahi} />
        <MetricSecondary
          items={fx.secondary}
          onMetric={(label) => openSheet('coach', { context: { kind: 'metric', label } })}
        />

        <div className="section-head">
          <h3>The night</h3>
        </div>
        <NightTimeline timeline={fx.timeline} session={fx.session} onOpen={() => openSheet('fullnight')} />

        {fx.pattern && <PatternCard pattern={fx.pattern} />}

        {bodyCards.length > 0 && (
          <div className="section-head">
            <h3>Your body overnight</h3>
          </div>
        )}
        {bodyCards.map((data) => (
          <BodyResponse key={data.deviceKey} data={data} session={fx.session} />
        ))}

        <p className="disclaimer">
          Nocta is a wellness companion, not a medical device. It supplements — it does not
          replace — your prescribed therapy or your doctor's care.
        </p>
      </div>
    </div>
  );
}
