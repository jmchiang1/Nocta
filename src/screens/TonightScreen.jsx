/* Nocta — Tonight tab. The hero why-card + last night's metrics + the night timeline. */
import { useStore } from '../lib/store.jsx';
import { FIXTURES, WEEK_BASE } from '../data/fixtures.js';
import { StatusBar } from '../components/StatusBar.jsx';
import { Icon } from '../components/Icons.jsx';
import { WhyCard } from '../components/WhyCard.jsx';
import { MetricPrimary } from '../components/MetricPrimary.jsx';
import { MetricSecondary } from '../components/MetricSecondary.jsx';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { CheckinPrompt } from '../components/CheckinPrompt.jsx';
import { PatternCard } from '../components/PatternCard.jsx';

export function TonightScreen() {
  const { fixtureId, setTab, openSheet, checkin } = useStore();
  const fx = FIXTURES[fixtureId];

  const week = WEEK_BASE.map((d, i) =>
    i === WEEK_BASE.length - 1 ? { ...d, state: fx.dayState } : d
  );

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

        <div className="week" aria-label="This week">
          {week.map((d, i) => (
            <div
              key={d.day}
              className={`day ${d.state}${i === week.length - 1 ? ' selected' : ''}`}
            >
              <span className="dot" />
              <span className="d-label">{d.day}</span>
            </div>
          ))}
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
          <span className="meta">Tap to expand</span>
        </div>
        <NightTimeline timeline={fx.timeline} session={fx.session} onOpen={() => openSheet('fullnight')} />

        <CheckinPrompt checkin={checkin} onStart={() => openSheet('checkin')} />

        {fx.pattern && <PatternCard pattern={fx.pattern} />}

        <p className="disclaimer">
          Nocta is a wellness companion, not a medical device. It supplements — it does not
          replace — your prescribed therapy or your doctor's care.
        </p>
      </div>
    </div>
  );
}
