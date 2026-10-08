/* Nocta — app state. Onboarding + tab + active fixture + check-in + active sheet.
 * onboarded & checkin persist to localStorage. */
import { EMPTY_CHECKIN_TAGS } from '../data/journal.js';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_FIXTURE, WEEK } from '../data/fixtures.js';
import { DEFAULT_MACHINE_ID } from '../data/therapy.js';
import {
  DEFAULT_MASK_ID,
  DEFAULT_DEVICE_CONNECTIONS,
  DEFAULT_DEVICE_ENABLED,
  DEFAULT_DEVICE_READS,
} from '../data/account.js';

const StoreContext = createContext(null);

const CHECKIN_KEY = 'nocta.checkin.v1';
const ONBOARD_KEY = 'nocta.onboarded.v1';
const DEVPANEL_KEY = 'nocta.devpanel.v1';
const EMPTY_CHECKIN = { done: false, tags: EMPTY_CHECKIN_TAGS };
const TAB_ORDER = ['tonight', 'trends', 'therapy', 'you'];
/* how long the mock "pulling last night from SleepHQ" sync takes */
const SYNC_MS = 1700;

function loadCheckin() {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return EMPTY_CHECKIN;
}

function loadOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function StoreProvider({ children }) {
  const [onboarded, setOnboarded] = useState(loadOnboarded);
  const [tab, setTabState] = useState('tonight');
  /* bumped on every setTab call — even when the requested tab matches the
   * current one — so the app shell can use it as a key to remount the
   * active screen and replay chart + card entrance animations on every
   * "landing", including re-taps of the current tab */
  const [tabNonce, setTabNonce] = useState(0);
  /* +1 when moving right along the tab bar, -1 when moving left, 0 on a
   * re-tap — the shell uses it to slide the incoming screen from the
   * direction of travel */
  const [tabDir, setTabDir] = useState(0);
  /* the tab bar compacts while scrolling down (see ScreenFrame) */
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const tabRef = useRef('tonight');
  const setTab = useCallback((next) => {
    setTabBarHidden(false);
    setTabDir(Math.sign(TAB_ORDER.indexOf(next) - TAB_ORDER.indexOf(tabRef.current)));
    tabRef.current = next;
    setTabState(next);
    setTabNonce((n) => n + 1);
  }, []);
  const [fixtureId, setFixtureIdState] = useState(DEFAULT_FIXTURE);
  /* nights in calendar order (the week strip, minus no-session days) — used
   * to know which way a night change moves, so the new night slides in from
   * that side, and what the neighbours are for swiping */
  const nightOrder = WEEK.filter((d) => d.fixtureId).map((d) => d.fixtureId);
  const [nightDir, setNightDir] = useState(0); // +1 later night, -1 earlier
  const fixtureRef = useRef(DEFAULT_FIXTURE);
  const setFixtureId = useCallback(
    (next) => {
      setNightDir(Math.sign(nightOrder.indexOf(next) - nightOrder.indexOf(fixtureRef.current)));
      fixtureRef.current = next;
      setFixtureIdState(next);
    },
    // nightOrder is derived from static fixture data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  /* live drag progress while swiping the why-card: -1…1, positive = toward
   * the next (later) night. The week strip's highlight follows it. */
  const [nightDrag, setNightDrag] = useState(0);
  /* Tonight layout test page: 'current' or 'proposed'. Seeded from
   * ?layout=proposed and mirrored back to the URL so a refresh (or a shared
   * link) lands on the same layout. */
  const [tonightLayout, setTonightLayoutState] = useState(() =>
    new URLSearchParams(window.location.search).get('layout') === 'proposed' ? 'proposed' : 'current'
  );
  const setTonightLayout = useCallback((next) => {
    setTonightLayoutState(next);
    const url = new URL(window.location.href);
    if (next === 'proposed') url.searchParams.set('layout', 'proposed');
    else url.searchParams.delete('layout');
    window.history.replaceState(null, '', url);
  }, []);
  /* 'mobile' = the phone-in-the-center demo; 'desktop' = the full-width
   * dashboard. Toggled from the DevPanel; both share the same underlying state
   * (tab, fixture, devices) so switching keeps you on the same data. */
  const [viewMode, setViewMode] = useState('mobile');
  /* open sheets, bottom → top ({ kind, ...params }). openSheet replaces the
   * stack; pushSheet layers one over the current (e.g. the check-in over the
   * full-night page), and closing it returns to the one beneath. */
  const [sheets, setSheets] = useState([]);
  const sheet = sheets.length ? sheets[sheets.length - 1] : null;
  /* true from the moment a sheet starts its exit animation until it unmounts,
   * so the app layer behind it can start settling back in sync */
  const [sheetLeaving, setSheetLeaving] = useState(false);

  /* toast — one at a time, newest wins. { id, text, icon } */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((text, icon = 'check') => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, icon });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* mock SleepHQ sync — runs once when the app opens and on pull-to-refresh.
   * The Dynamic Island shows progress; Tonight shows skeletons meanwhile. */
  const [syncing, setSyncing] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
  const syncTimer = useRef(null);
  const startSync = useCallback(() => {
    clearTimeout(syncTimer.current);
    setSyncing(true);
    syncTimer.current = setTimeout(() => {
      setSyncing(false);
      setSyncNonce((n) => n + 1);
    }, SYNC_MS);
  }, []);

  const [devPanelOpen, setDevPanelOpenState] = useState(() => {
    try {
      return localStorage.getItem(DEVPANEL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setDevPanelOpen = useCallback((open) => {
    setDevPanelOpenState(open);
    try {
      localStorage.setItem(DEVPANEL_KEY, open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);
  const [checkin, setCheckin] = useState(loadCheckin);
  const [maskId, setMaskId] = useState(DEFAULT_MASK_ID);
  const [machineId, setMachineId] = useState(DEFAULT_MACHINE_ID);
  const [deviceConnections, setDeviceConnections] = useState(DEFAULT_DEVICE_CONNECTIONS);
  const [deviceEnabled, setDeviceEnabledState] = useState(DEFAULT_DEVICE_ENABLED);
  const [deviceReads, setDeviceReads] = useState(DEFAULT_DEVICE_READS);

  const setDeviceConnected = useCallback(
    (key, connected) => setDeviceConnections((c) => ({ ...c, [key]: connected })),
    []
  );
  const setDeviceEnabled = useCallback(
    (key, enabled) => setDeviceEnabledState((e) => ({ ...e, [key]: enabled })),
    []
  );
  const setDeviceRead = useCallback(
    (key, read, on) =>
      setDeviceReads((r) => ({ ...r, [key]: { ...r[key], [read]: on } })),
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(CHECKIN_KEY, JSON.stringify(checkin));
    } catch {
      /* ignore */
    }
  }, [checkin]);

  useEffect(() => {
    try {
      localStorage.setItem(ONBOARD_KEY, onboarded ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [onboarded]);

  const openSheet = useCallback((kind, params = {}) => {
    setSheetLeaving(false);
    setSheets([{ kind, ...params }]);
  }, []);
  const pushSheet = useCallback((kind, params = {}) => {
    setSheetLeaving(false);
    setSheets((st) => [...st, { kind, ...params }]);
  }, []);
  const closeSheet = useCallback(() => {
    setSheetLeaving(false);
    setSheets((st) => st.slice(0, -1));
  }, []);

  const completeCheckin = useCallback((tags) => {
    setCheckin({ done: true, tags });
  }, []);
  const resetCheckin = useCallback(() => setCheckin(EMPTY_CHECKIN), []);

  const completeOnboarding = useCallback(() => {
    if (!onboarded) startSync();
    setOnboarded(true);
  }, [onboarded, startSync]);
  const resetOnboarding = useCallback(() => {
    setTab('tonight');
    setSheets([]);
    setOnboarded(false);
  }, []);

  const value = {
    onboarded,
    completeOnboarding,
    resetOnboarding,
    tab,
    setTab,
    tabNonce,
    tabDir,
    tabBarHidden,
    setTabBarHidden,
    sheetLeaving,
    setSheetLeaving,
    toast,
    showToast,
    syncing,
    syncNonce,
    startSync,
    devPanelOpen,
    setDevPanelOpen,
    fixtureId,
    setFixtureId,
    nightOrder,
    nightDir,
    nightDrag,
    setNightDrag,
    tonightLayout,
    setTonightLayout,
    viewMode,
    setViewMode,
    sheet,
    sheets,
    openSheet,
    pushSheet,
    closeSheet,
    checkin,
    completeCheckin,
    resetCheckin,
    maskId,
    setMaskId,
    machineId,
    setMachineId,
    deviceConnections,
    setDeviceConnected,
    deviceEnabled,
    setDeviceEnabled,
    deviceReads,
    setDeviceRead,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
