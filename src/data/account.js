/* Nocta — account, settings, masks, and connected-device data.
 * Mock for v1. None of this hits a backend; the toggles and pickers update
 * local store state so the subpages feel real. */

export const USER = {
  name: 'Jonathan Chiang',
  email: 'jonathan@example.com',
  initials: 'JC',
  joinedDate: 'May 28, 2026',
  plan: 'Nocta · free trial',
  planSub: '11 days remaining',
  daysOnTherapy: 11,
  condition: 'OSA',
};

/* Static settings preferences. Notification switches are interactive (local
 * sheet state); the rest are display-only for the prototype. */
export const SETTINGS_DEFAULTS = {
  checkinReminder: true,
  weeklySummary: true,
  syncOverCellular: false,
};

export const PRIVACY_NOTE =
  'Your CPAP data is stored on Nocta servers and encrypted at rest. We never sell it or share it with insurers or employers. You can delete your account and all associated data from this screen at any time.';

export const MEDICAL_NOTE =
  'Nocta is a wellness companion, not a medical device. It supplements — it does not replace — your prescribed therapy or your doctor’s care. No insight from Nocta should be used to adjust pressure settings, diagnose a condition, or stop therapy.';

/* Masks — single source of truth lives in onboarding.js (the catalog used by
 * the first-time setup flow). We re-export from here so the rest of the app
 * has one mask import path. */
import { MASKS, MASK_BRANDS, MASK_TYPES } from './onboarding.js';
export { MASKS, MASK_BRANDS, MASK_TYPES };
export const MASK_BRAND_LABEL = Object.fromEntries(MASK_BRANDS.map((b) => [b.id, b.label]));
export const MASK_TYPE_LABEL = Object.fromEntries(MASK_TYPES.map((t) => [t.id, t.label]));
export const DEFAULT_MASK_ID = 'rm-p30i';
export const maskById = (id) => MASKS.find((m) => m.id === id) || MASKS[0];

/* Third-party body-data sources. Apple Health is the iPhone aggregator
 * (HealthKit); Watch and Oura write to it. `reads` is the per-source list
 * shown on the device detail sheet so the user sees what Nocta will pull. */
export const CONNECTED_DEVICES = [
  {
    key: 'watch',
    icon: 'clock',
    title: 'Apple Watch',
    short: 'Series 10',
    blurb: 'Heart rate, sleep, and recovery from your wrist.',
    reads: ['Heart rate', 'Heart-rate variability', 'Sleep stages', 'Blood oxygen', 'Respiratory rate'],
    lastSync: '2 hours ago',
  },
  {
    key: 'health',
    icon: 'heart',
    title: 'Apple Health',
    short: 'HealthKit',
    blurb:
      'Aggregator on your iPhone. Nocta reads what other apps have written here — workouts, weight, and manual entries.',
    reads: ['Steps', 'Workouts', 'Body mass', 'Manual entries'],
    lastSync: null,
  },
  {
    key: 'oura',
    icon: 'dotRing',
    title: 'Oura Ring',
    short: 'Ring data',
    blurb: 'Sleep stages and recovery signals from your Oura ring.',
    reads: ['Sleep stages', 'Heart-rate variability', 'Heart rate', 'Body temperature', 'Readiness score'],
    lastSync: null,
  },
  {
    key: 'whoop',
    icon: 'exercise',
    title: 'Whoop',
    short: 'Strain & recovery',
    blurb: 'Strain, recovery, and sleep from your Whoop strap.',
    reads: ['Strain', 'Recovery score', 'Sleep performance', 'Heart rate'],
    lastSync: null,
  },
];

export const DEFAULT_DEVICE_CONNECTIONS = { watch: true, health: false, oura: false, whoop: false };

/* Master enable map — independent of the OAuth connection. Lets the user
 * temporarily pause a device's contribution to Nocta without revoking access
 * or losing their per-read permissions. Defaults to all on; a disabled-but-
 * connected device keeps the OAuth tie but stops feeding the home screen. */
export const DEFAULT_DEVICE_ENABLED = { watch: true, health: true, oura: true, whoop: true };

/* Per-device permission map — which of a device's `reads` Nocta is allowed
 * to pull. Defaults to all-on; the device-detail sheet lets users opt out
 * per read so they can grant Apple Watch HR but withhold blood oxygen. */
export const DEFAULT_DEVICE_READS = Object.fromEntries(
  CONNECTED_DEVICES.map((d) => [d.key, Object.fromEntries(d.reads.map((r) => [r, true]))])
);

export const deviceByKey = (key) => CONNECTED_DEVICES.find((d) => d.key === key);

/* Real product photography used in the device rows (You tab + Add device
 * picker). Devices without a photo fall back to the line-icon defined on
 * CONNECTED_DEVICES.icon. Apple Watch maps to the Apple Health badge
 * because on iOS, Watch data flows in through HealthKit. */
export const DEVICE_PHOTO = {
  watch: '/applehealth.png',
  health: '/applehealth.png',
  oura: '/ouraring.jpg',
  whoop: '/whoop.png',
};
