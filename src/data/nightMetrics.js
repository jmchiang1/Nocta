/* Nocta — the four machine measurements that get their own detail page from
 * the full night (Apple Health style: one graph, its key number, and a short
 * "About" in plain language). Hedged, never diagnostic, and never a pressure
 * suggestion (CLAUDE.md safety rails). */
import { pct } from '../lib/nightSeries.js';

const LEAK_LINE = 24;
const round1 = (x) => Math.round(x * 10) / 10;

export const NIGHT_METRICS = {
  flow: {
    title: 'Flow rate',
    unit: '',
    meta: 'breath by breath',
    about:
      'Flow rate is the air moving in and out with each breath, as your machine measures it. Even, steady waves mean easy breathing. Flatter stretches are where breathing paused or got shallow, which is what your machine counts as events.',
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
    meta: '0 – 10',
    about:
      'Snore index is how much vibration your machine picked up in your airway, on a scale of 0 to 10. A little is common, even on CPAP. Longer stretches of higher snoring can mean your airway was partly narrowed for a while.',
  },
};

/* the headline number for a metric's detail page, from the night's series */
export function metricStat(key, series, fx) {
  const minsPer = (fx.session.durationHours * 60) / (series[key]?.length || 1);
  if (key === 'pressure') {
    const s = series.pressure;
    return {
      label: 'Median',
      value: round1(pct(s, 0.5)).toFixed(1),
      sub: `Ranged ${round1(Math.min(...s)).toFixed(1)} to ${round1(Math.max(...s)).toFixed(1)} overnight`,
      sentence: `the median was **${round1(pct(s, 0.5)).toFixed(1)} cmH₂O**, ranging from ${round1(Math.min(...s)).toFixed(1)} to ${round1(Math.max(...s)).toFixed(1)}`,
    };
  }
  if (key === 'leak') {
    const s = series.leak;
    if (!s)
      return {
        label: '95th percentile',
        value: '—',
        unit: '',
        sub: 'Not enough data recorded',
        sentence: 'the machine did not record enough leak data this night to read',
      };
    const over = Math.round(s.filter((v) => v > LEAK_LINE).length * minsPer);
    const p95 = Math.round(pct(s, 0.95));
    return {
      label: '95th percentile',
      value: String(p95),
      sub: over ? `Above ${LEAK_LINE} for about ${over} min` : `Under ${LEAK_LINE} all night`,
      sentence: over
        ? `it peaked at **${p95} L/min** and ran above ${LEAK_LINE} for about **${over} minutes**`
        : `it stayed under ${LEAK_LINE} all night, topping out at **${p95} L/min**`,
    };
  }
  if (key === 'snore') {
    const s = series.snore;
    const avg = round1(s.reduce((a, b) => a + b, 0) / s.length);
    return {
      label: 'Average',
      value: avg.toFixed(1),
      sub: `Peak ${round1(Math.max(...s)).toFixed(1)} of 10`,
      sentence: `it averaged **${avg.toFixed(1)}** out of 10, peaking at ${round1(Math.max(...s)).toFixed(1)}`,
    };
  }
  // flow: the waveform has no single number; breathing rate comes from the watch
  const rr = fx.bodyResponse?.respRate?.value;
  return {
    label: 'Breathing rate',
    value: rr != null ? String(rr) : '—',
    unit: rr != null ? 'breaths/min' : '',
    sub: rr != null ? 'Average from your watch' : 'No breathing rate recorded',
    sentence:
      rr != null
        ? `you averaged **${rr} breaths a minute**, and the wave shows each breath through the night`
        : 'the wave shows each breath through the night',
  };
}
