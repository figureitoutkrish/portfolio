import './utils/ease.js'; // registers the site's custom curves first
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initMenu } from './sections/menu.js';
import { initTabbar } from './sections/tabbar.js';
import { initTheme } from './utils/theme.js';
import { initPalette } from './sections/palette.js';
import { initPageTransitions, navigate } from './utils/transition.js';
import { prefersReducedMotion } from './utils/motion.js';
import { initPlayer } from './audio/player.js';
import './styles/player.css';
import './styles/hover-fx.css';
import { initHoverFx } from './utils/hover-fx.js';

// Everything every page needs: smooth scroll, header menu, tab bar, wiped page transitions.
export function initShared() {
  const reducedMotion = prefersReducedMotion();

  // Reduced motion: keep native scrolling.
  let lenis = null;
  if (!reducedMotion) {
    lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update); // keep scroll-driven animations in step with Lenis
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const theme = initTheme({ reducedMotion });
  initMenu({ reducedMotion });
  initPlayer({ reducedMotion }); // the record player in the header (and the site's sound switch)
  initPageTransitions({ reducedMotion, lenis });
  const go = (url) => navigate(url, { reducedMotion, lenis });
  initTabbar({ reducedMotion, navigate: go });
  const palette = initPalette({ reducedMotion, navigate: go, toggleTheme: theme.toggle });
  initHoverFx({ reducedMotion }); // letter roll, border shine, shimmer (visuvate-style)

  // Wait for fonts (max 1.5s) so text doesn't swap typefaces mid-animation.
  const fontsReady = Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
  fontsReady.then(() => ScrollTrigger.refresh()); // text metrics changed: re-measure trigger points

  return { reducedMotion, lenis, fontsReady, palette };
}
