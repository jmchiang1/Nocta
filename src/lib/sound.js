/* Nocta — sound, synthesized with Web Audio (no audio files). A few soft
 * voices the splash scores with: a bell, a breath of filtered air, and a low
 * pad. Everything runs through one shared room reverb so it sits together.
 *
 * Browsers hold audio until the person has interacted with the page, so on a
 * cold load the splash may start silent; the first tap or key anywhere
 * unlocks it. Every call here quietly no-ops while audio isn't running. */

/* the splash's score (splashScore below). It follows the same "Sound
 * effects" switch in Settings as Nox's sounds; false here silences it
 * everywhere (and no audio context is ever made for it). */
export const SOUND_ENABLED = true;

/* Nox's little sounds (landing, hopping, a happy finish) are separate: on
 * unless the person turns "Sound effects" off in Settings (this device). */
const PREF_KEY = 'nocta.soundEffects.v1';
export function soundEffectsOn() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setSoundEffects(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

let ac = null;
let master = null;
let wet = null;
let noiseBuf = null;
let resuming = false;

function init() {
  if (ac) return ac;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ac = new AC();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 3;
  comp.connect(ac.destination);
  master = ac.createGain();
  master.gain.value = 0.8;
  master.connect(comp);
  const room = ac.createConvolver();
  room.buffer = impulse(3.2, 2.8);
  room.connect(master);
  wet = ac.createGain();
  wet.gain.value = 0.5;
  wet.connect(room);
  return ac;
}

/* a generated reverb tail: stereo noise, decaying */
function impulse(seconds, decay) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function noise() {
  if (noiseBuf) return noiseBuf;
  const len = ac.sampleRate * 2;
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/* the context if it's running, else null (and a nudge to resume). `nox`:
 * one of Nox's sounds, which follow the Settings switch, not the splash's */
function ready(nox = false) {
  if (!(nox ? soundEffectsOn() : SOUND_ENABLED && soundEffectsOn()) || !init()) return null;
  if (ac.state !== 'running' && !resuming) {
    resuming = true;
    ac.resume()
      .catch(() => {})
      .finally(() => {
        resuming = false;
      });
  }
  return ac.state === 'running' ? ac : null;
}

// unlock on the first gesture (resume() only succeeds inside one)
if (typeof window !== 'undefined') {
  const GESTURES = ['pointerdown', 'keydown', 'touchend'];
  const unlock = () => {
    if (!soundEffectsOn() || !init()) return;
    ac.resume()
      .then(() => GESTURES.forEach((e) => window.removeEventListener(e, unlock, true)))
      .catch(() => {});
  };
  GESTURES.forEach((e) => window.addEventListener(e, unlock, true));
}

/* send a voice to the speakers: panned, part dry, part into the room */
function route(node, { pan = 0, panTo = pan, dur = 0, send = 0.5 } = {}) {
  let out = node;
  if (ac.createStereoPanner) {
    const p = ac.createStereoPanner();
    p.pan.setValueAtTime(pan, ac.currentTime);
    if (panTo !== pan) p.pan.linearRampToValueAtTime(panTo, ac.currentTime + dur);
    node.connect(p);
    out = p;
  }
  out.connect(master);
  const s = ac.createGain();
  s.gain.value = send;
  out.connect(s);
  s.connect(wet);
}

/* A soft bell. The upper partials ring shorter than the fundamental, which
 * is most of what makes it read as glass rather than a beep. */
const PARTIALS = [
  [1, 1],
  [2, 0.22],
  [2.76, 0.1],
  [5.4, 0.035],
];
export function chime(freq, { gain = 0.08, attack = 0.006, decay = 2, pan = 0, send = 0.6 } = {}) {
  if (!ready()) return;
  const t = ac.currentTime + 0.005;
  const bus = ac.createGain();
  route(bus, { pan, send });
  for (const [ratio, level] of PARTIALS) {
    const d = decay / Math.sqrt(ratio);
    const o = ac.createOscillator();
    o.frequency.value = freq * ratio;
    const env = ac.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain * level, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + attack + d);
    o.connect(env);
    env.connect(bus);
    o.start(t);
    o.stop(t + attack + d + 0.05);
  }
}

/* A breath of air: band-passed noise sweeping from one pitch to another. */
export function breath({ from = 800, to = 2000, dur = 0.4, gain = 0.04, q = 1.4, pan = 0, panTo = pan } = {}) {
  if (!ready()) return;
  const t = ac.currentTime + 0.005;
  const src = ac.createBufferSource();
  src.buffer = noise();
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + dur * 0.5);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.5);
  src.connect(bp);
  bp.connect(env);
  route(env, { pan, panTo, dur, send: 0.6 });
  src.start(t);
  src.stop(t + dur * 1.6);
}

/* A low, slowly breathing pad. Returns a handle to swell or stop it, or null
 * if audio isn't running yet. */
export function pad(freqs, { gain = 0.03, attack = 1.6 } = {}) {
  if (!ready()) return null;
  const t = ac.currentTime;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  lp.Q.value = 0.5;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  lp.connect(env);
  route(env, { send: 0.8 });

  const oscs = freqs.flatMap((f) =>
    [-6, 6].map((cents) => {
      const o = ac.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      return o;
    })
  );
  // the filter opens and closes like slow breathing
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.2;
  const depth = ac.createGain();
  depth.gain.value = 200;
  lfo.connect(depth);
  depth.connect(lp.frequency);
  lfo.start(t);
  oscs.push(lfo);

  let stopped = false;
  const rampTo = (level, secs) => {
    const now = ac.currentTime;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(Math.max(env.gain.value, 0.0001), now);
    env.gain.exponentialRampToValueAtTime(Math.max(level, 0.0001), now + secs);
  };
  return {
    swell(level, secs = 1) {
      if (!stopped) rampTo(level, secs);
    },
    stop(release = 2.5) {
      if (stopped) return;
      stopped = true;
      rampTo(0.0001, release);
      oscs.forEach((o) => o.stop(ac.currentTime + release + 0.05));
    },
  };
}

/* ---- Nox's sounds: short, bright and soft, like a friendly game ----
 * a quick upward "boop" with a tiny glass ping on top; a smaller "bip" for
 * a hop; three rising notes for a happy finish. Quiet by design. */
function blip(t, from, to, { dur = 0.09, gain = 0.07, type = 'triangle', send = 0.25 } = {}) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.7);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(env);
  route(env, { send });
  o.start(t);
  o.stop(t + dur + 0.02);
}
function ping(t, freq, { gain = 0.035, decay = 0.35 } = {}) {
  const o = ac.createOscillator();
  o.frequency.value = freq;
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(env);
  route(env, { send: 0.45 });
  o.start(t);
  o.stop(t + decay + 0.02);
}

/* Nox lands on a page: "boop-bip" */
export function noxLand() {
  if (!ready(true)) return;
  const t = ac.currentTime + 0.01;
  blip(t, 330, 620, { dur: 0.11, gain: 0.08 });
  blip(t + 0.085, 620, 990, { dur: 0.09, gain: 0.06 });
  ping(t + 0.1, 1980);
}

/* a little hop */
export function noxHop(step = 0) {
  if (!ready(true)) return;
  const t = ac.currentTime + 0.01;
  blip(t, 520 + step * 90, 880 + step * 120, { dur: 0.07, gain: 0.05 });
}

/* he's pleased: three notes up, and a sparkle */
export function noxHappy() {
  if (!ready(true)) return;
  const t = ac.currentTime + 0.01;
  [523, 659, 784].forEach((f, i) => blip(t + i * 0.075, f, f * 1.02, { dur: 0.14, gain: 0.06, type: 'sine' }));
  ping(t + 0.24, 2093, { gain: 0.03, decay: 0.5 });
}

/* ---- the splash: Nox gathers out of the night sky (components/NoxReveal)
 * Scored to the animation's own beats (onboarding.css › .nox-reveal):
 *   0 s      a low night-air pad, and a slow breath of air sweeping across
 *   2.1 s    each outline star lands with a soft glass note, round the
 *            shape in order, so the landings rise like a harp glissando
 *   2.25 s   the constellation line draws: a brighter breath
 *   2.7 s    the moon lights: the pad lifts a little (no bell: kept sparse)
 *   4.8 s    the logo rises into the page: the pad lets go
 * All in D major pentatonic, so nothing can clash. Quiet by design. Each cue
 * checks for running audio when it's due, so a tap partway through the
 * splash (which is what unlocks audio in most browsers) still brings in the
 * rest. Returns a stop function. */
const D = 146.83; // D3
const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]; // D E F♯ A B
const note = (step) => D * 2 ** Math.floor(step / 5) * PENTA[((step % 5) + 5) % 5];

export function splashScore({ outline = [] } = {}) {
  const timers = [];
  let bed = null;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  at(0, () => {
    bed = pad([D * 2, D * 3, D * 4], { gain: 0.016, attack: 2.4 }); // D4 A4 D5: air, not bass
    breath({ from: 260, to: 1300, dur: 2.0, gain: 0.018, q: 0.9, pan: -0.6, panTo: 0.6 });
  });
  // the outline stars landing (every other one: a glissando, not a rattle)
  outline.forEach((p, i) => {
    if (i % 2) return;
    at(p.land, () =>
      chime(note(10 + Math.round((i / outline.length) * 9)), {
        gain: 0.022,
        attack: 0.004,
        decay: 1.1,
        pan: (p.x - 50) / 60,
        send: 0.7,
      })
    );
  });
  at(2250, () => breath({ from: 1100, to: 3400, dur: 0.7, gain: 0.012, q: 1.6, pan: 0.3, panTo: -0.3 }));
  at(2700, () => {
    if (!bed) bed = pad([D * 2, D * 3, D * 4], { gain: 0.016, attack: 0.6 });
    bed?.swell(0.022, 1.2);
  });
  at(4800, () => bed?.stop(3.5));

  return () => {
    timers.forEach(clearTimeout);
    bed?.stop(1.2);
  };
}
