/* Nocta — desktop Tonight view. The same story as the mobile screen, laid out
 * wide: the night sky behind the page head, the open why-horizon hero (verdict,
 * the night's shape, the one action) across the full width, then the morning
 * check-in and last night's numbers side by side, then the wearable modules.
 * Reuses the mobile components. */
import { firstName } from '../../data/account.js';
import { Fragment, useEffect, useState } from 'react';
import { useStore } from '../../lib/store.jsx';
import { FIXTURES, stripAround, nightsEnding, DEFAULT_FIXTURE } from '../../data/fixtures.js';
import { LAST_NIGHT, THERAPY_START, addDays } from '../../data/history.js';
import { MEDICAL_NOTE } from '../../data/account.js';
import { Icon } from '../Icons.jsx';
import { TonightSky, SKY_FOR_STATE } from '../NightSky.jsx';
import { WhyHorizon } from '../WhyHorizon.jsx';
import { CheckinPrompt, LateCheckin } from '../CheckinPrompt.jsx';
import { ProfileReminder } from '../ProfileReminder.jsx';
import { FeedbackPrompt } from '../FeedbackPrompt.jsx';
import { StaleDataBanner, SampleDataBanner } from '../NoNights.jsx';
import { MetricSecondary } from '../MetricSecondary.jsx';
import { BodyResponse } from '../BodyResponse.jsx';
import { TonightSkeleton } from '../Skeleton.jsx';
import { nightMarks, StripHead } from '../WeekStrip.jsx';
import { activeBodyResponses } from '../../lib/bodySource.js';
import { InsightRating } from '../InsightRating.jsx';

/* The 14-night strip under the page head: the latest two weeks, or the
 * stretch around an older night picked from the calendar. The arrows either
 * side page it a week at a time without changing the night on screen. */
const STRIP_DAYS = 14;
const PAGE_DAYS = 7;

const EMPTY_SAYS = { missed: 'no session recorded' };

const fmtShort = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtLong = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const rangeLabel = (days) => `${fmtShort(days[0].date)} – ${fmtShort(days.at(-1).date)}`;

/* which 14 days the strip shows: the stretch around the selected night,
 * until the arrows page it. Picking a night already on show leaves the
 * strip where it is; one outside it (from the calendar) brings it into view */
function useStripEnd(fixtureId) {
  const around = () => stripAround(fixtureId, STRIP_DAYS).at(-1).date;
  const [end, setEnd] = useState(around);
  useEffect(
    () => setEnd((e) => (nightsEnding(e, STRIP_DAYS).some((d) => d.date === fixtureId) ? e : around())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixtureId]
  );
  const first = addDays(THERAPY_START, STRIP_DAYS - 1); // the earliest end: night 1 on the left
  const page = (dir) =>
    setEnd((e) => {
      const next = addDays(e, dir * PAGE_DAYS);
      return next > LAST_NIGHT ? LAST_NIGHT : next < first ? first : next;
    });
  return { end, setEnd, page, atStart: end <= first, atEnd: end >= LAST_NIGHT };
}

/* the 14-night strip, on its own full-width row under the page head */
function Fortnight({ strip }) {
  const { fixtureId, setFixtureId, showToast } = useStore();
  const days = nightsEnding(strip.end, STRIP_DAYS);

  return (
    <div className="dash-weeknav">
      {/* "Last night" over the newest night, or the way back (as on the phone);
       * the range already sits in the page head */}
      <StripHead
        days={days}
        showRange={false}
        onLatest={() => {
          strip.setEnd(LAST_NIGHT);
          setFixtureId(DEFAULT_FIXTURE);
        }}
      />
      <div className="dash-week-row">
        <button
          className="dash-week-arrow"
          type="button"
          onClick={() => strip.page(-1)}
          disabled={strip.atStart}
          aria-label="Previous week"
          title="Previous week"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="dash-week week" role="group" aria-label="14 nights. Click a night to open it">
          {days.map((d) => {
            const nightFx = d.fixtureId ? FIXTURES[d.fixtureId] : null;
            const state = nightFx ? nightFx.dayState : d.state;
            if (!nightFx) {
              // say why there's nothing to open, as the mobile strip does
              const says = EMPTY_SAYS[d.state];
              return (
                <button
                  key={d.date}
                  type="button"
                  className={`day ${state} empty`}
                  aria-label={`${fmtLong(d.date)}, ${says}`}
                  onClick={(e) => {
                    const el = e.currentTarget;
                    el.classList.remove('nudge');
                    void el.offsetWidth; // restart the nudge animation
                    el.classList.add('nudge');
                    showToast(`${fmtShort(d.date)}: ${says}`, 'moon');
                  }}
                >
                  <Icon name="moon" size={19} className="day-moon" />
                  <span className="d-num tnum">{Number(d.date.slice(8))}</span>
                </button>
              );
            }
            const selected = d.fixtureId === fixtureId;
            const marks = nightMarks(nightFx);
            return (
              <button
                key={d.date}
                type="button"
                className={`day ${state}${selected ? ' selected' : ''}`}
                aria-current={selected ? 'date' : undefined}
                aria-label={`${nightFx.dayName}, ${nightFx.dateLabel}${marks.a11y}`}
                onClick={() => setFixtureId(d.fixtureId)}
              >
                {marks.suggests && <span className="day-dot" aria-hidden="true" />}
                <Icon name="moon" size={19} className="day-moon" />
                <span className="d-num tnum">{Number(d.date.slice(8))}</span>
              </button>
            );
          })}
        </div>
        <button
          className="dash-week-arrow"
          type="button"
          onClick={() => strip.page(1)}
          disabled={strip.atEnd}
          aria-label="Next week"
          title="Next week"
        >
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </div>
  );
}

export function DesktopTonight() {
  const { fixtureId, openSheet, deviceConnections, deviceEnabled, deviceReads, syncing, syncNonce, checkin, authUser, cardData } =
    useStore();
  const fx = FIXTURES[fixtureId];
  const bodyCards = activeBodyResponses(fx, deviceConnections, deviceEnabled, deviceReads);
  const strip = useStripEnd(fixtureId);

  return (
    <div className="dash-tonight">
      <TonightSky condition={SKY_FOR_STATE[fx.insight.card_state] ?? 'clear'} className="dash-sky" />

      {/* the day on the left (click it for every night), the dates the strip
       * shows on the right; the strip itself spans the row beneath */}
      <header className="dash-topbar">
        <div>
          <div className="dash-eyebrow">
            {fx.greeting}
            {fixtureId === LAST_NIGHT && firstName(authUser) ? `, ${firstName(authUser)}` : ''}
          </div>
          {/* the day is the way to every night: click it for the calendar */}
          <h1 className="dash-h1">
            <button className="day-picker" type="button" onClick={() => openSheet('calendar')} aria-haspopup="dialog">
              {fx.dayName}
              <Icon name="chevronDown" size={22} />
              <span className="sr-only">, see all nights</span>
            </button>
          </h1>
          <div className="dash-sub">
            {fx.dateLabel}
            {/* nothing imported: these are the bundled sample nights, not theirs */}
            {!cardData && <span className="sample-tag">Sample data</span>}
          </div>
        </div>
        <span className="dash-week-range tnum">{rangeLabel(nightsEnding(strip.end, STRIP_DAYS))}</span>
      </header>
      {/* the card's newest night is days old: say so before showing it */}
      <StaleDataBanner />
      <SampleDataBanner />
      <Fortnight strip={strip} />

      {syncing ? (
        <div className="dash-tonight-skeleton">
          <TonightSkeleton />
        </div>
      ) : (
        // keyed on the night (and each completed sync) so switching nights
        // replays the staggered entrance instead of swapping text in place
        <Fragment key={`${fixtureId}-${syncNonce}`}>
          <div className="dash-tonight-grid">
            {/* the one hero: verdict, the night's horizon, tonight's action.
             * No Nox face here on desktop — Ask Nox lives in the sidebar */}
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
            {/* was the insight above any use (lib/insightRatings.js) */}
            {fx.session && <InsightRating date={fixtureId} />}

            <div className="dash-tonight-pair">
              {/* the check-in is half of what Nox learns from, so it leads
               * the row right under the night's suggestion, and is done
               * right there in the card */}
              {/* last night only, as on the phone */}
              {fixtureId === LAST_NIGHT && (
                <CheckinPrompt
                  checkin={checkin}
                  wide
                  onStart={(initial) => openSheet('checkin', { initial })}
                />
              )}

              <section className="tn-module">
                <div className="section-head">
                  {/* every night reads from its own morning, so it's "Last night"
                   * on older nights too (the eyebrow already says Looking back) */}
                  <h3>Last night</h3>
                  <span className="meta tnum">
                    {fx.session.start}–{fx.session.end}
                  </span>
                </div>
                {/* AHI itself leads the hero, so this card holds the rest */}
                <MetricSecondary items={fx.secondary} />
                <button className="row-cta" onClick={() => openSheet('fullnight')}>
                  <span>Open full-night view</span>
                  <Icon name="chevronRight" size={16} />
                </button>
                <button className="row-cta" onClick={() => openSheet('compare')}>
                  <span>Compare with another night</span>
                  <Icon name="chevronRight" size={16} />
                </button>
                {/* an older night: add (or edit) how that morning went, from memory */}
                {fixtureId !== LAST_NIGHT && (
                  <LateCheckin date={fixtureId} onStart={(initial) => openSheet('checkin', { initial, date: fixtureId })} />
                )}
              </section>
            </div>

            {/* a skipped onboarding question, now and then (lib/profile.js) */}
            <ProfileReminder />
            {/* how it's going, now and then (lib/feedback.js) */}
            <FeedbackPrompt />
          </div>

          {bodyCards.length > 0 && (
            <section className="tn-module dash-body-module">
              <div className="section-head">
                <h3>Your body overnight</h3>
              </div>
              <div className="dash-body-grid">
                {bodyCards.map((data) => (
                  <BodyResponse key={data.deviceKey} data={data} session={fx.session} />
                ))}
              </div>
            </section>
          )}
        </Fragment>
      )}

      <p className="disclaimer">{MEDICAL_NOTE}</p>
    </div>
  );
}
