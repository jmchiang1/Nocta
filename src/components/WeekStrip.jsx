/* Nocta — the last-7-nights strip on Tonight. Nights differ by SHAPE, not a
 * good/bad colour (no red/amber/green night scores):
 *   solid blue moon    a logged night
 *   dim outline moon   low data — too short to read
 *   coral moon         needs a doctor (escalation) — the one colour state
 *   peach dot          the why-card has a suggested step (peach = Nocta)
 *   faint gray moon    no session; tapping it says so instead of doing nothing */
import { useStore } from '../lib/store.jsx';
import { useState, useEffect, useRef } from 'react';
import { FIXTURES, stripAround, nightsEnding, DEFAULT_FIXTURE } from '../data/fixtures.js';
import { LAST_NIGHT, THERAPY_START, addDays } from '../data/history.js';
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

/* drag the strip sideways to page through weeks: right → the week before,
 * left → the week after (never past last night or before the first night) */
const PAGE_AT = 48; // px of drag that turns a page
const TAP_SLOP = 8; // px before a press becomes a drag (and not a tap)

export function WeekStrip() {
  const { fixtureId, setFixtureId, showToast, nightDrag, nightOrder } = useStore();
  // the week on show: the one holding the selected night, until the person
  // drags to another; picking a night elsewhere brings it back into view
  const home = stripAround(fixtureId, 7).at(-1).date;
  const [end, setEnd] = useState(home);
  const [slide, setSlide] = useState(null); // 'from-left' | 'from-right' after a page turn
  // a night picked inside the week on show leaves the week where it is (no
  // jump); only one outside it (the calendar, a swipe past the edge) moves it
  useEffect(() => {
    setEnd((e) => (nightsEnding(e, 7).some((d) => d.date === fixtureId) ? e : home));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);
  const WEEK = nightsEnding(end, 7);
  const firstEnd = THERAPY_START ? addDays(THERAPY_START, 6) : end; // the earliest week still holds night 1
  const canBack = end > firstEnd;
  const canForward = end < LAST_NIGHT;

  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const suppressClick = useRef(false);

  const page = (dir) => {
    if (dir < 0 && canBack) {
      setEnd((e) => (addDays(e, -7) < firstEnd ? firstEnd : addDays(e, -7)));
      setSlide('from-left');
    } else if (dir > 0 && canForward) {
      setEnd((e) => (addDays(e, 7) > LAST_NIGHT ? LAST_NIGHT : addDays(e, 7)));
      setSlide('from-right');
    }
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.button > 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
    },
    onPointerMove: (e) => {
      const g = drag.current;
      if (!g || g.id !== e.pointerId) return;
      const mx = e.clientX - g.x;
      const my = e.clientY - g.y;
      if (!g.active) {
        if (Math.abs(my) > Math.abs(mx) && Math.abs(my) > TAP_SLOP) {
          drag.current = null; // a vertical scroll, not a week drag
          return;
        }
        if (Math.abs(mx) < TAP_SLOP) return;
        g.active = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      // resist at the ends: nothing newer than last night, nothing before night 1
      const blocked = (mx < 0 && !canForward) || (mx > 0 && !canBack);
      setDx(blocked ? mx * 0.25 : mx);
    },
    onPointerUp: () => {
      const g = drag.current;
      drag.current = null;
      if (!g?.active) return;
      suppressClick.current = true; // the release after a drag isn't a tap
      setTimeout(() => (suppressClick.current = false), 0);
      if (dx > PAGE_AT) page(-1);
      else if (dx < -PAGE_AT) page(1);
      setDx(0);
    },
  };
  handlers.onPointerCancel = handlers.onPointerUp;
  const tap = (fn) => (e) => {
    if (suppressClick.current) return;
    fn(e);
  };

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
      <StripHead
        days={WEEK}
        onLatest={() => {
          setEnd(LAST_NIGHT);
          setSlide('from-right');
          setFixtureId(DEFAULT_FIXTURE);
        }}
      />
      <div
        className={`week week-drag${dx ? ' dragging' : ''}${slide ? ` ${slide}` : ''}`}
        key={end}
        role="group"
        aria-label="A week of nights. Tap a night to open it; drag sideways for other weeks"
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onAnimationEnd={(e) => e.target === e.currentTarget && setSlide(null)}
        {...handlers}
      >
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
                onClick={tap((e) => {
                  const el = e.currentTarget;
                  el.classList.remove('nudge');
                  void el.offsetWidth; // restart the nudge animation
                  el.classList.add('nudge');
                  showToast(`No session recorded ${DAY_FULL[d.day]}`, 'moon');
                })}
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
              onClick={tap(() => setFixtureId(d.fixtureId))}
            >
              {marks.suggests && <span className="day-dot" aria-hidden="true" />}
              <Icon name="moon" size={19} className="day-moon" />
              <span className="d-num tnum">{dayNum(d.date)}</span>
            </button>
          );
        })}
      </div>
      {/* the same paging for keyboards and switch control (no drag needed);
       * visible when focused */}
      <div className="week-pager">
        <button type="button" className="week-pager-btn" onClick={() => page(-1)} disabled={!canBack}>
          Earlier week
        </button>
        <button type="button" className="week-pager-btn" onClick={() => page(1)} disabled={!canForward}>
          Later week
        </button>
      </div>
    </div>
  );
}
