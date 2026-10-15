import { getCard } from './dataset.js';

/* Nocta — what the device card says about where the data comes from. Data
 * only arrives by SD card import today, so the status is the import, not a
 * sync schedule. Shared by Therapy (mobile) and DesktopTherapy. */

const short = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function importedWhen(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 864e5);
  if (days < 1 && new Date().getDate() === then.getDate()) return 'today';
  if (days < 2) return 'yesterday';
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* → { live, status, source } */
export function deviceStatus(cardData, justImported = false) {
  if (!cardData) {
    // nothing imported: the app is showing the bundled sample year
    const demo = getCard();
    return demo
      ? {
          live: false,
          status: 'Sample data',
          source: `A sample year, through ${short(demo.range.last)} · import your SD card to see yours`,
        }
      : { live: false, status: 'No data yet', source: 'Import from your SD card to bring in your nights' };
  }
  return {
    live: true,
    status: justImported ? 'Imported just now' : `Imported ${importedWhen(cardData.importedAt)}`,
    source: `From your SD card · latest night ${short(cardData.range.last)}`,
  };
}
