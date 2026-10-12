import './styles/main.css';
import './styles/creative.css';
import './styles/creative-mac.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/caveat/wght.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';
import { createOS } from './creative/mac/os.js';
import { initCabinet } from './creative/mac/cabinet.js';
import { initDesk } from './creative/desk.js';
import { initHeaderLights } from './creative/header-lights.js';
import { initWork } from './creative/work.js';
import { initPeek } from './creative/peek.js';
import { initMascot } from './creative/mascot.js';
import { registerCommands } from './sections/palette.js';
import { PROJECTS } from './creative/data/projects.js';
import { openProject } from './creative/project-window.js';
import { soundOn, setSound } from './creative/sound.js';

// Creative page (alter ego 02): the vintage Mac, then the work.
const { reducedMotion, lenis, fontsReady, palette } = initShared();
const viaWipe = arrivedViaWipe();

const os = createOS({ reducedMotion, lenis });
const cabinet = initCabinet({ os, reducedMotion });
initDesk({ reducedMotion });
const lights = initHeaderLights({ lenis, reducedMotion });
// Phones: the Mac's screen is small, so a game takes the whole screen (and gives it back after).
let autoZoomed = false;
os?.on((type, on) => {
  if (type !== 'gaming' || !matchMedia('(max-width: 767px)').matches) return;
  if (on && !lights.isZoomed()) {
    lights.zoom(true);
    autoZoomed = true;
  } else if (!on && autoZoomed) {
    lights.zoom(false);
    autoZoomed = false;
  }
});
initWork({ reducedMotion, lenis });
initPeek({ reducedMotion });
initMascot({ os, reducedMotion });

// ⌘K extras on this page: the projects, the Mac's apps and games, sound.
const toMac = (fn) => () => {
  const mac = document.querySelector('[data-mac]');
  const r = mac.getBoundingClientRect();
  const offscreen = r.bottom < 80 || r.top > window.innerHeight - 80;
  if (offscreen && lenis) lenis.scrollTo(mac, { offset: -100, duration: 0.8, onComplete: fn });
  else fn();
};
registerCommands([
  { group: 'Play', label: 'Play Racer', hint: 'RACER.DSK', keys: 'game racer car drive play', run: toMac(() => cabinet.insert('racer')) },
  { group: 'Play', label: 'Play Perfect Circle', hint: 'CIRCLE.DSK', keys: 'game circle draw play', run: toMac(() => cabinet.insert('circle')) },
  { group: 'Play', label: 'High Scores', hint: 'leaderboard', keys: 'scores leaderboard top', run: toMac(() => os?.open('scores')) },
  { group: 'Play', label: 'Talk to Krish', hint: 'chat', keys: 'chat talk ask question', run: toMac(() => os?.open('chat')) },
  { group: 'Play', label: 'Sound on / off', hint: 'retro sounds', keys: 'sound audio mute music', keepOpen: false, run: () => { setSound(!soundOn()); palette.toast(soundOn() ? 'Sound on' : 'Sound off'); } },
  { group: 'Play', label: 'Mac full screen', hint: 'green light', keys: 'fullscreen zoom mac big', run: () => lights.zoom(true) },
  ...PROJECTS.map((p) => ({
    group: 'Projects',
    label: p.title,
    hint: p.subtitle,
    keys: `${p.category} ${p.client || ''} project work ${p.subtitle}`,
    run: () => openProject(p.slug, { from: document.querySelector(`.card[data-slug="${p.slug}"]`) }),
  })),
]);

// Hero entrance: the headline rises line by line, the desk settles in after it.
const lines = document.querySelectorAll('.chero__title .line > span');
const fades = document.querySelectorAll('.chero [data-fade]');
if (!reducedMotion) {
  gsap.set(lines, { yPercent: 110 });
  gsap.set(fades, { autoAlpha: 0, y: 16 });
}

fontsReady.then(() => {
  if (viaWipe) revealArrival();
  if (reducedMotion) return;
  gsap
    .timeline({ delay: viaWipe ? 0.1 : 0 })
    .to(lines, { yPercent: 0, duration: 0.9, ease: 'ui-out', stagger: 0.07 })
    .to(fades, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'ui-out', stagger: 0.06, clearProps: 'transform' }, 0.25);
});
