/* Nocta — Therapy tab data: device, settings, compliance. The machine, its
 * settings and compliance come from the CPAP card; equipment ages from the
 * replacement dates the person logs (lib/equipment.js). */
import { getCard } from '../lib/dataset.js';

/* The machine and its settings, as the card records them. Nothing here is a
 * default: a card that doesn't carry a setting shows it as missing. */

/* the card's machine: { brand, model, serial } or null */
export function cardDevice() {
  const d = getCard()?.device;
  return d?.model ? d : null;
}

const MODE_NAME = { AutoSet: 'AutoSet', CPAP: 'CPAP (fixed)', HerAuto: 'AutoSet for Her', APAP: 'Auto (APAP)' };

/* the prescribed pressure window from the card: [min, max] for an auto mode,
 * [set, set] for fixed CPAP, null when the card doesn't say */
export function pressureRange() {
  const s = getCard()?.settings;
  if (!s) return null;
  if (s.mode === 'CPAP' && s.setPressure != null) return [s.setPressure, s.setPressure];
  if (s.minPressure != null && s.maxPressure != null) return [s.minPressure, s.maxPressure];
  return null;
}
export const rangeLabel = (r) => (!r ? null : r[0] === r[1] ? `${r[0]} cmH₂O` : `${r[0]} – ${r[1]} cmH₂O`);

/* the machine card's settings grid — only what the card recorded */
export function deviceCells() {
  const s = getCard()?.settings;
  if (!s) return [];
  const cells = [];
  if (s.mode) cells.push({ k: 'Mode', v: MODE_NAME[s.mode] ?? s.mode });
  const r = rangeLabel(pressureRange());
  if (r) cells.push({ k: s.mode === 'CPAP' ? 'Pressure' : 'Pressure range', v: r });
  if (s.epr) cells.push({ k: 'EPR', v: s.epr.on ? `On · level ${s.epr.level}` : 'Off' });
  if (s.humidifierLevel != null) cells.push({ k: 'Humidity', v: `Level ${s.humidifierLevel}` });
  if (s.rampMinutes != null) cells.push({ k: 'Ramp', v: `${s.rampMinutes} min` });
  return cells;
}

/* CPAP machines (the picker's catalogue). Shown only when there's no card to
 * say which machine it is. */
export const MACHINES = [
  { id: 'rm-as11-auto', brand: 'ResMed', name: 'AirSense 11 AutoSet', short: 'AirSense 11' },
  { id: 'rm-as10-auto', brand: 'ResMed', name: 'AirSense 10 AutoSet', short: 'AirSense 10' },
  { id: 'rm-airmini', brand: 'ResMed', name: 'AirMini AutoSet', short: 'AirMini' },
  { id: 'ph-ds2', brand: 'Philips Respironics', name: 'DreamStation 2 Auto', short: 'DreamStation 2' },
  { id: 'fp-sleepstyle', brand: 'Fisher & Paykel', name: 'SleepStyle Auto', short: 'SleepStyle' },
  { id: 'rh-luna-g3', brand: 'React Health', name: 'Luna G3 Auto', short: 'Luna G3' },
];
export const DEFAULT_MACHINE_ID = 'rm-as11-auto';
export const machineById = (id) => MACHINES.find((m) => m.id === id) || MACHINES[0];

/* the machine to name on screen: the card's, else the one picked */
export function machineName(machineId) {
  const d = cardDevice();
  if (d) return { brand: d.brand, name: d.model.replace(/^ResMed\s+/, ''), short: d.model.replace(/ AutoSet$| CPAP$/, '') };
  const m = machineById(machineId);
  return { brand: m.brand, name: m.name, short: m.short };
}

/* Compliance lives in data/compliance.js: the person's own plan (start date
 * and rule), shown only to an account that said it's in a window. */
