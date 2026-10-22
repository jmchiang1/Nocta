/* Nocta — the logo: Nox with a few stars around him (the night he lives in).
 *
 * Nox on his own (components/Mascot.jsx) is the character: the coach, the
 * moments he reacts. The logo is Nox plus three stars, used wherever Nocta
 * signs its name: the splash, sign-in, the welcome, the sidebar, the icons.
 * public/nocta-mark.svg, nocta-mark-sm.svg and favicon.svg are this same
 * drawing as files (for <img> and the browser).
 *
 * Geometry is Mascot's (100 × 100 box), drawn at 80% and set down-left so
 * the stars have the top-right sky: moon (50,53) r42, bite (84,19) r22,
 * eyes 8.5 × 17 at x 37 / 55. `small` is Mascot's simpler optical size
 * (≤ ~40 px): a bigger bite and eyes, no craters, two bolder stars. */
import { useId } from 'react';

export const LOGO_NOX = 'translate(8 14) scale(0.8)';
export const LOGO_STARS = [
  { x: 80, y: 12, r: 2.6 },
  { x: 92, y: 25, r: 1.8 },
  { x: 14, y: 17, r: 1.8 },
];
const LOGO_STARS_SM = [
  { x: 82, y: 10, r: 4.2 },
  { x: 13, y: 16, r: 3.2 },
];

/* the drawing itself, as SVG children (NoxReveal animates these parts by
 * their class names: nl-moon, nl-grow, nl-eyes, nl-star). `reveal`: the
 * moon's light comes from a circle in its mask (nl-grow) that the splash
 * grows from the centre; otherwise it's the plain full mask. */
export function NoxLogoArt({ id, small = false, stars = true, reveal = false }) {
  const eye = small ? { w: 12.4, h: 18.7 } : { w: 8.5, h: 17 };
  const bite = small ? { cx: 82, cy: 20, r: 25 } : { cx: 84, cy: 19, r: 22 };
  return (
    <>
      <defs>
        <radialGradient id={`nlg${id}`} cx="34%" cy="28%" r="80%">
          <stop offset="0" stopColor="#F4B896" />
          <stop offset="0.55" stopColor="#F0A47A" />
          <stop offset="1" stopColor="#D97F4F" />
        </radialGradient>
        <mask id={`nlm${id}`}>
          {reveal ? (
            <circle className="nl-grow" cx="50" cy="53" r="44" fill="#fff" />
          ) : (
            <rect width="100" height="100" fill="#fff" />
          )}
          <circle cx={bite.cx} cy={bite.cy} r={bite.r} fill="#000" />
        </mask>
      </defs>
      {/* two groups: the reveal animates nl-moon with a CSS transform, which
       * would replace a transform attribute on the same element */}
      <g className="nl-moon">
        <g transform={LOGO_NOX}>
          <g mask={`url(#nlm${id})`}>
            <circle cx="50" cy="53" r="42" fill={`url(#nlg${id})`} />
            {!small && (
              <>
                <circle cx="27" cy="76" r="5" fill="#D97F4F" fillOpacity="0.45" />
                <circle cx="66" cy="81" r="3" fill="#D97F4F" fillOpacity="0.45" />
              </>
            )}
          </g>
          <g className="nl-eyes" fill="#1A1424">
            {[37, 55].map((x) => (
              <rect key={x} x={x - eye.w / 2} y={55 - eye.h / 2} width={eye.w} height={eye.h} rx={eye.w / 2} />
            ))}
          </g>
        </g>
      </g>
      {stars &&
        (small ? LOGO_STARS_SM : LOGO_STARS).map((s, i) => (
          <circle key={i} className="nl-star" style={{ '--i': i }} cx={s.x} cy={s.y} r={s.r} fill="#ECF0FB" />
        ))}
    </>
  );
}

export function NoxLogo({ size = 48, small = size <= 40, stars = true, label, className = '' }) {
  const id = useId().replace(/:/g, ''); // React ids contain colons, which break url(#…)
  return (
    <svg
      className={`nox-logo ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      <NoxLogoArt id={id} small={small} stars={stars} />
    </svg>
  );
}
