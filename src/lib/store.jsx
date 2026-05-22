/* Nocta — app state. Onboarding + tab + active fixture + check-in + active sheet.
 * onboarded & checkin persist to localStorage. */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DEFAULT_FIXTURE } from '../data/fixtures.js';
import {
  DEFAULT_MASK_ID,
  DEFAULT_DEVICE_CONNECTIONS,
  DEFAULT_DEVICE_ENABLED,
  DEFAULT_DEVICE_READS,
} from '../data/account.js';

const StoreContext = createContext(null);

const CHECKIN_KEY = 'nocta.checkin.v1';
const ONBOARD_KEY = 'nocta.onboarded.v1';
const EMPTY_CHECKIN = { done: false, tags: { feel: [], lastnight: [], yesterday: [] } };

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
  const setTab = useCallback((next) => {
    setTabState(next);
    setTabNonce((n) => n + 1);
  }, []);
  const [fixtureId, setFixtureId] = useState(DEFAULT_FIXTURE);
  const [sheet, setSheet] = useState(null); // { kind, ...params }
  const [checkin, setCheckin] = useState(loadCheckin);
  const [maskId, setMaskId] = useState(DEFAULT_MASK_ID);
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

  const openSheet = useCallback((kind, params = {}) => setSheet({ kind, ...params }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const completeCheckin = useCallback((tags) => {
    setCheckin({ done: true, tags });
  }, []);
  const resetCheckin = useCallback(() => setCheckin(EMPTY_CHECKIN), []);

  const completeOnboarding = useCallback(() => setOnboarded(true), []);
  const resetOnboarding = useCallback(() => {
    setTab('tonight');
    setSheet(null);
    setOnboarded(false);
  }, []);

  const value = {
    onboarded,
    completeOnboarding,
    resetOnboarding,
    tab,
    setTab,
    tabNonce,
    fixtureId,
    setFixtureId,
    sheet,
    openSheet,
    closeSheet,
    checkin,
    completeCheckin,
    resetCheckin,
    maskId,
    setMaskId,
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
