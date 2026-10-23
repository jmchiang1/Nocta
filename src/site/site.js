/* Nocta — the marketing site (index.html at /). The app lives at /app/. */

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

  navOnScroll();
  tiltOnScroll(still);
  reveals(still);
  trendBars();
  howSteps();
  tabs();
  checkin();
  spotlight(still);
}

/* the bar gains a fill once the page moves under it */
function navOnScroll() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const set = () => nav.classList.toggle('scrolled', window.scrollY > 12);
  set();
  window.addEventListener('scroll', set, { passive: true });
}

/* the product rises from the horizon tilted back, and lies flat as you scroll */
function tiltOnScroll(still) {
  const tilt = document.querySelector('[data-tilt]');
  if (!tilt || still) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = tilt.getBoundingClientRect();
    // 0 when the shot's top is low in the window, 1 once it's near the top third
    const t = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.75)));
    tilt.style.setProperty('--tilt', `${(1 - t) * 22}deg`);
    tilt.style.setProperty('--lift', `${(1 - t) * 40}px`);
  };
  update();
  window.addEventListener('scroll', () => (raf ||= requestAnimationFrame(update)), { passive: true });
  window.addEventListener('resize', update);
}

/* things that play when they come into view (once) */
function reveals(still) {
  const els = document.querySelectorAll('[data-reveal]');
  if (still || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );
  els.forEach((el) => io.observe(el));
}

/* the trend tile's bars, from the sample month's real nights */
function trendBars() {
  document.querySelectorAll('[data-bars]').forEach((box) => {
    const vals = box.dataset.bars.split(',').map(Number);
    const max = Math.max(...vals);
    box.innerHTML = vals
      .map((v, i) => `<i style="--h:${Math.max(3, (v / max) * 100)}%;--i:${i}"${v >= 10 ? ' class="hi"' : ''}></i>`)
      .join('');
  });
}

/* how it works: the step in the middle of the window picks the picture */
function howSteps() {
  const visual = document.querySelector('[data-how-visual]');
  const steps = document.querySelectorAll('.how-step');
  if (!visual || !steps.length || !('IntersectionObserver' in window)) return;
  const show = (n) => {
    visual.querySelectorAll('.hv').forEach((hv) => hv.classList.toggle('on', hv.classList.contains(`hv-${n}`)));
    steps.forEach((s) => s.classList.toggle('active', s.dataset.step === n));
  };
  show('1');
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && show(e.target.dataset.step)),
    { rootMargin: '-45% 0px -45% 0px' }
  );
  steps.forEach((s) => io.observe(s));
}

/* the laptop screens: a tab list (arrow keys move between tabs) */
function tabs() {
  const list = document.querySelector('[role="tablist"]');
  if (!list) return;
  const all = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    all.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls'))?.classList.toggle('on', on);
    });
  };
  all.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = all[(i + d + all.length) % all.length];
      select(next);
      next.focus();
    });
  });
}

/* the check-in tile's answers can be tapped, like the real one */
function checkin() {
  document.querySelectorAll('.checkin-chips button').forEach((b) =>
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')))
  );
}

/* a soft light that follows the pointer across a tile */
function spotlight(still) {
  if (still || !window.matchMedia('(hover: hover)').matches) return;
  document.querySelectorAll('[data-spot]').forEach((el) =>
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    })
  );
}
