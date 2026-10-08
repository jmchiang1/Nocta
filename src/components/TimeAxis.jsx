/* Nocta — a clock-time axis for one night's charts: whole hours placed where
 * they fall between the session's start and end (every hour for a short
 * night, every two otherwise). Replaces fixed "12AM 2AM 4AM 6AM" labels that
 * didn't match nights starting at 10:54 PM or 1:20 AM. */
import { sessionSpan, hourLabel } from '../lib/nightSeries.js';

export function TimeAxis({ session, className = '' }) {
  const { start, span } = sessionSpan(session);
  if (start == null) return null;
  const step = span <= 200 ? 1 : 2;
  const ticks = [];
  for (let m = Math.ceil(start / 60) * 60; m <= start + span; m += 60) {
    const h24 = (m / 60 + 12) % 24;
    const x = ((m - start) / span) * 100;
    if (h24 % step === 0 && x > 4 && x < 96) ticks.push({ x, label: hourLabel(m).replace(/a$/, 'AM').replace(/p$/, 'PM') });
  }
  return (
    <span className={`time-axis tnum ${className}`} aria-hidden="true">
      {ticks.map((t) => (
        <span key={t.label} style={{ left: `${t.x}%` }}>
          {t.label}
        </span>
      ))}
    </span>
  );
}
