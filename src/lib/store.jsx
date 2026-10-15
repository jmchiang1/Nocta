/* Nocta — app state. Onboarding + tab + active fixture + check-in + active sheet.
 * onboarded & checkin persist to localStorage. */
import { EMPTY_CHECKIN_TAGS } from '../data/journal.js';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_FIXTURE } from '../data/fixtures.js';
import { NIGHTS, LAST_NIGHT } from '../data/history.js';
import { refreshInsights } from '../data/fixtures.js';
import { getCheckin, setCheckin as saveCheckinFor, clearCheckin, migrateOldCheckin } from './checkins.js';
import { getProfile, onProfile } from './profile.js';
import { setCard, getCard, isDemoData } from './dataset.js';
import { DEFAULT_MACHINE_ID } from '../data/therapy.js';
import {
  DEFAULT_DEVICE_CONNECTIONS,
  DEFAULT_DEVICE_ENABLED,
  DEFAULT_DEVICE_READS,
} from '../data/account.js';
import { DEFAULT_SIGNIN_SCENARIO } from '../data/auth.js';
import { useAuth } from './auth.jsx';
import { saveImport, clearImport } from './importStore.js';

const StoreContext = createContext(null);

const ONBOARD_KEY = 'nocta.onboarded.v1';
const DEVPANEL_KEY = 'nocta.devpanel.v1';
const VIEW_KEY = 'nocta.layout.v1'; // v1 view key held a forced layout from the old toggle
/* the width at which the desktop dashboard takes over from the mobile app */
const DESKTOP_QUERY = '(min-width: 768px)'; // tablets get the dashboard (icon rail under 820)
const EMPTY_CHECKIN = { done: false, tags: EMPTY_CHECKIN_TAGS };
const TAB_ORDER = ['tonight', 'trends', 'therapy', 'you'];
/* how long the "bringing in last night" live activity runs after an import */
const SYNC_MS = 1700;

/* last night's check-in, from the per-night store (lib/checkins.js) */
function loadCheckin() {
  migrateOldCheckin(LAST_NIGHT);
  const tags = getCheckin(LAST_NIGHT);
  return tags ? { done: true, tags } : EMPTY_CHECKIN;
}

function loadOnboarded() {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

export function StoreProvider({ children }) {
  const [onboardedFlag, setOnboarded] = useState(loadOnboarded);
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
  /* every night with a session, in calendar order — used to know which way
   * a night change moves, so the new night slides in from that side, and
   * what the neighbours are for swiping. Read fresh from history (it
   * changes when a card is imported). */
  const nightOrder = NIGHTS.filter((x) => x.hours > 0).map((x) => x.date);
  const [nightDir, setNightDir] = useState(0); // +1 later night, -1 earlier
  const fixtureRef = useRef(DEFAULT_FIXTURE);
  const setFixtureId = useCallback((next) => {
    // night ids are dates, so their order is the calendar's
    setNightDir(next === fixtureRef.current ? 0 : next > fixtureRef.current ? 1 : -1);
    fixtureRef.current = next;
    setFixtureIdState(next);
  }, []);
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
  /* layout: the desktop dashboard on wide windows, the mobile app on narrow
   * ones, switching as the window resizes, like any web app. The DevPanel can
   * force either ('mobile' | 'desktop'); 'auto' follows the width. The
   * preference persists so a reload (R) keeps a forced layout. Every consumer
   * reads `viewMode`, the layout actually showing. */
  const [layoutPref, setLayoutPref] = useState(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'mobile' || v === 'desktop' ? v : 'auto';
    } catch {
      return 'auto';
    }
  });
  const wideQuery = typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY) : null;
  const [wide, setWide] = useState(() => wideQuery?.matches ?? true);
  useEffect(() => {
    if (!wideQuery) return undefined;
    const on = (e) => setWide(e.matches);
    wideQuery.addEventListener('change', on);
    return () => wideQuery.removeEventListener('change', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const viewMode = layoutPref === 'auto' ? (wide ? 'desktop' : 'mobile') : layoutPref;
  const setViewMode = useCallback((mode) => {
    setLayoutPref(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);
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

  /* the "bringing in last night" live activity. Data only arrives by SD card
   * import, so it plays once an import has been read successfully — never on
   * app open, never on a pull (there's nothing to pull from). The Dynamic
   * Island / desktop status pill show it; Tonight shows skeletons meanwhile.
   * info: { title, sub } for the island while it runs. */
  const [syncing, setSyncing] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
  const [syncInfo, setSyncInfo] = useState(null);
  const syncTimer = useRef(null);
  const startSync = useCallback((info = null) => {
    clearTimeout(syncTimer.current);
    setSyncInfo(info);
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
  /* demo: what the Apple / Google account you "use" looks like (mock sign-in
   * only — see data/auth.js) */
  const [signinScenario, setSigninScenario] = useState(DEFAULT_SIGNIN_SCENARIO);
  const auth = useAuth(signinScenario);
  /* with real sign-in, the app needs a signed-in user (account or guest):
   * a session that ended elsewhere lands back on the splash */
  const onboarded = onboardedFlag && (!auth.authConfigured || auth.authUser != null);
  /* the morning check-in is about last night; each night keeps its own
   * (lib/checkins.js), and the insights read them */
  const [checkin, setCheckin] = useState(loadCheckin);
  /* onboarding answers + reminder prefs (lib/profile.js), mirrored here so
   * screens re-render when they change; the insights read them too */
  const [profile, setProfileState] = useState(getProfile);
  useEffect(
    () =>
      onProfile((p) => {
        refreshInsights();
        setProfileState(p);
      }),
    []
  );
  // the mask they picked or told us in onboarding — none until then
  const [maskId, setMaskId] = useState(() => getProfile().answers.maskModel ?? null);
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
      localStorage.setItem(ONBOARD_KEY, onboardedFlag ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [onboardedFlag]);

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

  /* bumped whenever any night's check-in changes, so screens showing an
   * older night re-read it (lib/checkins.js) */
  const [checkinVersion, setCheckinVersion] = useState(0);
  /* `date`: the night it's for (default: last night). Any other night is a
   * late entry, added after that morning, and the insights weigh it less. */
  const completeCheckin = useCallback((tags, date = LAST_NIGHT) => {
    const isLast = date === LAST_NIGHT;
    saveCheckinFor(date, tags, { late: !isLast });
    refreshInsights(); // what was logged can change what Nox says
    if (isLast) setCheckin({ done: true, tags });
    setCheckinVersion((v) => v + 1);
  }, []);
  const resetCheckin = useCallback(() => {
    clearCheckin(LAST_NIGHT);
    refreshInsights();
    setCheckin(EMPTY_CHECKIN);
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
  }, []);
  /* sign out: back to the splash (a guest's setup is gone with it) */
  const { signOutAuth } = auth;
  /* bumped on every reset so onboarding remounts clean (App keys on it) */
  const [onboardingNonce, setOnboardingNonce] = useState(0);
  const resetOnboarding = useCallback(() => {
    setTab('tonight');
    setSheets([]);
    setOnboarded(false);
    try {
      localStorage.removeItem('nocta.setupDraft.v1'); // Onboarding's DRAFT_KEY
    } catch {
      /* ignore */
    }
    setOnboardingNonce((n) => n + 1);
    signOutAuth();
  }, [signOutAuth]);

  /* a guest choosing an account (You › Account): leave guest mode and land on
   * the sign up screen (Onboarding reads authEntry once) */
  const [authEntry, setAuthEntry] = useState(null);
  const switchToAccount = useCallback(
    (mode = 'signup') => {
      setAuthEntry(mode);
      resetOnboarding();
    },
    [resetOnboarding]
  );

  /* CPAP data imported from an SD card (lib/resmed, kept in IndexedDB).
   * main.jsx loaded it before the first render (lib/dataset.js); with
   * nothing imported the app shows the demo year and cardData stays null. */
  const [cardData, setCardData] = useState(() => (isDemoData() ? null : getCard()));
  /* a card that read cleanly: keep it, switch every screen onto it (open on
   * its last night), then play "bringing in last night" */
  const saveCardImport = useCallback(
    async (card) => {
      const res = await saveImport(card);
      await setCard(res.card);
      setCardData(res.card);
      setFixtureId(DEFAULT_FIXTURE);
      setCheckin(loadCheckin()); // "last night" may be a different night now
      startSync({
        title: 'Bringing in last night',
        sub: `SD card · ${res.card.device.model}`,
      });
      return res;
    },
    [startSync, setFixtureId]
  );
  /* removing the import goes back to the demo year */
  const removeCardImport = useCallback(async () => {
    await clearImport();
    await setCard(null);
    setCardData(null);
    setFixtureId(DEFAULT_FIXTURE);
    setCheckin(loadCheckin()); // "last night" may be a different night now
  }, [setFixtureId]);

  const value = {
    onboarded,
    completeOnboarding,
    resetOnboarding,
    switchToAccount,
    onboardingNonce,
    authEntry,
    setAuthEntry,
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
    syncInfo,
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
    layoutPref,
    setViewMode,
    sheet,
    sheets,
    openSheet,
    pushSheet,
    closeSheet,
    signinScenario,
    setSigninScenario,
    ...auth,
    cardData,
    saveCardImport,
    removeCardImport,
    checkin,
    checkinVersion,
    completeCheckin,
    resetCheckin,
    profile,
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
