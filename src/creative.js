import './styles/main.css';
import './styles/creative.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/caveat/wght.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';
import { initToolbar } from './creative/toolbar.js';
import { initMiniMac } from './creative/minimac.js';

// Creative page (alter ego 02): green grid, Mac windows, the work.
const { reducedMotion, lenis, fontsReady } = initShared();
const viaWipe = arrivedViaWipe();

initToolbar({ lenis, reducedMotion });
initMiniMac({ reducedMotion });

// Hero entrance: the name rises line by line, everything else settles in after it.
const lines = document.querySelectorAll('.chero__name .line > span');
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
    .to(fades, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'ui-out', stagger: 0.05 }, 0.25);
});
