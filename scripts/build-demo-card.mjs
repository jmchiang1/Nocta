#!/usr/bin/env node
/* Build the bundled demo dataset from a ResMed SD card folder, with the app's
 * own parser (src/lib/resmed/card.js), so the demo is exactly what an import
 * of that card would produce.
 *
 *   node scripts/build-demo-card.mjs "CPAP Data 1 Year"  [out]
 *
 * Writes src/data/demoCard.json by default. The app loads it at startup when
 * nothing has been imported on the device (src/lib/dataset.js). BRP (the 25 Hz
 * flow waveform) is skipped, as in the app; tidal volume is dropped because
 * nothing charts it yet. */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseCard } from '../src/lib/resmed/card.js';

const [root, out = 'src/data/demoCard.json'] = process.argv.slice(2);
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
    else if (!/_BRP\.edf$/i.test(name)) {
      files.push({
        path: relative(root, full),
        size: s.size,
        read: async () => {
          const b = await readFile(full);
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        },
      });
    }
  }
  return files;
}

const card = await parseCard(await walk(root));
for (const night of card.nights) {
  for (const session of night.sessions ?? []) {
    if (session.series) delete session.series.tidalVolume;
  }
}
card.demo = true;
card.warnings = [];

const json = JSON.stringify(card);
await writeFile(out, json);
console.log(
  `${card.nights.length} nights · ${card.range.first} → ${card.range.last} · ${(json.length / 1e6).toFixed(2)} MB → ${out}`
);
