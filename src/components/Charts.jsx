/* Nocta — chart primitives, rendered with Chart.js (via react-chartjs-2).
 * Same component names + prop signatures as the prior SVG version, so screens
 * and components import them unchanged. Canvas can't read CSS vars, so the
 * token hexes are mirrored here from styles/tokens.css. */
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
} from 'chart.js';
import { genEventWave } from '../lib/format.js';

ChartJS.register(
  BarController,
  LineController,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
);

/* token hexes mirrored from styles/tokens.css. The chart palette is the
 * Oura-inspired 2-state system: `data` for every metric by default,
 * `alert` only when a value crosses a threshold. `watch`/`good` remain in
 * the table because non-chart UI (date-picker moons, lifecycle pills) still
 * reads them — but charts must not call them. */
const HEX = {
  data: '#7b95d8',
  dataDeep: '#4a63a8',
  accent: '#f0a47a',
  accentDeep: '#d97f4f',
  watch: '#e6b85c',
  good: '#7dc99a',
  alert: '#e07a6a',
};
const FAINT = 'rgba(123,149,216,0.28)';

/* sleep-stage hexes mirrored from styles/tokens.css; level = wakefulness, so
 * the hypnogram bars step taller from deep sleep up to awake. Stages ramp
 * through one hue so the chart reads as a single phenomenon; awake breaks
 * the ramp because it is the only out-of-expected state. */
const STAGE_HEX = { deep: '#2e4180', light: '#7c95c8', rem: '#a3b7df', awake: '#e07a6a' };
const STAGE_LEVEL = { deep: 0.3, light: 0.56, rem: 0.8, awake: 1 };

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* themed tooltip, used only on the interactive data charts */
const TOOLTIP = {
  enabled: true,
  backgroundColor: '#1c233e',
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  cornerRadius: 9,
  padding: 9,
  displayColors: false,
  titleColor: '#6b7396',
  titleFont: { family: 'Inter', size: 10, weight: '600' },
  bodyColor: '#ecf0fb',
  bodyFont: { family: 'Inter', size: 13, weight: '600' },
};

const HIDDEN_AXES = {
  x: { display: false, grid: { display: false }, offset: false },
  y: { display: false, grid: { display: false }, beginAtZero: true },
};

/* staggered "grow in" animation for bar-type charts */
function stagger(step, duration = 850) {
  return {
    duration,
    easing: 'easeOutQuart',
    delay: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * step : 0),
  };
}

function ChartBox({ height, marginTop, children }) {
  return (
    <div className="chart" style={{ height, marginTop, position: 'relative' }}>
      {children}
    </div>
  );
}

const emptyLabels = (n) => Array.from({ length: n }, () => '');

/* ---- Sparkline: bars 0..1, optional per-bar kind ('', 'w', 'hi') ----
 * 'hi' marks the focal bar (full-strength metric blue), 'w' marks an
 * attention bar (coral). The rest sit faint. No yellow middle band — the
 * 2-state palette does the work, the headline carries the verdict. */
export function Sparkline({ values, kinds = [], height = 38 }) {
  const colors = values.map((_, i) =>
    kinds[i] === 'hi' ? HEX.data : kinds[i] === 'w' ? HEX.alert : FAINT
  );
  const data = {
    labels: emptyLabels(values.length),
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderRadius: 3,
        borderSkipped: false,
        barPercentage: 0.82,
        categoryPercentage: 0.92,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(34),
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max: 1 } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Overnight hypnogram: one bar per time sample, height = wakefulness,
 * colour = sleep stage. Many touching bars read as a stepped stage chart. ---- */
export function Hypnogram({ samples, height = 96 }) {
  const data = {
    labels: emptyLabels(samples.length),
    datasets: [
      {
        data: samples.map((s) => STAGE_LEVEL[s] ?? 0.5),
        backgroundColor: samples.map((s) => STAGE_HEX[s] ?? FAINT),
        borderRadius: 0,
        borderSkipped: false,
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 650, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max: 1 } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Mini sparkline for secondary metric / trend tiles ---- */
export function MetricSpark({ values, hot = [], height = 16 }) {
  const colors = values.map((_, i) => (hot.includes(i) ? HEX.data : FAINT));
  const data = {
    labels: emptyLabels(values.length),
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderRadius: 1.5,
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.86,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(28, 700),
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max: 1 } },
  };
  return (
    <ChartBox height={height} marginTop={10}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Centered floating-bar waveform: flow rate / breathing ---- */
export function Waveform({ amps, color = 'data', height = 90 }) {
  const c = HEX[color] || HEX.data;
  const data = {
    labels: emptyLabels(amps.length),
    datasets: [
      {
        data: amps.map((a) => [-a, a]),
        backgroundColor: c,
        borderRadius: 2,
        borderSkipped: false,
        barPercentage: 0.64,
        categoryPercentage: 1,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(7, 700),
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: -1.05, max: 1.05 } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Apnea-event mini waveform: full -> quiet gap -> full, with a dashed gap line ---- */
export function EventWave({ seed, color = 'good', height = 52 }) {
  const c = HEX[color] || HEX.good;
  const { amps, gapStart, gapEnd } = genEventWave(seed, 46);
  const data = {
    labels: emptyLabels(amps.length),
    datasets: [
      {
        type: 'bar',
        data: amps.map((a) => [-a, a]),
        backgroundColor: amps.map((_, i) =>
          i >= gapStart && i < gapEnd ? rgba(c, 0.3) : c
        ),
        borderRadius: 2,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 1,
        order: 2,
      },
      {
        type: 'line',
        data: amps.map((_, i) => (i >= gapStart && i < gapEnd ? 0 : null)),
        borderColor: rgba(c, 0.6),
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        spanGaps: false,
        fill: false,
        order: 1,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(8, 700),
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: -1.05, max: 1.05 } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Line chart with soft area fill + optional threshold line ----
 * `yMin` lifts the baseline off zero (e.g. heart rate never nears 0). */
export function LineChart({ values, color = 'data', height = 110, threshold, yMin = 0 }) {
  const c = HEX[color] || HEX.data;
  const max = Math.max(...values, threshold || 0) * 1.15 || 1;
  const datasets = [
    {
      type: 'line',
      data: values,
      borderColor: c,
      borderWidth: 2.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: c,
      pointHoverBorderColor: '#0b1020',
      tension: 0.4,
      fill: true,
      backgroundColor: (ctx) => {
        const { chart } = ctx;
        const { ctx: cv, chartArea } = chart;
        if (!chartArea) return 'transparent';
        const g = cv.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, rgba(c, 0.34));
        g.addColorStop(1, rgba(c, 0));
        return g;
      },
    },
  ];
  if (threshold != null) {
    datasets.push({
      type: 'line',
      data: values.map(() => threshold),
      borderColor: rgba(HEX.alert, 0.65),
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
    });
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 950, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP,
        filter: (item) => item.datasetIndex === 0,
        callbacks: { label: (ctx) => Number(ctx.raw).toFixed(1) },
      },
    },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: yMin, max } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="line" data={{ labels: emptyLabels(values.length), datasets }} options={options} />
    </ChartBox>
  );
}

/* ---- Stacked bars: AHI events per night (csa / osa / hyp) ----
 * Hypopnea + obstructive ramp through the metric blue (faint → deep) so the
 * stack reads as one quantity on a normal night. Central apneas alone get
 * the coral attention hue, because per the safety rails their *appearance*
 * is a clinical escalation signal — keeping them visually distinct lets the
 * eye catch the pattern across the row without colouring every night red. */
export function StackedBars({ series, height = 132 }) {
  const mk = (key, hex, label) => ({
    label,
    data: series.map((d) => d[key]),
    backgroundColor: hex,
    borderRadius: 2,
    borderSkipped: false,
    barPercentage: series.length > 20 ? 0.95 : 0.74,
    categoryPercentage: 0.86,
  });
  const data = {
    labels: emptyLabels(series.length),
    datasets: [
      mk('csa', HEX.alert, 'Central'),
      mk('osa', HEX.dataDeep, 'Obstructive'),
      mk('hyp', rgba(HEX.data, 0.55), 'Hypopnea'),
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(series.length > 20 ? 14 : 32),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}` },
      },
    },
    scales: {
      x: { ...HIDDEN_AXES.x, stacked: true },
      y: { ...HIDDEN_AXES.y, stacked: true },
    },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Simple bars (usage, snore) with optional target line ---- */
export function Bars({ values, color = 'data', height = 110, target }) {
  const c = HEX[color] || HEX.data;
  const max = Math.max(...values, target || 0) * 1.14 || 1;
  const datasets = [
    {
      type: 'bar',
      data: values,
      backgroundColor: c,
      borderRadius: 3,
      borderSkipped: false,
      barPercentage: values.length > 20 ? 0.9 : 0.7,
      categoryPercentage: 0.86,
      order: 2,
    },
  ];
  if (target != null) {
    datasets.push({
      type: 'line',
      data: values.map(() => target),
      borderColor: rgba(HEX.good, 0.7),
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 0,
      fill: false,
      order: 1,
    });
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(values.length > 20 ? 16 : 34),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP,
        filter: (item) => item.datasetIndex === 0,
        callbacks: { label: (ctx) => Number(ctx.raw).toFixed(1) },
      },
    },
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={{ labels: emptyLabels(values.length), datasets }} options={options} />
    </ChartBox>
  );
}

/* ---- Horizontal progress / lifecycle bar on a faint rounded track ----
 * pct 0..100. `gradient` paints the accent-deep→accent fill used on the
 * compliance projection; `marker` (0..100) draws a dashed target tick. */
export function ProgressBar({ pct, color = 'accent', gradient = false, marker, height = 8 }) {
  const c = HEX[color] || HEX.accent;
  const val = Math.max(0, Math.min(100, pct));
  const trackPlugin = {
    id: 'progressTrack',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a } = chart;
      if (!a) return;
      const r = (a.bottom - a.top) / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(a.left, a.top, a.right - a.left, a.bottom - a.top, r);
      ctx.fill();
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      if (marker == null) return;
      const a = chart.chartArea;
      const x = chart.scales.x.getPixelForValue(marker);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, a.top - 2);
      ctx.lineTo(x, a.bottom + 2);
      ctx.stroke();
      ctx.restore();
    },
  };
  const data = {
    labels: [''],
    datasets: [
      {
        data: [val],
        backgroundColor: gradient
          ? (ctx) => {
              const { chart } = ctx;
              const { ctx: cv, chartArea } = chart;
              if (!chartArea) return c;
              const g = cv.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
              g.addColorStop(0, HEX.accentDeep);
              g.addColorStop(1, HEX.accent);
              return g;
            }
          : c,
        borderRadius: height / 2,
        borderSkipped: false,
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  };
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, min: 0, max: 100 },
      y: { display: false },
    },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} plugins={[trackPlugin]} />
    </ChartBox>
  );
}

/* ---- AHI baseline: horizontal bar on a 0..max scale with a 14-day-avg marker ---- */
export function BaselineBar({ value, avg, max = 32, height = 18 }) {
  const trackPlugin = {
    id: 'baselineTrack',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a } = chart;
      if (!a) return;
      const r = (a.bottom - a.top) / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.roundRect(a.left, a.top, a.right - a.left, a.bottom - a.top, r);
      ctx.fill();
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      if (avg == null) return;
      const a = chart.chartArea;
      const x = chart.scales.x.getPixelForValue(avg);
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = '#9aa3c0';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, a.top - 3);
      ctx.lineTo(x, a.bottom + 3);
      ctx.stroke();
      ctx.restore();
    },
  };
  const data = {
    labels: [''],
    datasets: [
      {
        data: [Math.min(value, max)],
        backgroundColor: HEX.accent,
        borderRadius: height / 2,
        borderSkipped: false,
        barPercentage: 1,
        categoryPercentage: 1,
      },
    ],
  };
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false, min: 0, max },
      y: { display: false },
    },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} plugins={[trackPlugin]} />
    </ChartBox>
  );
}
