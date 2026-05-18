/* Nocta — Trends mock data. Series + copy vary by the active night fixture
 * AND by the selected date range, so the Trends tab tells a coherent story at
 * every zoom level.
 * Series are generated deterministically; tiles and copy are hand-authored. */
import { mulberry32, hashStr } from '../lib/format.js';

export const RANGES = ['7d', '30d', '90d'];

const RANGE_N = { '7d': 7, '30d': 30, '90d': 45 };
const RANGE_LABEL = { '7d': 'Past 7 nights', '30d': 'Past 30 nights', '90d': 'Past 90 nights' };
export const RANGE_WINDOW = { '7d': '7 nights', '30d': '30 nights', '90d': '90 nights' };
const X_LABELS = {
  '7d': ['Jun 1', '', 'Jun 3', '', 'Jun 5', '', 'Jun 7'],
  '30d': ['May 13', '', 'May 22', '', 'Jun 1', '', 'Jun 7'],
  '90d': ['Mar', '', 'Apr', '', 'May', '', 'Jun'],
};

/* deterministic linear drift from→to with jitter */
function shape(seed, n, from, to, jitter) {
  const rnd = mulberry32(hashStr(String(seed)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 1 : i / (n - 1);
    out.push(Math.max(0, from + (to - from) * t + (rnd() - 0.5) * jitter));
  }
  return out;
}

/* realistic single-night APAP pressure trace: a smooth ramp from ~4 cmH₂O
 * up to the median, then a settled hover with occasional event-driven rises
 * that decay back down — not the flat noise a plain drift produces */
function pressureNight(seed, n, median) {
  const rnd = mulberry32(hashStr(String(seed)));
  const rampEnd = Math.max(2, Math.round(n * 0.15));
  const start = 4.2;
  const out = [];
  let v = start;
  for (let i = 0; i < n; i++) {
    if (i < rampEnd) {
      const t = i / rampEnd;
      const ease = t * t * (3 - 2 * t); // smoothstep
      v = start + (median - start) * ease + (rnd() - 0.5) * 0.18;
    } else {
      v += (median - v) * 0.14; // decay back toward the median
      v += (rnd() - 0.5) * 0.42; // organic wander
      if (rnd() > 0.92) v += 0.6 + rnd() * 1.4; // pressure climbs to an event
    }
    out.push(Math.max(start - 0.4, v));
  }
  return out;
}

/* ---- per-fixture shape profiles: the same story the why-card tells ---- */
const PROFILES = {
  /* anomaly — steady week, then a sharp central-event spike on the last night */
  anomaly: {
    j: 1.5,
    csa: [1.4, 1.7], osa: [1.7, 1.8], hyp: [1.5, 1.6],
    endSpike: [5.6, 1.0, 0.6],
    leak: [11, 13, 6], leakSpike: 19,
    hours: [6.5, 6.2, 1.3],
    pressure: 5.6,
  },
  /* steady — flat and in range across the whole window */
  steady: {
    j: 0.9,
    csa: [1.0, 1.0], osa: [1.2, 1.2], hyp: [1.0, 1.0],
    leak: [9, 9, 3],
    hours: [6.9, 7.1, 1.0],
    pressure: 7.0,
  },
  /* win — everything trends down, ending on the best night */
  win: {
    j: 1.0,
    csa: [2.0, 0.7], osa: [1.9, 0.9], hyp: [1.6, 0.6],
    leak: [14, 7, 4],
    hours: [6.2, 7.6, 1.1],
    pressure: 6.8,
  },
  /* escalation — central events climb steadily through the window */
  escalation: {
    j: 1.0,
    csa: [1.2, 6.6], osa: [1.5, 1.6], hyp: [1.2, 1.3],
    leak: [10, 11, 3.5],
    hours: [6.5, 6.4, 1.0],
    pressure: 6.1,
  },
  /* insufficient — only the last couple of nights have any data */
  insufficient: {
    j: 0.6,
    csa: [0.8, 1.0], osa: [1.0, 1.2], hyp: [0.8, 0.9],
    leak: [8, 8, 2],
    hours: [3.0, 1.7, 0.6],
    pressure: 5.8,
    sparseTail: 2,
  },
};

function build(id, range) {
  const p = PROFILES[id];
  const n = RANGE_N[range];
  let csa = shape(id + 'csa', n, p.csa[0], p.csa[1], p.j);
  let osa = shape(id + 'osa', n, p.osa[0], p.osa[1], p.j);
  let hyp = shape(id + 'hyp', n, p.hyp[0], p.hyp[1], p.j);
  let leak = shape(id + 'leak', n, p.leak[0], p.leak[1], p.leak[2]);
  let hours = shape(id + 'hours', n, p.hours[0], p.hours[1], p.hours[2]);

  if (p.endSpike) {
    csa[n - 1] += p.endSpike[0];
    osa[n - 1] += p.endSpike[1];
    hyp[n - 1] += p.endSpike[2];
  }
  if (p.leakSpike) leak[n - 1] += p.leakSpike;
  if (p.sparseTail) {
    const keep = (a) => a.map((v, i) => (i >= n - p.sparseTail ? v : 0));
    csa = keep(csa); osa = keep(osa); hyp = keep(hyp);
    leak = keep(leak); hours = keep(hours);
  }

  return {
    ahiSeries: csa.map((c, i) => ({ csa: c, osa: osa[i], hyp: hyp[i] })),
    leakSeries: leak,
    hoursSeries: hours,
    pressureSeries: pressureNight(id + 'p' + range, 60, p.pressure),
  };
}

/* ---- hand-authored tiles + copy: one set per fixture PER RANGE ----
 * Keyed [fixtureId][range]. The range is a zoom level on the same story:
 * 7d is last night in context, 30d the month, 90d the quarter. Copy follows
 * the voice rules — honest, hedged, descriptive, never diagnostic. */
const FIXTURE_DATA = {
  anomaly: {
    '7d': {
      ahiAvg: 5.6,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '5.6', unit: '/h', delta: 0.6, dir: 'up' },
        { key: 'leak', label: 'Leak P95', value: '24', unit: 'L/m', delta: 9, dir: 'up' },
        { key: 'hours', label: 'Usage', value: '6.3', unit: 'h', delta: 0.2, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '5.6', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Your AHI spiked to **10.5** last night — nearly double the rest of this week.' },
        { icon: 'leak', text: 'Leak crossed the **24 L/min** line once this week, climbing after 3 a.m.' },
        { icon: 'spark', text: 'Central events drove most of the rise. The same pattern showed up on **2** earlier nights.' },
      ],
      bestWorst: {
        best: { date: 'Tue, Jun 3', ahi: '2.8', note: 'Side sleeping · no alcohol logged' },
        worst: { date: 'Sat, Jun 7', ahi: '10.5', note: 'Stomach sleeping · late meal · leak spike at 3 a.m.' },
      },
      patterns: [
        {
          headline: 'On nights you sleep on your stomach, your AHI averages 2.3× higher.',
          body: '4 of your last 5 stomach nights landed above your usual range — most of the rise from central events.',
          stats: [
            { v: '2.3×', k: 'average AHI' },
            { v: '5 / 5', k: 'matched pattern' },
            { v: '7d', k: 'data window' },
          ],
        },
      ],
    },
    '30d': {
      ahiAvg: 4.8,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '4.8', unit: '/h', delta: 0.3, dir: 'flat' },
        { key: 'leak', label: 'Leak P95', value: '14', unit: 'L/m', delta: 2, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.4', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '5.6', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Across 30 nights your AHI averaged **4.8** — steady, apart from one sharp spike last Saturday.' },
        { icon: 'spark', text: 'That spike was almost all central events. Two earlier nights this month showed a smaller version of it.' },
        { icon: 'leak', text: 'Leak stayed low most of the month, crossing the **24 L/min** line only on the night of the spike.' },
      ],
      bestWorst: {
        best: { date: 'Wed, May 21', ahi: '2.4', note: 'Side sleeping · early bedtime' },
        worst: { date: 'Sat, Jun 7', ahi: '10.5', note: 'Stomach sleeping · late meal · leak spike at 3 a.m.' },
      },
      patterns: [
        {
          headline: 'On nights you sleep on your stomach, your AHI runs higher than your back or side nights.',
          body: '6 of the 8 stomach nights this month landed above your usual range. The rise came mostly from central events.',
          stats: [
            { v: '2.1×', k: 'average AHI' },
            { v: '6 / 8', k: 'matched pattern' },
            { v: '30d', k: 'data window' },
          ],
        },
      ],
    },
    '90d': {
      ahiAvg: 5.0,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '5.0', unit: '/h', delta: 0.2, dir: 'flat' },
        { key: 'leak', label: 'Leak P95', value: '13', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.5', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '5.7', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Over 90 nights your AHI has held around **5** — last Saturday stands out against an otherwise stable stretch.' },
        { icon: 'spark', text: 'Central-event spikes have appeared a handful of times across the quarter, never more than one night at a time.' },
        { icon: 'leak', text: 'Leak has been low and stable for three months, with only brief crossings of the **24 L/min** line.' },
      ],
      bestWorst: {
        best: { date: 'Thu, Apr 17', ahi: '2.1', note: 'Side sleeping · exercised that day' },
        worst: { date: 'Sat, Jun 7', ahi: '10.5', note: 'Stomach sleeping · late meal · leak spike at 3 a.m.' },
      },
      patterns: [
        {
          headline: 'Across the quarter, your stomach nights have run consistently higher than your other nights.',
          body: 'Stomach nights averaged about twice the AHI of your back and side nights. The gap has held steady all three months.',
          stats: [
            { v: '2.2×', k: 'average AHI' },
            { v: '18 / 26', k: 'matched pattern' },
            { v: '90d', k: 'data window' },
          ],
        },
      ],
    },
  },

  steady: {
    '7d': {
      ahiAvg: 3.4,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '3.4', unit: '/h', delta: 0.3, dir: 'down' },
        { key: 'leak', label: 'Leak P95', value: '9', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '7.0', unit: 'h', delta: 0.3, dir: 'up' },
        { key: 'pressure', label: 'Pressure', value: '7.0', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Your AHI has held inside your normal range for most of this window.' },
        { icon: 'clock', text: 'Usage stayed close to **7 hours** a night — well clear of the 4-hour compliance bar.' },
        { icon: 'leak', text: 'Leak sat low and flat. Nothing in the mask seal needs attention right now.' },
      ],
      bestWorst: {
        best: { date: 'Sun, Jun 8', ahi: '3.0', note: 'Bedtime before midnight · side sleeping' },
        worst: { date: 'Wed, Jun 4', ahi: '5.1', note: 'Later bedtime than usual' },
      },
      patterns: [
        {
          headline: 'When your bedtime stays before midnight, your AHI sits lower.',
          body: 'Across this week, pre-midnight nights averaged a full point below your later nights.',
          stats: [
            { v: '−1.0', k: 'AHI shift' },
            { v: '5 / 7', k: 'nights in range' },
            { v: '7d', k: 'data window' },
          ],
        },
      ],
    },
    '30d': {
      ahiAvg: 3.6,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '3.6', unit: '/h', delta: 0.2, dir: 'flat' },
        { key: 'leak', label: 'Leak P95', value: '9', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.9', unit: 'h', delta: 0.2, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '7.0', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Your AHI stayed inside your normal range on **27 of 30** nights this month.' },
        { icon: 'clock', text: 'Usage averaged just under **7 hours** — consistently clear of the 4-hour bar.' },
        { icon: 'leak', text: 'Leak held low and flat all month. The mask seal looks settled.' },
      ],
      bestWorst: {
        best: { date: 'Sun, May 25', ahi: '2.6', note: 'Bedtime before midnight · side sleeping' },
        worst: { date: 'Sat, May 17', ahi: '5.4', note: 'Late night · later bedtime than usual' },
      },
      patterns: [
        {
          headline: 'When your bedtime stays before midnight, your AHI sits lower.',
          body: 'Across the month, pre-midnight nights averaged about a point below your later nights.',
          stats: [
            { v: '−1.1', k: 'AHI shift' },
            { v: '21 / 30', k: 'nights in range' },
            { v: '30d', k: 'data window' },
          ],
        },
      ],
    },
    '90d': {
      ahiAvg: 3.8,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '3.8', unit: '/h', delta: 0.2, dir: 'flat' },
        { key: 'leak', label: 'Leak P95', value: '10', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.9', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '7.0', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Across 90 nights your AHI has stayed close to **4** — a stable quarter with no real swings.' },
        { icon: 'clock', text: 'Usage has been consistent for three months, averaging near **7 hours** a night.' },
        { icon: 'leak', text: 'Leak has been low and steady the whole quarter — nothing in the seal to watch.' },
      ],
      bestWorst: {
        best: { date: 'Tue, Apr 8', ahi: '2.3', note: 'Bedtime before midnight · side sleeping' },
        worst: { date: 'Fri, Mar 21', ahi: '6.0', note: 'Later bedtime than usual' },
      },
      patterns: [
        {
          headline: 'When your bedtime stays before midnight, your AHI sits lower.',
          body: 'The pattern has held all quarter — pre-midnight nights averaged about a point below your later nights.',
          stats: [
            { v: '−1.0', k: 'AHI shift' },
            { v: '64 / 90', k: 'nights in range' },
            { v: '90d', k: 'data window' },
          ],
        },
      ],
    },
  },

  win: {
    '7d': {
      ahiAvg: 3.6,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '3.6', unit: '/h', delta: 1.6, dir: 'down' },
        { key: 'leak', label: 'Leak P95', value: '10', unit: 'L/m', delta: 5, dir: 'down' },
        { key: 'hours', label: 'Usage', value: '7.0', unit: 'h', delta: 0.9, dir: 'up' },
        { key: 'pressure', label: 'Pressure', value: '6.8', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Your AHI trended **down** across this window, ending on your lowest night in two weeks.' },
        { icon: 'spark', text: 'Your strongest nights all followed days you logged **exercise**.' },
        { icon: 'leak', text: 'Leak improved steadily — down to **7 L/min** by the end of the window.' },
      ],
      bestWorst: {
        best: { date: 'Mon, Jun 9', ahi: '2.1', note: 'Side sleeping · exercised that day' },
        worst: { date: 'Tue, Jun 3', ahi: '6.8', note: 'No exercise · later meal' },
      },
      patterns: [
        {
          headline: 'Your best AHI nights this week all followed a day with exercise.',
          body: 'Three of three. On exercise days your AHI averaged about half your non-exercise nights.',
          stats: [
            { v: '3 / 3', k: 'exercise nights' },
            { v: '−2.2', k: 'avg AHI shift' },
            { v: '7d', k: 'data window' },
          ],
        },
      ],
    },
    '30d': {
      ahiAvg: 4.2,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '4.2', unit: '/h', delta: 1.8, dir: 'down' },
        { key: 'leak', label: 'Leak P95', value: '11', unit: 'L/m', delta: 4, dir: 'down' },
        { key: 'hours', label: 'Usage', value: '6.8', unit: 'h', delta: 0.6, dir: 'up' },
        { key: 'pressure', label: 'Pressure', value: '6.8', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Your AHI has trended **down** through the month, from the high 5s to last night’s 2.1.' },
        { icon: 'spark', text: 'The improvement lines up with how often you logged **exercise** this month.' },
        { icon: 'leak', text: 'Leak came down steadily over 30 nights — from the mid-teens to single digits.' },
      ],
      bestWorst: {
        best: { date: 'Mon, Jun 9', ahi: '2.1', note: 'Side sleeping · exercised that day' },
        worst: { date: 'Thu, May 15', ahi: '7.2', note: 'No exercise · late night' },
      },
      patterns: [
        {
          headline: 'Your best AHI nights this month all followed a day with exercise.',
          body: '9 of 11 exercise days were followed by a night below your average. On those nights your AHI ran about half.',
          stats: [
            { v: '9 / 11', k: 'exercise nights' },
            { v: '−2.4', k: 'avg AHI shift' },
            { v: '30d', k: 'data window' },
          ],
        },
      ],
    },
    '90d': {
      ahiAvg: 5.0,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '5.0', unit: '/h', delta: 2.4, dir: 'down' },
        { key: 'leak', label: 'Leak P95', value: '12', unit: 'L/m', delta: 6, dir: 'down' },
        { key: 'hours', label: 'Usage', value: '6.6', unit: 'h', delta: 0.8, dir: 'up' },
        { key: 'pressure', label: 'Pressure', value: '6.8', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'ahi', text: 'Over 90 nights your AHI has fallen from around **7** to last night’s **2.1** — a steady, sustained drop.' },
        { icon: 'spark', text: 'The strongest months were the ones with the most logged **exercise** days.' },
        { icon: 'leak', text: 'Leak has roughly halved across the quarter as the seal settled in.' },
      ],
      bestWorst: {
        best: { date: 'Mon, Jun 9', ahi: '2.1', note: 'Side sleeping · exercised that day' },
        worst: { date: 'Tue, Mar 18', ahi: '8.1', note: 'No exercise · later meal' },
      },
      patterns: [
        {
          headline: 'Your best AHI nights this quarter followed days with exercise.',
          body: '26 of 31 exercise days led into a below-average night. The link has held across all three months.',
          stats: [
            { v: '26 / 31', k: 'exercise nights' },
            { v: '−2.5', k: 'avg AHI shift' },
            { v: '90d', k: 'data window' },
          ],
        },
      ],
    },
  },

  escalation: {
    '7d': {
      ahiAvg: 6.2,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '6.2', unit: '/h', delta: 2.4, dir: 'up' },
        { key: 'leak', label: 'Leak P95', value: '11', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.4', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '6.1', unit: 'cmH₂O', delta: 0.1, dir: 'flat' },
      ],
      insights: [
        { icon: 'spark', text: 'Central events have **climbed** over the last several nights, up from a usual 1–2 per hour.' },
        { icon: 'ahi', text: 'The rise in your AHI is coming almost entirely from central events.' },
        { icon: 'clock', text: 'Usage and pressure held steady — this shift is worth bringing to your doctor.' },
      ],
      bestWorst: {
        best: { date: 'Thu, Jun 5', ahi: '4.1', note: 'Mostly obstructive events' },
        worst: { date: 'Tue, Jun 10', ahi: '9.4', note: 'Central events through the night' },
      },
      patterns: [
        {
          headline: 'Your central-event index has risen on 4 of the last 5 nights.',
          body: 'The climb has been steady rather than a one-night spike. Worth showing your sleep doctor.',
          stats: [
            { v: '4 / 5', k: 'nights rising' },
            { v: '1.2→6.8', k: 'central index' },
            { v: '7d', k: 'data window' },
          ],
        },
      ],
    },
    '30d': {
      ahiAvg: 4.9,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '4.9', unit: '/h', delta: 1.6, dir: 'up' },
        { key: 'leak', label: 'Leak P95', value: '11', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.4', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '6.1', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'spark', text: 'Central events were low for most of the month, then began climbing over the last week or so.' },
        { icon: 'ahi', text: 'Almost all of the recent rise in your AHI traces back to those central events.' },
        { icon: 'clock', text: 'Usage and pressure didn’t change — bring this pattern to your doctor.' },
      ],
      bestWorst: {
        best: { date: 'Mon, May 26', ahi: '3.2', note: 'Mostly obstructive events' },
        worst: { date: 'Tue, Jun 10', ahi: '9.4', note: 'Central events through the night' },
      },
      patterns: [
        {
          headline: 'Your central-event index has climbed sharply in the last week of this window.',
          body: 'The first three weeks of the month were flat. The rise is recent — worth showing your sleep doctor.',
          stats: [
            { v: '4 / 5', k: 'nights rising' },
            { v: '1.2→6.8', k: 'central index' },
            { v: '30d', k: 'data window' },
          ],
        },
      ],
    },
    '90d': {
      ahiAvg: 4.3,
      tiles: [
        { key: 'ahi', label: 'AHI', value: '4.3', unit: '/h', delta: 0.9, dir: 'up' },
        { key: 'leak', label: 'Leak P95', value: '11', unit: 'L/m', delta: 1, dir: 'flat' },
        { key: 'hours', label: 'Usage', value: '6.5', unit: 'h', delta: 0.1, dir: 'flat' },
        { key: 'pressure', label: 'Pressure', value: '6.1', unit: 'cmH₂O', delta: 0, dir: 'flat' },
      ],
      insights: [
        { icon: 'spark', text: 'For most of the quarter your central events sat at **1–2** per hour — the climb only shows up in the last week.' },
        { icon: 'ahi', text: 'Against three months of stable data, the recent rise in central events stands out.' },
        { icon: 'clock', text: 'Nothing in your usage or pressure explains it — this is worth a doctor’s review.' },
      ],
      bestWorst: {
        best: { date: 'Wed, Apr 2', ahi: '2.9', note: 'Mostly obstructive events' },
        worst: { date: 'Tue, Jun 10', ahi: '9.4', note: 'Central events through the night' },
      },
      patterns: [
        {
          headline: 'After a stable quarter, your central-event index has begun to climb.',
          body: 'Three months held flat, then a steady rise over the last five nights. Worth showing your sleep doctor.',
          stats: [
            { v: '4 / 5', k: 'nights rising' },
            { v: '1.2→6.8', k: 'central index' },
            { v: '90d', k: 'data window' },
          ],
        },
      ],
    },
  },

  insufficient: {
    '7d': {
      ahiAvg: '—',
      tiles: [
        { key: 'ahi', label: 'AHI', value: '—', unit: '/h', dir: 'flat', note: 'low data' },
        { key: 'leak', label: 'Leak P95', value: '—', unit: 'L/m', dir: 'flat', note: 'low data' },
        { key: 'hours', label: 'Usage', value: '1.7', unit: 'h', dir: 'flat', note: 'short night' },
        { key: 'pressure', label: 'Pressure', value: '5.8', unit: 'cmH₂O', dir: 'flat', note: 'steady' },
      ],
      insights: [
        { icon: 'spark', text: 'Only a few nights of data so far — not enough to draw trend lines yet.' },
        { icon: 'clock', text: "Last night's session ran **1.7 hours**, short of the 2-hour mark Nocta needs." },
        { icon: 'ahi', text: 'A couple of full nights and these charts start to fill in.' },
      ],
      bestWorst: null,
      patterns: [],
    },
    '30d': {
      ahiAvg: '—',
      tiles: [
        { key: 'ahi', label: 'AHI', value: '—', unit: '/h', dir: 'flat', note: 'low data' },
        { key: 'leak', label: 'Leak P95', value: '—', unit: 'L/m', dir: 'flat', note: 'low data' },
        { key: 'hours', label: 'Usage', value: '—', unit: 'h', dir: 'flat', note: 'low data' },
        { key: 'pressure', label: 'Pressure', value: '5.8', unit: 'cmH₂O', dir: 'flat', note: 'steady' },
      ],
      insights: [
        { icon: 'spark', text: 'Most of the last 30 nights have no recorded data — there isn’t enough here to chart a trend.' },
        { icon: 'clock', text: 'Nocta needs at least a couple of full nights in a window before trend lines mean anything.' },
        { icon: 'ahi', text: 'Once you’ve worn the device a few nights in a row, this view fills in.' },
      ],
      bestWorst: null,
      patterns: [],
    },
    '90d': {
      ahiAvg: '—',
      tiles: [
        { key: 'ahi', label: 'AHI', value: '—', unit: '/h', dir: 'flat', note: 'low data' },
        { key: 'leak', label: 'Leak P95', value: '—', unit: 'L/m', dir: 'flat', note: 'low data' },
        { key: 'hours', label: 'Usage', value: '—', unit: 'h', dir: 'flat', note: 'low data' },
        { key: 'pressure', label: 'Pressure', value: '5.8', unit: 'cmH₂O', dir: 'flat', note: 'steady' },
      ],
      insights: [
        { icon: 'spark', text: 'Across 90 nights only a handful have data — far too few to show trends.' },
        { icon: 'clock', text: 'A trend needs a run of full nights. A few in a row is enough to start.' },
        { icon: 'ahi', text: 'Wear the device consistently for about a week and these charts begin to take shape.' },
      ],
      bestWorst: null,
      patterns: [],
    },
  },
};

export function getTrends(fixtureId, range) {
  const id = FIXTURE_DATA[fixtureId] ? fixtureId : 'anomaly';
  const r = FIXTURE_DATA[id][range] ? range : '7d';
  const d = FIXTURE_DATA[id][r];
  return {
    rangeLabel: RANGE_LABEL[r],
    xLabels: X_LABELS[r],
    ahiAvg: d.ahiAvg,
    tiles: d.tiles,
    insights: d.insights,
    bestWorst: d.bestWorst,
    patterns: d.patterns,
    ...build(id, r),
  };
}
