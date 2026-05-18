/* Nocta — inline SVG icon set. <Icon name="..." size={20} /> */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const PATHS = {
  tonight: <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  trends: <path d="M4 19V5M8 19v-9M12 19V8M16 19v-6M20 19V3" />,
  therapy: (
    <>
      <path d="M4 8c0-2 2-4 8-4s8 2 8 4-2 8-8 8-8-6-8-8z" />
      <circle cx="12" cy="9" r="1.5" />
    </>
  ),
  you: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.4 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 009 19.4a1.7 1.7 0 00-1.8.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.4-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  heart: <path d="M12 20s-7-4.6-9.2-9A4.8 4.8 0 0 1 12 6.3 4.8 4.8 0 0 1 21.2 11C19 15.4 12 20 12 20z" />,
  sparkles: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  leak: <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />,
  ahi: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  doc: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </>
  ),
  download: <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />,
  refresh: <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />,
  exercise: <path d="M6.5 6.5l11 11M4 9l5-5M15 20l5-5M2 12l4 4M18 8l4 4M12 2l4 4" />,
  position: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21c0-3 3-5 6-5M14 14l3 3-3 3M11 17h6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  coach: <path d="M21 12c0 4.4-4 8-9 8a10 10 0 01-3.5-.6L3 21l1.6-4.5A8 8 0 013 12c0-4.4 4-8 9-8s9 3.6 9 8z" />,
  spark: <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  bed: <path d="M3 18V8M3 12h13a4 4 0 014 4v2M3 18h18M7 12V9a1 1 0 011-1h3a1 1 0 011 1v3" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  logout: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
  pillow: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="4" />
      <path d="M8 7v10M16 7v10" />
    </>
  ),
  wind: <path d="M3 8h11a3 3 0 100-6M3 12h16a3 3 0 110 6M3 16h8a2.5 2.5 0 110 5" />,
};

/* solid-fill glyphs */
const SOLID = {
  star: <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" />,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
  triUp: <path d="M12 5l7 12H5z" />,
  triDown: <path d="M12 19L5 7h14z" />,
  dotRing: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </>
  ),
};

export function Icon({ name, size = 20, className }) {
  if (SOLID[name]) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        {SOLID[name]}
      </svg>
    );
  }
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...STROKE}>
      {path}
    </svg>
  );
}
