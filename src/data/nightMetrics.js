/* Nocta — the four machine measurements that get their own detail page from
 * the full night (Apple Health style: one graph, its key number, and a short
 * "About" in plain language). Hedged, never diagnostic, and never a pressure
 * suggestion (CLAUDE.md safety rails). */
import { pct } from '../lib/nightSeries.js';
import { cardNight } from './history.js';

const LEAK_LINE = 24;
const round1 = (x) => Math.round(x * 10) / 10;

export const NIGHT_METRICS = {
  resp: {
    title: 'Breathing rate',
    unit: 'breaths/min',
    meta: 'breaths a minute',
    about:
      'Breathing rate is how many breaths a minute your machine counted through the night. Many adults sit somewhere around 12 to 20 at rest. What matters most is how steady yours stays from minute to minute and night to night.',
  },
  pressure: {
    title: 'Pressure',
    unit: 'cmH₂O',
    meta: 'cmH₂O',
    about:
      'Pressure is how firmly your machine pushes air to keep your airway open. On AutoSet it rises and falls on its own through the night, within the range your doctor prescribed. A higher stretch often means your airway needed more support then.',
  },
  leak: {
    title: 'Leak rate',
    unit: 'L/min',
    meta: `L/min · ${LEAK_LINE} threshold`,
    about: `Leak rate is air escaping around your mask or through your mouth, beyond the small vent leak your mask is designed to have. Staying under ${LEAK_LINE} L/min is generally considered fine. Higher stretches often come from a loose fit, a worn cushion, or a change in sleep position.`,
  },
  snore: {
    title: 'Snore index',
    unit: '',
    meta: 'machine snore index',
    about:
      'Snore index is how much vibration your machine picked up in your airway. Higher means more. A little is common, even on CPAP. Longer stretches of higher snoring can mean your airway was partly narrowed for a while.',
  },
};

/* the headline number for a metric's detail page. Pressure, leak and
 * breathing rate use the card's own night statistics (computed from the
 * machine's 2-second samples) — the same numbers as the tiles, so the two
 * always agree. Only snore, which the card doesn't summarise, is read from
 * its per-minute series, skipping mask-off minutes. */
export function metricStat(key, series, fx) {
  const raw = cardNight(fx.id);
  const none = (label, what) => ({ label, value: '—', unit: '', sub: `No ${what} recorded`, sentence: `the machine did not record ${what} this night` });

  if (key === 'pressure') {
    const p = raw?.pressure;
    if (p?.p50 == null) return none('Median', 'pressure');
    return {
      label: 'Median',
      value: round1(p.p50).toFixed(1),
      sub: `95% of the night at or under ${round1(p.p95).toFixed(1)} · highest ${round1(p.max).toFixed(1)}`,
      sentence: `the median was **${round1(p.p50).toFixed(1)} cmH₂O**, 95% of the night at or under ${round1(p.p95).toFixed(1)}, and the highest reading ${round1(p.max).toFixed(1)}`,
    };
  }
  if (key === 'leak') {
    const l = raw?.leak;
    if (l?.p95 == null) return none('95th percentile', 'leak');
    const p95 = Math.round(l.p95);
    const over = l.largeMinutes; // minutes above the line, from 2-second samples
    return {
      label: '95th percentile',
      value: String(p95),
      sub: over ? `Above ${LEAK_LINE} for about ${over} min` : over === 0 ? `Under ${LEAK_LINE} all night` : 'L/min',
      sentence: over
        ? `95% of the night it stayed at or under **${p95} L/min**, and it ran above ${LEAK_LINE} for about **${over} minutes**`
        : `95% of the night it stayed at or under **${p95} L/min**${over === 0 ? `, never above ${LEAK_LINE}` : ''}`,
    };
  }
  if (key === 'snore') {
    const s = (raw?.sessions ?? []).flatMap((x) => x.series?.snore ?? []).filter((v) => v != null);
    if (!s.length) return none('Average', 'snoring');
    const avg = round1(s.reduce((a, b) => a + b, 0) / s.length);
    const peak = round1(Math.max(...s));
    return {
      label: 'Average',
      value: avg.toFixed(1),
      sub: `Highest minute ${peak.toFixed(1)}`,
      sentence: `it averaged **${avg.toFixed(1)}**, with the highest minute at ${peak.toFixed(1)}`,
    };
  }
  // breathing rate: the card's median; the spread from its per-minute series
  const med = raw?.respRate?.p50;
  const s = (raw?.sessions ?? []).flatMap((x) => x.series?.respRate ?? []).filter((v) => v > 0);
  if (med == null || !s.length) return none('Median', 'breathing rate');
  return {
    label: 'Median',
    value: round1(med).toFixed(1),
    sub: `Mostly between ${round1(pct(s, 0.1)).toFixed(1)} and ${round1(pct(s, 0.9)).toFixed(1)}`,
    sentence: `your breathing rate sat around **${round1(med).toFixed(1)} breaths a minute**, mostly between ${round1(pct(s, 0.1)).toFixed(1)} and ${round1(pct(s, 0.9)).toFixed(1)}`,
  };
}
