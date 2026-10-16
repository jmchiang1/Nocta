/* Nocta — equipment replacement, Therapy (mobile + desktop). The card shows
 * where each part is in its replacement cycle; tapping a part opens it
 * (screens/EquipmentSheet.jsx), where the replacement is logged. The CPAP
 * card can't know when a part was replaced, so a part's age exists only once
 * the person logs it. Until then it says "Not logged" — never an invented age. */
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { Icon } from './Icons.jsx';
import { ProgressBar } from './Charts.jsx';
import { equipmentStatus, onEquipment, PARTS } from '../lib/equipment.js';
import { partStatus } from '../screens/EquipmentSheet.jsx';

/* `collapsible` folds the parts under the summary (mobile); the desktop page
 * has the room to keep them open, so there it's a plain header */
export function EquipmentList({ collapsible = true }) {
  const { openSheet } = useStore();
  const [parts, setParts] = useState(equipmentStatus);
  useEffect(() => onEquipment(() => setParts(equipmentStatus())), []);

  const logged = parts.filter((p) => p.ageDays != null);
  const due = logged.filter((p) => p.ageDays >= p.lifespanDays * 0.8);
  // folded to start (the summary line already says what's due); tap to open
  const [expanded, setExpanded] = useState(false);
  const open = !collapsible || expanded;

  const title = !logged.length
    ? 'No replacements logged yet'
    : due.length
      ? `${due.length} ${due.length === 1 ? 'part' : 'parts'} due for replacement`
      : `${logged.length} of ${parts.length} parts logged`;
  const sub = !logged.length
    ? 'Log when you last replaced each part, and Nocta shows when each one is due'
    : due.length
      ? due.map((p) => p.name).join(', ')
      : `${parts.length - logged.length} not logged yet`;

  return (
    <div className={`equip${open ? ' open' : ''}`}>
      {collapsible ? (
        <button className={`equip-summary ${due.length ? 'alert' : ''}`} type="button" aria-expanded={open} onClick={() => setExpanded((o) => !o)}>
          <span className="es-main">
            <span className="es-title">{title}</span>
            <span className="es-sub">{sub}</span>
          </span>
          <Icon name="chevronDown" size={16} className="es-chev" />
        </button>
      ) : (
        <div className={`equip-summary static ${due.length ? 'alert' : ''}`}>
          <span className="es-main">
            <span className="es-title">{title}</span>
            <span className="es-sub">{sub}</span>
          </span>
        </div>
      )}
      {open &&
        parts.map((p) => {
          const s = partStatus(p);
          return (
            <button
              type="button"
              className="equip-row"
              key={p.id}
              onClick={() => openSheet('equipment', { partId: p.id })}
              aria-label={`${p.name}: ${s.text}. Log a replacement`}
            >
              <span className="er-top">
                <span className="er-name">{p.name}</span>
                <span className={`er-age tnum${s.alert ? ' alert' : ''}`}>{s.text}</span>
                <Icon name="chevronRight" size={15} className="er-chev" />
              </span>
              <ProgressBar pct={s.pct} color={s.alert ? 'alert' : 'data'} height={6} />
            </button>
          );
        })}
    </div>
  );
}

/* what the Equipment section shows, for the (i) beside its heading. The
 * replacement times come from the part list itself, so they can't drift. */
const byLifespan = PARTS.reduce((m, p) => m.set(p.lifespanDays, [...(m.get(p.lifespanDays) ?? []), p.name]), new Map());

export function EquipmentInfo() {
  return (
    <>
      <p>
        Mask cushions, filters and tubing wear out with use. Log the day you last replaced a part, and
        Nocta keeps count of its age and shows when it’s due.
      </p>
      <ul className="tnum">
        {[...byLifespan].map(([days, names]) => (
          <li key={days}>
            <strong>Every {days} days:</strong> {names.join(', ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
          </li>
        ))}
      </ul>
      <p>
        A part shows as due once it’s 80% of the way to its replacement time. Your CPAP card can’t tell
        when you swapped something, so a part says “Not logged” until you add the date.
      </p>
    </>
  );
}
