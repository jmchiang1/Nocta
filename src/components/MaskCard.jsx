/* Nocta — "Your mask" card on the Therapy tab. Tap to open the mask picker.
 * Mask MODEL (what you own) is intentionally separate from the Equipment
 * lifecycle list below (when to replace mask parts). */
import { useStore } from '../lib/store.jsx';
import { maskById, MASK_BRAND_LABEL, MASK_TYPE_LABEL } from '../data/account.js';
import { Icon } from '../components/Icons.jsx';

export function MaskCard() {
  const { maskId, openSheet } = useStore();
  const mask = maskById(maskId);

  return (
    <>
      <div className="section-head">
        <h3>Your mask</h3>
        <span className="meta">tap to change</span>
      </div>
      <div className="list">
        <button className="list-row" onClick={() => openSheet('maskPicker')}>
          <div className="lr-icon">
            <Icon name="pillow" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">
              {MASK_BRAND_LABEL[mask.brand]} {mask.name}
            </div>
            <div className="lr-sub">{MASK_TYPE_LABEL[mask.type]}</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>
    </>
  );
}
