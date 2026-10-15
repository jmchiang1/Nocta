/* Nocta — account, settings, masks, and wearable definitions. Nothing here
 * stands in for real data: who you are comes from sign-in, therapy from the
 * card, and no wearable is connected until one actually is. */

import { NIGHTS_USED, THERAPY_START, toDate } from './history.js';

/* Who's using Nocta comes from their sign-in (lib/auth.jsx → authUser):
 * the name and photo Google shares, or the email they signed up with. Nothing
 * is filled in when it isn't known: no placeholder name, no plan, no
 * diagnosis. Therapy facts come from the card. */
export const USER = {
  get daysOnTherapy() {
    return NIGHTS_USED;
  },
  get therapyStart() {
    return THERAPY_START
      ? toDate(THERAPY_START).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  },
};

/* the name to greet someone by: their first name if their sign-in gave one */
export const firstName = (authUser) => authUser?.name?.trim().split(/\s+/)[0] ?? null;
export const initialsOf = (authUser) => {
  const parts = authUser?.name?.trim().split(/\s+/) ?? [];
  if (parts.length) return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  return authUser?.email ? authUser.email[0].toUpperCase() : null;
};

/* where the data lives, said plainly */
export const PRIVACY_NOTE =
  'Your CPAP nights, check-ins and answers are kept on this device, read from your SD card. Your sign-in is held by Nocta’s account service. Nothing is sold or shared with insurers or employers. You can export it all, or delete your account, below.';

/* the one medical disclaimer — onboarding, the Tonight footer and Settings
 * all render this, so the three never drift apart */
export const MEDICAL_NOTE =
  'Nocta is a wellness companion, not a medical device. Don’t use it to change your pressure, diagnose a condition, or stop therapy. Ask your doctor instead.';

/* Masks — single source of truth lives in onboarding.js (the catalog used by
 * the first-time setup flow). We re-export from here so the rest of the app
 * has one mask import path. */
import { MASKS, MASK_BRANDS, MASK_TYPES } from './onboarding.js';
export { MASKS, MASK_BRANDS, MASK_TYPES };
export const MASK_BRAND_LABEL = Object.fromEntries(MASK_BRANDS.map((b) => [b.id, b.label]));
export const MASK_TYPE_LABEL = Object.fromEntries(MASK_TYPES.map((t) => [t.id, t.label]));
/* no default mask: it's whatever the person picked or told us, else none */
export const maskById = (id) => (id ? (MASKS.find((m) => m.id === id) ?? null) : null);

/* the mask TYPE the machine itself records (CurrentSettings.json) */
const CARD_MASK = { Pillows: 'Nasal pillow', Nasal: 'Nasal', FullFace: 'Full face' };
export const cardMaskType = (settings) => CARD_MASK[settings?.maskType] ?? null;

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
  },
  {
    key: 'health',
    icon: 'heart',
    title: 'Apple Health',
    short: 'HealthKit',
    blurb:
      'Aggregator on your iPhone. Nocta reads what other apps have written here: workouts, weight, and manual entries.',
    reads: ['Steps', 'Workouts', 'Body mass', 'Manual entries'],
  },
  {
    key: 'oura',
    icon: 'dotRing',
    title: 'Oura Ring',
    short: 'Ring data',
    blurb: 'Sleep stages and recovery signals from your Oura ring.',
    reads: ['Sleep stages', 'Heart-rate variability', 'Heart rate', 'Body temperature', 'Readiness score'],
  },
  {
    key: 'fitbit',
    icon: 'heart',
    title: 'Fitbit',
    short: 'Wrist data',
    blurb: 'Heart rate, sleep stages, and breathing rate from your Fitbit.',
    reads: ['Heart rate', 'Heart-rate variability', 'Sleep stages', 'Blood oxygen', 'Respiratory rate'],
  },
  {
    key: 'garmin',
    icon: 'exercise',
    title: 'Garmin',
    short: 'Wrist data',
    blurb: 'Heart rate, Pulse Ox, and sleep from your Garmin watch.',
    reads: ['Heart rate', 'Heart-rate variability', 'Sleep stages', 'Blood oxygen', 'Respiratory rate'],
  },
  {
    key: 'samsung',
    icon: 'clock',
    title: 'Samsung Galaxy Watch',
    short: 'Wrist data',
    blurb: 'Heart rate, blood oxygen, and sleep from your Galaxy Watch.',
    reads: ['Heart rate', 'Sleep stages', 'Blood oxygen'],
  },
  {
    key: 'whoop',
    icon: 'exercise',
    title: 'Whoop',
    short: 'Strain & recovery',
    blurb: 'Strain, recovery, and sleep from your Whoop strap.',
    reads: ['Strain', 'Recovery score', 'Sleep performance', 'Heart rate'],
  },
];

/* nothing is connected until a real connection exists (none can be made yet) */
export const DEFAULT_DEVICE_CONNECTIONS = {
  watch: false,
  health: false,
  oura: false,
  fitbit: false,
  garmin: false,
  samsung: false,
  whoop: false,
};

/* Master enable map — independent of the OAuth connection. Lets the user
 * temporarily pause a device's contribution to Nocta without revoking access
 * or losing their per-read permissions. Defaults to all on; a disabled-but-
 * connected device keeps the OAuth tie but stops feeding the home screen. */
export const DEFAULT_DEVICE_ENABLED = {
  watch: true,
  health: true,
  oura: true,
  fitbit: true,
  garmin: true,
  samsung: true,
  whoop: true,
};

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
  watch: '/brands/applehealth.png',
  health: '/brands/applehealth.png',
  oura: '/brands/oura.png',
  fitbit: '/brands/fitbit.svg',
  garmin: '/brands/garmin.svg',
  samsung: '/brands/samsung.svg',
  whoop: '/brands/whoop.png',
};
