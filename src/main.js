import './styles/main.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { initHome } from './sections/home.js';
import { initIntro } from './sections/intro.js';
import { arrivedViaWipe, wipeReveal } from './utils/transition.js';

// Home page.
const { reducedMotion, lenis, fontsReady } = initShared();
const home = initHome();

if (arrivedViaWipe()) {
  // Coming back from another page: no intro, just uncover home and play its entrance.
  gsap.set('.intro', { autoAlpha: 0 });
  home.hide();
  fontsReady.then(() => {
    wipeReveal();
    home.reveal().delay(0.15);
  });
} else {
  fontsReady.then(() => initIntro({ reducedMotion, home, lenis }));
}
