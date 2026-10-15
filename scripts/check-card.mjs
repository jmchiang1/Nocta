#!/usr/bin/env node
/* Parse a ResMed SD card folder with the app's own parser and print what it
 * found — the quickest way to check a card (or a parser change) without the UI.
 *
 *   node scripts/check-card.mjs "<path to the card folder>" [YYYY-MM-DD …]
 *
 * With dates, prints those nights in full (events, sessions, stats). */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseCard } from '../src/lib/resmed/card.js';

const [root, ...dates] = process.argv.slice(2);
if (!root) {
  console.error('usage: node scripts/check-card.mjs <card folder> [YYYY-MM-DD …]');
  process.exit(1);
}

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await walk(full)));
    else {
      out.push({
        path: relative(root, full),
        size: s.size,
        read: async () => {
          const b = await readFile(full);
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        },
      });
    }
  }
  return out;
}

const t0 = Date.now();
const card = await parseCard(await walk(root));
const ms = Date.now() - t0;

const detail = card.nights.filter((n) => n.source === 'datalog').length;
console.log(`${card.device.model} · serial ${card.device.serial ?? '?'}`);
console.log('settings', JSON.stringify(card.settings));
console.log(
  `${card.nights.length} nights (${detail} detailed, ${card.nights.length - detail} summary only) · ${card.range.first} → ${card.range.last} · ${ms} ms`
);
if (card.warnings.length) console.log('warnings:', card.warnings.slice(0, 10));

const row = (n) =>
  `${n.date}  ${n.source.padEnd(8)} ${String(n.hours).padStart(5)} h  AHI ${String(n.ahi.total).padStart(4)}  ` +
  `(osa ${n.ahi.osa} csa ${n.ahi.csa} hyp ${n.ahi.hyp} unk ${n.ahi.apnea})  leak95 ${n.leak.p95} L/min  ` +
  `press50 ${n.pressure.p50}  sessions ${n.sessions.length}`;

console.log('\nlast 8 nights:');
card.nights.slice(-8).forEach((n) => console.log(' ', row(n)));

for (const d of dates) {
  const n = card.nights.find((x) => x.date === d);
  if (!n) {
    console.log(`\n${d}: no night`);
    continue;
  }
  const { eventList, sessions, ...rest } = n;
  console.log(`\n${d}:`, JSON.stringify(rest, null, 1));
  sessions.forEach((s) =>
    console.log(`  session ${s.start} → ${s.end} (${s.minutes} min, ${s.series?.leak.length ?? 0} per-minute points)`)
  );
  eventList.forEach((e) => console.log(`  ${e.at}  ${e.type.padEnd(7)} ${e.durSec}s`));
}
