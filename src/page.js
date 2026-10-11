import './styles/main.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';

// Alter-ego pages (data, creative). Placeholder content for now.
const { reducedMotion, fontsReady } = initShared();
const viaWipe = arrivedViaWipe();

const lines = document.querySelectorAll('.page-hero .line > span');
const fades = document.querySelectorAll('.page-hero [data-fade]');

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
    .to(fades, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'ui-out', stagger: 0.04 }, 0.3);
});
