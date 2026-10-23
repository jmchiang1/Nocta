/* Nocta — "the sky opens": the launch film, right after the hero
 * (index.html #film).
 *
 *   scrolled in   the film waits behind the hero, unseen. As the hero lifts
 *                 away it blooms out of its own horizon: a soft, edgeless
 *                 light that widens with the scroll until the film fills the
 *                 sky, its edges dissolving into the page's night. The bar
 *                 slips away while it plays, and the page's clock hands over
 *                 to the film's, in the same corner
 *   playing       the film plays on its own clock (never scrubbed): muted,
 *                 unless the speaker in the bar is on; the page's clock steps
 *                 aside for the film's own
 *   scrolled on   it fades back into the sky and pauses; scroll back and it
 *                 picks up where it was
 *   the button    full screen, with sound and the usual controls
 *
 * Reduced motion: no growing or autoplay; the poster frame, full size, with a
 * play button. The film loads only as you get near it. */
import { siteSoundOn, onSiteSoundChange, refreshSoundToggle } from './soundToggle.js';

export function initFilm(sky, { still = false } = {}) {
  const section = document.querySelector('#film');
  const film = section?.querySelector('[data-film]');
  const video = film?.querySelector('video');
  if (!video) return;
  const playBtn = film.querySelector('[data-film-play]');
  const fullBtn = film.querySelector('[data-film-full]');

  // the smaller file on narrow screens; loaded only when it's close
  const load = () => {
    if (video.src) return;
    video.src = window.matchMedia('(min-width: 900px)').matches ? video.dataset.srcWide : video.dataset.srcNarrow;
    video.preload = 'auto';
  };
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (load(), near.disconnect()), {
      rootMargin: '150% 0px',
    });
    near.observe(section);
  } else load();

  /* sound is on by default (unless switched off with the speaker). Browsers
   * only allow sound after a click, tap or key press (not a scroll), so the
   * film first tries to play with sound; if that's refused it plays muted,
   * says "Tap for sound", and the visitor's first click or tap anywhere turns
   * it on */
  let blocked = false;
  const setBlocked = (on) => {
    blocked = on;
    film.classList.toggle('sound-blocked', on && siteSoundOn());
    refreshSoundToggle();
  };
  const syncSound = () => {
    if (document.fullscreenElement) return;
    video.muted = !siteSoundOn() || blocked;
    film.classList.toggle('sound-blocked', blocked && siteSoundOn());
  };
  onSiteSoundChange(() => {
    // switching the speaker on is a click, so sound is allowed from here
    if (siteSoundOn()) blocked = false;
    syncSound();
  });
  const gesture = () => {
    if (!blocked) return;
    setBlocked(false);
    syncSound();
    GESTURES.forEach((g) => window.removeEventListener(g, gesture, true));
  };
  const GESTURES = ['pointerdown', 'keydown', 'touchend'];
  GESTURES.forEach((g) => window.addEventListener(g, gesture, true));
  ['play', 'pause', 'volumechange'].forEach((e) => video.addEventListener(e, refreshSoundToggle));

  const play = () => {
    load();
    syncSound();
    video.play().catch(() => {
      if (video.muted) {
        // won't play even muted: offer the play button instead
        film.classList.add('needs-tap');
        return;
      }
      setBlocked(true);
      syncSound();
      video.play().catch(() => film.classList.add('needs-tap'));
    });
  };

  playBtn.addEventListener('click', () => {
    film.classList.remove('needs-tap');
    video.controls = still;
    play();
  });

  // full screen, with sound and controls; back to the sky after
  fullBtn.addEventListener('click', () => {
    load();
    video.muted = false;
    video.controls = true;
    const fs = video.requestFullscreen?.() ?? video.webkitEnterFullscreen?.();
    Promise.resolve(fs).finally(() => video.play().catch(() => {}));
  });
  const leftFull = () => {
    if (document.fullscreenElement) return;
    video.controls = still;
    syncSound();
  };
  document.addEventListener('fullscreenchange', leftFull);
  video.addEventListener('webkitendfullscreen', leftFull);

  if (still || !sky) {
    document.documentElement.classList.add('film-still');
    return;
  }

  const { gsap, ScrollTrigger, lenis } = sky;
  const hero = document.querySelector('.hero');
  // the film's stage sits behind the hero from the top of the page (the
  // section overlaps it), so it can open in place instead of scrolling in
  const overlap = () => {
    section.style.marginTop = `-${hero.offsetHeight}px`;
  };
  overlap();
  window.addEventListener('resize', overlap);
  const vh = () => window.innerHeight;
  const span = () => section.offsetHeight - vh();
  const top0 = () => section.offsetTop;

  // the light opens with the scroll (a picture, so it may stop anywhere)
  gsap.fromTo(
    film,
    { '--k': 0 },
    {
      '--k': 1,
      ease: 'none',
      scrollTrigger: { start: () => top0() + vh() * 0.12, end: () => top0() + vh() * 1.05, scrub: 0.6, invalidateOnRefresh: true },
      onUpdate() {
        film.classList.toggle('open', Number(gsap.getProperty(film, '--k')) > 0.85);
      },
    }
  );
  // …and dissolves back into the sky as you leave
  gsap.fromTo(
    film,
    { opacity: 1 },
    {
      opacity: 0,
      ease: 'none',
      immediateRender: false,
      scrollTrigger: { start: () => top0() + span() * 0.88, end: () => top0() + span(), scrub: 0.6, invalidateOnRefresh: true },
    }
  );

  // the film itself plays on its own clock once the light is mostly open;
  // the bar steps aside while it does
  ScrollTrigger.create({
    start: () => top0() + vh() * 0.6,
    end: () => top0() + span() * 0.94,
    invalidateOnRefresh: true,
    onToggle: (s) => {
      document.documentElement.classList.toggle('film-on', s.isActive);
      if (s.isActive) play();
      else if (!document.fullscreenElement) video.pause();
    },
  });

  // the hero's "Watch" pill lands where the window is fully open
  document.querySelectorAll('a[href="#film"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const top = top0() + vh() * 1.15;
      if (lenis) lenis.scrollTo(top, { duration: 1.6 });
      else window.scrollTo({ top, behavior: 'smooth' });
    })
  );
}
