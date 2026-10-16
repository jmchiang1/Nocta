/* Nocta — the SD card import card (Therapy, mobile + desktop). The way real
 * data gets in today, so it's its own card — the main action it is, not a
 * footnote on the device card. Opens screens/CardImport.jsx. */
import { Icon } from './Icons.jsx';

const shortDate = (d, opts = { month: 'short', day: 'numeric' }) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

/* the way real data gets in today: the machine's SD card. Its own card, so
 * it reads as the main action it is, not a footnote on the device card */
export function SdImportCard({ card, onOpen }) {
  return (
    <section className="sd-card">
      <div className="sd-head">
        <span className="sd-icon" aria-hidden="true">
          <Icon name="download" size={20} />
        </span>
        <div className="sd-text">
          <h3>{card ? 'Your SD card data' : 'Import from your SD card'}</h3>
          <p>
            {card
              ? `${card.nights.length} nights · ${shortDate(card.range.first, { month: 'short', year: 'numeric' })} to ${shortDate(card.range.last)}`
              : 'Bring in your real nights from the card in your machine. It takes about a minute, and the card is read on this device.'}
          </p>
        </div>
      </div>
      <button className={`btn ${card ? 'ghost' : 'primary'} sd-btn`} onClick={onOpen}>
        {card ? 'Import a newer card' : 'Import now'}
      </button>
    </section>
  );
}

