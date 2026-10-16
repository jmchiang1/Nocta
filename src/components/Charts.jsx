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
  dataLight: '#a3b7df', // --stage-rem
  muted: '#6b7396', // --text-tertiary
  text2: '#9aa3c0', // --text-secondary: axis labels (AA on the card)
  // breathing-event types (--ev-*): obstructive, hypopnea, central
  evOsa: '#7b95d8',
  evHyp: '#6fa8a6',
  evCsa: '#ab97d6',
};
const FAINT = 'rgba(123,149,216,0.28)';

/* sleep-stage hexes mirrored from styles/tokens.css; level = wakefulness, so
 * the hypnogram bars step taller from deep sleep up to awake. Stages ramp
 * through one hue so the chart reads as a single phenomenon; awake breaks
 * the ramp because it is the only out-of-expected state. */
const STAGE_HEX = { deep: '#2e4180', light: '#7c95c8', rem: '#a3b7df', awake: '#e07a6a' };
const STAGE_LEVEL = { deep: 0.3, light: 0.56, rem: 0.8, awake: 1 };
const STAGE_NAME = { deep: 'Deep', light: 'Light', rem: 'REM', awake: 'Awake' };
/* the hypnogram's y axis: each stage named at its own height */
export const STAGE_TICKS = {
  yTicks: [STAGE_LEVEL.deep, STAGE_LEVEL.light, STAGE_LEVEL.rem, STAGE_LEVEL.awake],
  yTick: (v) => STAGE_NAME[Object.keys(STAGE_LEVEL).find((k) => Math.abs(STAGE_LEVEL[k] - v) < 0.01)] ?? '',
};

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* diagonal-hatch canvas pattern for the "typical range" band — built once,
 * faint metric blue so the band reads as context, never as data */
let _hatch = null;
function hatchPattern() {
  if (_hatch) return _hatch;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 7;
  const tc = tile.getContext('2d');
  tc.fillStyle = rgba(HEX.data, 0.05);
  tc.fillRect(0, 0, 7, 7);
  tc.strokeStyle = rgba(HEX.data, 0.18);
  tc.lineWidth = 1;
  tc.beginPath();
  tc.moveTo(-2, 9);
  tc.lineTo(9, -2);
  tc.stroke();
  _hatch = tc.createPattern(tile, 'repeat');
  return _hatch;
}

/* draws a hatched horizontal band between two y-values, behind the data —
 * "your usual range", so every chart is read against the user's own baseline */
const bandPlugin = {
  id: 'typicalBand',
  beforeDatasetsDraw(chart, _args, opts) {
    const range = opts?.range;
    if (!range) return;
    const { ctx, chartArea: a, scales } = chart;
    if (!a) return;
    const yTop = scales.y.getPixelForValue(range[1]);
    const yBot = scales.y.getPixelForValue(range[0]);
    const top = Math.max(a.top, Math.min(yTop, yBot));
    const bot = Math.min(a.bottom, Math.max(yTop, yBot));
    if (bot <= top) return;
    ctx.save();
    ctx.fillStyle = hatchPattern() || rgba(HEX.data, 0.08);
    ctx.fillRect(a.left, top, a.right - a.left, bot - top);
    ctx.strokeStyle = rgba(HEX.data, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.left, top);
    ctx.lineTo(a.right, top);
    ctx.moveTo(a.left, bot);
    ctx.lineTo(a.right, bot);
    ctx.stroke();
    ctx.restore();
  },
};

/* settings changes on a trend chart (axes.markers: [{ index, label }]): a
 * dashed line at the night it happened and a short label at the top, so a
 * step in the line can be read against what changed */
const markersPlugin = {
  id: 'markers',
  afterDatasetsDraw(chart, _args, opts) {
    const list = opts?.list;
    if (!list?.length) return;
    const { ctx, chartArea: a, scales } = chart;
    if (!a) return;
    ctx.save();
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textBaseline = 'top';
    for (const m of list) {
      const x = scales.x.getPixelForValue(m.index);
      if (x < a.left || x > a.right) continue;
      ctx.strokeStyle = rgba(HEX.accent, 0.7);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, a.top);
      ctx.lineTo(x, a.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      const text = 'Settings changed';
      const w = ctx.measureText(text).width;
      const tx = Math.min(Math.max(x + 4, a.left), a.right - w);
      ctx.fillStyle = HEX.accent;
      ctx.fillText(text, tx, a.top + 2);
    }
    ctx.restore();
  },
};
/* the tooltip footer on a marked night says what changed */
const markerFooter = (axes) => (i) => {
  const m = axes?.markers?.find((x) => x.index === i);
  const own = axes?.footer ? axes.footer(i) : '';
  return [own, m ? `Settings changed: ${m.label}` : ''].filter(Boolean).join('\n');
};

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

/* ---- real axes, for the charts people dig into (the full night, a
 * metric's own page, Trends). Pass `axes` to a chart to turn them on:
 *   labels   one per point: what the x axis can show (clock time, a date)
 *   titles   one per point: the tooltip's heading (defaults to labels)
 *   tick     (i, width) => text | null — which points get an x label (whole
 *            clock hours); without it the labels thin out evenly
 *   xTitle / yTitle   the axis names; unit: after each tooltip value
 *   decimals  the tooltip value's; integer: whole-number y ticks
 *   yTick     a custom y label
 *   yTicks   fixed y positions (the hypnogram's stages)
 *   footer   (i) => extra tooltip lines for point i
 * Without `axes` a chart stays the bare shape (Tonight's small cards). */
const GRID = 'rgba(255,255,255,0.06)';
const AXIS_LINE = 'rgba(255,255,255,0.16)';
const AXIS_FONT = { family: 'Inter', size: 11, weight: '500' };
const AXIS_TITLE_FONT = { family: 'Inter', size: 11, weight: '600' };
const axisTitle = (text, pad) =>
  text ? { display: true, text, color: HEX.text2, font: AXIS_TITLE_FONT, padding: pad } : { display: false };

function axisScales(axes, { yMin = 0, yMax, stacked = false, offset = false } = {}) {
  return {
    x: {
      display: true,
      stacked,
      offset,
      border: { display: true, color: AXIS_LINE },
      grid: { display: true, color: GRID, drawTicks: true, tickLength: 4, tickColor: AXIS_LINE },
      ticks: {
        color: HEX.text2,
        font: AXIS_FONT,
        maxRotation: 0,
        padding: 4,
        autoSkip: !axes.tick,
        autoSkipPadding: 14,
        // a null label also hides that tick's grid line
        callback(value) {
          return axes.tick ? axes.tick(value, this.chart.width) : axes.labels[value];
        },
      },
      title: axisTitle(axes.xTitle, { top: 6 }),
    },
    y: {
      display: true,
      stacked,
      min: yMin,
      suggestedMax: yMax,
      beginAtZero: yMin === 0,
      border: { display: false },
      grid: { color: GRID, drawTicks: false },
      ...(axes.yTicks && {
        afterBuildTicks: (axis) => {
          axis.ticks = axes.yTicks.map((value) => ({ value }));
        },
      }),
      ticks: {
        color: HEX.text2,
        font: AXIS_FONT,
        padding: 8,
        maxTicksLimit: 6,
        ...(axes.integer && { precision: 0 }),
        ...(axes.yTick && { callback: axes.yTick }),
      },
      title: axisTitle(axes.yTitle, { bottom: 4 }),
    },
  };
}

/* the tooltip on an axed chart: its point's time or date, then the value */
function axisTooltip(axes, label) {
  const titles = axes.titles ?? axes.labels;
  return {
    ...TOOLTIP,
    titleFont: { family: 'Inter', size: 11, weight: '600' },
    footerColor: HEX.text2,
    footerFont: { family: 'Inter', size: 11, weight: '500' },
    callbacks: {
      title: (items) => (items.length ? titles[items[0].dataIndex] : ''),
      label,
      footer: (items) => (items.length ? markerFooter(axes)(items[0].dataIndex) : ''),
    },
  };
}
const withUnit = (v, axes, d = axes.decimals ?? 1) => `${Number(v).toFixed(d)}${axes.unit ? ` ${axes.unit}` : ''}`;

/* Every chart animates in over the same total time, however many points it
 * has (7 nights or a year): bars grow in a left-to-right wave whose spread is
 * fixed, so a long range doesn't crawl; lines draw over the same total. */
const GROW_MS = 600; // each bar's own grow-in
const SPREAD_MS = 400; // first bar → last bar
export const CHART_MS = GROW_MS + SPREAD_MS;

/* staggered "grow in" animation for bar-type charts */
function stagger() {
  return {
    duration: GROW_MS,
    easing: 'easeOutQuart',
    delay: (ctx) => {
      if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
      const n = ctx.chart.data.labels?.length || ctx.dataset?.data?.length || 1;
      return n > 1 ? (ctx.dataIndex / (n - 1)) * SPREAD_MS : 0;
    },
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
    animation: stagger(),
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
export function Hypnogram({ samples, height = 96, axes }) {
  const data = {
    labels: axes ? axes.labels : emptyLabels(samples.length),
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
    animation: { duration: CHART_MS, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: axes ? axisTooltip(axes, (ctx) => STAGE_NAME[samples[ctx.dataIndex]] ?? '') : { enabled: false },
    },
    scales: axes
      ? (() => {
          const sc = axisScales(axes, { yMax: 1, offset: false });
          sc.y.max = 1;
          return sc;
        })()
      : { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max: 1 } },
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
    animation: stagger(),
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
    animation: stagger(),
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
 * `yMin` lifts the baseline off zero (e.g. heart rate never nears 0).
 * `band` = [lo, hi] draws a hatched "your usual range" strip behind the
 * line, so the night reads against the user's own baseline (no scoring). */
const isolatedDot = (ctx) => {
  const d = ctx.dataset.data;
  const i = ctx.dataIndex;
  return d[i] != null && d[i - 1] == null && d[i + 1] == null ? 2.6 : 0;
};

/* `second` = { values, label }: a second, lighter line on the same axes (the
 * set pressure breathing out under breathing in); `label` names the first
 * line in the tooltip when there are two */
export function LineChart({ values, color = 'data', height = 110, threshold, yMin = 0, band, axes, second, label }) {
  const c = HEX[color] || HEX.data;
  const finite = (arr) => arr.filter((v) => v != null && Number.isFinite(v));
  const top = Math.max(...finite(values), ...(second ? finite(second.values) : []), threshold || 0, band ? band[1] : 0);
  const max = top * 1.15 || 1;
  const datasets = [
    {
      type: 'line',
      data: values,
      borderColor: c,
      borderWidth: 2.2,
      // a reading with gaps on both sides has no line to sit on: draw it as
      // a dot, so a lone night (or minute) never silently disappears
      pointRadius: isolatedDot,
      pointBackgroundColor: c,
      pointBorderWidth: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: c,
      pointHoverBorderColor: '#0b1020',
      tension: 0.4,
      // on a chart read value by value, the curve never overshoots a reading
      ...(axes && { cubicInterpolationMode: 'monotone' }),
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
  if (second) {
    datasets.push({
      type: 'line',
      label: second.label,
      data: second.values,
      borderColor: HEX.dataLight,
      borderWidth: 1.6,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: HEX.dataLight,
      pointHoverBorderColor: '#0b1020',
      tension: 0.4,
      ...(axes && { cubicInterpolationMode: 'monotone' }),
      fill: false,
    });
    datasets[0].label = label;
  }
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
    animation: { duration: CHART_MS, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      typicalBand: { range: band },
      markers: { list: axes?.markers },
      tooltip: axes
        ? {
            ...axisTooltip(axes, (ctx) =>
              second ? `${ctx.dataset.label}: ${withUnit(ctx.raw, axes)}` : withUnit(ctx.raw, axes)
            ),
            // the readings only (not the threshold line), and nothing for a gap
            filter: (item) => item.datasetIndex <= (second ? 1 : 0) && item.raw != null,
          }
        : {
            ...TOOLTIP,
            filter: (item) => item.datasetIndex === 0,
            callbacks: { label: (ctx) => Number(ctx.raw).toFixed(1) },
          },
    },
    scales: axes
      ? axisScales(axes, { yMin, yMax: top * 1.05 || 1 })
      : { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: yMin, max } },
  };
  return (
    <ChartBox height={height}>
      <Chart
        type="line"
        data={{ labels: axes ? axes.labels : emptyLabels(values.length), datasets }}
        options={options}
        plugins={[bandPlugin, markersPlugin]}
      />
    </ChartBox>
  );
}

/* ---- Stacked bars: AHI events per night (csa / osa / hyp) ----
 * Hypopnea + obstructive ramp through the metric blue (faint → deep) so the
 * stack reads as one quantity on a normal night. Central apneas alone get
 * the coral attention hue, because per the safety rails their *appearance*
 * is a clinical escalation signal — keeping them visually distinct lets the
 * eye catch the pattern across the row without colouring every night red. */
/* layers: optional [{ key, color (HEX name), label }] — defaults to the
 * Trends breakdown (central / obstructive / hypopnea) */
const DEFAULT_LAYERS = [
  { key: 'csa', color: 'alert', label: 'Central' },
  { key: 'osa', color: 'dataDeep', label: 'Obstructive' },
  { key: 'hyp', color: 'dataSoft', label: 'Hypopnea' },
];
/* `centered`: each bar in the middle of its own slot, so a row of labels
 * laid out in equal columns sits exactly under the bars (events by hour) */
export function StackedBars({ series, height = 132, layers = DEFAULT_LAYERS, centered = false, axes }) {
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
    labels: axes ? axes.labels : emptyLabels(series.length),
    datasets: layers.map((l) =>
      mk(l.key, l.color === 'dataSoft' ? rgba(HEX.data, 0.55) : HEX[l.color], l.label)
    ),
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      markers: { list: axes?.markers },
      tooltip: axes
        ? {
            ...axisTooltip(axes, (ctx) => axes.layerLabel?.(ctx) ?? `${ctx.dataset.label}: ${withUnit(ctx.raw, axes)}`),
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 4,
            // the empty layers of a slot say nothing
            filter: (item) => item.raw != null && Number(item.raw) > 0,
          }
        : {
            ...TOOLTIP,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}` },
          },
    },
    scales: axes
      ? axisScales(axes, { stacked: true, offset: true })
      : {
          x: { ...HIDDEN_AXES.x, stacked: true, offset: centered },
          y: { ...HIDDEN_AXES.y, stacked: true },
        },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} plugins={[markersPlugin]} />
    </ChartBox>
  );
}

/* ---- Simple bars (usage, snore) with optional target line ---- */
export function Bars({ values, color = 'data', height = 110, target, axes }) {
  const c = HEX[color] || HEX.data;
  const top = Math.max(...values, target || 0);
  const max = top * 1.14 || 1;
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
    animation: stagger(),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      markers: { list: axes?.markers },
      tooltip: axes
        ? { ...axisTooltip(axes, (ctx) => withUnit(ctx.raw, axes)), filter: (item) => item.datasetIndex === 0 }
        : {
            ...TOOLTIP,
            filter: (item) => item.datasetIndex === 0,
            callbacks: { label: (ctx) => Number(ctx.raw).toFixed(1) },
          },
    },
    scales: axes
      ? axisScales(axes, { yMax: top * 1.05 || 1, offset: true })
      : { x: HIDDEN_AXES.x, y: { ...HIDDEN_AXES.y, min: 0, max } },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={{ labels: axes ? axes.labels : emptyLabels(values.length), datasets }} options={options} plugins={[markersPlugin]} />
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

/* ---- AHI baseline: horizontal bar on a 0..max scale with a marker at your average so far ---- */
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

/* ---- shared: a vertical shaded span on the x axis (an event's length on a
 * breath trace, the prescribed range on the pressure histogram) ---- */
const xSpanPlugin = {
  id: 'xSpan',
  beforeDatasetsDraw(chart, _args, opts) {
    const span = opts?.span;
    if (!span) return;
    const { ctx, chartArea: a, scales } = chart;
    if (!a) return;
    const x0 = Math.max(a.left, Math.min(a.right, scales.x.getPixelForValue(span[0])));
    const x1 = Math.max(a.left, Math.min(a.right, scales.x.getPixelForValue(span[1])));
    if (x1 - x0 < 1) return;
    ctx.save();
    ctx.fillStyle = opts.hatch ? hatchPattern() || rgba(HEX.data, 0.08) : rgba(opts.color ? HEX[opts.color] : HEX.data, 0.14);
    ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
    ctx.strokeStyle = rgba(opts.color ? HEX[opts.color] : HEX.data, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, a.top);
    ctx.lineTo(x0, a.bottom);
    ctx.moveTo(x1, a.top);
    ctx.lineTo(x1, a.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

const clockOfMin = (m) => {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  return `${h % 12 || 12}:${String(t % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const lengthOf = (min) => (min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`);

/* ---- Mask on and off: each session as a bar along the night's clock ----
 * spans: [{ from, to }] in clock minutes of the day (running past 1440 after
 * midnight). The gaps between bars are the mask off. */
export function SessionsChart({ spans, height = 64 }) {
  if (!spans?.length) return null;
  const lo = Math.floor(spans[0].from / 60) * 60;
  const hi = Math.ceil(spans.at(-1).to / 60) * 60;
  const data = {
    labels: ['Mask on'],
    datasets: spans.map((s) => ({
      data: [[s.from, s.to]],
      backgroundColor: HEX.data,
      borderRadius: 6,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 1,
      grouped: false,
    })),
  };
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: CHART_MS, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...TOOLTIP,
        callbacks: {
          title: () => 'Mask on',
          label: (ctx) => {
            const [a, b] = ctx.raw;
            return `${clockOfMin(a)} – ${clockOfMin(b)} · ${lengthOf(b - a)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: lo,
        max: hi,
        border: { display: true, color: AXIS_LINE },
        grid: { color: GRID, tickLength: 4, tickColor: AXIS_LINE },
        ticks: {
          color: HEX.text2,
          font: AXIS_FONT,
          maxRotation: 0,
          stepSize: (hi - lo) / 60 > 7 ? 120 : 60,
          callback: (v) => clockOfMin(v).replace(':00', ''),
        },
      },
      y: { display: false },
    },
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} />
    </ChartBox>
  );
}

/* ---- Time at each pressure: minutes the machine set each pressure, one
 * bar per 0.1 cmH₂O exactly as recorded (hist from lib/resmed › pressureHist),
 * with the night's prescribed range shaded behind ---- */
export function PressureHistogram({ hist, range, height = 180 }) {
  if (!hist?.counts?.length) return null;
  const toMin = hist.sampleSec / 60;
  const labels = hist.counts.map((_, i) => ((hist.from + i) * hist.step).toFixed(1));
  const values = hist.counts.map((c) => c * toMin);
  const idx = (p) => Math.round(p / hist.step) - hist.from;
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: HEX.data,
        borderRadius: 2,
        borderSkipped: false,
        barPercentage: 1,
        categoryPercentage: 0.92,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: stagger(),
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      xSpan: range ? { span: [idx(range[0]) - 0.5, idx(range[1]) + 0.5], hatch: true } : null,
      tooltip: {
        ...TOOLTIP,
        titleFont: { family: 'Inter', size: 11, weight: '600' },
        callbacks: {
          title: (items) => (items.length ? `${labels[items[0].dataIndex]} cmH₂O` : ''),
          label: (ctx) => lengthOf(ctx.raw),
        },
      },
    },
    scales: axisScales(
      {
        labels,
        // a label on each whole cmH₂O
        tick: (i) => (((hist.from + i) * hist.step) % 1 < 0.05 ? String(Math.round((hist.from + i) * hist.step)) : null),
        xTitle: 'Set pressure, cmH₂O',
        yTitle: 'Minutes',
      },
      { offset: true }
    ),
  };
  return (
    <ChartBox height={height}>
      <Chart type="bar" data={data} options={options} plugins={[xSpanPlugin]} />
    </ChartBox>
  );
}

/* ---- Breath trace: the airflow (and mask pressure) around one event, every
 * sample the machine recorded (25 a second), the event's length shaded ----
 * trace from lib/waves.js › traceFor: { time (s from the event's start),
 * flow (L/min), press (cmH₂O), event: [0, dur] } */
function traceOptions({ yTitle, unit, span, showX, zeroLine, decimals = 1, xMin, xMax }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    normalized: true,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: false },
      xSpan: { span, color: 'accent' },
      tooltip: {
        ...TOOLTIP,
        titleFont: { family: 'Inter', size: 11, weight: '600' },
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const s = items[0].parsed.x;
            return s < 0 ? `${Math.abs(s).toFixed(1)} s before` : `${s.toFixed(1)} s in`;
          },
          label: (ctx) => `${ctx.parsed.y.toFixed(decimals)} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        // both charts span exactly the recorded stretch, so they line up;
        // ticks on the whole 10 s marks inside it
        min: xMin,
        max: xMax,
        afterBuildTicks: (axis) => {
          const ticks = [];
          for (let v = Math.ceil(axis.min / 10) * 10; v <= axis.max; v += 10) ticks.push({ value: v });
          axis.ticks = ticks;
        },
        border: { display: true, color: AXIS_LINE },
        grid: { color: GRID, tickLength: 4, tickColor: AXIS_LINE },
        ticks: {
          display: showX,
          color: HEX.text2,
          font: AXIS_FONT,
          maxRotation: 0,
          stepSize: 10,
          callback: (v) => (v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}s`),
        },
        title: showX ? axisTitle('Seconds from the event', { top: 6 }) : { display: false },
      },
      y: {
        border: { display: false },
        // one width for both charts' labels, so their time axes line up
        afterFit: (scale) => {
          scale.width = 64;
        },
        grid: {
          color: (c) => (zeroLine && c.tick.value === 0 ? AXIS_LINE : GRID),
          drawTicks: false,
        },
        ticks: { color: HEX.text2, font: AXIS_FONT, padding: 8, maxTicksLimit: 5 },
        title: axisTitle(yTitle, { bottom: 4 }),
      },
    },
  };
}
const traceLine = (xs, ys, color, width = 1.4) => ({
  type: 'line',
  data: xs.map((x, i) => ({ x, y: ys[i] })),
  borderColor: color,
  borderWidth: width,
  pointRadius: 0,
  pointHoverRadius: 3,
  pointHoverBackgroundColor: color,
  tension: 0, // straight between samples: exactly what was recorded
  fill: false,
});

export function BreathTrace({ trace, height = 170 }) {
  if (!trace) return null;
  const pressTime = trace.press.map((_, i) => trace.time[0] + i / (trace.pressRate || 25));
  const xMin = trace.time[0];
  const xMax = Math.max(trace.time.at(-1), pressTime.at(-1));
  return (
    <div className="breath-trace" role="img" aria-label={`Airflow and mask pressure from ${Math.round(-trace.time[0])} seconds before the event to ${Math.round(trace.time.at(-1) - trace.event[1])} seconds after it; the event is shaded`}>
      <ChartBox height={height}>
        <Chart
          type="line"
          data={{ datasets: [traceLine(trace.time, trace.flow, HEX.data)] }}
          options={traceOptions({ yTitle: 'Airflow, L/min', unit: 'L/min', span: trace.event, showX: false, zeroLine: true, xMin, xMax })}
          plugins={[xSpanPlugin]}
        />
      </ChartBox>
      <ChartBox height={Math.round(height * 0.55)}>
        <Chart
          type="line"
          data={{ datasets: [traceLine(pressTime, trace.press, HEX.dataLight, 1.6)] }}
          options={traceOptions({ yTitle: 'cmH₂O', unit: 'cmH₂O', span: trace.event, showX: true, decimals: 2, xMin, xMax })}
          plugins={[xSpanPlugin]}
        />
      </ChartBox>
    </div>
  );
}
