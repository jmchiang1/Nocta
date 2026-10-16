/* Nocta — an (i) beside a section heading that opens a short note on what
 * the section shows (as onboarding's "why we ask"). The note drops under the
 * heading, across its full width; a tap away or Escape closes it. */
import { useState, useEffect, useRef, useId } from 'react';
import { Icon } from './Icons.jsx';

export function InfoTip({ label, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="info-tip" ref={ref}>
      <button
        type="button"
        className={`info-tip-btn${open ? ' on' : ''}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={17} />
      </button>
      {open && (
        <div
          id={id}
          className="info-tip-note"
          role="note"
          // low on the screen it would open under the tab bar: once it has
          // its full size, bring it into view (scroll-margin clears the bar)
          onAnimationEnd={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
        >
          {children}
        </div>
      )}
    </div>
  );
}
