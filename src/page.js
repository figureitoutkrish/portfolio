import './styles/main.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { arrivedViaWipe, wipeReveal } from './utils/transition.js';

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
  if (viaWipe) wipeReveal();
  if (reducedMotion) return;
  gsap
    .timeline({ delay: viaWipe ? 0.15 : 0 })
    .to(lines, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.08 })
    .to(fades, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05 }, 0.3);
});
