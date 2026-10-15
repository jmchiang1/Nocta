/* Nocta — every night on therapy as a month calendar. Opened from the day
 * heading on Tonight (like myAir's date picker): a bottom sheet on the phone
 * (screens/CalendarSheet.jsx), a wide dialog on desktop
 * (desktop/DesktopCalendar.jsx). Each night uses the week strip's language
 * (WeekStrip.jsx): nights differ by SHAPE, never a good/bad colour —
 *   solid moon     a logged night       outline moon  too short to score
 *   coral moon     worth showing your doctor (the one colour state)
 *   peach dot      Nox has a suggestion faint moon    no session
 * Picking a night shows its numbers (beside the month on desktop, under it
 * on the phone); nights with a full write-up open on Tonight. Numbers come
 * from history.js, the same source as Trends, so the two never disagree. */
import { useState } from 'react';
import { onDataset } from '../lib/dataset.js';
import { useStore } from '../lib/store.jsx';
import { FIXTURES } from '../data/fixtures.js';
import {
  NIGHTS,
  THERAPY_START,
  LAST_NIGHT,
  ahiTotal,
  metCompliance,
  dateForFixture,
  toDate,
} from '../data/history.js';
import { Icon } from './Icons.jsx';
import { Rich } from './Rich.jsx';
import { nightMarks } from './WeekStrip.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/* history's rows by date and the run's months — rebuilt when the card
 * changes (an import), since history refills in place */
const BY_DATE = {};

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthKey = (date) => date.slice(0, 7); // 'YYYY-MM'
const monthLabel = (key) =>
  toDate(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const longDate = (date) =>
  toDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/* every month from the first night to the last, oldest first */
function therapyMonths() {
  const out = [];
  const d = toDate(`${monthKey(THERAPY_START)}-01`);
  const end = monthKey(LAST_NIGHT);
  for (;;) {
    const key = iso(d.getFullYear(), d.getMonth(), 1).slice(0, 7);
    out.push(key);
    if (key === end) return out;
    d.setMonth(d.getMonth() + 1);
  }
}
const MONTHS = [];
onDataset(() => {
  Object.keys(BY_DATE).forEach((k) => delete BY_DATE[k]);
  NIGHTS.forEach((x) => (BY_DATE[x.date] = x));
  MONTHS.length = 0;
  MONTHS.push(...therapyMonths());
});

/* what one night should show: its state (for the moon) and plain words */
function nightView(night) {
  const fx = night.fixture ? FIXTURES[night.fixture] : null;
  if (night.hours === 0) return { state: 'missed', fx, word: 'No session' };
  const state = fx ? fx.dayState : night.ahi ? 'logged' : 'low';
  return { state, fx, word: night.ahi ? null : 'Too short to score' };
}

function DayCell({ date, selected, current, onSelect }) {
  const night = BY_DATE[date];
  const day = toDate(date).getDate();

  if (!night) {
    // before night 1 or after last night: nothing recorded, nothing to open
    return (
      <div className="cal-day outside" aria-hidden="true">
        <span className="cal-num tnum">{day}</span>
      </div>
    );
  }

  const v = nightView(night);
  const ahi = ahiTotal(night);
  const marks = v.fx ? nightMarks(v.fx) : { suggests: false, a11y: '' };
  const label = `${longDate(date)}, night ${night.n}${
    ahi != null ? `, AHI ${ahi}` : `, ${v.word.toLowerCase()}`
  }${night.hours > 0 ? `, ${night.hours} hours` : ''}${marks.a11y}`;

  return (
    <button
      type="button"
      className={`cal-day day ${v.state}${selected ? ' selected' : ''}${current ? ' current' : ''}`}
      aria-pressed={selected}
      aria-label={label}
      onClick={() => onSelect(date)}
    >
      <span className="cal-top">
        <span className="cal-num tnum">{day}</span>
        <span className="cal-moon">
          {marks.suggests && <span className="day-dot" aria-hidden="true" />}
          <Icon name="moon" size={15} className="day-moon" />
        </span>
      </span>
      {ahi != null ? (
        <span className="cal-stat tnum">
          <b>{ahi.toFixed(1)}</b>
          <span>AHI</span>
        </span>
      ) : (
        <span className="cal-word">{v.word}</span>
      )}
      {night.hours > 0 && <span className="cal-hours tnum">{night.hours} h</span>}
    </button>
  );
}

function NightDetail({ date, onOpen }) {
  const night = BY_DATE[date];
  const v = nightView(night);
  const ahi = ahiTotal(night);
  const rows = [
    { k: 'AHI', v: ahi != null ? `${ahi.toFixed(1)} events/hr` : '—' },
    { k: 'Usage', v: night.hours > 0 ? `${night.hours} hours` : 'No session' },
    { k: 'Leak (P95)', v: night.leak != null ? `${night.leak} L/min` : '—' },
    { k: 'Pressure', v: night.pressure != null ? `${night.pressure} cmH₂O` : '—' },
  ];

  return (
    <aside className="cal-detail" aria-live="polite">
      <h3 className="cal-detail-date">{longDate(date)}</h3>
      {v.fx && (
        <p className="cal-detail-headline">
          <Rich text={v.fx.insight.headline} />
        </p>
      )}
      <dl className="cal-detail-rows">
        {rows.map((r) => (
          <div key={r.k}>
            <dt>{r.k}</dt>
            <dd className="tnum">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="cal-detail-note">
        {night.hours === 0
          ? 'No session recorded, so this night doesn’t count toward compliance.'
          : metCompliance(night)
            ? 'Over 4 hours, so this night counts toward compliance.'
            : 'Under 4 hours, so this night doesn’t count toward compliance.'}
      </p>
      {v.fx && (
        <button className="btn ghost cal-open" type="button" onClick={() => onOpen(v.fx.id)}>
          Open this night
          <Icon name="chevronRight" size={16} />
        </button>
      )}
    </aside>
  );
}

/* `onOpen(fixtureId)`: the host switches Tonight to that night and closes */
export function NightCalendar({ onOpen }) {
  const { fixtureId } = useStore();
  const current = dateForFixture(fixtureId);
  const [month, setMonth] = useState(monthKey(current));
  const [selected, setSelected] = useState(current);
  const mi = MONTHS.indexOf(month);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(y, m - 1, i + 1)),
  ];
  // always six week rows, so switching months never changes the height
  const cells = [...days, ...Array.from({ length: 42 - days.length }, () => null)];

  return (
    <div className="cal-body">
      <section className="cal-month" aria-label={monthLabel(month)}>
        <div className="cal-month-head">
          <button
            className="cal-arrow"
            type="button"
            onClick={() => setMonth(MONTHS[mi - 1])}
            disabled={mi <= 0}
            aria-label="Previous month"
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <h3>{monthLabel(month)}</h3>
          <button
            className="cal-arrow"
            type="button"
            onClick={() => setMonth(MONTHS[mi + 1])}
            disabled={mi >= MONTHS.length - 1}
            aria-label="Next month"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        <div className="cal-grid" role="group" aria-label={`Nights in ${monthLabel(month)}`}>
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-weekday" aria-hidden="true">
              {w}
            </span>
          ))}
          {cells.map((date, i) =>
            date ? (
              <DayCell
                key={date}
                date={date}
                selected={date === selected}
                current={date === current}
                onSelect={setSelected}
              />
            ) : (
              <span key={`pad-${i}`} className="cal-pad" aria-hidden="true" />
            )
          )}
        </div>

        <div className="cal-legend" aria-hidden="true">
          <span className="day logged"><Icon name="moon" size={13} className="day-moon" /> Logged</span>
          <span className="day low"><Icon name="moon" size={13} className="day-moon" /> Too short to score</span>
          <span className="day escalation"><Icon name="moon" size={13} className="day-moon" /> Worth showing your doctor</span>
          <span className="cal-legend-dot"><span className="day-dot" /> Nox has a suggestion</span>
        </div>
      </section>

      {BY_DATE[selected] ? (
        <NightDetail date={selected} onOpen={onOpen} />
      ) : (
        <aside className="cal-detail empty">
          <p>Pick a night to see its numbers.</p>
        </aside>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Phone: NightList — myAir's night list, Nocta's rules. One month at a time
 * (‹ October 2026 › to scrub), its nights newest first. Each row leads with
 * the night's moon (the week strip's shapes), not a 0–100 score ring, and
 * says plainly what happened. A night with a full read opens on Tonight.
 * Desktop keeps the month calendar above. */

const rowDate = (date) =>
  toDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

function NightRow({ date, latest, current, onOpen }) {
  const night = BY_DATE[date];
  const v = nightView(night);
  const ahi = ahiTotal(night);
  const marks = v.fx ? nightMarks(v.fx) : { suggests: false, a11y: '' };
  const facts =
    night.hours === 0
      ? 'No session recorded'
      : [ahi != null ? `AHI ${ahi.toFixed(1)}` : 'Too short to score', `${night.hours} h`].join(' · ');
  const eyebrow = current ? 'Showing now' : latest ? 'Most recent' : null;

  const inner = (
    <>
      <span className={`nl-badge ${v.state}`} aria-hidden="true">
        {marks.suggests && <span className="day-dot" />}
        <Icon name="moon" size={24} className="day-moon" />
      </span>
      <span className="nl-text">
        {eyebrow && <span className="nl-eyebrow">{eyebrow}</span>}
        <span className="nl-date">{rowDate(date)}</span>
        <span className="nl-facts tnum">{facts}</span>
      </span>
      {v.fx && <Icon name="chevronRight" size={18} className="nl-chev" />}
    </>
  );

  const label = `${rowDate(date)}, night ${night.n}, ${facts}${marks.a11y}`;
  return v.fx ? (
    <li>
      <button
        type="button"
        className={`nl-row${current ? ' current' : ''}`}
        aria-label={`${label}. Open this night`}
        aria-current={current ? 'date' : undefined}
        onClick={() => onOpen(v.fx.id)}
      >
        {inner}
      </button>
    </li>
  ) : (
    <li className={`nl-row static${night.hours === 0 ? ' missed' : ''}`} aria-label={label}>
      {inner}
    </li>
  );
}

export function NightList({ onOpen }) {
  const { fixtureId } = useStore();
  const current = dateForFixture(fixtureId);
  const [month, setMonth] = useState(monthKey(current));
  const mi = MONTHS.indexOf(month);
  const nights = NIGHTS.filter((x) => monthKey(x.date) === month)
    .map((x) => x.date)
    .sort()
    .reverse();
  const used = NIGHTS.filter((x) => monthKey(x.date) === month);
  const over4 = used.filter(metCompliance).length;

  return (
    <div className="nl">
      {/* scrub month by month */}
      <div className="nl-month">
        <button
          className="cal-arrow"
          type="button"
          onClick={() => setMonth(MONTHS[mi - 1])}
          disabled={mi <= 0}
          aria-label="Previous month"
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="nl-month-mid" aria-live="polite">
          <h3>{monthLabel(month)}</h3>
          <span className="tnum">
            {used.length} {used.length === 1 ? 'night' : 'nights'} · {over4} over 4 hours
          </span>
        </div>
        <button
          className="cal-arrow"
          type="button"
          onClick={() => setMonth(MONTHS[mi + 1])}
          disabled={mi >= MONTHS.length - 1}
          aria-label="Next month"
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </div>

      <ul className="nl-list" key={month} aria-label={`Nights in ${monthLabel(month)}`}>
        {nights.map((date) => (
          <NightRow
            key={date}
            date={date}
            latest={date === LAST_NIGHT}
            current={date === current}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  );
}
