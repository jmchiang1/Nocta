/* Nocta — Tonight tab. The hero why-card + last night's metrics + the night timeline. */
import { StaleDataBanner, SampleDataBanner } from '../components/NoNights.jsx';
import { firstName } from '../data/account.js';
import { LAST_NIGHT } from '../data/history.js';
import { Fragment } from 'react';
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import { ScreenFrame } from '../components/ScreenFrame.jsx';
import { SKY_FOR_STATE } from '../components/NightSky.jsx';
import { TonightSkeleton } from '../components/Skeleton.jsx';
import { WeekStrip } from '../components/WeekStrip.jsx';
import { Icon } from '../components/Icons.jsx';
import { CheckinPrompt, LateCheckin } from '../components/CheckinPrompt.jsx';
import { ProfileReminder } from '../components/ProfileReminder.jsx';
import { FeedbackPrompt } from '../components/FeedbackPrompt.jsx';
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
    authUser, cardData } = useStore();
  const fx = FIXTURES[fixtureId];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);

  return (
    <ScreenFrame
      stickyTitle
      title={`${fx.dayName}, ${fx.dateLabel.split(' · ')[0]}`}
      className="tonight-open"
      sky={SKY_FOR_STATE[fx.insight.card_state] ?? 'clear'}
    >
      <header className="page-head">
        <div>
          <div className="eyebrow">
            {fx.greeting}
            {fixtureId === LAST_NIGHT && firstName(authUser) ? `, ${firstName(authUser)}` : ''}
          </div>
          {/* the day is the way to every night: tap it for the calendar */}
          <h1>
            <button
              className="day-picker"
              type="button"
              onClick={() => openSheet('calendar')}
              aria-haspopup="dialog"
            >
              {fx.dayName}
              <Icon name="chevronDown" size={20} />
              <span className="sr-only">, see all nights</span>
            </button>
          </h1>
          <div className="sub">
            {fx.dateLabel}
            {/* nothing imported: these are the bundled sample nights, not theirs */}
            {!cardData && <span className="sample-tag">Sample data</span>}
          </div>
        </div>
      </header>

      {/* the card's newest night is days old: say so before showing it */}
      <StaleDataBanner />
      <SampleDataBanner />

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
              rate={fx.session ? fixtureId : null}
            />
          </NightSwiper>

          {/* the check-in is half of what Nox learns from, so it sits right
           * under the night's suggestion rather than inside the full night */}
          {/* the check-in is about last night, so it only shows there (on an
           * older night it would save to the wrong night) */}
          {fixtureId === LAST_NIGHT && (
            <CheckinPrompt checkin={checkin} onStart={(initial) => openSheet('checkin', { initial })} />
          )}

          {/* a skipped onboarding question, now and then (lib/profile.js) */}
          <ProfileReminder />
          {/* how it's going, now and then (lib/feedback.js) */}
          <FeedbackPrompt />

          {/* below the open hero, each section sits in its own soft module
           * (like Weather): grouping without heavy boxes */}
          <section className="tn-module">
            <div className="section-head">
              <h3>{fixtureId === LAST_NIGHT ? 'Last night' : 'This night'}</h3>
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
            {/* an older night: add (or edit) how that morning went, from memory */}
            {fixtureId !== LAST_NIGHT && (
              <LateCheckin date={fixtureId} onStart={(initial) => openSheet('checkin', { initial, date: fixtureId })} />
            )}
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
