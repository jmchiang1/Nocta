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
      out.push({ path, entry, read: async () => (await fileOf(entry)).arrayBuffer() });
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
