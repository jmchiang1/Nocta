/* Nocta — "Your mask" on the Therapy tab. Tap to open the mask picker.
 * Mask MODEL (what you own) is intentionally separate from the Equipment
 * lifecycle list below (when to replace mask parts). The model is only ever
 * what the person picked or told us; until then it says so, with the mask
 * type the machine itself records, if any.
 * `inline`: a row inside the device card (mobile — machine + mask read as one
 * setup); without it, its own section (desktop's Therapy column). */
import { useStore } from '../lib/store.jsx';
import { maskById, cardMaskType, MASK_BRAND_LABEL, MASK_TYPE_LABEL } from '../data/account.js';
import { getCard } from '../lib/dataset.js';
import { Icon } from '../components/Icons.jsx';

function useMask() {
  const { maskId, openSheet } = useStore();
  const mask = maskById(maskId);
  const machineType = cardMaskType(getCard()?.settings);
  return {
    mask,
    title: mask ? `${MASK_BRAND_LABEL[mask.brand]} ${mask.name}` : 'Not set yet',
    sub: mask
      ? MASK_TYPE_LABEL[mask.type]
      : machineType
        ? `Your machine is set for a ${machineType.toLowerCase()} mask`
        : 'Tell Nocta which mask you use',
    open: () => openSheet('maskPicker'),
  };
}

export function MaskCard({ inline = false }) {
  const m = useMask();

  if (inline) {
    return (
      <button className="dc-mask" onClick={m.open}>
        <span className="dc-mask-icon" aria-hidden="true">
          <Icon name="pillow" size={17} />
        </span>
        <span className="dc-mask-main">
          <span className="dc-mask-k">Your mask</span>
          <span className={`dc-mask-v${m.mask ? '' : ' unset'}`}>{m.title}</span>
          <span className="dc-mask-sub">{m.sub}</span>
        </span>
        <span className="dc-mask-cta">
          {m.mask ? 'Change' : 'Add'}
          <Icon name="chevronRight" size={15} />
        </span>
      </button>
    );
  }

  return (
    <>
      <div className="section-head">
        <h3>Your mask</h3>
        <span className="meta">{m.mask ? 'tap to change' : 'tap to add'}</span>
      </div>
      <div className="list">
        <button className="list-row" onClick={m.open}>
          <div className="lr-icon">
            <Icon name="pillow" size={17} />
          </div>
          <div className="lr-main">
            <div className="lr-title">{m.title}</div>
            <div className="lr-sub">{m.sub}</div>
          </div>
          <Icon name="chevronRight" size={17} />
        </button>
      </div>
    </>
  );
}
