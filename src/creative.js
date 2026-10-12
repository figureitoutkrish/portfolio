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

// Creative page (alter ego 02): the vintage Mac, then the work.
const { reducedMotion, lenis, fontsReady } = initShared();
const viaWipe = arrivedViaWipe();

const os = createOS({ reducedMotion, lenis });
initCabinet({ os, reducedMotion });
initDesk({ reducedMotion });
initHeaderLights({ lenis, reducedMotion });
initWork({ reducedMotion, lenis });

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
