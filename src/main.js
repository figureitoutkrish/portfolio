import './styles/main.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { initHome } from './sections/home.js';
import { initIntro } from './sections/intro.js';
import { initAbout } from './sections/about.js';
import { initTrail } from './sections/trail.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';

// Home page.
const { reducedMotion, lenis, fontsReady } = initShared();
const home = initHome();
initTrail({ reducedMotion });
initAbout({ reducedMotion });

if (arrivedViaWipe()) {
  // Coming back from another page: no intro, just uncover home and play its entrance.
  gsap.set('.intro', { autoAlpha: 0 });
  home.hide();
  fontsReady.then(() => {
    revealArrival();
    home.reveal().delay(0.1);
  });
} else {
  fontsReady.then(() => initIntro({ reducedMotion, home, lenis }));
}
