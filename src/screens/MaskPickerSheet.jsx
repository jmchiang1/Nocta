/* Nocta — comprehensive mask picker. Same catalog + filter UX as the
 * onboarding "Your mask & supplies" step so the user can find any model. */
import { useState, useMemo } from 'react';
import { useStore } from '../lib/store.jsx';
import {
  MASKS,
  MASK_BRANDS,
  MASK_TYPES,
  MASK_BRAND_LABEL,
  MASK_TYPE_LABEL,
} from '../data/account.js';
import { Sheet } from '../components/Sheet.jsx';
import { Icon } from '../components/Icons.jsx';

export function MaskPickerSheet() {
  const { closeSheet, maskId, setMaskId } = useStore();
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MASKS.filter((m) => {
      if (brand && m.brand !== brand) return false;
      if (type && m.type !== type) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        MASK_BRAND_LABEL[m.brand].toLowerCase().includes(q)
      );
    });
  }, [brand, type, query]);

  return (
    <Sheet eyebrow="Equipment" title="Change mask" onClose={closeSheet} full>
      {(close) => (
        <>
          <p className="settings-note" style={{ margin: '0 0 14px' }}>
            Find the exact mask you use. Switching this updates the parts Nocta tracks
            for replacement.
          </p>

          <input
            className="text-field"
            type="search"
            placeholder="Search by model name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search masks"
          />
          <div className="filter-row">
            <select
              className="select-field"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              aria-label="Filter by brand"
            >
              <option value="">All brands</option>
              {MASK_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <select
              className="select-field"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {MASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="result-count">{results.length} masks</div>

          {results.length === 0 ? (
            <div className="empty-note">No masks match those filters.</div>
          ) : (
            <div className="list mask-list">
              {results.map((m) => {
                const selected = m.id === maskId;
                return (
                  <button
                    key={m.id}
                    className={`list-row${selected ? ' selected' : ''}`}
                    onClick={() => {
                      setMaskId(m.id);
                      close();
                    }}
                  >
                    <div className="lr-main">
                      <div className="lr-title">
                        {MASK_BRAND_LABEL[m.brand]} {m.name}
                      </div>
                      <div className="lr-sub">{MASK_TYPE_LABEL[m.type]}</div>
                    </div>
                    {selected && <Icon name="check" size={17} />}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
