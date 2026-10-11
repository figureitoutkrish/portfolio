import Lenis from 'lenis';
import gsap from 'gsap';
import { initMenu } from './sections/menu.js';
import { initTabbar } from './sections/tabbar.js';
import { initPageTransitions, navigate } from './utils/transition.js';
import { prefersReducedMotion } from './utils/motion.js';

// Everything every page needs: smooth scroll, header menu, tab bar, wiped page transitions.
export function initShared() {
  const reducedMotion = prefersReducedMotion();

  // Reduced motion: keep native scrolling.
  let lenis = null;
  if (!reducedMotion) {
    lenis = new Lenis();
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initMenu({ reducedMotion });
  initPageTransitions({ reducedMotion, lenis });
  initTabbar({ reducedMotion, navigate: (url) => navigate(url, { reducedMotion, lenis }) });

  // Wait for fonts (max 1.5s) so text doesn't swap typefaces mid-animation.
  const fontsReady = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);

  return { reducedMotion, lenis, fontsReady };
}
