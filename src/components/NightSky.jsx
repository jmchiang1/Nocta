/* Nocta — the night sky (Tonight backdrop + the first-run flow).
 *
 * Three slow-drifting glows in the app's blues + REM lavender (peach stays
 * reserved for Nocta's AI), a seeded star field in three tiers, soft clouds,
 * and weather that reflects the night — clear / bright / hazy / overcast /
 * faint (always the same blues: a condition, never a red/green grade). The
 * condition only sets CSS variables (.sky-clear etc. in motion.css), so the
 * sky eases between nights instead of cutting.
 *
 * Options for the first-run screens:
 *   twinkle — share of stars that twinkle (0–1)
 *   comets  — an occasional comet streaks across: random timing (6.5–13 s
 *             apart), angle and length, one at a time
 * Reduced motion: nothing twinkles, drifts or flies (global rule + JS gate). */
import { useEffect, useMemo, useState } from 'react';
import { mulberry32, hashStr } from '../lib/format.js';
import { prefersReducedMotion } from '../lib/motion.jsx';

/* why-card state → sky weather (Tonight) */
export const SKY_FOR_STATE = {
  steady: 'clear',
  win: 'bright',
  anomaly: 'hazy',
  escalation: 'overcast',
  insufficient_data: 'faint',
};

const TIERS = [
  { cls: 't1', count: 9, size: [1.8, 2.6], alpha: [0.8, 1] }, // bright, soft glow
  { cls: 't2', count: 20, size: [1.1, 1.7], alpha: [0.5, 0.8] },
  { cls: 't3', count: 34, size: [0.7, 1.1], alpha: [0.3, 0.55] }, // faint
];

function makeStars(seed, twinkle) {
  const rnd = mulberry32(hashStr(seed));
  const lerp = ([a, b]) => a + rnd() * (b - a);
  const out = [];
  TIERS.forEach((t) => {
    for (let i = 0; i < t.count; i += 1) {
      out.push({
        key: `${t.cls}-${i}`,
        cls: t.cls,
        left: rnd() * 100,
        top: Math.pow(rnd(), 1.4) * 82, // denser high in the sky
        size: lerp(t.size),
        a: lerp(t.alpha),
        tw: rnd() < twinkle,
        t: 2.4 + rnd() * 4.4, // twinkle period
        d: -rnd() * 6, // already mid-twinkle on arrival
      });
    }
  });
  return out;
}

function useComets(enabled, firstMs) {
  const [comet, setComet] = useState(null);
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return undefined;
    let timer;
    let n = 0;
    const launch = (wait) => {
      timer = setTimeout(() => {
        const r = Math.random;
        const fromLeft = r() > 0.35; // most streak left → right, falling
        const tilt = 14 + r() * 18;
        setComet({
          id: (n += 1),
          top: 4 + r() * 28,
          left: fromLeft ? -8 + r() * 40 : 52 + r() * 40,
          angle: fromLeft ? tilt : 180 - tilt,
          dur: 1.1 + r() * 0.7,
          len: 90 + r() * 80,
        });
        launch(6500 + Math.random() * 6500);
      }, wait);
    };
    launch(firstMs);
    return () => clearTimeout(timer);
  }, [enabled, firstMs]);
  return [comet, () => setComet(null)];
}

export function NightSky({
  condition = 'clear',
  seed = 'nocta-sky',
  twinkle = 0.35,
  comets = false,
  firstCometMs = 2200,
  className = '',
}) {
  const stars = useMemo(() => makeStars(seed, twinkle), [seed, twinkle]);
  const [comet, clearComet] = useComets(comets, firstCometMs);

  return (
    <div className={`sky sky-${condition}${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="sky-glow a" />
      <span className="sky-glow b" />
      <span className="sky-glow c" />

      <div className="sky-stars">
        {stars.map((s) => (
          <i
            key={s.key}
            className={`${s.cls}${s.tw ? ' tw' : ''}`}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              '--a': s.a,
              '--t': `${s.t}s`,
              '--d': `${s.d}s`,
            }}
          />
        ))}
      </div>

      <div className="sky-clouds">
        <i className="c1" />
        <i className="c2" />
        <i className="c3" />
        <i className="c4" />
        <i className="c5" />
      </div>

      {/* the scripted shooting star on the best nights (CSS: .sky-bright) */}
      <span className="sky-meteor" />

      {comet && (
        <span
          key={comet.id}
          className="sky-comet-path"
          style={{ top: `${comet.top}%`, left: `${comet.left}%`, transform: `rotate(${comet.angle}deg)` }}
        >
          <span
            className="sky-comet"
            style={{ '--cd': `${comet.dur}s`, '--len': `${comet.len}px` }}
            onAnimationEnd={clearComet}
          />
        </span>
      )}
    </div>
  );
}
