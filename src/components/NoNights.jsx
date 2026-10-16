/* Nocta — no nights to show: an account with no card yet, or one whose card
 * was removed (the sample year is only for someone looking around without an
 * account — lib/dataset.js). Tonight and Trends show this in place of their
 * night views, on the phone and the desktop dashboard; the one thing to do is
 * bring in the card. */
import { useStore } from '../lib/store.jsx';
import { ScreenFrame } from './ScreenFrame.jsx';
import { SdImportCard } from './SdImportCard.jsx';

const TITLE = { tonight: 'Tonight', trends: 'Trends' };

export function NoNightsCard() {
  const { openSheet } = useStore();
  return <SdImportCard card={null} onOpen={() => openSheet('cardImport')} />;
}

/* the phone's tab */
export function NoNightsScreen({ tab }) {
  return (
    <ScreenFrame title={TITLE[tab]}>
      <header className="page-head">
        <h1>{TITLE[tab]}</h1>
      </header>
      <p className="no-nights-note">No nights yet.</p>
      <NoNightsCard />
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
        <p className="no-nights-note">No nights yet.</p>
        <NoNightsCard />
      </div>
    </>
  );
}
