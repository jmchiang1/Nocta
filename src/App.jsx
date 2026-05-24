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
import { DesktopApp } from './components/desktop/DesktopApp.jsx';
import { DesktopFullNight } from './components/desktop/DesktopFullNight.jsx';

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
  const { tab, tabNonce, sheet, onboarded, viewMode, closeSheet } = useStore();

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

  const ActiveSheet = sheet ? SHEETS[sheet.kind] : null;

  if (viewMode === 'desktop') {
    return (
      <div className="desktop-stage">
        <DevPanel />
        <DesktopApp />
        {/* full-night gets a wide, desktop-native dialog; every other sheet
         * renders as a centered desktop card (CSS in desktop.css re-styles the
         * shared Sheet markup so it isn't a phone-shaped bottom sheet) */}
        {sheet && (
          <div
            className="desktop-modal-wrap"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSheet();
            }}
          >
            {sheet.kind === 'fullnight' ? (
              <div className="desktop-dialog">
                <DesktopFullNight />
              </div>
            ) : (
              ActiveSheet && <ActiveSheet />
            )}
          </div>
        )}
      </div>
    );
  }

  const Screen = SCREENS[tab];

  return (
    <div className="stage">
      <DevPanel />
      <div className="phone">
        {/* keying on tabNonce (bumped on every setTab call) remounts the
         * screen on every tab tap — including re-tapping the current tab —
         * so chart and card entrance animations replay each time the user
         * "lands" on a page */}
        <Screen key={tabNonce} />
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
