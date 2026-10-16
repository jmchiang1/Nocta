import { getCard, isDemoData } from './dataset.js';

/* Nocta — the device card's line about where the data comes from. Data only
 * arrives by SD card import today. Shared by Therapy (mobile) and
 * DesktopTherapy. */

const short = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function deviceSource(cardData) {
  if (!cardData) {
    // nothing imported: the bundled sample year (someone looking around), or
    // no nights at all
    return isDemoData()
      ? `A sample year, through ${short(getCard().range.last)} · import your SD card to see yours`
      : 'Import from your SD card to bring in your nights';
  }
  return `From your SD card · latest night ${short(cardData.range.last)}`;
}
