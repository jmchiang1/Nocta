/* Nocta — modal slide-up sheet */
import { Icon } from './Icons.jsx';

export function Sheet({ eyebrow, title, onClose, children, footer, full = false, headRight }) {
  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <div className={`sheet${full ? ' full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {!full && <div className="sheet-grip" />}
        <div className="sheet-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3>{title}</h3>
          </div>
          {headRight || (
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <Icon name="x" size={17} />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}
