/* Nocta — the full night's event list, filtered and sorted (phone). The
 * list's own row has no room for both the type chips and the sort pill, so
 * one button there opens this: which events to show, and in what order.
 * Each pick applies straight away (the list behind updates); Done closes. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';
import { SORTS } from '../components/NightCharts.jsx';

function Choice({ label, n, on, onPick }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={`list-row${on ? ' selected' : ''}`} onClick={onPick}>
      <div className="lr-main">
        <div className="lr-title">{label}</div>
      </div>
      {n != null && <span className="ev-pick-n tnum">{n}</span>}
      <span className="ev-pick-check" aria-hidden="true">
        {on && <Icon name="check" size={17} />}
      </span>
    </button>
  );
}

export function EventFilterSheet() {
  const { sheet, closeSheet } = useStore();
  const [type, setType] = useState(sheet?.type ?? 'all');
  const [sort, setSort] = useState(sheet?.sort ?? 'time');

  return (
    <Sheet
      title="Show and sort"
      onClose={closeSheet}
      footer={(close) => (
        <button className="btn primary" onClick={close}>
          Done
        </button>
      )}
    >
      <div className="ev-filter-sheet">
        <div className="section-head">
          <h3>Show</h3>
        </div>
        <div className="list" role="radiogroup" aria-label="Show events">
          {(sheet?.types ?? []).map((t) => (
            <Choice
              key={t.id}
              label={t.label}
              n={t.n}
              on={type === t.id}
              onPick={() => {
                setType(t.id);
                sheet.onType?.(t.id);
              }}
            />
          ))}
        </div>
        <div className="section-head">
          <h3>Sort by</h3>
        </div>
        <div className="list" role="radiogroup" aria-label="Sort events by">
          {SORTS.map((o) => (
            <Choice
              key={o.id}
              label={o.label}
              on={sort === o.id}
              onPick={() => {
                setSort(o.id);
                sheet.onSort?.(o.id);
              }}
            />
          ))}
        </div>
      </div>
    </Sheet>
  );
}
