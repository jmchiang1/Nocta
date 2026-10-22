/* Nocta — no nights to show: an account with no card yet, or one whose card
 * was removed (the sample week is only for someone looking around without an
 * account — lib/dataset.js). Each screen keeps its usual layout as still,
 * empty placeholders, with one message at the top: bring in your data.
 * Tonight and Trends use these screens (phone + desktop); Therapy shows the
 * banner over its own content. */
import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { ScreenFrame } from './ScreenFrame.jsx';
import { Icon } from './Icons.jsx';
import { TonightSkeleton, TrendsSkeleton } from './Skeleton.jsx';
import { LAST_NIGHT, toDate } from '../data/history.js';
import { dayDiff, todayIso } from '../data/compliance.js';
import { isDemoData } from '../lib/dataset.js';

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

/* the card's newest night is days old (people bring their card in now and
 * then): say so on Tonight, so an old night isn't read as last night, and
 * offer the import. One short row: tap it to import, or put it away for this
 * card (it comes back if a later import is still behind). Not for the
 * sample, which is a fixed year. */
const STALE_KEY = 'nocta.staleDismissed.v1'; // the newest night it was put away for

function staleDismissedFor() {
  try {
    return localStorage.getItem(STALE_KEY);
  } catch {
    return null;
  }
}

export function StaleDataBanner() {
  const { openSheet, cardData } = useStore();
  const [dismissed, setDismissed] = useState(staleDismissedFor);
  if (!cardData || !LAST_NIGHT) return null;
  const days = dayDiff(LAST_NIGHT, todayIso());
  if (days < 2) return null; // last night, or the night before (not read yet this morning)
  if (dismissed === LAST_NIGHT) return null;
  const when = toDate(LAST_NIGHT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  function dismiss() {
    try {
      localStorage.setItem(STALE_KEY, LAST_NIGHT);
    } catch {
      /* storage blocked: hidden for this visit only */
    }
    setDismissed(LAST_NIGHT);
  }

  return (
    <section className="stale-note" aria-label="Newer nights not imported">
      <button type="button" className="stale-note-main" onClick={() => openSheet('cardImport')}>
        <span className="stale-note-icon" aria-hidden="true">
          <Icon name="download" size={18} />
        </span>
        <span className="stale-note-text">
          <span className="stale-note-title">Newest night: {when}</span>
          <span className="stale-note-sub">{days} days ago. Tap to update.</span>
        </span>
      </button>
      <button type="button" className="stale-note-x" aria-label="Dismiss" onClick={dismiss}>
        <Icon name="x" size={18} />
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

/* someone looking around without an account sees a sample week (the 7-day
 * card, lib/dataset.js). Tonight says so, every visit, with the way to their
 * own: back to the welcome screen to make an account or sign in (the same
 * door as You's GuestAccountCard). */
export function SampleDataBanner() {
  const { authUser, resetOnboarding } = useStore();
  if (!isDemoData() || (authUser && authUser.kind !== 'guest')) return null;
  return (
    <section className="stale-note sample-note" aria-label="These are sample nights">
      <button type="button" className="stale-note-main" onClick={resetOnboarding}>
        <span className="stale-note-icon" aria-hidden="true">
          <Icon name="you" size={18} />
        </span>
        <span className="stale-note-text">
          <span className="stale-note-title">These are sample nights</span>
          <span className="stale-note-sub">Create an account or sign in to see your own.</span>
        </span>
        <Icon name="chevronRight" size={18} className="sample-note-chev" />
      </button>
    </section>
  );
}
