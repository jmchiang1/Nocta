/* Nocta — onboarding: meet Nox, the Coach. A small peach moon with an
 * entrance:
 *   fly    spirals in from the bottom-left on a smooth path (no waypoints),
 *          spinning, eyes squeezed shut, a little peach sparkle trail behind
 *   land   a jelly wobble (squash & stretch springing out), eyes pop open
 *   hop    a happy double hop, with a head-wiggle
 *   idle   settles into a gentle float, glancing around and blinking
 * Driven by requestAnimationFrame (transforms on refs, no re-renders) so the
 * path is one continuous curve. Then the copy: what Nox does; the one thing
 * he won't sits with the button as fine print. Reduced motion: he's simply there. */
import { useEffect, useRef, useState } from 'react';
import { Mascot } from '../components/Mascot.jsx';
import { prefersReducedMotion } from '../lib/motion.jsx';

export const COACH_NAME = 'Nox';

/* timeline, ms */
const FLY = 1050; // spiral in
const JELLY = 620; // landing wobble
const HOP_AT = FLY + JELLY; // first hop
const HOPS = [
  { dur: 430, h: 26 },
  { dur: 320, h: 11 },
];
const END = HOP_AT + HOPS.reduce((s, h) => s + h.dur, 0);
const TRAIL = 9; // sparkle dots

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/* where Nox is at time t: offset from his resting spot, rotation, scale and
 * squash. One continuous function, so the motion never kinks. */
function pose(t) {
  if (t < FLY) {
    const p = easeOutCubic(t / FLY);
    // an elliptical spiral that closes on the rest point: 1.15 turns
    const r = 330 * (1 - p);
    const theta = 2.4 + Math.PI * 2 * 1.15 * p;
    return {
      x: r * Math.cos(theta),
      y: r * Math.sin(theta) * 0.75,
      rot: -760 * (1 - p),
      scale: 0.22 + 0.78 * Math.pow(p, 0.7),
      sx: 1,
      sy: 1,
      flying: 1 - p,
    };
  }
  if (t < HOP_AT) {
    // jelly: squash on contact, springing out in a decaying wobble
    const u = t - FLY;
    const k = Math.exp(-u / 170) * Math.cos(u / 42);
    return { x: 0, y: 0, rot: 0, scale: 1, sx: 1 + 0.2 * k, sy: 1 - 0.22 * k, flying: 0 };
  }
  // two happy hops, each with a squash at take-off and landing
  let u = t - HOP_AT;
  for (const hop of HOPS) {
    if (u < hop.dur) {
      const f = u / hop.dur;
      const air = Math.sin(Math.PI * f);
      const contact = Math.max(0, 1 - Math.min(f, 1 - f) * 7); // near the ground
      return {
        x: 0,
        y: -hop.h * air,
        rot: 7 * Math.sin(Math.PI * 2 * f) * (hop.h / 26), // head wiggle
        scale: 1,
        sx: 1 + 0.1 * contact - 0.04 * air,
        sy: 1 - 0.12 * contact + 0.07 * air,
        flying: 0,
      };
    }
    u -= hop.dur;
  }
  return { x: 0, y: 0, rot: 0, scale: 1, sx: 1, sy: 1, flying: 0 };
}

// the first frame of the flight, so he doesn't flash at his resting spot
const P0 = pose(0);
const START_STYLE = { transform: `translate(${P0.x}px, ${P0.y}px) rotate(${P0.rot}deg) scale(${P0.scale})` };

export function MeetCoach({ next }) {
  const still = prefersReducedMotion();
  // asleep (eyes shut, spinning) → waking (pop + blink on landing) → idle
  const [mood, setMood] = useState(still ? 'idle' : 'asleep');
  const flyRef = useRef(null);
  const squashRef = useRef(null);
  const trailRefs = useRef([]);

  useEffect(() => {
    if (still) return undefined;
    const timers = [setTimeout(() => setMood('waking'), FLY), setTimeout(() => setMood('idle'), END + 200)];
    const history = [];
    let raf;
    let t0;
    const frame = (now) => {
      if (t0 == null) t0 = now;
      const t = now - t0;
      const p = pose(Math.min(t, END));
      if (flyRef.current) {
        flyRef.current.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.scale})`;
      }
      if (squashRef.current) squashRef.current.style.transform = `scale(${p.sx}, ${p.sy})`;
      // the sparkle trail: dots at where Nox was a few frames ago
      history.unshift([p.x, p.y]);
      history.length = Math.min(history.length, TRAIL * 2 + 1);
      trailRefs.current.forEach((el, k) => {
        if (!el) return;
        const at = history[(k + 1) * 2] || history[history.length - 1];
        const a = p.flying * (1 - k / TRAIL) * 0.9;
        el.style.opacity = String(Math.max(0, a));
        el.style.transform = `translate(${at[0]}px, ${at[1]}px) scale(${1 - k / (TRAIL + 2)})`;
      });
      if (t < END + 60) raf = requestAnimationFrame(frame);
      else {
        if (flyRef.current) flyRef.current.style.transform = '';
        if (squashRef.current) squashRef.current.style.transform = '';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [still]);

  return (
    <>
      <div className="ob-body">
        <div className="ob-content center mc-screen">
          <div className={`mc-stage${still ? ' still' : ''}`} aria-hidden="true">
            <span className="mc-halo" />
            <span className="mc-land-ring" />
            {Array.from({ length: TRAIL }, (_, k) => (
              <span key={k} className="mc-spark" ref={(el) => (trailRefs.current[k] = el)} />
            ))}
            <span className="mc-fly" ref={flyRef} style={still ? undefined : START_STYLE}>
              <span className="mc-squash" ref={squashRef}>
                <span className="mc-float">
                  <Mascot size={120} state={mood} />
                </span>
              </span>
            </span>
          </div>

          <div className="mc-eyebrow">Your sleep coach</div>
          <h1 className="ob-title">Meet {COACH_NAME}</h1>
          <p className="ob-copy">
            Every morning, {COACH_NAME} reads your CPAP data and explains it in plain words.
            Ask him why a night went the way it did, or what to try next.
          </p>
        </div>
      </div>
      <div className="ob-foot mc-foot">
        <p className="ob-foot-note">
          {COACH_NAME} won’t change your pressure or name a condition. That’s always your
          doctor’s call.
        </p>
        <button className="btn primary" onClick={next}>
          Continue
        </button>
      </div>
    </>
  );
}
