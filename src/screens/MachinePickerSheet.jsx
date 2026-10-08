/* Nocta — CPAP machine picker. Opened from the device card on Therapy.
 * Mirrors the mask picker: one list, grouped by brand, current pick checked. */
import { useStore } from '../lib/store.jsx';
import { MACHINES } from '../data/therapy.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

const BRANDS = [...new Set(MACHINES.map((m) => m.brand))];

export function MachinePickerSheet() {
  const { closeSheet, machineId, setMachineId, showToast } = useStore();

  return (
    <Sheet eyebrow="Equipment" title="Change machine" onClose={closeSheet} full>
      {(close) => (
        <>
          <p className="settings-note" style={{ margin: '0 0 14px' }}>
            Pick the CPAP you sleep with. Nocta reads it through SleepHQ, so your next sync
            will come from the machine you choose here. Your prescribed pressure doesn’t
            change.
          </p>

          {BRANDS.map((brand) => (
            <div key={brand}>
              <div className="result-count">{brand}</div>
              <div className="list mask-list">
                {MACHINES.filter((m) => m.brand === brand).map((m) => {
                  const selected = m.id === machineId;
                  return (
                    <button
                      key={m.id}
                      className={`list-row${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => {
                        setMachineId(m.id);
                        close();
                        if (!selected) showToast(`Machine set to ${m.short}`, 'check');
                      }}
                    >
                      <div className="lr-main">
                        <div className="lr-title">{m.name}</div>
                        <div className="lr-sub">{m.mode}</div>
                      </div>
                      {selected && <Icon name="check" size={17} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
