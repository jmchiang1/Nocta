/* Nocta — first-run onboarding options. See docs/FEATURES.md → Onboarding. */

export const GOALS = [
  { id: 'understand', label: 'Understand my data' },
  { id: 'adherence', label: 'Stick with therapy' },
  { id: 'leaks', label: 'Fix mask leaks' },
  { id: 'rested', label: 'Wake up rested' },
  { id: 'ahi', label: 'Lower my AHI' },
  { id: 'doctor', label: 'Prep for my doctor' },
];

/* about you — every field is a dropdown */
export const BIRTH_YEARS = Array.from({ length: 2007 - 1935 + 1 }, (_, i) => 2007 - i);

export const SEX_OPTIONS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'intersex', label: 'Intersex' },
  { id: 'na', label: 'Prefer not to say' },
];

export const WEIGHTS = Array.from({ length: 350 - 90 + 1 }, (_, i) => ({
  value: String(90 + i),
  label: `${90 + i} lb`,
}));

export const HEIGHT_FT = [
  { value: '4', label: '4 ft' },
  { value: '5', label: '5 ft' },
  { value: '6', label: '6 ft' },
  { value: '7', label: '7 ft' },
];
export const HEIGHT_IN = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: `${i} in`,
}));

/* sleep context */
export const SLEEP_POSITIONS = [
  { id: 'back', label: 'On my back' },
  { id: 'side', label: 'On my side' },
  { id: 'stomach', label: 'On my stomach' },
  { id: 'varies', label: 'It varies / I move around' },
];

export const SLEEP_CONDITIONS = [
  {
    id: 'insomnia',
    label: 'Insomnia',
    info: 'Ongoing trouble falling or staying asleep, even when you have the time and a fair chance to rest.',
  },
  {
    id: 'rls',
    label: 'Restless legs',
    info: 'An uncomfortable urge to move your legs in the evening or at night — often a crawling or tingling feeling.',
  },
  {
    id: 'bruxism',
    label: 'Teeth grinding',
    info: 'Clenching or grinding your teeth during sleep (bruxism). It can affect mask fit and cause jaw soreness.',
  },
  {
    id: 'ptsd',
    label: 'Nightmares / PTSD',
    info: 'Distressing dreams or trauma-related sleep disruption that can wake you or spike your heart rate at night.',
  },
  {
    id: 'gerd',
    label: 'Acid reflux (GERD)',
    info: 'Stomach acid rising into your throat when lying down. It often worsens overnight and can disrupt breathing.',
  },
  {
    id: 'congestion',
    label: 'Chronic nasal congestion',
    info: 'A persistently stuffy or blocked nose, which can make nasal masks harder to tolerate.',
  },
  { id: 'none', label: 'None of these', exclusive: true },
];

/* insurance / compliance — providers picked from the major companies */
export const COMPLIANCE_WINDOW = [
  { id: 'yes', label: 'Yes — in my first 90 days' },
  { id: 'no', label: 'No / already cleared it' },
  { id: 'unsure', label: 'Not sure' },
];

export const INSURERS = [
  { id: 'uhc', label: 'UnitedHealthcare' },
  { id: 'aetna', label: 'Aetna (CVS Health)' },
  { id: 'cigna', label: 'Cigna' },
  { id: 'anthem', label: 'Anthem / Elevance' },
  { id: 'bcbs', label: 'Blue Cross Blue Shield' },
  { id: 'kaiser', label: 'Kaiser Permanente' },
  { id: 'humana', label: 'Humana' },
  { id: 'centene', label: 'Centene / Ambetter' },
  { id: 'medicare', label: 'Medicare' },
  { id: 'medicaid', label: 'Medicaid' },
  { id: 'other_ins', label: 'Other / not listed' },
];

export const DME_PROVIDERS = [
  { id: 'apria', label: 'Apria Healthcare' },
  { id: 'lincare', label: 'Lincare' },
  { id: 'adapthealth', label: 'AdaptHealth' },
  { id: 'rotech', label: 'Rotech Healthcare' },
  { id: 'aeroflow', label: 'Aeroflow Healthcare' },
  { id: 'sleepdirect', label: 'Sleep Direct' },
  { id: 'resmed_direct', label: 'ResMed (direct)' },
  { id: 'other_dme', label: 'Other / not listed' },
];

/* wearables for the health-data connect step */
export const WEARABLES = [
  { id: 'apple_watch', label: 'Apple Watch' },
  { id: 'oura', label: 'Oura Ring' },
  { id: 'fitbit', label: 'Fitbit' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'samsung', label: 'Samsung Galaxy Watch' },
  { id: 'whoop', label: 'Whoop' },
];

/* mask: filter by brand + type, search by name, then pick the exact model */
export const MASK_BRANDS = [
  { id: 'resmed', label: 'ResMed' },
  { id: 'philips', label: 'Philips Respironics' },
  { id: 'fphealthcare', label: 'Fisher & Paykel' },
  { id: 'airliquide', label: 'Air Liquide' },
];

export const MASK_TYPES = [
  { id: 'nasal', label: 'Nasal' },
  { id: 'pillow', label: 'Nasal pillow' },
  { id: 'full', label: 'Full face' },
];

export const MASK_SIZES = [
  { id: 's', label: 'Small' },
  { id: 'm', label: 'Medium' },
  { id: 'l', label: 'Large' },
  { id: 'w', label: 'Wide' },
  { id: 'unsure_size', label: 'Not sure' },
];

/* a working catalog of common CPAP masks */
export const MASKS = [
  { id: 'rm-p10', brand: 'resmed', type: 'pillow', name: 'AirFit P10' },
  { id: 'rm-p30i', brand: 'resmed', type: 'pillow', name: 'AirFit P30i' },
  { id: 'rm-n20', brand: 'resmed', type: 'nasal', name: 'AirFit N20' },
  { id: 'rm-n30', brand: 'resmed', type: 'nasal', name: 'AirFit N30' },
  { id: 'rm-n30i', brand: 'resmed', type: 'nasal', name: 'AirFit N30i' },
  { id: 'rm-n40', brand: 'resmed', type: 'nasal', name: 'AirFit N40' },
  { id: 'rm-f20', brand: 'resmed', type: 'full', name: 'AirFit F20' },
  { id: 'rm-f30', brand: 'resmed', type: 'full', name: 'AirFit F30' },
  { id: 'rm-f30i', brand: 'resmed', type: 'full', name: 'AirFit F30i' },
  { id: 'rm-f40', brand: 'resmed', type: 'full', name: 'AirFit F40' },
  { id: 'rm-at-n20', brand: 'resmed', type: 'nasal', name: 'AirTouch N20' },
  { id: 'rm-at-f20', brand: 'resmed', type: 'full', name: 'AirTouch F20' },
  { id: 'ph-dw-n', brand: 'philips', type: 'nasal', name: 'DreamWear Nasal' },
  { id: 'ph-dw-p', brand: 'philips', type: 'pillow', name: 'DreamWear Nasal Pillow' },
  { id: 'ph-dw-f', brand: 'philips', type: 'full', name: 'DreamWear Full Face' },
  { id: 'ph-dwisp', brand: 'philips', type: 'nasal', name: 'DreamWisp' },
  { id: 'ph-amara', brand: 'philips', type: 'full', name: 'Amara View' },
  { id: 'ph-wisp', brand: 'philips', type: 'nasal', name: 'Wisp' },
  { id: 'ph-nuance', brand: 'philips', type: 'pillow', name: 'Nuance Pro' },
  { id: 'fp-brevida', brand: 'fphealthcare', type: 'pillow', name: 'Brevida' },
  { id: 'fp-eson2', brand: 'fphealthcare', type: 'nasal', name: 'Eson 2' },
  { id: 'fp-evora', brand: 'fphealthcare', type: 'nasal', name: 'Evora' },
  { id: 'fp-evora-f', brand: 'fphealthcare', type: 'full', name: 'Evora Full' },
  { id: 'fp-vitera', brand: 'fphealthcare', type: 'full', name: 'Vitera' },
  { id: 'fp-simplus', brand: 'fphealthcare', type: 'full', name: 'Simplus' },
  { id: 'fp-solo', brand: 'fphealthcare', type: 'nasal', name: 'Solo' },
  { id: 'al-nina', brand: 'airliquide', type: 'nasal', name: 'Respireo Nina' },
  { id: 'al-soft-n', brand: 'airliquide', type: 'nasal', name: 'Respireo Soft Nasal' },
  { id: 'al-soft-f', brand: 'airliquide', type: 'full', name: 'Respireo Soft Full Face' },
];

export const CUSHION_AGE = [
  { id: 'new', label: 'Within the last week' },
  { id: 'recent', label: '2 – 4 weeks ago' },
  { id: 'old', label: 'Over a month ago' },
  { id: 'unknown', label: 'Not sure' },
];
