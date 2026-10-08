/* Nocta — the splash swirl. The whole screen fills with palette lines swirling
 * around the logo like a slow current; they're drawn inward and dissolve into
 * the ring while a core of strands spirals together into the twisted ribbon of
 * the logo. Every strand slides along its own path the whole time, so the
 * motion never stops — once formed, the ribbon's stripes keep flowing.
 *
 * When `handoff` turns true the real artwork (public/Nocta-logo.svg) crossfades
 * in over the drawn ribbon and the canvas retires. The box this component lays
 * out may move and resize meanwhile (the intro glides it into a corner); the
 * drawing follows it every frame.
 *
 * Canvas, because it's several hundred depth-sorted strokes a frame. Under
 * prefers-reduced-motion only the artwork shows. Canvas can't read CSS
 * variables, so colors are pulled from :root at start. */
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion.jsx';

/* Logo geometry, in the source artwork's pixel space (2076×2048). The ribbon is
 * described in polar coordinates around the center of the hole: Fourier fits
 * [cos, sin] of its centerline radius and half-width, measured off the artwork
 * (max error ~3px of 2076). If the logo art changes, these need re-measuring. */
const IMG_W = 2076;
const IMG_H = 2048;
const CX = 1019;
const CY = 1087;
const MID = [[535.7, 0], [0.4, 9.0], [-20.9, 0.4], [0.1, 39.2], [7.6, -0.2], [-0.2, -2.4], [-4.0, -0.1]];
const HALF = [[166.4, 0], [0, -4.1], [-5.5, 0.2], [-0.2, 26.3], [1.0, -0.2], [-0.1, -0.8], [-2.4, 0]];
const TAU = Math.PI * 2;

/* Core strands — the ones that become the logo. Each runs two laps (4π) and
 * turns 1.5 half-twists per lap, so a full strand closes on itself and the
 * ribbon pinches on its three sides. Strand colors sweep white → peach →
 * white across the ribbon, like the artwork's pale bands. */
const STRANDS = 12;
const TWIST = 1.5;
const LAPS = 4 * Math.PI;
const SEGMENTS = 64; // depth-sorted pieces per closed strand
const SUB = 4; // points per piece
const FROM = ['--data-1', '--accent', '--stage-rem', '--accent-soft', '--data-2', '--accent-hi', '--accent-deep', '--text-primary'];
const BANDS = ['--text-primary', '--accent-hi', '--accent-soft', '--accent', '--accent-soft', '--accent-hi'];
const FLOW = 1.2; // rad/s — the steady pace the formed ribbon keeps turning at

/* Field lines — the full-screen current. Count scales with screen area. */
const FIELD_DENSITY = 220; // lines on a 390×844 screen
const FIELD_COLORS = ['--data-1', '--data-2', '--stage-rem', '--data-deep', '--accent', '--accent-soft', '--accent-hi', '--accent-deep', '--text-primary'];

/* timeline, ms. The current starts lazy and gathers speed (SPIN_UP) as it's
 * drawn in, so the logo forms at the fastest point, then settles to FLOW. */
const SPIN_UP = 1600; // field lines go from a drift to full speed over this
const PULL_AT = 400; // field lines start drawing inward
const PULL_SPREAD = 500;
const PULL = 1350;
const CONVERGE_AT = 600; // core strands start locking in
const STAGGER = 40;
const CONVERGE = 1300;
const RESOLVE_AT = CONVERGE_AT + STAGGER * (STRANDS - 1) + CONVERGE;
const HANDOFF = 700; // canvas → artwork crossfade; matches .swirl-logo in onboarding.css

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fourier = (f, t) => f.reduce((sum, [a, b], k) => sum + a * Math.cos(k * t) + b * Math.sin(k * t), 0);
const rand = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* The Fourier fits, tabulated — they're sampled ~6k times a frame. */
const LUT_N = 1024;
const tabulate = (f) => Float32Array.from({ length: LUT_N + 1 }, (_, i) => fourier(f, (i / LUT_N) * TAU));
const MID_LUT = tabulate(MID);
const HALF_LUT = tabulate(HALF);
const lookup = (tab, a) => {
  let x = (a / TAU) % 1;
  if (x < 0) x += 1;
  const f = x * LUT_N;
  const i = f | 0;
  return tab[i] + (tab[i + 1] - tab[i]) * (f - i);
};

function tokenRGB(styles, name) {
  const hex = styles.getPropertyValue(name).trim().replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* Color at position x ∈ [0, 1) along a cyclic list of colors. */
function cyclic(colors, x) {
  const f = (((x % 1) + 1) % 1) * colors.length;
  const i = Math.floor(f);
  return mix(colors[i], colors[(i + 1) % colors.length], f - i);
}

/* Offset of `el` within `stage`, in layout px (immune to the desktop frame's scale). */
function offsetWithin(el, stage) {
  let x = 0;
  let y = 0;
  for (let node = el; node && node !== stage; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return [x, y];
}

/* `stageRef` is the element the swirl fills — the splash screen itself. */
export function SwirlLogo({ className = '', stageRef, onResolve, handoff = false }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const [done, setDone] = useState(prefersReducedMotion);

  // once the artwork has crossfaded in, retire the canvas
  useEffect(() => {
    if (!handoff || done) return undefined;
    const t = setTimeout(() => setDone(true), HANDOFF);
    return () => clearTimeout(t);
  }, [handoff, done]);

  useEffect(() => {
    if (done) {
      if (prefersReducedMotion()) onResolveRef.current?.();
      return undefined;
    }
    const wrap = wrapRef.current;
    const stage = stageRef?.current ?? wrap.offsetParent;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    let hasResolved = false;
    const resolve = () => {
      if (hasResolved) return;
      hasResolved = true;
      onResolveRef.current?.();
    };
    if (!ctx || !stage) {
      resolve();
      setDone(true);
      return undefined;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let geo = null;
    // canvas covers the stage; it sits in the logo box, so offset it back out
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
      const scale = Math.min(boxW / IMG_W, boxH / IMG_H);
      const ox = bx + (boxW - IMG_W * scale) / 2;
      const oy = by + (boxH - IMG_H * scale) / 2;
      geo = { cw, ch, bx, by, scale, ox, oy, lx: ox + CX * scale, ly: oy + CY * scale, ring: MID[0][0] * scale * 1.05 };
      return geo;
    };
    layout();

    const styles = getComputedStyle(document.documentElement);
    const bg = tokenRGB(styles, '--bg-base');
    const fieldColors = FIELD_COLORS.map((name) => tokenRGB(styles, name));
    const bands = BANDS.map((name) => tokenRGB(styles, name));

    // lock-in order, shuffled so neighbouring strands don't land in sequence
    const order = Array.from({ length: STRANDS }, (_, i) => i).sort((a, b) => rand(a, 30) - rand(b, 30));
    const strands = Array.from({ length: STRANDS }, (_, i) => {
      const start = CONVERGE_AT + order.indexOf(i) * STAGGER;
      return {
        phase: (Math.PI * i) / STRANDS,
        from: tokenRGB(styles, FROM[i % FROM.length]),
        to: cyclic(bands, i / STRANDS),
        start,
        lockEnd: start + CONVERGE,
        radius: 500 + rand(i, 1) * 1000,
        wobble: 0.06 + rand(i, 2) * 0.1,
        wobbleSpeed: 1.5 + rand(i, 3) * 2.5,
        // extra travel spun off on the way in. A multiple of 2π/3 so that,
        // with 1.5 half-twists per lap, every strand lands evenly spaced.
        boost: (TAU / 3) * (3 + Math.floor(rand(i, 4) * 3)),
        head: rand(i, 5) * TAU,
        trail: (0.5 + rand(i, 6) * 0.7) * Math.PI,
        drift: 60 + rand(i, 7) * 160,
        driftAngle: rand(i, 8) * TAU,
        depth: rand(i, 9) * 2 - 1,
      };
    });

    const { cw: cw0, ch: ch0, lx: lx0, ly: ly0, ring: ring0 } = geo;
    const reach = Math.hypot(Math.max(lx0, cw0 - lx0), Math.max(ly0, ch0 - ly0));
    const fieldCount = Math.round(Math.min(320, Math.max(140, ((cw0 * ch0) / (390 * 844)) * FIELD_DENSITY)));
    const field = Array.from({ length: fieldCount }, (_, i) => ({
      // sqrt spreads lines evenly by area rather than bunching at the center
      r0: ring0 * 1.3 + (reach - ring0 * 1.3) * Math.sqrt(rand(i, 11)),
      theta: rand(i, 12) * TAU,
      speed: 0.8 + rand(i, 13) * 1.1,
      len: 70 + rand(i, 14) * 260,
      width: 0.6 + Math.pow(rand(i, 15), 2) * 1.8,
      alpha: 0.3 + rand(i, 16) * 0.55,
      color: fieldColors[Math.floor(rand(i, 17) * fieldColors.length)],
      wobble: 0.02 + rand(i, 18) * 0.08,
      phase: rand(i, 19) * TAU,
      pullAt: PULL_AT + rand(i, 20) * PULL_SPREAD,
    }));
    let fieldGone = false;

    /* The current: each line orbits the logo, faster the closer it gets, then
     * is drawn into the ring and dissolves there. */
    const drawField = (t, dt) => {
      const { lx, ly, ring } = geo;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;
      let visible = 0;
      for (const f of field) {
        const p = easeInOut(clamp01((t - f.pullAt) / PULL));
        const r = f.r0 + (ring - f.r0) * p;
        const ramp = 0.15 + 1.1 * smoothstep(0, SPIN_UP, t); // slow start, then speed up
        f.theta += f.speed * ramp * Math.pow((ring * 1.6) / r, 0.65) * dt;
        const alpha = f.alpha * (1 - smoothstep(0.72, 1, p));
        if (alpha < 0.01) continue;
        visible += 1;

        const arc = Math.min(f.len / r, 1.3 * Math.PI);
        const n = Math.min(48, Math.max(6, Math.ceil((arc * r) / 8)));
        const wob = f.phase + t * 0.0012;
        ctx.beginPath();
        let tx;
        let ty;
        let hx;
        let hy;
        for (let k = 0; k <= n; k += 1) {
          const back = 1 - k / n; // 1 at the tail, 0 at the head
          const a = f.theta - arc * back;
          const rr = r * (1 + 0.1 * back) * (1 + f.wobble * Math.sin(3 * a + wob));
          hx = lx + rr * Math.cos(a);
          hy = ly + rr * Math.sin(a);
          if (k === 0) {
            ctx.moveTo(hx, hy);
            tx = hx;
            ty = hy;
          } else {
            ctx.lineTo(hx, hy);
          }
        }
        const [cr, cg, cb] = f.color;
        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0)`);
        grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, ${alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = f.width;
        ctx.stroke();
      }
      if (t > PULL_AT + PULL_SPREAD + PULL && visible === 0) fieldGone = true;
    };

    /* The core: strands spiral in and lock into the ribbon, drawn as
     * depth-sorted pieces so the twist reads as 3D. */
    const drawCore = (t) => {
      const pieces = [];
      for (const s of strands) {
        const e = easeInOut(clamp01((t - s.start) / CONVERGE));
        // distance travelled along the path: a gentle start that speeds up,
        // then eases back to FLOW as it locks in, never to a stop
        const travel = (FLOW * t) / 1000 + s.boost * easeInOut(clamp01(t / s.lockEnd));
        const len = s.trail + (LAPS - s.trail) * e;
        const count = Math.max(8, Math.round((SEGMENTS * len) / LAPS));
        const drift = s.drift * (1 - e);
        const dx = Math.cos(s.driftAngle + t * 0.0012) * drift;
        const dy = Math.sin(s.driftAngle + t * 0.0012) * drift;
        const wob = t * 0.001 * s.wobbleSpeed + s.phase * 4;

        // p is the strand's own coordinate (the twist rides on it); v is where
        // that point currently sits around the loop
        const pts = [];
        for (let j = 0; j <= count * SUB; j += 1) {
          const p = s.head - len + (len * j) / (count * SUB);
          const v = p + travel;
          const loose = s.radius * (1 + s.wobble * Math.sin(2 * v + wob));
          const tight = lookup(MID_LUT, v) + 0.84 * Math.cos(s.phase + TWIST * p) * lookup(HALF_LUT, v);
          const r = loose + (tight - loose) * e;
          pts.push(CX + dx + r * Math.cos(v), CY + dy + r * Math.sin(v));
        }

        const base = mix(s.from, s.to, e);
        for (let k = 0; k < count; k += 1) {
          const pos = (k + 0.5) / count; // 0 at the tail, 1 at the head
          const p = s.head - len + len * pos;
          const looseZ = s.depth + 0.4 * Math.sin(p + t * 0.002);
          const z = looseZ + (Math.sin(s.phase + TWIST * p) - looseZ) * e;
          const c = mix(base, bg, (1 - (z + 1) / 2) * 0.32 * e); // back of the ribbon sits in shadow
          pieces.push({
            z,
            pts,
            from: k * SUB,
            alpha: Math.pow(pos, 1.3) * (1 - e) + e,
            color: `rgb(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0})`,
            width: 13 + 31 * e,
          });
        }
      }

      pieces.sort((a, b) => a.z - b.z);
      const { scale, ox, oy } = geo;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      ctx.lineJoin = 'round';
      for (const p of pieces) {
        ctx.globalAlpha = p.alpha;
        // butt caps while translucent so overlapping joints don't bead
        ctx.lineCap = p.alpha > 0.99 ? 'round' : 'butt';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        ctx.moveTo(p.pts[p.from * 2], p.pts[p.from * 2 + 1]);
        for (let j = p.from + 1; j <= p.from + SUB; j += 1) {
          ctx.lineTo(p.pts[j * 2], p.pts[j * 2 + 1]);
        }
        ctx.stroke();
      }
    };

    let raf;
    let t0;
    let last;
    const frame = (now) => {
      if (t0 == null) t0 = last = now;
      const t = now - t0;
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      layout();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!fieldGone) drawField(t, dt);
      drawCore(t);
      if (t >= RESOLVE_AT) resolve();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [done, stageRef]);

  return (
    <div ref={wrapRef} className={`swirl-logo${handoff || done ? ' handoff' : ''} ${className}`}>
      {!done && <canvas ref={canvasRef} className="swirl-logo-canvas" aria-hidden="true" />}
      <img className="swirl-logo-img" src="/Nocta-logo.svg" alt="Nocta" />
    </div>
  );
}
