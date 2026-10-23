/* Nocta — the marketing site (index.html at /). The app lives at /app/. */
import { initSky } from './sky.js';
import { initStory } from './story.js';

/* ---- links meant for the app ----
 * Before the app moved to /app/, sign-in, email and wearable links came back
 * to /. Any that are still out there (a confirmation email sent last week, a
 * Google sign-in mid-flight) carry their answer in the address: hand it on to
 * the app, unchanged, instead of showing this page. */
const APP_PARAMS = ['code', 'error', 'error_code', 'error_description', 'sb', 'token_hash', 'type', 'wearable', 'result', 'wearable_tab', 'demo', 'layout'];
const q = new URLSearchParams(window.location.search);
const forApp =
  APP_PARAMS.some((k) => q.has(k)) || /(^#|&)(access_token|error|refresh_token)=/.test(window.location.hash);

if (forApp) {
  window.location.replace(`/app/${window.location.search}${window.location.hash}`);
} else if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}


function start() {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  const sky = initSky({ still });
  navOnScroll();
  splitHero();
  splitWords();
  staggers();
  reveals(still);
  parallax(sky);
  initStory(sky, { still, reader: makeReader(document.querySelector('[data-reader]')) });
  questions(still);
  // the hero wave's travelling light is an SVG animation: hold it still too
  if (still) document.querySelectorAll('svg').forEach((s) => s.pauseAnimations?.());
}

/* questions open and close with a slide, not a jump */
function questions(still) {
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  document.querySelectorAll('.faq details').forEach((d) => {
    const a = d.querySelector('.faq-a');
    d.querySelector('summary').addEventListener('click', (e) => {
      e.preventDefault();
      const opening = !d.classList.contains('is-open');
      d.classList.toggle('is-open', opening);
      if (still) {
        d.open = opening;
        return;
      }
      a.getAnimations().forEach((x) => x.cancel());
      if (opening) {
        d.open = true;
        const h = a.scrollHeight;
        a.animate(
          [
            { height: '0px', opacity: 0 },
            { height: `${h}px`, opacity: 1 },
          ],
          { duration: 420, easing: EASE }
        );
      } else {
        const h = a.scrollHeight;
        const anim = a.animate(
          [
            { height: `${h}px`, opacity: 1 },
            { height: '0px', opacity: 0 },
          ],
          { duration: 320, easing: EASE }
        );
        anim.onfinish = () => {
          if (!d.classList.contains('is-open')) d.open = false;
        };
      }
    });
  });
}

/* the bar gains a fill once the page moves under it */
function navOnScroll() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const set = () => nav.classList.toggle('scrolled', window.scrollY > 12);
  set();
  window.addEventListener('scroll', set, { passive: true });
}

/* the hero's headline: each word rises up through its line, one after
 * another, after the sky has opened (site.css › .hw). The second line takes
 * the lower half of the moonlit gradient, as the whole title did. */
function splitHero() {
  const h = document.querySelector('[data-hero-title]');
  if (!h) return;
  const text = h.textContent.replace(/\s+/g, ' ').trim();
  h.setAttribute('aria-label', text);
  h.innerHTML = text
    .split(' ')
    .map((w, i) => `<span class="hl" aria-hidden="true"><span class="hw" style="--i:${i}">${w}</span></span>`)
    .join(' ');
  h.classList.add('split');
  const lines = () => {
    const words = [...h.querySelectorAll('.hl')];
    const top = words[0].offsetTop;
    words.forEach((w) => w.classList.toggle('l2', w.offsetTop > top + 4));
  };
  lines();
  // the wrap can change once the display font arrives
  document.fonts?.ready.then(lines);
  window.addEventListener('resize', lines);
}

/* section titles rise word by word, the way the app's headlines do
 * (lib/motion.jsx RevealText); screen readers get the title as written */
function splitWords() {
  document.querySelectorAll('[data-words]').forEach((el) => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) return frag.append(' ');
            const s = document.createElement('span');
            s.className = 'w';
            s.style.setProperty('--i', i++);
            s.textContent = w;
            s.setAttribute('aria-hidden', 'true');
            frag.append(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          walk(n);
        }
      });
    };
    walk(el);
    // "focus": the words come into focus where they stand (no movement)
    el.setAttribute('data-reveal', el.dataset.words === 'focus' ? 'focus' : 'words');
  });
}

/* a list's items arrive one after another */
function staggers() {
  document.querySelectorAll('[data-stagger]').forEach((list) => {
    [...list.children].forEach((c, i) => c.style.setProperty('--d', `${i * 90}ms`));
    list.setAttribute('data-reveal', list.getAttribute('data-reveal') || 'stagger');
  });
}

/* anything marked plays as it scrolls into view (once) */
function reveals(still) {
  const els = document.querySelectorAll('[data-reveal]');
  if (still || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

/* the hero's phone and waves leave at different speeds: the phone lifts
 * away faster than the horizon behind it (scrubbed with the sky's GSAP) */
function parallax(sky) {
  if (!sky) return;
  const { gsap } = sky;
  const hero = document.querySelector('.hero');
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    gsap.to(el, {
      y: () => Number(el.dataset.parallax) * window.innerHeight * 3,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
    });
  });
}

/* the card-reading screen, driven by the scroll (story.js): the bar fills and
 * the nights count up as you go, then Nox's "All read" */
function makeReader(panel) {
  if (!panel) return null;
  const bar = panel.querySelector('.ci-progress span');
  const label = panel.querySelector('.read-working .settings-note');
  const doneBox = panel.querySelector('.read-done');
  const tpl = doneBox.innerHTML;
  const TOTAL = 29;
  let done = false;
  return {
    progress(k) {
      bar.style.width = `${(k * 100).toFixed(1)}%`;
      label.textContent = `Night ${Math.max(1, Math.round(k * TOTAL))} of ${TOTAL}`;
    },
    done(on) {
      if (on === done) return;
      done = on;
      panel.classList.toggle('is-done', on);
      // a fresh "All read" each time, so Nox's hop and the cheer replay
      if (on) doneBox.innerHTML = tpl;
    },
  };
}
