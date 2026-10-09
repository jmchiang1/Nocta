/* Nocta — sound, synthesized with Web Audio (no audio files). A few soft
 * voices the splash scores with: a bell, a breath of filtered air, and a low
 * pad. Everything runs through one shared room reverb so it sits together.
 *
 * Browsers hold audio until the person has interacted with the page, so on a
 * cold load the splash may start silent; the first tap or key anywhere
 * unlocks it. Every call here quietly no-ops while audio isn't running. */

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

/* the context if it's running, else null (and a nudge to resume) */
function ready() {
  if (!init()) return null;
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
    if (!init()) return;
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
