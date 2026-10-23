/* Nocta — the splash: Nox gathers out of the night sky.
 *
 *   scattered  faint stars appear across the sky
 *   gather     they spiral in, each landing on Nox's outline (the round
 *              edge, then the bite), in order around the shape, so his
 *              silhouette appears in stars first; three others fly to
 *              where the logo's stars sit
 *   join       a thin line traces through them, like a constellation
 *   light      the moon lights up from its centre out to that outline, and
 *              the outline stars dissolve into its edge (eyes shut)
 *   wake       he blinks awake; his three stars twinkle
 *   moved      (the intro's CSS) the logo glides up into the lockup
 *
 * The finished drawing is the logo itself (components/NoxLogo.jsx), so what
 * the splash lands on is exactly what every other screen shows, and the
 * three stars that end it are the same stars that flew in.
 *
 * Contract (as before): `onResolve` fires once he's awake; the intro holds a
 * beat and moves the box. `settled` (the splash revisited) and reduced
 * motion start on the finished logo. All motion is CSS (onboarding.css ›
 * .nox-reveal); this only places the stars. */
import { useEffect, useId, useRef } from 'react';
import { prefersReducedMotion } from '../lib/motion.jsx';
import { NoxLogoArt, LOGO_STARS } from './NoxLogo.jsx';
import { splashScore } from '../lib/sound.js';

const RESOLVE_MS = 3900; // awake (keep in step with the CSS delays)

/* Nox's outline in the logo's 100-unit box: the moon (48,56.4) r33.6 less
 * the bite (75.2,29.2) r17.6. From where the edge meets the bite, round the
 * far side, then back along the bite's curve. */
export const OUTLINE_PATH = 'M58.27 24.41 A33.6 33.6 0 1 0 79.99 46.13 A17.6 17.6 0 0 1 58.27 24.41 Z';
const OUTLINE_POINTS = [
  [53.92, 23.33], [45.0, 22.93], [36.28, 24.91], [28.4, 29.11], [21.9, 35.24],
  [17.25, 42.86], [14.77, 51.45], [14.64, 60.38], [16.86, 69.03], [21.29, 76.79],
  [27.61, 83.11], [35.37, 87.54], [44.02, 89.76], [52.95, 89.63], [61.54, 87.15],
  [69.16, 82.5], [75.29, 76.0], [79.49, 68.12], [81.47, 59.4], [81.07, 50.48],
  [76.94, 46.71], [70.76, 46.23], [65.14, 43.64], [60.76, 39.26], [58.17, 33.64], [57.69, 27.46],
];

/* each star: where it lands, how far out (and how far round) it starts, and
 * when it sets off. Outline stars leave in order round the shape, so the
 * silhouette draws itself; the logo's stars set off with the first few.
 * Deterministic, so every visit looks the same. */
const DUST = [
  ...OUTLINE_POINTS.map(([x, y], i) => ({ x, y, r: 1.25, i, star: false })),
  ...LOGO_STARS.map((s, k) => ({ x: s.x, y: s.y, r: s.r, i: k * 7 + 3, star: true })),
].map((d, n) => {
  const a = d.i * 2.39996 + n;
  const dist = 78 + ((d.i * 29 + n * 11) % 72);
  return {
    ...d,
    sx: +(Math.cos(a) * dist).toFixed(1),
    sy: +(Math.sin(a) * dist).toFixed(1),
    rot: 150 + ((d.i * 23) % 80), // degrees round the moon on the way in
    delay: d.star ? 120 + d.i * 12 : Math.round((d.i / OUTLINE_POINTS.length) * 520),
  };
});

export function NoxReveal({ className = '', onResolve, settled = false }) {
  const id = useId().replace(/:/g, '');
  const still = settled || prefersReducedMotion();
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;

  useEffect(() => {
    if (still) return undefined;
    const t = setTimeout(() => onResolveRef.current?.(), RESOLVE_MS);
    // its sound: each outline star lands at its own delay + the 2.1 s gather
    const stop = splashScore({
      outline: DUST.filter((d) => !d.star).map((d) => ({ x: d.x, land: d.delay + 2100 })),
    });
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [still]);

  return (
    <div className={`nox-reveal${still ? ' still' : ''} ${className}`}>
      <svg viewBox="0 0 100 100" role="img" aria-label="Nocta">
        <NoxLogoArt id={id} reveal={!still} />
        {!still && (
          <>
            <path className="nr-trace" d={OUTLINE_PATH} pathLength="100" />
            {DUST.map((d, n) => (
              <circle
                key={n}
                className={`nr-dust${d.star ? ' to-star' : ''}`}
                cx={d.x}
                cy={d.y}
                r={d.r}
                style={{ '--sx': `${d.sx}px`, '--sy': `${d.sy}px`, '--rot': `${d.rot}deg`, '--d': `${d.delay}ms` }}
              />
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
