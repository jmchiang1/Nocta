/* Nocta — app shell: phone frame, tab routing, sheet routing. */
import { useEffect } from 'react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { DynamicIsland } from './components/DynamicIsland.jsx';
import { LiquidGlassFilters } from './components/LiquidGlass.jsx';
import { TabBar } from './components/TabBar.jsx';
import { DevPanel } from './components/DevPanel.jsx';
import { TonightScreen } from './screens/TonightScreen.jsx';
import { TonightProposedScreen } from './screens/TonightProposedScreen.jsx';
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
import { MachinePickerSheet } from './screens/MachinePickerSheet.jsx';
import { JournalSheet } from './screens/JournalSheet.jsx';
import { DoctorSummarySheet } from './screens/DoctorSummarySheet.jsx';
import { Onboarding } from './screens/Onboarding.jsx';
import { DesktopApp } from './components/desktop/DesktopApp.jsx';
import { DesktopFullNight } from './components/desktop/DesktopFullNight.jsx';
import { DesktopCompare } from './components/desktop/DesktopCompare.jsx';

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
  machinePicker: MachinePickerSheet,
  journal: JournalSheet,
  doctor: DoctorSummarySheet,
};

/* drill-down subpages push in from the right; everything else is a modal */
const PAGE_SHEETS = new Set([
  'account',
  'settings',
  'deviceDetail',
  'addDevice',
  'fullnight',
  'journal',
]);

function Shell() {
  const { tab, tabNonce, tabDir, sheet, sheetLeaving, onboarded, viewMode, closeSheet, startSync, tonightLayout } =
    useStore();

  // opening the app pulls last night from SleepHQ (mock) — the Dynamic Island
  // shows the live activity while Tonight renders skeletons
  useEffect(() => {
    if (onboarded) startSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!onboarded) {
    return (
      <div className="stage">
        <DevPanel />
        <div className="phone">
          <Onboarding />
          <DynamicIsland />
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
            ) : sheet.kind === 'compare' ? (
              <div className="desktop-dialog cmp2-dialog">
                <DesktopCompare />
              </div>
            ) : (
              ActiveSheet && <ActiveSheet />
            )}
          </div>
        )}
      </div>
    );
  }

  // Tonight has a proposed-layout test page (DevPanel › Tonight, or ?layout=proposed)
  const Screen = tab === 'tonight' && tonightLayout === 'proposed' ? TonightProposedScreen : SCREENS[tab];
  const sheetUp = !!sheet && !sheetLeaving;
  const isPage = sheet && PAGE_SHEETS.has(sheet.kind);
  // iOS depth cues: a modal sheet shrinks the app behind it into a card;
  // a pushed page slides the app left underneath it (parallax)
  const layerState = sheetUp ? (isPage ? ' pushed' : ' behind') : '';

  return (
    <div className="stage">
      <DevPanel />
      <div className="phone">
        <div className={`app-layer${layerState}`} aria-hidden={sheetUp || undefined}>
          {/* keying on tabNonce (bumped on every setTab call) remounts the
           * screen on every tab tap — including re-tapping the current tab —
           * so chart and card entrance animations replay each time the user
           * "lands" on a page. dir-* slides it in from the direction of travel. */}
          <div className={`screen-host dir-${tabDir}`} key={tabNonce}>
            <Screen />
          </div>
          <TabBar />
        </div>
        {ActiveSheet && <ActiveSheet />}
        <DynamicIsland />
      </div>
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
      <LiquidGlassFilters />
    </StoreProvider>
  );
}
