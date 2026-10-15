/* Nocta — equipment replacement, Therapy (mobile + desktop). The card can't
 * know when a part was replaced, so a part's age exists only once the person
 * logs it ("Replaced today", or a date). Until then it says "Not logged" and
 * shows the recommended interval — never an invented age. */
import { useState, useEffect } from 'react';
import { Icon } from './Icons.jsx';
import { ProgressBar } from './Charts.jsx';
import { equipmentStatus, logReplaced, onEquipment, TODAY } from '../lib/equipment.js';

const ago = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function EquipmentList() {
  const [parts, setParts] = useState(equipmentStatus);
  useEffect(() => onEquipment(() => setParts(equipmentStatus())), []);
  const [editing, setEditing] = useState(null);

  const logged = parts.filter((p) => p.ageDays != null);
  const due = logged.filter((p) => p.ageDays >= p.lifespanDays * 0.8);
  const [open, setOpen] = useState(due.length > 0 || logged.length === 0);

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
      <button className={`equip-summary ${due.length ? 'alert' : ''}`} type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="es-main">
          <span className="es-title">{title}</span>
          <span className="es-sub">{sub}</span>
        </span>
        <Icon name="chevronDown" size={16} className="es-chev" />
      </button>
      {open &&
        parts.map((p) => {
          const pct = p.ageDays == null ? null : p.ageDays / p.lifespanDays;
          const dueSoon = pct != null && pct >= 0.8;
          return (
            <div className="equip-row" key={p.id}>
              <div className="er-top">
                <span className="er-name">{p.name}</span>
                <span className={`er-age${dueSoon ? ' alert' : ''}`}>
                  {p.ageDays == null
                    ? `Not logged · replace every ${p.lifespanDays} days`
                    : `${p.ageDays} / ${p.lifespanDays} days · since ${ago(p.replacedOn)}${pct >= 1 ? ' · replace now' : dueSoon ? ' · replace soon' : ''}`}
                </span>
              </div>
              {pct != null && <ProgressBar pct={Math.min(100, pct * 100)} color={dueSoon ? 'alert' : 'data'} height={6} />}
              <div className="er-actions">
                <button type="button" className="er-log" onClick={() => logReplaced(p.id, TODAY())}>
                  Replaced today
                </button>
                {editing === p.id ? (
                  <input
                    type="date"
                    className="er-date"
                    max={TODAY()}
                    defaultValue={p.replacedOn ?? ''}
                    aria-label={`When you last replaced the ${p.name.toLowerCase()}`}
                    autoFocus
                    onChange={(e) => e.target.value && logReplaced(p.id, e.target.value)}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <button type="button" className="er-log subtle" onClick={() => setEditing(p.id)}>
                    {p.replacedOn ? 'Change date' : 'Pick a date'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
