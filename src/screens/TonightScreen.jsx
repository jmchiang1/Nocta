/* Nocta — Tonight tab. The hero why-card + last night's metrics + the night timeline. */
import { Fragment } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { TonightSkeleton } from '../components/Skeleton.jsx';
import { WeekStrip } from '../components/WeekStrip.jsx';
import { WhyCard } from '../components/WhyCard.jsx';
import { NightSwiper } from '../components/NightSwiper.jsx';
import { MetricPrimary } from '../components/MetricPrimary.jsx';
import { MetricSecondary } from '../components/MetricSecondary.jsx';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { PatternCard } from '../components/PatternCard.jsx';
import { BodyResponse } from '../components/BodyResponse.jsx';
import { activeBodyResponses } from '../lib/bodySource.js';
import { MEDICAL_NOTE } from '../data/account.js';

export function TonightScreen() {
  const {
    fixtureId,
    openSheet,
    deviceConnections,
    deviceEnabled,
    deviceReads,
    syncing,
    syncNonce,
    startSync,
  } = useStore();
  const fx = FIXTURES[fixtureId];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);

  return (
    <ScreenFrame
      title={`${fx.dayName}, ${fx.dateLabel.split(' · ')[0]}`}
      onRefresh={startSync}
      refreshing={syncing}
      className="tonight-open"
      sky
    >
      <header className="page-head">
        <div>
          <div className="eyebrow">{fx.greeting}</div>
          <h1>{fx.dayName}</h1>
          <div className="sub">{fx.dateLabel}</div>
        </div>
      </header>

      <WeekStrip />

      {syncing ? (
        <TonightSkeleton />
      ) : (
        // keyed on the night (and each completed sync) so switching nights
        // replays the staggered entrance instead of swapping text in place
        <Fragment key={`${fixtureId}-${syncNonce}`}>
          {/* the one hero — swipe it to move between nights */}
          <NightSwiper>
            <WhyCard
              insight={fx.insight}
              spark={fx.spark}
              sparkKind={fx.sparkKind}
              onAsk={() => openSheet('coach', { context: { kind: 'why' } })}
              onDoctor={() => openSheet('doctor')}
            />
          </NightSwiper>

          <div className="section-head">
            <h3>Last night</h3>
            <span className="meta">
              {fx.session.start}–{fx.session.end}
            </span>
          </div>
          <MetricPrimary ahi={fx.ahi} />
          <MetricSecondary items={fx.secondary} />

          <div className="section-head">
            <h3>The night</h3>
          </div>
          <NightTimeline
            timeline={fx.timeline}
            session={fx.session}
            ahi={fx.ahi.value}
            escalated={fx.insight.escalation_flag === 'hard'}
            onOpen={() => openSheet('fullnight')}
          />

          {fx.pattern && <PatternCard pattern={fx.pattern} />}

          {bodyCards.length > 0 && (
            <div className="section-head">
              <h3>Your body overnight</h3>
            </div>
          )}
          {bodyCards.map((data) => (
            <BodyResponse key={data.deviceKey} data={data} session={fx.session} />
          ))}
        </Fragment>
      )}

      <p className="disclaimer">{MEDICAL_NOTE}</p>
    </ScreenFrame>
  );
}
