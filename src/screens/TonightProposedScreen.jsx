/* Nocta — Tonight, proposed layout (test page). Toggle it from the Demo panel
 * (Tonight › Proposed) or open ?layout=proposed. The current TonightScreen is
 * untouched so the two can be compared side by side.
 *
 * What changes vs. the current layout:
 *  - why-card gets its "Nox · Last night" byline and drops the
 *    sparkline (the night chart below shows the same shape)
 *  - the morning check-in sits right under the why-card until it's done —
 *    it feeds the patterns, so it shouldn't hide inside the full-night view
 *  - AHI + leak + hours + pressure become one 2×2 grid; AHI is no longer a
 *    second hero repeating the why-card's number
 *  - date line drops "Night 11 of 30"
 *  - type steps up toward the 17pt body floor (scoped to .tonight-proposed) */
import { Fragment } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { TonightSkeleton } from '../components/Skeleton.jsx';
import { WeekStrip } from '../components/WeekStrip.jsx';
import { WhyCard } from '../components/WhyCard.jsx';
import { CheckinPrompt } from '../components/CheckinPrompt.jsx';
import { MetricGrid } from '../components/MetricGrid.jsx';
import { NightTimeline } from '../components/NightTimeline.jsx';
import { PatternCard } from '../components/PatternCard.jsx';
import { BodyResponse } from '../components/BodyResponse.jsx';
import { activeBodyResponses } from '../lib/bodySource.js';
import { MEDICAL_NOTE } from '../data/account.js';

export function TonightProposedScreen() {
  const {
    fixtureId,
    openSheet,
    checkin,
    deviceConnections,
    deviceEnabled,
    deviceReads,
    syncing,
    syncNonce,
    startSync,
  } = useStore();
  const fx = FIXTURES[fixtureId];
  const date = fx.dateLabel.split(' · ')[0];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);
  const escalated = fx.insight.escalation_flag === 'hard';

  return (
    <ScreenFrame
      title={`${fx.dayName}, ${date}`}
      onRefresh={startSync}
      refreshing={syncing}
      className="tonight-proposed"
    >
      <header className="page-head">
        <div>
          <div className="eyebrow">{fx.greeting}</div>
          <h1>{fx.dayName}</h1>
          <div className="sub">{date}</div>
        </div>
        <span className="proposed-pill">Proposed layout</span>
      </header>

      <WeekStrip />

      {syncing ? (
        <TonightSkeleton />
      ) : (
        <Fragment key={`${fixtureId}-${syncNonce}`}>
          <WhyCard
            insight={fx.insight}
            eyebrow
            onAsk={() => openSheet('coach', { context: { kind: 'why' } })}
            onDoctor={() => openSheet('doctor')}
          />

          {!checkin.done && <CheckinPrompt checkin={checkin} onStart={() => openSheet('checkin')} />}

          <div className="section-head">
            <h3>Last night</h3>
            <span className="meta tnum">
              {fx.session.start}–{fx.session.end}
            </span>
          </div>
          <MetricGrid
            fixtureId={fixtureId}
            ahi={fx.ahi}
            items={fx.secondary}
            onMetric={(label) => openSheet('coach', { context: { kind: 'metric', label } })}
          />

          <div className="section-head">
            <h3>The night</h3>
          </div>
          <NightTimeline
            timeline={fx.timeline}
            session={fx.session}
            ahi={fx.ahi.value}
            escalated={escalated}
            fixtureId={fixtureId}
            sleepStages={fx.bodyResponse?.stages}
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

          {checkin.done && <CheckinPrompt checkin={checkin} onStart={() => openSheet('checkin')} />}
        </Fragment>
      )}

      <p className="disclaimer">{MEDICAL_NOTE}</p>
    </ScreenFrame>
  );
}
