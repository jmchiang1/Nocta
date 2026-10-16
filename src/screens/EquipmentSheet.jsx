/* Nocta — one piece of equipment (Therapy › Equipment › a part): where it is
 * in its replacement cycle, and the place to log a replacement — today, or a
 * date picked here. The Equipment card itself only shows progress; logging
 * lives here, with real buttons. The CPAP card can't know when a part was
 * replaced, so until it's logged there is no age, never a guess. */
import { useState, useEffect } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { ProgressBar } from '../components/Charts.jsx';
import { equipmentStatus, logReplaced, onEquipment, TODAY } from '../lib/equipment.js';
import { validDate } from '../lib/format.js';

const EARLIEST = '2000-01-01';
const longDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/* where a part is: shared with the Equipment card's rows */
export function partStatus(p) {
  if (p.ageDays == null) return { text: 'Not logged', pct: 0, alert: false };
  const left = p.lifespanDays - p.ageDays;
  const pct = Math.min(100, (p.ageDays / p.lifespanDays) * 100);
  const alert = p.ageDays >= p.lifespanDays * 0.8;
  return { text: left <= 0 ? 'Replace now' : `${left} ${left === 1 ? 'day' : 'days'} left`, pct, alert };
}

export function EquipmentSheet() {
  const { sheet, closeSheet, showToast } = useStore();
  const [parts, setParts] = useState(equipmentStatus);
  useEffect(() => onEquipment(() => setParts(equipmentStatus())), []);
  const p = parts.find((x) => x.id === sheet?.partId) ?? parts[0];
  const [picked, setPicked] = useState(p.replacedOn ?? '');
  const date = validDate(picked, EARLIEST, TODAY());
  const s = partStatus(p);

  const save = (close, on) => {
    logReplaced(p.id, on);
    showToast(on ? `${p.name}: replaced ${on === TODAY() ? 'today' : longDate(on)}` : `${p.name}: date cleared`, 'check');
    close();
  };

  return (
    <Sheet
      eyebrow="Equipment"
      title={p.name}
      onClose={closeSheet}
      footer={(close) => (
        <>
          <button className="btn primary" onClick={() => save(close, TODAY())}>
            Replaced today
          </button>
          <button className="btn ghost" disabled={!date || date === p.replacedOn} onClick={() => save(close, date)}>
            Save date
          </button>
          {p.replacedOn && (
            <button className="btn subtle" onClick={() => save(close, null)}>
              Clear date
            </button>
          )}
        </>
      )}
    >
      <div className="eq-sheet">
        <div className="eq-status">
          <span className={`eq-left tnum${s.alert ? ' alert' : ''}`}>{s.text}</span>
          <span className="eq-cycle tnum">
            {p.replacedOn
              ? `Replaced ${longDate(p.replacedOn)} · every ${p.lifespanDays} days`
              : `Replace every ${p.lifespanDays} days`}
          </span>
        </div>
        <ProgressBar pct={s.pct} color={s.alert ? 'alert' : 'data'} height={8} />

        <label className="ob-field-label eq-label" htmlFor="eq-date">
          {p.replacedOn ? 'Replaced on a different day?' : 'Replaced it before today?'}
        </label>
        <input
          id="eq-date"
          className="text-field eq-date"
          type="date"
          min={EARLIEST}
          max={TODAY()}
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
