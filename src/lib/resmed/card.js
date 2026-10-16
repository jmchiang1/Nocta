/* Nocta — read a ResMed SD card (AirSense 10 / 11) into nights.
 *
 * Card layout:
 *   STR.edf                          one record per day (noon → noon): usage,
 *                                    the machine's own AHI / leak / pressure summary
 *   DATALOG/<YYYYMMDD>/              one folder per sleep day (named for the
 *                                    evening it started)
 *     <start>_EVE.edf                events: Obstructive / Central / unclassified
 *                                    Apnea, Hypopnea, Arousal (EDF+ annotations)
 *     <start>_CSL.edf                periodic-breathing spans (EDF+ annotations)
 *     <start>_PLD.edf                every 2 s: mask pressure, leak, resp rate,
 *                                    tidal volume, minute vent, snore, flow limit
 *     <start>_SA2.edf                every 1 s: SpO₂ + pulse (all -1 without an oximeter)
 *     <start>_BRP.edf                25 Hz flow + pressure waveform — not read
 *                                    (≈1.4 MB a night; nothing in v1 needs it)
 *   Identification.json | .tgt       model + serial (AirSense 11 | 10)
 *   SETTINGS/CurrentSettings.json    prescribed mode + pressures (AirSense 11)
 *
 * Each mask-on stretch is a session: one PLD (+ EVE/CSL/SA2) per session.
 * A night's numbers come from its DATALOG files when they exist, so the
 * events listed and the AHI shown always agree (AHI = apneas + hypopneas per
 * hour of use — the machine's definition; it matches STR to 0.1 on real
 * nights). STR fills in nights whose detail files are gone (the card keeps
 * summaries longer than detail).
 *
 * Times are the machine's wall clock, kept as naive 'YYYY-MM-DDTHH:MM:SS'. */
import { readEdf, readEdfHeader, EdfError } from './edf.js';
import { eventWindows, readWaves } from './waves.js';

export class CardError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code; // 'not_a_card' | 'philips' | 'empty' | 'unreadable'
  }
}

const NIGHT_FILE = /(?:^|\/)DATALOG\/(\d{8})\/(\d{8}_\d{6})_(EVE|CSL|PLD|SA2|BRP)\.edf$/i;
const STR_FILE = /(?:^|\/)STR\.edf$/i;
const ID_JSON = /(?:^|\/)Identification\.json$/i;
const ID_TGT = /(?:^|\/)Identification\.tgt$/i;
const SETTINGS_JSON = /(?:^|\/)SETTINGS\/CurrentSettings\.json$/i;
const PHILIPS = /(?:^|\/)P-Series\//i;

const EVENT_TYPES = {
  'Obstructive Apnea': 'osa',
  'Central Apnea': 'csa',
  Hypopnea: 'hyp',
  Apnea: 'apnea', // unclassified
  Arousal: 'arousal',
};
/* what counts toward AHI */
const AHI_TYPES = ['osa', 'csa', 'hyp', 'apnea'];

const LARGE_LEAK_LPM = 24; // ResMed's large-leak line (0.4 L/s)
const SERIES_STEP_SEC = 60; // per-minute series for the full-night charts

const naive = (ms) => new Date(ms).toISOString().slice(0, 19);
const isoDate = (yyyymmdd) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
const round = (v, d = 1) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/* nearest-rank percentile over finite values (what myAir's leak 95% matches) */
function percentile(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

/* 2 s samples per 0.1 cmH₂O step: { from: lowest step, counts } (compact,
 * and exact enough to count time at a pressure) */
function pressureHist(values) {
  const steps = values.filter((v) => Number.isFinite(v) && v > 0).map((v) => Math.round(v * 10));
  if (!steps.length) return null;
  const from = Math.min(...steps);
  const counts = new Array(Math.max(...steps) - from + 1).fill(0);
  for (const k of steps) counts[k - from]++;
  return { from, step: 0.1, sampleSec: 2, counts };
}

/* mean of each `step`-sample block, NaN-aware (null when a block is all gaps) */
function downsample(values, step, scale = 1, digits = 1) {
  const out = [];
  for (let i = 0; i < values.length; i += step) {
    let sum = 0;
    let n = 0;
    for (let j = i; j < i + step && j < values.length; j++) {
      if (Number.isFinite(values[j])) {
        sum += values[j];
        n++;
      }
    }
    out.push(n ? round((sum / n) * scale, digits) : null);
  }
  return out;
}

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
const asText = (buf) => decoder.decode(buf);

/* ---------- device + settings ---------- */

function deviceFromJson(text) {
  const p = JSON.parse(text)?.FlowGenerator?.IdentificationProfiles?.Product ?? {};
  return {
    brand: 'ResMed',
    model: p.ProductName || 'ResMed machine',
    serial: p.SerialNumber || null,
    productCode: p.ProductCode || null,
  };
}

/* AirSense 10: "#PNA AirSense_10_AutoSet\n#SRN 23161234567\n#PCD 37028 …" */
function deviceFromTgt(text) {
  const get = (k) => text.match(new RegExp(`#${k}\\s+(.+)`))?.[1]?.trim() ?? null;
  return {
    brand: 'ResMed',
    model: (get('PNA') || 'ResMed machine').replace(/_/g, ' '),
    serial: get('SRN'),
    productCode: get('PCD'),
  };
}

function settingsFromJson(text) {
  const sp = JSON.parse(text)?.FlowGenerator?.SettingProfiles;
  if (!sp) return null;
  const active = sp.ActiveProfiles?.TherapyProfile;
  const t = sp.TherapyProfiles?.[active] ?? {};
  const f = sp.FeatureProfiles ?? {};
  return {
    mode: t.TherapyMode ?? null, // 'AutoSet' | 'CPAP' | 'HerAuto' | …
    minPressure: t.MinPressure ?? null,
    maxPressure: t.MaxPressure ?? null,
    setPressure: t.SetPressure ?? null,
    startPressure: t.StartPressure ?? null,
    epr: f.EprFeature ? { on: f.EprFeature.EprEnable === 'On', level: f.EprFeature.EprPressure ?? null } : null,
    rampMinutes: f.AutoRampFeature?.RampTime ?? null,
    humidifierLevel: f.ClimateFeature?.HumidifierLevel ?? null,
    maskType: f.CircuitFeature?.MaskType ?? null,
    appliedAt: sp.Attributes?.AppliedDateTime ?? null,
  };
}

/* ---------- STR.edf: one summary row per day ---------- */

const STR_SIGNALS = [
  'Date', 'MaskOn', 'MaskOff', 'Duration', 'Mode',
  'AHI', 'HI', 'OAI', 'CAI', 'UAI',
  'Leak.50', 'Leak.95', 'Leak.Max',
  'MaskPress.50', 'MaskPress.95', 'MaskPress.Max',
  'RespRate.50', 'SpO2.50',
  'S.A.MinPress', 'S.A.MaxPress', 'S.C.Press', 'S.EPR.EPREnable', 'S.EPR.Level',
];
const STR_MODES = { 0: 'CPAP', 1: 'AutoSet', 2: 'APAP', 11: 'HerAuto' };

function readStr(buf) {
  const e = readEdf(buf, { signals: STR_SIGNALS });
  const s = e.signals;
  const at = (label, r, j = 0) => {
    const sig = s[label];
    if (!sig) return NaN;
    const per = sig.values.length / e.nrec;
    return sig.values[r * per + j];
  };
  const days = new Map();
  let lastSettings = null;
  // the prescription that day: each row carries the settings in force, so a
  // change shows up on the night it happened
  const rowSettings = (r) => {
    const n = (k) => (Number.isFinite(at(k, r)) ? round(at(k, r)) : null);
    const eprLevel = n('S.EPR.Level');
    return {
      mode: STR_MODES[at('Mode', r)] ?? null,
      minPressure: n('S.A.MinPress'),
      maxPressure: n('S.A.MaxPress'),
      setPressure: n('S.C.Press'),
      eprLevel: eprLevel == null ? null : at('S.EPR.EPREnable', r) > 0 ? eprLevel : 0,
    };
  };
  for (let r = 0; r < e.nrec; r++) {
    const minutes = at('Duration', r);
    // the day this row covers: Date (days since 1970) if present, else header + r
    const dayMs = Number.isFinite(at('Date', r))
      ? at('Date', r) * 864e5
      : Math.floor(e.start / 864e5) * 864e5 + r * 864e5;
    const date = naive(dayMs).slice(0, 10);
    const daySettings = Number.isFinite(at('S.A.MinPress', r)) ? rowSettings(r) : null;
    if (daySettings) lastSettings = daySettings;
    if (!(minutes > 0)) continue;
    const noon = dayMs + 12 * 3600e3;
    const sessions = [];
    for (let j = 0; j < 20; j++) {
      const on = at('MaskOn', r, j);
      const off = at('MaskOff', r, j);
      if (!Number.isFinite(on) || !Number.isFinite(off) || off <= on) continue;
      sessions.push({ start: naive(noon + on * 60e3), end: naive(noon + off * 60e3), minutes: off - on });
    }
    const lpm = (v) => round(v * 60);
    days.set(date, {
      date,
      source: 'summary',
      hours: round(minutes / 60, 2),
      sessions,
      events: null, // STR has rates, not counts
      ahi: {
        total: round(at('AHI', r)),
        osa: round(at('OAI', r)),
        csa: round(at('CAI', r)),
        hyp: round(at('HI', r)),
        apnea: round(at('UAI', r)),
      },
      leak: { p50: lpm(at('Leak.50', r)), p95: lpm(at('Leak.95', r)), max: lpm(at('Leak.Max', r)), largeMinutes: null },
      pressure: { p50: round(at('MaskPress.50', r)), p95: round(at('MaskPress.95', r)), max: round(at('MaskPress.Max', r)) },
      respRate: { p50: round(at('RespRate.50', r)) },
      spo2: Number.isFinite(at('SpO2.50', r)) && at('SpO2.50', r) > 0 ? { median: round(at('SpO2.50', r)) } : null,
      settings: daySettings,
      eventList: [],
    });
  }
  return { days, settings: lastSettings };
}

/* ---------- DATALOG: one sleep day ---------- */

async function readNight(date, files) {
  const sessions = [];
  const eventList = [];
  const leakAll = [];
  const pressAll = [];
  const targetAll = []; // the pressure the machine set for each breath in (Press.2s)
  const exhaleAll = []; // and for breathing out, after exhale relief (EprPress.2s)
  const rrAll = [];
  const spo2All = [];
  const pulseAll = [];
  let periodicSec = 0;
  const warnings = [];

  for (const f of files.PLD) {
    try {
      const e = readEdf(await f.read(), {
        signals: ['MaskPress.2s', 'Press.2s', 'EprPress.2s', 'Leak.2s', 'RespRate.2s', 'Snore.2s', 'FlowLim.2s', 'TidVol.2s', 'MinVent.2s'],
      });
      const sec = e.nrec * e.recordSec;
      if (!sec) continue;
      const sig = (k) => e.signals[k]?.values ?? new Float32Array();
      const per = Math.round(SERIES_STEP_SEC * (e.signals['Leak.2s']?.rate ?? 0.5));
      leakAll.push(...sig('Leak.2s'));
      pressAll.push(...sig('MaskPress.2s'));
      targetAll.push(...sig('Press.2s'));
      exhaleAll.push(...sig('EprPress.2s'));
      rrAll.push(...sig('RespRate.2s'));
      sessions.push({
        start: naive(e.start),
        end: naive(e.start + sec * 1000),
        minutes: round(sec / 60, 1),
        // per-minute means, for the full-night charts
        series: {
          stepSec: SERIES_STEP_SEC,
          pressure: downsample(sig('MaskPress.2s'), per),
          leak: downsample(sig('Leak.2s'), per, 60), // L/s → L/min
          respRate: downsample(sig('RespRate.2s'), per),
          snore: downsample(sig('Snore.2s'), per, 1, 2),
          flowLimit: downsample(sig('FlowLim.2s'), per, 1, 2),
          tidalVolume: downsample(sig('TidVol.2s'), per, 1000, 0), // L → mL
          minuteVent: downsample(sig('MinVent.2s'), per),
          // the pressure the machine set, breathing in and out
          inhale: downsample(sig('Press.2s'), per),
          exhale: downsample(sig('EprPress.2s'), per),
        },
      });
    } catch (err) {
      warnings.push(`${f.name}: ${err.message}`);
    }
  }

  for (const f of files.EVE) {
    try {
      const e = readEdf(await f.read());
      for (const a of e.annotations) {
        const type = EVENT_TYPES[a.text];
        if (!type) continue; // "Recording starts" and unknown labels
        eventList.push({ type, at: naive(e.start + a.onset * 1000), durSec: round(a.duration, 0) });
      }
    } catch (err) {
      warnings.push(`${f.name}: ${err.message}`);
    }
  }

  // CSL: periodic-breathing spans. Kept as a number for the escalation rules —
  // never shown or named in the UI (CLAUDE.md safety rails).
  for (const f of files.CSL) {
    try {
      const e = readEdf(await f.read());
      for (const a of e.annotations) if (a.duration > 0) periodicSec += a.duration;
    } catch (err) {
      warnings.push(`${f.name}: ${err.message}`);
    }
  }

  for (const f of files.SA2) {
    try {
      const e = readEdf(await f.read(), { signals: ['SpO2.1s', 'Pulse.1s'] });
      spo2All.push(...(e.signals['SpO2.1s']?.values ?? []));
      pulseAll.push(...(e.signals['Pulse.1s']?.values ?? []));
    } catch (err) {
      warnings.push(`${f.name}: ${err.message}`);
    }
  }

  if (!sessions.length) return { night: null, warnings };

  sessions.sort((a, b) => a.start.localeCompare(b.start));
  // only events inside recorded time count: a PLD cut short (card pulled
  // mid-write) would otherwise leave events with no hours under them, and
  // inflate the AHI. A minute's grace — EVE starts a few seconds before PLD.
  const ms = (t) => Date.parse(`${t}Z`);
  const inSession = (t) =>
    sessions.some((s) => ms(t) >= ms(s.start) - 60e3 && ms(t) <= ms(s.end) + 60e3);
  const kept = eventList.filter((ev) => inSession(ev.at));
  if (kept.length < eventList.length) {
    warnings.push(`${isoDate(date)}: ${eventList.length - kept.length} events outside recorded time were left out`);
  }
  eventList.length = 0;
  eventList.push(...kept);
  eventList.sort((a, b) => a.at.localeCompare(b.at));

  // the breathing waveform around each event (BRP), read in small slices
  let waves = [];
  if (files.BRP?.length && eventList.length) {
    try {
      waves = await readWaves(files.BRP, eventWindows(eventList), naive);
    } catch (err) {
      warnings.push(`${isoDate(date)} waveform: ${err.message}`);
    }
  }
  const hours = sessions.reduce((a, s) => a + s.minutes, 0) / 60;
  const events = { osa: 0, csa: 0, hyp: 0, apnea: 0, arousal: 0 };
  for (const ev of eventList) events[ev.type]++;
  const perHour = (n) => (hours > 0 ? round(n / hours) : null);
  const spo2 = spo2All.filter(Number.isFinite);
  const pulse = pulseAll.filter(Number.isFinite);
  const leakFinite = leakAll.filter(Number.isFinite);

  return {
    warnings,
    night: {
      date: isoDate(date),
      source: 'datalog',
      hours: round(hours, 2),
      sessions,
      events,
      ahi: {
        total: perHour(AHI_TYPES.reduce((a, t) => a + events[t], 0)),
        osa: perHour(events.osa),
        csa: perHour(events.csa),
        hyp: perHour(events.hyp),
        apnea: perHour(events.apnea),
      },
      leak: {
        p50: round(percentile(leakAll, 0.5) * 60),
        p95: round(percentile(leakAll, 0.95) * 60),
        max: round(percentile(leakAll, 1) * 60),
        // 2 s samples above the large-leak line, in minutes
        largeMinutes: round((leakFinite.filter((v) => v * 60 > LARGE_LEAK_LPM).length * 2) / 60, 0),
      },
      pressure: {
        p50: round(percentile(pressAll, 0.5)),
        p95: round(percentile(pressAll, 0.95)),
        max: round(percentile(pressAll, 1)),
        // what the machine set, breathing in and out (medians)
        inhaleP50: round(percentile(targetAll, 0.5)),
        exhaleP50: round(percentile(exhaleAll, 0.5)),
        // the set pressure's spread over the night, in 2 s samples per
        // 0.1 cmH₂O, so time at the prescribed maximum can be read against
        // that night's range (lib/nightDetail.js)
        targetHist: pressureHist(targetAll),
      },
      respRate: { p50: round(percentile(rrAll, 0.5)) },
      spo2: spo2.length
        ? {
            avg: round(spo2.reduce((a, v) => a + v, 0) / spo2.length),
            min: Math.min(...spo2),
            minutesBelow90: round(spo2.filter((v) => v < 90).length / 60, 0),
            pulseAvg: pulse.length ? round(pulse.reduce((a, v) => a + v, 0) / pulse.length, 0) : null,
          }
        : null,
      periodicBreathingMin: round(periodicSec / 60, 0),
      eventList,
      waves,
    },
  };
}

/* ---------- the whole card ---------- */

/**
 * @param entries  [{ path, size?, read: () => Promise<ArrayBuffer> }] — every
 *                 file under the folder the person picked (any depth)
 * @param onProgress ({ done, total }) => void
 */
export async function parseCard(entries, { onProgress } = {}) {
  const warnings = [];
  const norm = entries.map((e) => ({ ...e, path: e.path.replace(/\\/g, '/') }));

  const nightFiles = new Map(); // 'YYYYMMDD' → { EVE:[], CSL:[], PLD:[], SA2:[], BRP:[] }
  let str = null;
  let idJson = null;
  let idTgt = null;
  let settingsJson = null;
  let philips = false;

  for (const e of norm) {
    const m = e.path.match(NIGHT_FILE);
    if (m) {
      const kind = m[3].toUpperCase();
      if (!nightFiles.has(m[1])) nightFiles.set(m[1], { EVE: [], CSL: [], PLD: [], SA2: [], BRP: [] });
      nightFiles.get(m[1])[kind].push({ ...e, name: e.path.split('/').pop() });
    } else if (STR_FILE.test(e.path)) {
      // several copies (a backup folder)? use the one nearest the root
      if (!str || e.path.length < str.path.length) str = e;
    } else if (ID_JSON.test(e.path)) idJson = e;
    else if (ID_TGT.test(e.path)) idTgt = e;
    else if (SETTINGS_JSON.test(e.path)) settingsJson = e;
    else if (PHILIPS.test(e.path)) philips = true;
  }

  if (!str && !nightFiles.size) {
    if (philips) throw new CardError('philips', 'Philips cards aren’t supported yet.');
    throw new CardError('not_a_card', 'No ResMed data found.');
  }

  let device = { brand: 'ResMed', model: 'ResMed machine', serial: null, productCode: null };
  try {
    if (idJson) device = deviceFromJson(asText(await idJson.read()));
    else if (idTgt) device = deviceFromTgt(asText(await idTgt.read()));
  } catch (err) {
    warnings.push(`Identification: ${err.message}`);
  }

  let settings = null;
  try {
    if (settingsJson) settings = settingsFromJson(asText(await settingsJson.read()));
  } catch (err) {
    warnings.push(`Settings: ${err.message}`);
  }

  let summary = new Map();
  if (str) {
    try {
      const s = readStr(await str.read());
      summary = s.days;
      settings = settings ?? s.settings;
      if (!device.serial) {
        const h = readEdfHeader(await str.read());
        device.serial = h.recording.match(/SRN=(\d+)/)?.[1] ?? null;
      }
    } catch (err) {
      warnings.push(`STR.edf: ${err instanceof EdfError ? err.message : String(err)}`);
    }
  }

  const nights = new Map();
  const keys = [...nightFiles.keys()].sort();
  for (let i = 0; i < keys.length; i++) {
    const { night, warnings: w } = await readNight(keys[i], nightFiles.get(keys[i]));
    warnings.push(...w);
    if (night) nights.set(night.date, night);
    onProgress?.({ done: i + 1, total: keys.length });
    // let the UI breathe between nights
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  // the prescription each night ran on, from that day's STR row
  for (const [date, night] of nights) night.settings = summary.get(date)?.settings ?? null;
  // nights the card only has summaries for
  for (const [date, row] of summary) if (!nights.has(date)) nights.set(date, row);

  const list = [...nights.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) {
    // night folders with files, none of which would read: damaged, not empty
    const hadFiles = [...nightFiles.values()].some((f) => f.PLD.length || f.EVE.length);
    if (hadFiles && warnings.length) throw new CardError('unreadable', 'None of the nights could be read.');
    throw new CardError('empty', 'The card has no therapy nights yet.');
  }

  return {
    version: 1,
    source: 'resmed-sd',
    importedAt: new Date().toISOString(),
    device,
    settings,
    nights: list,
    range: { first: list[0].date, last: list.at(-1).date },
    warnings,
  };
}
