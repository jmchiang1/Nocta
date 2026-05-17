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

/* token hexes mirrored from styles/tokens.css */
const HEX = {
  data: '#7b95d8',
  accent: '#f0a47a',
  watch: '#e6b85c',
  good: '#7dc99a',
  alert: '#e07a6a',
};
const FAINT = 'rgba(123,149,216,0.28)';

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

/* ---- Sparkline: bars 0..1, optional per-bar kind ('', 'w', 'hi') ---- */
export function Sparkline({ values, kinds = [], height = 38 }) {
  const colors = values.map((_, i) =>
    kinds[i] === 'hi' ? HEX.accent : kinds[i] === 'w' ? HEX.watch : FAINT
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

/* ---- Line chart with soft area fill + optional threshold line ---- */
export function LineChart({ values, color = 'data', height = 110, threshold }) {
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
    scales: { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="line" data={{ labels: emptyLabels(values.length), datasets }} options={options} />
    </ChartBox>
  );
}

/* ---- Stacked bars: AHI events per night (csa / osa / hyp) ---- */
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
      mk('osa', HEX.watch, 'Obstructive'),
      mk('hyp', HEX.data, 'Hypopnea'),
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
