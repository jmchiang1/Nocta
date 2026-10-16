/* Nocta — turn what the person picked (a folder input, or a folder dropped on
 * the page) into the `{ path, size, read }` entries lib/resmed/card.js reads.
 * Files are only read when the parser asks, so the big waveform files on the
 * card are never loaded. */

/* <input type="file" webkitdirectory>: a flat FileList with relative paths */
export function entriesFromFileList(fileList) {
  return Array.from(fileList, (f) => ({
    path: f.webkitRelativePath || f.name,
    size: f.size,
    read: () => f.arrayBuffer(),
    readRange: (a, b) => f.slice(a, b).arrayBuffer(), // only the bytes asked for
  }));
}

/* a drag-and-drop: walk dropped folders with the File System Entry API */
export async function entriesFromDrop(dataTransfer) {
  const roots = Array.from(dataTransfer.items ?? [])
    .map((it) => it.webkitGetAsEntry?.())
    .filter(Boolean);
  if (!roots.length) return entriesFromFileList(dataTransfer.files ?? []);

  const out = [];
  const fileOf = (entry) => new Promise((res, rej) => entry.file(res, rej));
  // readEntries hands back at most ~100 at a time; call until it's empty
  const children = (dir) =>
    new Promise((res, rej) => {
      const reader = dir.createReader();
      const all = [];
      const next = () =>
        reader.readEntries((batch) => {
          if (!batch.length) res(all);
          else {
            all.push(...batch);
            next();
          }
        }, rej);
      next();
    });

  async function walk(entry, prefix) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      const file = await fileOf(entry);
      out.push({
        path,
        size: file.size,
        read: () => file.arrayBuffer(),
        readRange: (a, b) => file.slice(a, b).arrayBuffer(),
      });
    } else if (entry.isDirectory) {
      for (const child of await children(entry)) await walk(child, path);
    }
  }
  for (const r of roots) await walk(r, '');
  return out;
}

/* folder picking needs webkitdirectory (desktop browsers, Android). iPhone
 * Safari doesn't support it — the native app will use the Files picker. */
export const canPickFolder = () =>
  typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');

/* ---- building a card up from several picks ----
 * A card can arrive in pieces: the card folder itself, or its DATALOG and
 * SETTINGS folders and loose files (STR.edf, Identification.*) picked or
 * dropped separately. Each file gets a key anchored at the card's own layout
 * ("DATALOG/20261013/…", "STR.edf"), so the same file picked twice — or the
 * whole card after a part of it — isn't counted twice. */
const ANCHOR = /(?:^|\/)((?:DATALOG|SETTINGS)\/.+|STR\.edf|Identification\.(?:json|tgt|crc))$/i;

const cardKey = (path) => {
  const p = path.replace(/\\/g, '/');
  return ANCHOR.exec(p)?.[1] ?? p;
};

/* add `more` to `entries`, newest pick wins for the same file */
export function mergeEntries(entries, more) {
  const byKey = new Map(entries.map((e) => [cardKey(e.path), e]));
  more.forEach((e) => byKey.set(cardKey(e.path), { ...e, path: cardKey(e.path) }));
  return [...byKey.values()];
}

/* what the picks so far hold, in the card's own terms */
export function cardContents(entries) {
  const keys = entries.map((e) => cardKey(e.path));
  const nights = new Set(keys.map((k) => /^DATALOG\/(\d{8})\//i.exec(k)?.[1]).filter(Boolean));
  return {
    summary: keys.some((k) => /^STR\.edf$/i.test(k)), // STR.edf — the daily summaries
    nights: nights.size, // DATALOG night folders
    settings: keys.some((k) => /^SETTINGS\//i.test(k)),
    identity: keys.some((k) => /^Identification\.(json|tgt)$/i.test(k)),
    other: keys.filter((k) => !ANCHOR.test(k)).length, // files that aren't part of a card
  };
}
