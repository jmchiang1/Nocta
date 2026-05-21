/* Nocta — modal slide-up sheet. Animates in on mount and out on close.
 * `children` / `footer` may be a render function receiving `close` so in-content
 * buttons trigger the same smooth dismissal.
 *
 * `variant`: 'sheet' (default) slides up from the bottom; 'page' pushes in from
 * the right edge — used for navigation drill-downs off the You tab (Account,
 * Settings, Device Detail) where the surface is hierarchical rather than modal. */
import { useState, useCallback } from 'react';
import { Icon } from './Icons.jsx';

const EXIT_MS = 300;

export function Sheet({
  eyebrow,
  title,
  onClose,
  children,
  footer,
  footerClass,
  full = false,
  headRight,
  variant = 'sheet',
}) {
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing((c) => {
      if (c) return c;
      setTimeout(onClose, EXIT_MS);
      return true;
    });
  }, [onClose]);

  const body = typeof children === 'function' ? children(close) : children;
  const foot = typeof footer === 'function' ? footer(close) : footer;
  const isPage = variant === 'page';
  const isFull = full || isPage;

  return (
    <>
      <div className={`sheet-scrim${closing ? ' closing' : ''}`} onClick={close} />
      <div
        className={`sheet${isFull ? ' full' : ''}${isPage ? ' page' : ''}${closing ? ' closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {!isFull && <div className="sheet-grip" />}
        <div className="sheet-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3>{title}</h3>
          </div>
          {headRight || (
            <button className="sheet-close" onClick={close} aria-label="Close">
              <Icon name="x" size={17} />
            </button>
          )}
        </div>
        <div className="sheet-body">{body}</div>
        {foot && (
          <div className={`sheet-foot${footerClass ? ` ${footerClass}` : ''}`}>{foot}</div>
        )}
      </div>
    </>
  );
}
