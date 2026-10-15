/* Nocta — the doctor summary: a printable page built from the card's nights
 * (history.js), opened in a new tab with the browser's print dialog, so the
 * person saves it as a PDF or prints it. Numbers only: no insights, no AI
 * commentary (FEATURES › Doctor PDF export). Everything on it is read from the
 * card; a value the card doesn't have is shown as "—", never estimated. */
import { NIGHTS, LAST_NIGHT, ahiTotal, averages, metCompliance, fmtShort, addDays, cardNight } from '../data/history.js';
import { cardDevice, pressureRange, rangeLabel } from '../data/therapy.js';
import { getCard } from './dataset.js';

export const REPORT_DAYS = 30;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f1 = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1));

/* a small inline bar chart (SVG): one bar per night, empty for no session */
function barsSvg(values, { max, line, unit }) {
  const w = 640;
  const h = 120;
  const n = values.length;
  const top = Math.max(max ?? 0, ...values.filter((v) => v != null), line ?? 0) || 1;
  const bw = w / n;
  const bars = values
    .map((v, i) =>
      v == null
        ? ''
        : `<rect x="${(i * bw + bw * 0.15).toFixed(1)}" y="${(h - (v / top) * h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${((v / top) * h).toFixed(1)}" fill="#5f7bc4"/>`
    )
    .join('');
  const ref = line != null ? `<line x1="0" x2="${w}" y1="${(h - (line / top) * h).toFixed(1)}" y2="${(h - (line / top) * h).toFixed(1)}" stroke="#999" stroke-dasharray="4 4"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h + 2}" width="100%" height="${h + 2}" role="img" aria-label="${esc(unit)} per night">${ref}${bars}</svg>`;
}

export function buildReportHtml({ days = REPORT_DAYS } = {}) {
  const from = addDays(LAST_NIGHT, -(days - 1));
  const nights = NIGHTS.filter((x) => x.date >= from && x.date <= LAST_NIGHT);
  const a = averages(nights);
  const used = nights.filter((x) => x.hours > 0);
  const met = nights.filter(metCompliance).length;
  const scored = nights.filter((x) => x.ahi);
  const sum = (k) => scored.reduce((t, x) => t + x.ahi[k] * x.hours, 0); // events/hr × hours = events
  const events = { osa: Math.round(sum('osa')), csa: Math.round(sum('csa')), hyp: Math.round(sum('hyp')) };
  const device = cardDevice();
  const settings = getCard()?.settings;
  const range = rangeLabel(pressureRange());
  const pressures = used.map((x) => x.pressure).filter((x) => x != null);
  const spo2Nights = used.map((x) => cardNight(x.date)?.spo2).filter(Boolean);

  const rows = [...nights]
    .reverse()
    .map(
      (x) => `<tr><td>${esc(fmtShort(x.date))}</td><td>${x.hours > 0 ? f1(x.hours) : 'No session'}</td><td>${x.ahi ? f1(ahiTotal(x)) : '—'}</td><td>${x.ahi ? f1(x.ahi.osa) : '—'}</td><td>${x.ahi ? f1(x.ahi.csa) : '—'}</td><td>${x.ahi ? f1(x.ahi.hyp) : '—'}</td><td>${x.leak != null ? f1(x.leak) : '—'}</td><td>${x.pressure != null ? f1(x.pressure) : '—'}</td></tr>`
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CPAP summary · ${esc(fmtShort(from))} – ${esc(fmtShort(LAST_NIGHT))}</title>
<style>
  body{font:13px/1.45 -apple-system,system-ui,sans-serif;color:#111;margin:32px;max-width:760px}
  h1{font-size:20px;margin:0 0 2px} h2{font-size:14px;margin:22px 0 6px} .muted{color:#666}
  dl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 16px;margin:12px 0} dt{color:#666;font-size:11px} dd{margin:0;font-size:16px;font-weight:600}
  table{border-collapse:collapse;width:100%;font-size:11.5px;font-variant-numeric:tabular-nums} th,td{text-align:right;padding:3px 6px;border-bottom:1px solid #e5e5e5} th:first-child,td:first-child{text-align:left} th{color:#666;font-weight:600}
  footer{margin-top:20px;font-size:11px;color:#666} @media print{body{margin:12mm}}
</style></head><body>
<h1>CPAP therapy summary</h1>
<div class="muted">${esc(fmtShort(from))} – ${esc(fmtShort(LAST_NIGHT))} · ${days} days${device ? ` · ${esc(device.brand)} ${esc(device.model)}` : ''}${settings?.mode ? ` · ${esc(settings.mode)}` : ''}${range ? ` · prescribed ${esc(range)}` : ''}</div>
<dl>
  <div><dt>Nights used</dt><dd>${used.length} of ${nights.length}</dd></div>
  <div><dt>Nights ≥ 4 h</dt><dd>${met} of ${nights.length}</dd></div>
  <div><dt>Average use</dt><dd>${f1(a.hours)} h</dd></div>
  <div><dt>Average AHI</dt><dd>${f1(a.ahi)}</dd></div>
  <div><dt>Events (obstructive / central / hypopnea)</dt><dd>${events.osa} / ${events.csa} / ${events.hyp}</dd></div>
  <div><dt>Leak, 95th percentile (average)</dt><dd>${f1(a.leak)} L/min</dd></div>
  <div><dt>Median pressure, range of nights</dt><dd>${pressures.length ? `${f1(Math.min(...pressures))} – ${f1(Math.max(...pressures))}` : '—'} cmH₂O</dd></div>
  <div><dt>Oximetry</dt><dd>${spo2Nights.length ? `${spo2Nights.length} nights` : 'Not recorded'}</dd></div>
</dl>
<h2>AHI each night <span class="muted">(dashed: 5 an hour)</span></h2>
${barsSvg(nights.map((x) => (x.ahi ? ahiTotal(x) : null)), { line: 5, unit: 'AHI' })}
<h2>Hours of use each night <span class="muted">(dashed: 4 hours)</span></h2>
${barsSvg(nights.map((x) => (x.hours > 0 ? x.hours : null)), { line: 4, unit: 'Hours' })}
<h2>Leak each night, 95th percentile <span class="muted">(L/min; dashed: 24)</span></h2>
${barsSvg(nights.map((x) => x.leak), { line: 24, unit: 'Leak' })}
<h2>Every night</h2>
<table><thead><tr><th>Night of</th><th>Hours</th><th>AHI</th><th>Obstr.</th><th>Central</th><th>Hypopnea</th><th>Leak p95</th><th>Pressure (median)</th></tr></thead><tbody>${rows}</tbody></table>
<footer>Generated by Nocta from the CPAP machine's SD card${device?.serial ? ` (serial ···${esc(device.serial.slice(-4))})` : ''}. AHI and events as recorded by the machine. Not a medical record.</footer>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
</body></html>`;
}

/* open the summary in a new tab (call from a click, so it isn't blocked) */
export function openDoctorReport(opts) {
  const html = buildReportHtml(opts);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return Boolean(win);
}
