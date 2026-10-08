/* Nocta — Tonight tab. The hero why-card + last night's metrics + the night timeline. */
import { Fragment } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { SKY_FOR_STATE } from '../components/NightSky.jsx';
import { TonightSkeleton } from '../components/Skeleton.jsx';
import { WeekStrip } from '../components/WeekStrip.jsx';
import { Icon } from '../components/Icons.jsx';
import { CheckinPrompt } from '../components/CheckinPrompt.jsx';
import { WhyHorizon } from '../components/WhyHorizon.jsx';
import { NightSwiper } from '../components/NightSwiper.jsx';
import { MetricSecondary } from '../components/MetricSecondary.jsx';
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
    checkin,
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
      sky={SKY_FOR_STATE[fx.insight.card_state] ?? 'clear'}
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
            <WhyHorizon
              insight={fx.insight}
              timeline={fx.timeline}
              session={fx.session}
              usual={fx.ahi.avgSoFar}
              fixtureId={fixtureId}
              onWhy={() => openSheet('why')}
              onAsk={() => openSheet('coach', { context: { kind: 'why' } })}
              onDoctor={() => openSheet('doctor')}
            />
          </NightSwiper>

          {/* the check-in is half of what Nox learns from, so it sits right
           * under the night's suggestion rather than inside the full night */}
          <CheckinPrompt checkin={checkin} onStart={(initial) => openSheet('checkin', { initial })} />

          {/* below the open hero, each section sits in its own soft module
           * (like Weather): grouping without heavy boxes */}
          <section className="tn-module">
            <div className="section-head">
              <h3>Last night</h3>
              <span className="meta">
                {fx.session.start}–{fx.session.end}
              </span>
            </div>
            {/* AHI itself leads the hero above, so this card holds the rest */}
            <MetricSecondary items={fx.secondary} />
            {/* the night's detail (events by type, flow, pressure, episodes)
             * lives one tap away; the hero above already draws its shape */}
            <button className="row-cta" onClick={() => openSheet('fullnight')}>
              <span>Open full-night view</span>
              <Icon name="chevronRight" size={16} />
            </button>
          </section>

          {bodyCards.length > 0 && (
            <section className="tn-module">
              <div className="section-head">
                <h3>Your body overnight</h3>
              </div>
              {bodyCards.map((data) => (
                <BodyResponse key={data.deviceKey} data={data} session={fx.session} />
              ))}
            </section>
          )}
        </Fragment>
      )}

      <p className="disclaimer">{MEDICAL_NOTE}</p>
    </ScreenFrame>
  );
}
