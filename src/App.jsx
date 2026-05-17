/* Nocta — app shell: phone frame, tab routing, sheet routing. */
import { StoreProvider, useStore } from './lib/store.jsx';
import { TabBar } from './components/TabBar.jsx';
import { CoachFab } from './components/CoachFab.jsx';
import { DevPanel } from './components/DevPanel.jsx';
import { TonightScreen } from './screens/TonightScreen.jsx';
import { TrendsScreen } from './screens/TrendsScreen.jsx';
import { TherapyScreen } from './screens/TherapyScreen.jsx';
import { YouScreen } from './screens/YouScreen.jsx';
import { CheckinSheet } from './screens/CheckinSheet.jsx';
import { FullNightSheet } from './screens/FullNightSheet.jsx';
import { CoachSheet } from './screens/CoachSheet.jsx';
import { Onboarding } from './screens/Onboarding.jsx';

const SCREENS = {
  tonight: TonightScreen,
  trends: TrendsScreen,
  therapy: TherapyScreen,
  you: YouScreen,
};

const SHEETS = {
  checkin: CheckinSheet,
  fullnight: FullNightSheet,
  coach: CoachSheet,
};

function Shell() {
  const { tab, sheet, onboarded } = useStore();

  if (!onboarded) {
    return (
      <div className="stage">
        <DevPanel />
        <div className="phone">
          <Onboarding />
        </div>
      </div>
    );
  }

  const Screen = SCREENS[tab];
  const ActiveSheet = sheet ? SHEETS[sheet.kind] : null;

  return (
    <div className="stage">
      <DevPanel />
      <div className="phone">
        <Screen key={tab} />
        <CoachFab />
        <TabBar />
        {ActiveSheet && <ActiveSheet />}
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
