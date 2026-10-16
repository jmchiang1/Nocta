/* Nocta — Sleep journal subpage opened from Trends. Full-screen.
 * Entries grouped by month with native <details> accordions; the most recent
 * month is open by default, older months collapsed. Scales cleanly as the
 * journal grows without turning into a wall of rows. */
import { useStore } from '../lib/store.jsx';
import { journalHistory, TAG_LABELS } from '../data/journal.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

/* group sorted-newest-first entries into runs of the same month */
function groupByMonth(entries) {
  const groups = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (last && last.month === e.month) last.entries.push(e);
    else groups.push({ month: e.month, entries: [e] });
  }
  return groups;
}

export function JournalSheet() {
  const { closeSheet, checkin } = useStore();
  const groups = groupByMonth(journalHistory(checkin));

  return (
    <Sheet title="Sleep journal" onClose={closeSheet} variant="page">
      {groups.length === 0 ? (
        // nothing logged yet: say what will appear here and how
        <div className="journal-empty">
          <Icon name="doc" size={22} />
          <p className="journal-empty-title">No check-ins yet</p>
          <p>
            Each morning, the check-in on Tonight asks how you slept and what was going on. Your
            answers collect here, next to that night’s AHI.
          </p>
        </div>
      ) : null}

      {groups.map((g, i) => (
        <details key={g.month} className="journal-month" open={i === 0}>
          <summary className="journal-month-summary">
            <span className="jms-month">{g.month}</span>
            <span className="jms-count tnum">{g.entries.length}</span>
            <Icon name="chevronDown" size={16} className="jms-chev" />
          </summary>
          <div className="list journal-list">
            {g.entries.map((j) => (
              <div className="list-row" key={j.date}>
                <div className="lr-main">
                  <div className="lr-title">{j.date}</div>
                  <div className="lr-sub">
                    {j.tags.length ? j.tags.map((t) => TAG_LABELS[t] || t).join(' · ') : 'Nothing unusual'}
                  </div>
                </div>
                <div className="lr-right tnum">AHI {j.ahi}</div>
              </div>
            ))}
          </div>
        </details>
      ))}
    </Sheet>
  );
}
