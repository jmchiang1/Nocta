/* Nocta — Liquid Glass refraction filters.
 *
 * Technique (after Mikhail Bespalov's "Liquid Glass" pen): an SVG filter used
 * as a *backdrop-filter* — the content behind an element is blurred a touch
 * and then pushed through feDisplacementMap, using a generated "normal map"
 * image to decide which way each pixel bends. That bending is what makes it
 * read as glass rather than a frosted blur.
 *
 * The pen's map is a sphere (one round button). Our surfaces are a capsule
 * tab bar and small circular buttons, so the maps are generated here on a
 * canvas to match each shape exactly: neutral (no bend) across the flat
 * middle, bending inward only within a bezel band around the rim — the way
 * Apple's material keeps the centre clear and refracts at the edges.
 *
 * SVG filters in backdrop-filter only render in Chromium; we tag <html> with
 * .lg-svg there and every other browser keeps the plain blur fallback in
 * motion.css. */
import { useEffect, useState } from 'react';

/* signed distance from p to a rounded rect centred at c (negative = inside) */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/* R/G encode x/y displacement around a neutral 128. Within `bezel` px of the
 * edge, pixels sample *inward* along the surface normal, strongest at the rim
 * (eased), so the backdrop appears to bend over a rounded glass edge. */
function makeMap(w, h, radius, bezel) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw, hh);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = -sdRoundRect(px, py, cx, cy, hw, hh, r); // inward distance
      let dx = 0;
      let dy = 0;
      if (d < bezel) {
        // outward normal from the SDF gradient
        const e = 0.5;
        const gx =
          sdRoundRect(px + e, py, cx, cy, hw, hh, r) - sdRoundRect(px - e, py, cx, cy, hw, hh, r);
        const gy =
          sdRoundRect(px, py + e, cx, cy, hw, hh, r) - sdRoundRect(px, py - e, cx, cy, hw, hh, r);
        const len = Math.hypot(gx, gy) || 1;
        const t = 1 - Math.max(0, d) / bezel; // 1 at the rim → 0 at bezel's inner edge
        const m = t * t * (3 - 2 * t); // smoothstep: soft start, strong at the rim
        dx = (-gx / len) * m; // sample inward
        dy = (-gy / len) * m;
      }
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(128 + dx * 127);
      img.data[i + 1] = Math.round(128 + dy * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function isChromium() {
  if (typeof navigator === 'undefined') return false;
  const brands = navigator.userAgentData?.brands;
  if (brands) return brands.some((b) => b.brand === 'Chromium');
  return /Chrome\//.test(navigator.userAgent);
}

/* every glass surface we render: id → geometry. `blur` softens the backdrop
 * before it bends; `scale` is twice the max displacement in px. Keep
 * scale / 2 below the bezel so the rim compresses content without ever
 * sampling past the centre (which would mirror it). */
function surfaces(phoneWidth) {
  const barW = Math.round(phoneWidth - 32); // tab bar: 16px inset each side
  return [
    { id: 'lg-bar', w: barW, h: 62, radius: 31, bezel: 22, blur: 3, scale: 46 },
    { id: 'lg-circle', w: 38, h: 38, radius: 19, bezel: 14, blur: 2, scale: 24 },
  ];
}

export function LiquidGlassFilters() {
  const [defs, setDefs] = useState([]);

  useEffect(() => {
    if (!isChromium()) return undefined;
    document.documentElement.classList.add('lg-svg');

    let lastW = 0;
    const build = () => {
      const phone = document.querySelector('.phone');
      const w = phone ? phone.clientWidth : 402;
      if (w === lastW) return;
      lastW = w;
      setDefs(surfaces(w).map((s) => ({ ...s, href: makeMap(s.w, s.h, s.radius, s.bezel) })));
    };
    build();
    window.addEventListener('resize', build);
    return () => {
      window.removeEventListener('resize', build);
      document.documentElement.classList.remove('lg-svg');
    };
  }, []);

  if (!defs.length) return null;

  return (
    <svg className="lg-defs" aria-hidden="true" focusable="false">
      <defs>
        {defs.map((s) => (
          <filter
            key={s.id}
            id={s.id}
            x="0"
            y="0"
            width={s.w}
            height={s.h}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={s.href} x="0" y="0" width={s.w} height={s.h} preserveAspectRatio="none" result="map" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={s.blur} result="soft" />
            <feDisplacementMap
              in="soft"
              in2="map"
              scale={s.scale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
