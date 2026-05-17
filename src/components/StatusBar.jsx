/* Nocta — faux iOS status bar */

export function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <div className="sb-right" aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff" />
          <rect x="5" y="5" width="3" height="6" rx="0.5" fill="#fff" />
          <rect x="10" y="2" width="3" height="9" rx="0.5" fill="#fff" />
          <rect x="15" y="0" width="3" height="11" rx="0.5" fill="#fff" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path
            d="M7.5 2C4.6 2 2 3.1 0 5l1.4 1.4C3 4.9 5.2 4 7.5 4s4.5.9 6.1 2.4L15 5C13 3.1 10.4 2 7.5 2zm0 3.5c-1.7 0-3.2.6-4.4 1.6L4.5 8.5C5.3 7.8 6.3 7.4 7.5 7.4s2.2.4 3 1.1L11.9 7.1c-1.2-1-2.7-1.6-4.4-1.6zm0 3.1a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z"
            fill="#fff"
          />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" strokeOpacity="0.5" />
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill="#fff" />
          <rect x="23" y="4" width="2" height="4" rx="0.5" fill="#fff" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
