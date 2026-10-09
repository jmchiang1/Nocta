/* Nocta — the splash: find the constellation in the night sky.
 *
 *   hidden   the six stars of the logo sit in the sky as ordinary faint,
 *            twinkling stars — you wouldn't pick them out
 *   found    one by one, left to right, each brightens and swells to its
 *            place in the mark with a soft ping; the crest star turns peach
 *   joined   the lines draw dot to dot along the breath
 *   moved    (driven by the intro's CSS) the mark glides to the top centre;
 *            once it lands, the artwork (public/Nocta-constellation.svg)
 *            crossfades in over the drawing and the canvas retires
 *
 * Contract (same as the old swirl): `onResolve` fires once the constellation
 * is joined; `handoff` turns true when the intro starts moving the logo box.
 * The box may move/resize meanwhile — the drawing follows it every frame,
 * re-weighting lines and dots for its current size (constellationWeights),
 * so it lands looking exactly like the artwork.
 *
 * Sound (lib/sound.js) follows the same timeline: a low pad comes up with the
 * sky, each star rings a bell as it's found, each line draws with a breath of
 * air, the closed constellation blooms into a chord, and the glide to the top
 * rises with a swell and settles with one soft note.
 * Reduced motion: only the artwork shows, silently. */
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { CONSTELLATION, constellationWeights } from '../data/constellation.js';
import * as sound from '../lib/sound.js';

const { viewBox: VB, nodes: NODES, lines: LINES, hero: HERO, radius: RADIUS } = CONSTELLATION;
const TAU = Math.PI * 2;

/* timeline, ms */
const FADE_IN = 600; // the hidden stars appear with the sky
const FIND_AT = 1300; // the first star lights up
const FIND_STAGGER = 170;
const FIND_DUR = 560;
const JOIN_AT = FIND_AT + FIND_STAGGER * 2 + 200; // lines follow a beat behind the lights
const JOIN_STAGGER = 170;
const JOIN_DUR = 320;
const JOINED = JOIN_AT + JOIN_STAGGER * (LINES.length - 1) + JOIN_DUR;
const RESOLVE_AT = JOINED + 160;
const MOVE_MS = 850; // matches the .ob-intro-logo transition
const SWAP_MS = 600; // canvas → artwork crossfade (.swirl-logo-img transition)

/* the score. Each star's bell is pitched by its height in the mark, so the
 * breathing wave plays as a melody (D major pentatonic, low star = D5, crest
 * = D6); bells and breaths pan with the stars, left to right. */
const SCALE = [0, 2, 4, 7, 9, 12]; // semitones above D5
const D5 = 587.33;
const NODE_YS = NODES.map((n) => n.y);
const LOWEST = Math.max(...NODE_YS);
const HIGHEST = Math.min(...NODE_YS);
const height = (n) => (LOWEST - n.y) / (LOWEST - HIGHEST); // 0 low … 1 crest
const pitch = (n) => D5 * Math.pow(2, SCALE[Math.round(height(n) * (SCALE.length - 1))] / 12);
const panOf = (n) => (((n.x - VB[0]) / VB[2]) * 2 - 1) * 0.6;
const PAD = [146.83, 220]; // D3 + A3, under the sky
const BLOOM = [293.66, 440, 587.33, 739.99]; // D4 A4 D5 F♯5, when it closes

function ringStar(i) {
  const n = NODES[i];
  const pan = panOf(n);
  if (i === HERO) {
    // the crest star: brighter and longer, with an octave underneath
    sound.chime(pitch(n), { gain: 0.1, decay: 3.2, pan });
    sound.chime(pitch(n) / 2, { gain: 0.05, attack: 0.03, decay: 3.6, pan });
  } else {
    sound.chime(pitch(n), { gain: 0.07, decay: 2.2, pan });
  }
}
function drawLine(j) {
  const [a, b] = LINES[j].map((k) => NODES[k]);
  sound.breath({
    from: 700 + 1500 * height(a),
    to: 700 + 1500 * height(b),
    dur: JOIN_DUR / 1000,
    gain: 0.035,
    pan: panOf(a),
    panTo: panOf(b),
  });
}
function bloom() {
  BLOOM.forEach((f, i) => sound.chime(f, { gain: 0.035, attack: 0.25 + i * 0.06, decay: 4, send: 0.8 }));
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => {
  const c = 1.5;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgba = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(0, Math.min(1, a))})`;

function tokenRGB(styles, name) {
  const hex = styles.getPropertyValue(name).trim().replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function offsetWithin(el, stage) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== stage; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return [x, y];
}

export function ConstellationReveal({ className = '', stageRef, onResolve, handoff = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const [swap, setSwap] = useState(prefersReducedMotion); // artwork showing
  const [done, setDone] = useState(prefersReducedMotion); // canvas retired

  // wait for the glide to the top to finish, then crossfade to the artwork
  useEffect(() => {
    if (!handoff || swap) return undefined;
    // the glide rises with a swell of air
    sound.breath({ from: 260, to: 2600, dur: MOVE_MS / 1000, gain: 0.06, q: 0.6 });
    const t = setTimeout(() => setSwap(true), MOVE_MS);
    return () => clearTimeout(t);
  }, [handoff, swap]);
  useEffect(() => {
    if (!swap || done) return undefined;
    // …and settles with one soft, low note as the artwork lands
    sound.chime(D5 / 2, { gain: 0.05, attack: 0.02, decay: 2.6 });
    const t = setTimeout(() => setDone(true), SWAP_MS);
    return () => clearTimeout(t);
  }, [swap, done]);

  useEffect(() => {
    if (done) {
      if (prefersReducedMotion()) onResolveRef.current?.();
      return undefined;
    }
    const wrap = wrapRef.current;
    const stage = stageRef?.current ?? wrap.offsetParent;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let resolved = false;
    const resolve = () => {
      if (resolved) return;
      resolved = true;
      onResolveRef.current?.();
    };
    if (!ctx || !stage) {
      resolve();
      setSwap(true);
      setDone(true);
      return undefined;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let geo = null;
    // the canvas covers the whole stage (so pings can spill past the box);
    // the mark maps into the box exactly as the <img> would (contain, centred)
    const layout = () => {
      const boxW = wrap.offsetWidth;
      const boxH = wrap.offsetHeight;
      const cw = stage.offsetWidth;
      const ch = stage.offsetHeight;
      const [bx, by] = offsetWithin(wrap, stage);
      if (!geo || geo.cw !== cw || geo.ch !== ch) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
      }
      if (!geo || geo.bx !== bx || geo.by !== by) {
        canvas.style.left = `${-bx}px`;
        canvas.style.top = `${-by}px`;
      }
      const scale = Math.min(boxW / VB[2], boxH / VB[3]);
      geo = {
        cw,
        ch,
        bx,
        by,
        scale,
        ox: bx + (boxW - VB[2] * scale) / 2 - VB[0] * scale,
        oy: by + (boxH - VB[3] * scale) / 2 - VB[1] * scale,
        w: { ...constellationWeights(VB[2] * scale) },
      };
      return geo;
    };
    layout();
    const at = (n) => [geo.ox + n.x * geo.scale, geo.oy + n.y * geo.scale];

    const styles = getComputedStyle(document.documentElement);
    const white = tokenRGB(styles, '--text-primary');
    const lineC = tokenRGB(styles, '--stage-rem');
    const peach = tokenRGB(styles, '--accent-soft');
    // the hidden stars' disguise: sky-star sizes and their own twinkle
    const hidden = NODES.map((_, i) => ({
      r: 1.1 + ((i * 7) % 5) * 0.12,
      tw: 1.4 + ((i * 3) % 4) * 0.5,
      tp: i * 1.7,
    }));

    // sound cues fire as the timeline passes them; a cue missed while audio
    // is still locked is skipped, never replayed late
    let pad = null;
    let rung = 0;
    let drawn = 0;
    let bloomed = false;
    const score = (t) => {
      if (!pad && t < JOINED) pad = sound.pad(PAD);
      while (rung < NODES.length && t >= FIND_AT + rung * FIND_STAGGER) ringStar(rung++);
      while (drawn < LINES.length && t >= JOIN_AT + drawn * JOIN_STAGGER) drawLine(drawn++);
      if (!bloomed && t >= JOINED) {
        bloomed = true;
        bloom();
        pad?.swell(0.045, 0.8);
      }
    };

    let raf;
    let t0;
    const frame = (now) => {
      if (t0 == null) t0 = now;
      const t = now - t0;
      score(t);
      layout();
      const { scale, w } = geo;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';

      /* joined: lines draw dot to dot, under the stars */
      ctx.lineWidth = w.line * scale;
      ctx.strokeStyle = rgba(lineC, 0.78);
      LINES.forEach(([a, b], j) => {
        const p = easeOut(clamp01((t - JOIN_AT - j * JOIN_STAGGER) / JOIN_DUR));
        if (p <= 0) return;
        const [x1, y1] = at(NODES[a]);
        const [x2, y2] = at(NODES[b]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p);
        ctx.stroke();
      });

      /* the stars: hidden → found */
      const appear = clamp01(t / FADE_IN);
      const haloFade = 1 - clamp01((t - JOINED) / 700);
      NODES.forEach((n, i) => {
        const [x, y] = at(n);
        const k = clamp01((t - FIND_AT - i * FIND_STAGGER) / FIND_DUR);
        const e = easeOutBack(k);
        const h = hidden[i];
        const full = RADIUS[n.size] * w.dot * scale;
        const r = Math.max(0.4, h.r + (full - h.r) * e);
        const twinkle = 0.62 + 0.38 * Math.sin(t * 0.001 * h.tw + h.tp);
        const alpha = appear * (k <= 0 ? 0.55 * twinkle : 0.55 + 0.45 * clamp01(k * 1.6));
        const color = i === HERO ? mix(white, peach, easeOut(k)) : white;

        if (k > 0) {
          // a soft halo while it's being found, gone by the time it lands
          const halo = ctx.createRadialGradient(x, y, 0, x, y, full * 3.2);
          halo.addColorStop(0, rgba(i === HERO ? peach : white, 0.28 * Math.min(1, k * 2) * haloFade));
          halo.addColorStop(1, rgba(white, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y, full * 3.2, 0, TAU);
          ctx.fill();
          if (k < 1) {
            // the "found it" ping: one ring expanding out and fading
            ctx.strokeStyle = rgba(i === HERO ? peach : white, 0.55 * (1 - k));
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, full * (1 + 2.6 * easeOut(k)), 0, TAU);
            ctx.stroke();
          }
        }
        ctx.fillStyle = rgba(color, alpha);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      });

      if (t >= RESOLVE_AT) resolve();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      pad?.stop(2.5); // the pad fades out as the canvas retires
    };
  }, [done, stageRef]);

  return (
    <div ref={wrapRef} className={`swirl-logo constellation-reveal${swap ? ' handoff' : ''} ${className}`}>
      {!done && <canvas ref={canvasRef} className="swirl-logo-canvas" aria-hidden="true" />}
      <img className="swirl-logo-img" src="/Nocta-constellation.svg" alt="Nocta" />
    </div>
  );
}
