/* Nocta — the marketing site's sky: one night, from dusk at the top of the
 * page to dawn at the end, behind everything (index.html .night).
 *
 *   scroll 0 ───────────────────────────────────────────── 1
 *   dusk ── deep night ─────────────── pre-dawn ── dawn
 *   a full sky from the first screen: three star layers and the Milky Way
 *   drifting up at different depths, clouds sailing across
 *
 * GSAP's ScrollTrigger ties all of it to the scroll (scrubbed, so it moves
 * with you, both ways); Lenis smooths the scroll itself. Now and then a star
 * falls in the deep part of the night, and on a desktop more stars show up
 * around the pointer. Reduced motion: a still night sky, native scrolling. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);

/* a small seeded random, so the sky is the same on every visit */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* per layer: how many stars (desktop; phones get about half), their size and brightness */
/* `born`: when the layer's stars start popping into being on load, far first */
const LAYERS = {
  far: { n: 280, size: [0.6, 1.2], alpha: [0.3, 0.7], twinkle: 0.15, born: 0.3 },
  mid: { n: 110, size: [1, 1.8], alpha: [0.5, 0.9], twinkle: 0.3, born: 0.7 },
  near: { n: 34, size: [1.8, 3], alpha: [0.8, 1], twinkle: 0.45, born: 1.1 },
};

/* the Milky Way: a soft band of dust and dense faint stars across the sky,
 * riding with the far stars */
function milkyWay(far, rnd, scale) {
  const band = document.createElement('div');
  band.className = 'milky-way';
  let html = '<span class="mw-glow"></span>';
  const n = Math.round(520 * scale);
  for (let i = 0; i < n; i += 1) {
    // thick in the middle of the band, thinning out to its edges
    const g = (rnd() + rnd() + rnd() - 1.5) / 1.5;
    html += `<i style="left:${(rnd() * 100).toFixed(2)}%;top:${(50 + g * 34).toFixed(2)}%;--s:${(0.5 + rnd() * 0.8).toFixed(2)}px;--a:${(0.25 + rnd() * 0.5).toFixed(2)};--in:${(0.5 + rnd() * 1.6).toFixed(2)}s"></i>`;
  }
  band.innerHTML = html;
  far.append(band);
}

function fillStars(layer, spec, rnd, scale) {
  const n = Math.round(spec.n * scale);
  const lerp = ([a, b]) => a + rnd() * (b - a);
  let html = '';
  for (let i = 0; i < n; i += 1) {
    const tw = rnd() < spec.twinkle;
    html += `<i${tw ? ' class="tw"' : ''} style="left:${(rnd() * 100).toFixed(2)}%;top:${(rnd() * 100).toFixed(2)}%;--s:${lerp(spec.size).toFixed(2)}px;--a:${lerp(spec.alpha).toFixed(2)};--t:${(2.4 + rnd() * 4).toFixed(1)}s;--d:${(-rnd() * 6).toFixed(1)}s;--in:${((spec.born ?? 0) + rnd() * 1.4).toFixed(2)}s"></i>`;
  }
  layer.innerHTML = html;
}

export function initSky({ still = false } = {}) {
  const night = document.querySelector('[data-night]');
  if (!night) return null;
  const rnd = seeded(2026);
  const small = window.matchMedia('(max-width: 700px)').matches;
  const scale = small ? 0.5 : 1;

  // stars: each layer is taller than the window by how far it travels
  const layers = [...night.querySelectorAll('.star-layer[data-depth]')];
  layers.forEach((l) => {
    const depth = Number(l.dataset.depth);
    l.style.height = `${100 + depth * 160}vh`;
    const key = [...l.classList].find((c) => LAYERS[c]);
    fillStars(l, LAYERS[key], rnd, scale);
    if (key === 'far') milkyWay(l, rnd, scale);
  });

  const q = (s) => night.querySelector(s);
  const dusk = q('.dusk');
  const deep = q('.deep');
  const predawn = q('.predawn');
  const dawn = q('.dawn');
  const clouds = q('.cloud-layer');

  if (still) {
    night.classList.add('still');
    return null;
  }

  // ---- smooth scrolling, driven by GSAP's clock so the two never drift ----
  const lenis = new Lenis({ duration: 1.15, smoothWheel: true, anchors: { offset: -84 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // ---- the night, scrubbed to the page's scroll (0 at the top, 1 at the end) ----
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    // the night runs from the top of the page to dawn (the sign-up)
    scrollTrigger: {
      trigger: document.documentElement,
      start: 'top top',
      endTrigger: '#dawn',
      end: 'center center',
      scrub: 0.8,
      invalidateOnRefresh: true, // a resized window re-measures how far the stars travel
    },
  });
  tl.to(dusk, { opacity: 0, duration: 0.3 }, 0)
    .fromTo(deep, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.08)
    .to(deep, { opacity: 0, duration: 0.2 }, 0.72)
    .fromTo(predawn, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.66)
    .fromTo(dawn, { opacity: 0 }, { opacity: 1, duration: 0.16 }, 0.84);

  // stars: deeper layers barely move, near ones drift up faster
  layers.forEach((l) => {
    tl.fromTo(l, { y: 0 }, { y: () => -(l.offsetHeight - window.innerHeight), duration: 1 }, 0);
  });
  // the whole sky from the first screen; only dawn washes the stars out
  tl.to(layers, { opacity: 0.3, duration: 0.14 }, 0.86);
  tl.fromTo(clouds, { x: '-8vw', y: '10vh' }, { x: '12vw', y: '-40vh', duration: 1 }, 0);


  // after dawn, the sky settles into a calm early-morning blue for the
  // quieter part of the page
  gsap.fromTo(
    q('.morning'),
    { opacity: 0 },
    {
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#dawn', start: 'bottom 80%', endTrigger: '#features', end: 'top 30%', scrub: 0.8 },
    }
  );

  shootingStars(night, deep);
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) cursorStars(night, rnd);
  window.addEventListener('load', () => ScrollTrigger.refresh());
  return { lenis, gsap, ScrollTrigger };
}

/* now and then a star falls, only in the deep part of the night */
function shootingStars(night, deep) {
  const box = night.querySelector('.meteors');
  const next = () => setTimeout(fire, 4000 + Math.random() * 6000);
  const fire = () => {
    if (document.visibilityState === 'visible' && Number(gsap.getProperty(deep, 'opacity')) > 0.6) {
      const m = document.createElement('i');
      m.className = 'meteor';
      m.style.left = `${35 + Math.random() * 55}vw`;
      m.style.top = `${4 + Math.random() * 36}vh`;
      box.append(m);
      gsap
        .timeline({ onComplete: () => m.remove() })
        .fromTo(m, { opacity: 0, x: 0, y: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' })
        .to(m, { x: -280, y: 150, duration: 0.95, ease: 'power2.in' }, 0)
        .to(m, { opacity: 0, duration: 0.4 }, 0.6);
    }
    next();
  };
  next();
}

/* on a desktop, more stars show up around the pointer */
function cursorStars(night, rnd) {
  const layer = night.querySelector('.cursor-stars');
  fillStars(layer, { n: 260, size: [0.6, 1.4], alpha: [0.4, 0.9], twinkle: 0.2 }, rnd, 1);
  let raf = 0;
  let x = -999;
  let y = -999;
  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      raf ||= requestAnimationFrame(() => {
        raf = 0;
        layer.style.setProperty('--cx', `${x}px`);
        layer.style.setProperty('--cy', `${y}px`);
      });
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', () => {
    layer.style.setProperty('--cx', '-999px');
    layer.style.setProperty('--cy', '-999px');
  });
}
