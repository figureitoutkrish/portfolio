import './styles/main.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { initHome } from './sections/home.js';
import { initIntro } from './sections/intro.js';
import { initMenu } from './sections/menu.js';
import { prefersReducedMotion } from './utils/motion.js';

const reducedMotion = prefersReducedMotion();

// Reduced motion: keep native scrolling.
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis();
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Wait for Nohemi (max 1.5s) so intro text doesn't swap fonts mid-animation.
const fontsReady = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
const home = initHome();
initMenu({ reducedMotion });
fontsReady.then(() => initIntro({ reducedMotion, home, lenis }));
