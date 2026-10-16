/* Nocta — no nights to show: an account with no card yet, or one whose card
 * was removed (the sample year is only for someone looking around without an
 * account — lib/dataset.js). Each screen keeps its usual layout as still,
 * empty placeholders, with one message at the top: bring in your data.
 * Tonight and Trends use these screens (phone + desktop); Therapy shows the
 * banner over its own content. */
import { useStore } from '../lib/store.jsx';
import { ScreenFrame } from './ScreenFrame.jsx';
import { Icon } from './Icons.jsx';
import { TonightSkeleton, TrendsSkeleton } from './Skeleton.jsx';

const TITLE = { tonight: 'Tonight', trends: 'Trends' };
const SHAPES = { tonight: <TonightSkeleton still />, trends: <TrendsSkeleton /> };

/* the message at the top of a screen with no nights */
export function NoDataBanner() {
  const { openSheet } = useStore();
  return (
    <section className="no-data" aria-label="No CPAP data yet">
      <span className="no-data-icon" aria-hidden="true">
        <Icon name="download" size={20} />
      </span>
      <div className="no-data-text">
        <h2>Import your CPAP data</h2>
        <p>Your nights show up here once Nocta reads the SD card from your machine.</p>
      </div>
      <button type="button" className="btn primary no-data-btn" onClick={() => openSheet('cardImport')}>
        Import from SD card
      </button>
    </section>
  );
}

/* the phone's tab */
export function NoNightsScreen({ tab }) {
  return (
    <ScreenFrame title={TITLE[tab]}>
      <header className="page-head">
        <h1>{TITLE[tab]}</h1>
      </header>
      <NoDataBanner />
      {SHAPES[tab]}
    </ScreenFrame>
  );
}

/* the desktop view */
export function DesktopNoNights({ tab }) {
  return (
    <>
      <header className="dash-topbar">
        <div>
          <h1 className="dash-h1">{TITLE[tab]}</h1>
        </div>
      </header>
      <div className="dash-no-nights">
        <NoDataBanner />
        {SHAPES[tab]}
      </div>
    </>
  );
}
