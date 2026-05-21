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
import { AccountSheet } from './screens/AccountSheet.jsx';
import { SettingsSheet } from './screens/SettingsSheet.jsx';
import { DeviceDetailSheet } from './screens/DeviceDetailSheet.jsx';
import { AddDeviceSheet } from './screens/AddDeviceSheet.jsx';
import { MaskPickerSheet } from './screens/MaskPickerSheet.jsx';
import { JournalSheet } from './screens/JournalSheet.jsx';
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
  account: AccountSheet,
  settings: SettingsSheet,
  deviceDetail: DeviceDetailSheet,
  addDevice: AddDeviceSheet,
  maskPicker: MaskPickerSheet,
  journal: JournalSheet,
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
        {/* the Coach FAB is a focused entry point; hide it whenever a sheet
         * is open so it can't compete for attention inside another flow */}
        {!sheet && <CoachFab />}
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
