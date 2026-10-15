/* Nocta — the last-7-nights strip on Tonight. Nights differ by SHAPE, not a
 * good/bad colour (no red/amber/green night scores):
 *   solid blue moon    a logged night
 *   dim outline moon   low data — too short to read
 *   coral moon         needs a doctor (escalation) — the one colour state
 *   peach dot          the why-card has a suggested step (peach = Nocta)
 *   faint gray moon    no session; tapping it says so instead of doing nothing */
import { useStore } from '../lib/store.jsx';
import { FIXTURES, stripAround, DEFAULT_FIXTURE } from '../data/fixtures.js';
import { LAST_NIGHT } from '../data/history.js';
import { Icon } from './Icons.jsx';

const DAY_FULL = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

// the why-card shows an action box for these states (see WhyCard NO_ACTION)
const SUGGESTS = new Set(['anomaly', 'win', 'escalation']);
const STATE_WORD = { low: 'low data', escalation: 'worth showing your doctor' };

/* shared with the desktop calendar: what a night's moon should say */
export function nightMarks(fx) {
  const suggests = SUGGESTS.has(fx.insight.card_state);
  const words = [STATE_WORD[fx.dayState], suggests && 'Nox has a suggestion'].filter(Boolean);
  return { suggests, a11y: words.length ? `, ${words.join(', ')}` : '' };
}

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
const dayNum = (iso) => Number(iso.slice(8));

/* the line over a strip: "Last night" pinned over the right-most night, or —
 * looking at an older stretch — its dates and the way back. Shared with the
 * desktop fortnight. */
export function StripHead({ days, onLatest, showRange = true }) {
  const latest = days.at(-1)?.date === LAST_NIGHT;
  return (
    <div className="week-head">
      {latest ? (
        <span className="week-head-last">Last night</span>
      ) : (
        <>
          {showRange && (
            <span className="week-head-range tnum">
              {shortDate(days[0].date)} – {shortDate(days.at(-1).date)}
            </span>
          )}
          <button type="button" className="week-head-back" onClick={onLatest}>
            Back to last night
            <Icon name="chevronRight" size={14} />
          </button>
        </>
      )}
    </div>
  );
}

export function WeekStrip() {
  const { fixtureId, setFixtureId, showToast, nightDrag, nightOrder } = useStore();
  // the 7 days that show the selected night (the latest week unless an older
  // night was picked from the calendar)
  const WEEK = stripAround(fixtureId, 7);
  const selectedIndex = WEEK.findIndex((d) => d.fixtureId === fixtureId);
  // while the why-card is being swiped, slide the highlight part-way toward
  // the night it's heading for (Thu/Fri have no session, so Wed ↔ Sat jumps)
  const o = nightOrder.indexOf(fixtureId);
  const target = nightDrag > 0 ? nightOrder[o + 1] : nightDrag < 0 ? nightOrder[o - 1] : null;
  const targetIndex = target ? WEEK.findIndex((d) => d.fixtureId === target) : -1;
  const indicatorPos =
    targetIndex >= 0 ? selectedIndex + (targetIndex - selectedIndex) * Math.abs(nightDrag) : selectedIndex;

  return (
    <div className="week-wrap">
      <StripHead days={WEEK} onLatest={() => setFixtureId(DEFAULT_FIXTURE)} />
      <div className="week" role="group" aria-label="The last 7 nights. Tap a night to open it">
        {/* one highlight that glides to the selected night, tinted by that
         * night's state, instead of each day toggling its own background */}
        {selectedIndex >= 0 && (
          <span
            className={`week-indicator ${FIXTURES[fixtureId].dayState}${nightDrag ? ' following' : ''}`}
            aria-hidden="true"
            style={{ transform: `translateX(${indicatorPos * 100}%)` }}
          />
        )}
        {WEEK.map((d) => {
          const nightFx = d.fixtureId ? FIXTURES[d.fixtureId] : null;
          const state = nightFx ? nightFx.dayState : d.state;

          if (!nightFx) {
            // no session synced — say so honestly rather than ignore the tap
            return (
              <button
                key={d.date}
                type="button"
                className={`day ${state} empty`}
                aria-label={`${DAY_FULL[d.day]}, no session recorded`}
                onClick={(e) => {
                  const el = e.currentTarget;
                  el.classList.remove('nudge');
                  void el.offsetWidth; // restart the nudge animation
                  el.classList.add('nudge');
                  showToast(`No session recorded ${DAY_FULL[d.day]}`, 'moon');
                }}
              >
                <Icon name="moon" size={19} className="day-moon" />
                <span className="d-num tnum">{dayNum(d.date)}</span>
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
              <span className="d-num tnum">{dayNum(d.date)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
