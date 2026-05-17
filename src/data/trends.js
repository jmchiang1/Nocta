/* Nocta — Trends mock data, keyed by range. Series are generated deterministically. */
import { genSeries } from '../lib/format.js';

function ahiBreakdown(seed, n) {
  // per-night stacked AHI: { csa, osa, hyp } summing to roughly the AHI value
  const csa = genSeries(seed + 'c', n, 1.4, 1.6);
  const osa = genSeries(seed + 'o', n, 1.8, 1.4);
  const hyp = genSeries(seed + 'h', n, 1.6, 1.2);
  return csa.map((c, i) => ({ csa: c, osa: osa[i], hyp: hyp[i] }));
}

export const TRENDS = {
  '7d': {
    rangeLabel: 'Past 7 nights',
    tiles: [
      { key: 'ahi', label: 'AHI', value: '5.2', unit: '/h', delta: 0.4, dir: 'up' },
      { key: 'leak', label: 'Leak P95', value: '14', unit: 'L/m', delta: 3, dir: 'up' },
      { key: 'hours', label: 'Usage', value: '6.4', unit: 'h', delta: 0.3, dir: 'up' },
      { key: 'pressure', label: 'Pressure', value: '6.2', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
    ],
    ahiAvg: 5.2,
    ahiSeries: ahiBreakdown('w7', 7),
    leakSeries: genSeries('l7', 7, 14, 10),
    hoursSeries: genSeries('h7', 7, 6.4, 1.4),
    pressureSeries: genSeries('p7', 60, 6.2, 1.8),
    xLabels: ['Jun 1', '', 'Jun 3', '', 'Jun 5', '', 'Jun 7'],
    insights: [
      { icon: 'ahi', text: 'Your AHI averaged **5.2** over the past 7 nights — slightly higher than the week before.' },
      { icon: 'clock', text: 'Usage held at **6.4 hours** a night. You are clearing the 4-hour compliance bar comfortably.' },
      { icon: 'leak', text: 'Leak crept up on **2 nights**, both after 3 a.m. — often a sign the cushion shifts as you move.' },
      { icon: 'spark', text: 'Central events made up **48%** of your events this week, up from a third. Worth watching.' },
    ],
  },
  '30d': {
    rangeLabel: 'Past 30 nights',
    tiles: [
      { key: 'ahi', label: 'AHI', value: '4.6', unit: '/h', delta: 1.1, dir: 'down' },
      { key: 'leak', label: 'Leak P95', value: '12', unit: 'L/m', delta: 2, dir: 'down' },
      { key: 'hours', label: 'Usage', value: '6.3', unit: 'h', delta: 0.5, dir: 'up' },
      { key: 'pressure', label: 'Pressure', value: '6.4', unit: 'cmH₂O', delta: 0.2, dir: 'flat' },
    ],
    ahiAvg: 4.6,
    ahiSeries: ahiBreakdown('w30', 30),
    leakSeries: genSeries('l30', 30, 12, 9),
    hoursSeries: genSeries('h30', 30, 6.3, 1.5),
    pressureSeries: genSeries('p30', 60, 6.4, 1.9),
    xLabels: ['May 13', '', 'May 22', '', 'Jun 1', '', 'Jun 7'],
    insights: [
      { icon: 'ahi', text: 'AHI trended **down to 4.6** across the month — your therapy is settling in.' },
      { icon: 'spark', text: 'Your **3 best nights** all followed days you logged exercise.' },
      { icon: 'leak', text: 'Leak P95 improved to **12 L/min** after week two — around when you changed the cushion.' },
      { icon: 'clock', text: 'You used the machine on **28 of 30 nights**. Two missed nights early in the month.' },
    ],
  },
  '90d': {
    rangeLabel: 'Past 90 nights',
    tiles: [
      { key: 'ahi', label: 'AHI', value: '5.8', unit: '/h', delta: 2.3, dir: 'down' },
      { key: 'leak', label: 'Leak P95', value: '15', unit: 'L/m', delta: 6, dir: 'down' },
      { key: 'hours', label: 'Usage', value: '6.0', unit: 'h', delta: 1.2, dir: 'up' },
      { key: 'pressure', label: 'Pressure', value: '6.5', unit: 'cmH₂O', delta: 0.3, dir: 'flat' },
    ],
    ahiAvg: 5.8,
    ahiSeries: ahiBreakdown('w90', 45),
    leakSeries: genSeries('l90', 45, 15, 12),
    hoursSeries: genSeries('h90', 45, 6.0, 1.8),
    pressureSeries: genSeries('p90', 60, 6.5, 2.0),
    xLabels: ['Mar', '', 'Apr', '', 'May', '', 'Jun'],
    insights: [
      { icon: 'ahi', text: 'Three months in, your AHI is down **2.3 points** from where you started.' },
      { icon: 'clock', text: 'Usage rose from **4.8h to 6.0h** a night — the habit is forming.' },
      { icon: 'leak', text: 'Leak is your most-improved metric: **down 6 L/min** since March.' },
      { icon: 'spark', text: 'Central events have edged up in the last 2 weeks. Keep an eye on it with your doctor.' },
    ],
  },
};

export const RANGES = ['7d', '30d', '90d'];

export const BEST_WORST = {
  best: { date: 'Mon, Jun 9', ahi: '2.1', note: 'Side sleeping · no alcohol · exercised that day' },
  worst: { date: 'Mon, Jun 2', ahi: '12.1', note: 'Stomach sleeping · late meal · leak spike at 3 a.m.' },
};

export const PATTERNS = [
  {
    headline: 'On nights you drink alcohol, your AHI averages 38% higher.',
    body: 'Across 7 alcohol nights your AHI was 6.1, against 3.9 on the others.',
    stats: [
      { v: '+38%', k: 'AHI shift' },
      { v: '7', k: 'alcohol nights' },
      { v: '30d', k: 'window' },
    ],
  },
  {
    headline: 'Your best AHI nights this month all came after exercise.',
    body: '4 of 4. On exercise days your AHI averages 2.4 — roughly half your usual.',
    stats: [
      { v: '4 / 4', k: 'matched' },
      { v: '−2.4', k: 'AHI shift' },
      { v: '30d', k: 'window' },
    ],
  },
];
