/* Nocta — the marketing site's sound switch (the speaker in the bar).
 * Browsers only let a page make sound after a click or key press, and
 * scrolling doesn't count, so the switch is also how sound gets started.
 * It shows "on" only while sound will actually play: switched on here, the
 * app's own Sound effects setting not off, and audio running. Off is
 * remembered on this device (site only; the app's setting is its own). */
import { audioRunning, startAudio, onAudioChange, soundEffectsOn, chime } from '../lib/sound.js';

const KEY = 'nocta.siteSound.v1';
const wanted = () => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
};
const remember = (on) => {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: for this visit only */
  }
};

/* should the site's sounds play right now? */
export const siteSoundOn = () => wanted() && soundEffectsOn();

/* tell the page when sound goes on or off (the launch film follows it) */
const listeners = new Set();
export const onSiteSoundChange = (fn) => listeners.add(fn);
const changed = () => listeners.forEach((fn) => fn());

let show = () => {};
/* the film calls this when its own sound starts or is blocked */
export const refreshSoundToggle = () => show();

export function initSoundToggle() {
  // the bar's speaker, and the film's own while the bar is away
  const btns = [...document.querySelectorAll('[data-sound]')];
  if (!btns.length) return;
  show = () => {
    // "on" while sound is actually reaching you: the page's sounds are
    // running, or the film is playing with its sound up
    const film = document.querySelector('.film-video');
    const filmLoud = film && !film.paused && !film.muted;
    const on = siteSoundOn() && (audioRunning() || filmLoud);
    btns.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
      btn.title = on ? 'Sound on' : 'Sound off';
    });
  };
  show();
  btns.forEach((btn) =>
    btn.addEventListener('click', async () => {
      const film = document.querySelector('.film-video');
      const playing = siteSoundOn() && (audioRunning() || (film && !film.paused && !film.muted));
      if (playing) {
        remember(false);
      } else {
        remember(true);
        // a soft note to say it's on
        if (await startAudio()) chime(587.33, { gain: 0.04, decay: 1.4 });
      }
      show();
      changed();
    })
  );
  onAudioChange(() => {
    show();
    changed();
  });
}
