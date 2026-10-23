/* Nocta — the marketing site's story: one night, in chapters (index.html
 * .story). Each chapter is taller than the window and its stage sticks while
 * you scroll through it; a GSAP timeline scrubbed to that scroll plays it.
 *
 *   midnight  a dot for every minute of the night draws across the sky,
 *             then most of them fade away ("most of it never reaches you")
 *   4 am      the app's card-reading screen, read as you scroll: the bar
 *             fills and "All read" lands before the chapter lets you go
 *   6 am      last night's events light up as stars, a line joins them, and
 *             the why card builds itself around that line in the sky: the
 *             curve, your usual, the peak, the headline, tonight's suggestion
 *
 * The clock in the corner runs 11 pm → 7 am across the whole story.
 * Reduced motion: no pinning, every chapter shown as it ends. */

const SVG = 'http://www.w3.org/2000/svg';

/* a seeded random, so the night looks the same on every visit */
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

/* midnight: a dot for each minute of an 8-hour night (one for every two on
 * a phone, so they stay apart), breathing along a slow line. Drawn at the
 * window's real size so the dots stay round. Illustrative: the shape of a
 * night, not anyone's real one. */
function buildMinutes(svg) {
  const rnd = seeded(480);
  const W = svg.clientWidth || 1200;
  const H = svg.clientHeight || 260;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.removeAttribute('preserveAspectRatio');
  const k = H / 260;
  const N = W < 700 ? 240 : 480;
  const dots = [];
  for (let i = 0; i < N; i += 1) {
    const t = i / (N - 1);
    const x = 10 + t * (W - 20);
    const y =
      (130 +
        Math.sin(t * Math.PI * 7) * 28 +
        Math.sin(t * Math.PI * 23) * 9 +
        // a restless stretch in the small hours
        Math.exp(-((t - 0.62) ** 2) / 0.004) * -60 +
        (rnd() - 0.5) * 14) *
      k;
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', (1.1 + rnd() * 1.3).toFixed(2));
    c.setAttribute('class', rnd() < 0.06 ? 'm hot' : 'm');
    svg.append(c);
    dots.push(c);
  }
  return dots;
}

/* 6 am: stars along the night's line (the why card's curve, in its 390 × 190
 * drawing), placed as % so they stay round however wide the chart is. The
 * bright ones sit on the hours; the brightest is the night's peak. */
const HOURS = [
  [48.8, 72.9],
  [146.3, 99.7],
  [243.8, 46.1],
  [341.3, 122],
];
const PEAK = 2;

function buildStars(card) {
  const path = card.querySelector('.nc-line');
  const box = card.querySelector('.nc-stars');
  const len = path.getTotalLength();
  const put = (x, y, cls) => {
    const el = document.createElement('i');
    el.className = cls;
    el.style.left = `${((x / 390) * 100).toFixed(2)}%`;
    el.style.top = `${((y / 190) * 100).toFixed(2)}%`;
    el.dataset.x = x;
    box.append(el);
    return el;
  };
  const stars = [];
  for (let d = 4; d < len; d += 13) {
    const p = path.getPointAtLength(d);
    if (HOURS.some(([hx]) => Math.abs(hx - p.x) < 9)) continue; // room for the hour stars
    stars.push(put(p.x, p.y, 'ns'));
  }
  HOURS.forEach(([x, y], i) => stars.push(put(x, y, i === PEAK ? 'ns hour peak' : 'ns hour')));
  // they light from left to right, the way the night went
  stars.sort((a, b) => a.dataset.x - b.dataset.x);
  return stars;
}

/* split a title into letters (kept inside their words, so lines still wrap
 * between words); screen readers get the title as written */
function splitChars(el) {
  if (!el) return [];
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = text
    .split(' ')
    .map((w) => `<span class="sw" aria-hidden="true">${[...w].map((ch) => `<span class="sc">${ch}</span>`).join('')}</span>`)
    .join(' ');
  return [...el.querySelectorAll('.sc')];
}

export function initStory(sky, { still = false, reader } = {}) {
  const story = document.querySelector('.story');
  if (!story) return;
  const minutesSvg = story.querySelector('[data-minutes]');
  const minuteDots = minutesSvg ? buildMinutes(minutesSvg) : [];
  const card = story.querySelector('[data-nightcard]');
  const stars = buildStars(card);

  if (still || !sky) {
    document.documentElement.classList.add('story-still');
    reader?.progress(1);
    reader?.done(true);
    return;
  }
  const { gsap, ScrollTrigger } = sky;
  const st = (trigger, extra = {}) => ({ trigger, start: 'top top', end: 'bottom bottom', scrub: 0.6, ...extra });
  const q = (ch, sel) => ch.querySelector(sel);

  /* Two kinds of motion. Pictures (the minute dots, the stars, the line, the
   * reading bar) are scrubbed: they follow the scroll exactly, and a picture
   * stopped halfway still reads. Words are cued: once the scroll passes their
   * moment they play through at their own pace, however unevenly you scroll,
   * and rewind (a little quicker) if you scroll back past it. No word is ever
   * left half-typed or with its letters frozen mid-flight. */
  const cue = (trigger, start, tl) =>
    ScrollTrigger.create({
      trigger,
      start,
      onEnter: () => tl.timeScale(1).play(),
      onLeaveBack: () => tl.timeScale(1.8).reverse(),
    });
  // a cue partway through a pinned chapter (f = 0…1 of its scroll)
  const at = (ch, f) => () => `top+=${Math.round((ch.offsetHeight - window.innerHeight) * f)} top`;
  const words = () => gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

  // ---- midnight ----
  const ch1 = q(story, '.ch-minutes');
  const copyA = q(ch1, '.ch-copy');
  const copyB = q(ch1, '.ch-copy-b');
  // "writes down every minute": typed out, letter by letter, as it arrives
  const typed = splitChars(q(copyA, '[data-fx="type"]'));
  cue(
    ch1,
    'top 55%',
    words()
      .fromTo(typed, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: 0.034, ease: 'none' })
      .fromTo(q(copyA, '.ch-sub'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.15')
  );
  // "never reaches you": the line settles out of a soft blur and a little
  // drift (the whole line, not letters), as the dots below fade away
  cue(
    ch1,
    at(ch1, 0.58),
    words()
      // the first line clears before the second arrives: never both at once
      .to(copyA, { opacity: 0, y: -40, duration: 0.45, ease: 'power2.in' })
      .fromTo(copyB, { opacity: 0 }, { opacity: 1, duration: 0.01 })
      .fromTo(q(copyB, '.ch-title'), { opacity: 0, y: 26, filter: 'blur(12px)', letterSpacing: '0.02em' }, { opacity: 1, y: 0, filter: 'blur(0px)', letterSpacing: '-0.04em', duration: 1.3 })
      .fromTo(q(copyB, '.ch-sub'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.6')
  );
  const t1 = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st(ch1) });
  t1.fromTo(minuteDots, { opacity: 0, scale: 0.2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.02, stagger: 0.4 / minuteDots.length }, 0.06)
    // most of the night's detail fades and drifts off; a few dots stay
    .to(
      minuteDots.filter((d) => !d.classList.contains('hot')),
      { opacity: 0.06, y: () => -20 - Math.random() * 60, duration: 0.22, stagger: { amount: 0.08, from: 'random' } },
      0.62
    )
    .set({}, {}, 1);
  // the chapter bows out as a whole
  cue(ch1, at(ch1, 0.92), words().to(q(ch1, '.ch-stage'), { opacity: 0, duration: 0.5 }));

  // ---- 4 am: the card is read as you scroll; it finishes before you leave ----
  const ch2 = q(story, '.ch-card');
  const panel = q(ch2, '.read-panel');
  // "reads the whole card": a scan line sweeps across, the words behind it
  const scanTitle = q(ch2, '[data-fx="scan"]');
  scanTitle.innerHTML = `<span class="scan-text">${scanTitle.innerHTML}</span>`;
  cue(
    ch2,
    'top 55%',
    words()
      .fromTo(q(scanTitle, '.scan-text'), { clipPath: 'inset(-30% 100% -30% 0%)' }, { clipPath: 'inset(-30% 0% -30% 0%)', duration: 1.1, ease: 'power1.inOut' }, 0)
      .fromTo(scanTitle, { '--scan': '0%', '--scan-o': 1 }, { '--scan': '100%', duration: 1.1, ease: 'power1.inOut' }, 0)
      .to(scanTitle, { '--scan-o': 0, duration: 0.3 }, 1.1)
      .fromTo(q(ch2, '.ch-sub'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, 0.8)
  );
  const READ_FROM = 0.16;
  const READ_TO = 0.66;
  const t2 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: st(ch2, {
      onUpdate: (s) => {
        const k = Math.min(1, Math.max(0, (s.progress - READ_FROM) / (READ_TO - READ_FROM)));
        reader?.progress(k);
        reader?.done(s.progress > READ_TO + 0.02);
      },
    }),
  });
  t2.fromTo(panel, { opacity: 0, scale: 0.85, y: 60 }, { opacity: 1, scale: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.06).set({}, {}, 1);
  // once "All read" has landed, the chapter bows out as a whole
  cue(ch2, at(ch2, 0.88), words().to(q(ch2, '.ch-stage'), { opacity: 0, y: -40, duration: 0.55, ease: 'power2.in' }));

  // ---- 6 am: the dots become the why card ----
  const ch3 = q(story, '.ch-stars');
  const c = (sel) => card.querySelectorAll(sel);
  const notPeak = stars.filter((s) => !s.classList.contains('peak'));
  const peakStar = stars.find((s) => s.classList.contains('peak'));
  // "connects the dots": the letters pop in one after another
  const connect = splitChars(card.querySelector('[data-fx="connect"]'));
  cue(
    ch3,
    'top 55%',
    words()
      .fromTo(connect, { opacity: 0, scale: 0, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, stagger: 0.025, ease: 'back.out(4)' })
      .fromTo(c('.nc-intro .ch-sub'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.3')
  );
  // the answer, word by word, the way the app's headline arrives
  cue(
    ch3,
    at(ch3, 0.58),
    words()
      // the question clears first, then the answer arrives in its place
      .to(c('.nc-intro'), { opacity: 0, y: -30, duration: 0.4, ease: 'power2.in' })
      .fromTo(c('.nc-w'), { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.12 })
      .fromTo(c('.nc-detail'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.35')
  );
  // and the one thing to try tonight, led in by its star
  cue(
    ch3,
    at(ch3, 0.74),
    words()
      .fromTo(c('.nc-star'), { opacity: 0, scale: 0, rotation: -90 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(2)' })
      .fromTo(c('.nc-trail'), { scaleY: 0 }, { scaleY: 1, duration: 0.9 }, 0.3)
      .fromTo(c('.nc-guide-body > *'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.3)
  );
  const t3 = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st(ch3) });
  t3
    // last night's events come out, one after another
    .fromTo(stars, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.03, stagger: 0.2 / stars.length, ease: 'back.out(3)' }, 0.06)
    // a line joins them, left to right
    .fromTo(c('.nc-line'), { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: 0.16 }, 0.28)
    // the night takes shape: the stars settle into the line, the curve fills
    .to(notPeak, { opacity: 0, scale: 0.4, duration: 0.06, stagger: 0.04 / notPeak.length }, 0.44)
    .to(peakStar, { opacity: 0, scale: 2.2, duration: 0.05 }, 0.5)
    .fromTo(c('.nc-area'), { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.42)
    .fromTo(c('.nc-usual, .nc-usual-label, .nc-ticks'), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.46)
    .fromTo(c('.nc-peak-dot'), { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.05, ease: 'back.out(2)' }, 0.5)
    .fromTo(c('.nc-peak-label'), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.53)
    // the card holds for the rest of the chapter
    .set({}, {}, 1);

  // ---- dawn: Nox comes up like the sun (with the scroll); the words rise
  // off the horizon once he's up (on their own clock) ----
  const sun = document.querySelector('[data-sun]');
  const sunrise = document.querySelector('[data-sunrise]');
  if (sun) {
    gsap.fromTo(
      sun,
      { y: 180, scale: 0.5, opacity: 0, '--glow': 0 },
      { y: 0, scale: 1, opacity: 1, '--glow': 1, ease: 'none', scrollTrigger: { trigger: '#dawn', start: 'top 95%', end: 'center 55%', scrub: 0.8 } }
    );
  }
  if (sunrise) {
    cue(
      '#dawn',
      'top 45%',
      words().fromTo(
        sunrise,
        { clipPath: 'inset(100% -10% -20% -10%)', y: 50 },
        { clipPath: 'inset(-20% -10% -20% -10%)', y: 0, duration: 1.3, ease: 'power3.out' }
      )
    );
  }

  // ---- the clock: 11 pm at the top of the page, 7 am as dawn arrives ----
  const clock = document.querySelector('[data-clock]');
  const time = clock?.querySelector('.clock-time');
  if (clock) {
    const fmt = (m) => {
      const h24 = Math.floor(m / 60) % 24;
      const mm = String(Math.floor(m % 60)).padStart(2, '0');
      return `${h24 % 12 || 12}:${mm} ${h24 < 12 ? 'am' : 'pm'}`;
    };
    ScrollTrigger.create({
      trigger: document.querySelector('.hero'),
      start: 'top top',
      endTrigger: '#dawn',
      end: 'top center',
      onUpdate: (s) => {
        time.textContent = fmt(23 * 60 + s.progress * 8 * 60);
      },
      onToggle: (s) => clock.classList.toggle('on', s.isActive),
    });
  }
}
