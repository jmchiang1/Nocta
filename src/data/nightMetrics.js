/* Nocta — the machine measurements that get their own detail page from
 * the full night (Apple Health style: one graph, its key number, and a short
 * "About" in plain language). Hedged, never diagnostic, and never a pressure
 * suggestion (CLAUDE.md safety rails). */
import { pct } from '../lib/nightSeries.js';
import { cardNight } from './history.js';
import { nightDetail, duration } from '../lib/nightDetail.js';

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
  sessions: {
    title: 'Mask on and off',
    unit: 'h',
    meta: 'sessions',
    about:
      'Each bar is a stretch with your mask on, from the moment your machine started to when it stopped. The gaps are times it came off, like getting up in the night. A few short breaks are common. Your hours on the mask count only the time inside the bars.',
  },
  setPressure: {
    title: 'Set pressure and your range',
    unit: 'cmH₂O',
    meta: 'cmH₂O',
    about:
      'This is the pressure your machine set for each breath in, and for breathing out. Exhale relief lowers the pressure as you breathe out so it feels easier. On AutoSet the machine moves within the range your doctor prescribed, shaded here. Questions about your range or settings are for your doctor.',
  },
  pressureTime: {
    title: 'Time at each pressure',
    unit: 'min',
    meta: 'minutes',
    about:
      'Each bar is how many minutes your machine spent at that pressure through the night, in steps of 0.1 cmH₂O. Your prescribed range is shaded. If your machine often spends time at the top of its range, that is worth mentioning to your doctor at your next visit.',
  },
  flow: {
    title: 'Flow limitation',
    unit: '',
    meta: '0 open · 1 restricted',
    about:
      'Flow limitation is your machine’s score for how freely each breath in flows. 0 means the breath flowed freely. Higher means its shape was flattened, as if the airway narrowed a little. AutoSet watches this to decide when to raise pressure. Short spikes are common.',
  },
  tidal: {
    title: 'Breath size',
    unit: 'mL',
    meta: 'mL a breath',
    about:
      'Breath size is how much air you moved with each breath, in millilitres, as your machine measured it. It shifts with sleep stage and position through the night. How steady it stays matters more than any single number.',
  },
  minVent: {
    title: 'Air moved a minute',
    unit: 'L/min',
    meta: 'L/min',
    about:
      'This is how much air you breathed in each minute: your breath size times your breaths a minute. It usually stays fairly steady through the night, dipping a little in deeper sleep.',
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
  if (key === 'sessions') {
    const d = nightDetail(fx.id);
    if (!d?.sessionCount) return none('On the mask', 'mask sessions');
    const hrs = round1(raw.hours).toFixed(1);
    const breaks = d.sessionCount - 1;
    return {
      label: 'On the mask',
      value: hrs,
      sub: breaks ? `${d.sessionCount} sessions · off ${duration(d.maskOff)} in between` : 'One unbroken session',
      sentence: breaks
        ? `your mask was on for **${hrs} hours** across ${d.sessionCount} sessions, off for ${duration(d.maskOff)} in between`
        : `your mask was on for **${hrs} hours** in one unbroken session`,
    };
  }
  if (key === 'setPressure') {
    const p = raw?.pressure;
    if (p?.inhaleP50 == null) return none('Median breathing in', 'set pressure');
    const d = nightDetail(fx.id);
    const range = d?.range ? `range ${d.range[0]}–${d.range[1]}` : null;
    const out = p.exhaleP50 != null ? `breathing out ${round1(p.exhaleP50).toFixed(1)}` : null;
    return {
      label: 'Median breathing in',
      value: round1(p.inhaleP50).toFixed(1),
      sub: [out, d?.eprLevel ? `exhale relief ${d.eprLevel}` : null, range].filter(Boolean).join(' · '),
      sentence: `the machine set a median of **${round1(p.inhaleP50).toFixed(1)} cmH₂O** breathing in${out ? ` and ${round1(p.exhaleP50).toFixed(1)} breathing out` : ''}`,
    };
  }
  if (key === 'pressureTime') {
    const d = nightDetail(fx.id);
    const h = d?.hist;
    if (!h) return none('At your maximum', 'set pressure');
    // the middle 80% of the night's minutes, read off the spread
    const total = h.counts.reduce((a, b) => a + b, 0);
    let acc = 0;
    let lo = null;
    let hi = null;
    h.counts.forEach((c, i) => {
      acc += c;
      if (lo == null && acc >= total * 0.1) lo = (h.from + i) * h.step;
      if (hi == null && acc >= total * 0.9) hi = (h.from + i) * h.step;
    });
    const at = d.atMaxMin == null ? null : Math.round(d.atMaxMin);
    return {
      label: 'At your maximum',
      value: at == null ? '—' : String(at),
      sub: `Most of the night between ${lo.toFixed(1)} and ${hi.toFixed(1)} cmH₂O`,
      sentence: `the machine spent **${at ?? 'no'} minutes** at the top of the range, and most of the night between ${lo.toFixed(1)} and ${hi.toFixed(1)} cmH₂O`,
    };
  }
  if (key === 'flow' || key === 'tidal' || key === 'minVent') {
    const src = { flow: 'flowLimit', tidal: 'tidalVolume', minVent: 'minuteVent' }[key];
    const what = { flow: 'flow limitation', tidal: 'breath size', minVent: 'breathing volume' }[key];
    const v = (raw?.sessions ?? []).flatMap((x) => x.series?.[src] ?? []).filter((x) => x != null);
    if (!v.length) return none(key === 'flow' ? '95th percentile' : 'Median', what);
    const f = (x) => (key === 'flow' ? x.toFixed(2) : key === 'tidal' ? String(Math.round(x)) : round1(x).toFixed(1));
    if (key === 'flow') {
      return {
        label: '95th percentile',
        value: f(pct(v, 0.95)),
        sub: `Median ${f(pct(v, 0.5))} · highest minute ${f(Math.max(...v))}`,
        sentence: `flow limitation stayed at or under **${f(pct(v, 0.95))}** for 95% of the night's minutes`,
      };
    }
    return {
      label: 'Median',
      value: f(pct(v, 0.5)),
      sub: `Mostly between ${f(pct(v, 0.1))} and ${f(pct(v, 0.9))}`,
      sentence: `your ${what} sat around **${f(pct(v, 0.5))}**, mostly between ${f(pct(v, 0.1))} and ${f(pct(v, 0.9))}`,
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
