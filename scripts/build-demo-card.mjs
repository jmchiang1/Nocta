#!/usr/bin/env node
/* Build the bundled demo dataset from a ResMed SD card folder, with the app's
 * own parser (src/lib/resmed/card.js), so the demo is exactly what an import
 * of that card would produce.
 *
 *   node scripts/build-demo-card.mjs "CPAP Data 1 Year"  [out]
 *
 * Writes src/data/demoCard.json by default. The app loads it at startup when
 * nothing has been imported on the device (src/lib/dataset.js).
 *
 * The breathing waveforms around events (BRP slices) would make the bundle
 * huge, so they're written separately, one file per night, to
 * public/demo-waves/<date>.json for the most recent DEMO_WAVE_NIGHTS nights
 * with detail; the app fetches them when an event is opened (lib/waves.js).
 * An import keeps every night's waves on the device instead. */
import { readdir, readFile, stat, writeFile, mkdir, rm, open } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseCard } from '../src/lib/resmed/card.js';

const [root, out = 'src/data/demoCard.json'] = process.argv.slice(2);
const WAVES_DIR = 'public/demo-waves';
const DEMO_WAVE_NIGHTS = 30;
if (!root) {
  console.error('usage: node scripts/build-demo-card.mjs <card folder> [out.json]');
  process.exit(1);
}

async function walk(dir) {
  const files = [];
  for (const name of await readdir(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) files.push(...(await walk(full)));
    else {
      files.push({
        path: relative(root, full),
        size: s.size,
        read: async () => {
          const b = await readFile(full);
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        },
        // only the bytes asked for (the waveform slices)
        readRange: async (a, b) => {
          const fh = await open(full, 'r');
          try {
            const buf = Buffer.alloc(Math.max(0, Math.min(b, s.size) - a));
            await fh.read(buf, 0, buf.length, a);
            return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
          } finally {
            await fh.close();
          }
        },
      });
    }
  }
  return files;
}

const card = await parseCard(await walk(root));

// waves out of the bundle: the latest nights' go to public/demo-waves
await rm(WAVES_DIR, { recursive: true, force: true });
await mkdir(WAVES_DIR, { recursive: true });
const withWaves = card.nights.filter((n) => n.waves?.length).slice(-DEMO_WAVE_NIGHTS);
let waveBytes = 0;
for (const n of withWaves) {
  const body = JSON.stringify(n.waves);
  waveBytes += body.length;
  await writeFile(join(WAVES_DIR, `${n.date}.json`), body);
}
const waveDates = new Set(withWaves.map((n) => n.date));
for (const n of card.nights) {
  delete n.waves;
  if (waveDates.has(n.date)) n.demoWaves = true; // fetched on demand
}
card.demo = true;
card.warnings = [];

const json = JSON.stringify(card);
await writeFile(out, json);
console.log(`waves: ${withWaves.length} nights · ${(waveBytes / 1e6).toFixed(2)} MB → ${WAVES_DIR}/`);
console.log(
  `${card.nights.length} nights · ${card.range.first} → ${card.range.last} · ${(json.length / 1e6).toFixed(2)} MB → ${out}`
);
