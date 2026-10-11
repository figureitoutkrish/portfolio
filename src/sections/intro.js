import gsap from 'gsap';
import { WIPE_HALF, wipeCover, wipeReveal } from '../utils/transition.js';
import { splitWords } from '../utils/split.js';

// Resting pose of each polaroid in the stack (back to front).
const POSES = [
  { xPercent: -18, yPercent: -4, rotation: -7 },
  { xPercent: 20, yPercent: -8, rotation: 8 },
  { xPercent: 0, yPercent: 0, rotation: -2 },
];

// Stack centred on screen vs. shrunk onto the bottom edge (the drop itself is a `y` tween).
const STACK_CENTER = { xPercent: -50, yPercent: -50, scale: 1 };
const STACK_END = { xPercent: -50, yPercent: -62, scale: 0.42 };


// In production the intro plays once per browser session; reloads and return visits go straight
// home. It always plays in dev so it can be reviewed.
const SEEN_KEY = 'krish:intro-seen';
function seenThisSession() {
  if (import.meta.env.DEV) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable: the intro just plays again next time */
  }
}

// Plays the intro over the home page, then wipes to it. `home` is the object from initHome();
// `lenis` (optional) is paused so the page underneath can't scroll during the intro.
export function initIntro({ reducedMotion, home, lenis }) {
  const root = document.querySelector('.intro');

  // Reduced motion: CSS already hides the intro; home shows as-is.
  if (!root || reducedMotion) return () => {};

  if (seenThisSession()) {
    gsap.set(root, { autoAlpha: 0 });
    return () => {};
  }
  markSeen();

  const hello = root.querySelector('.intro__hello');
  const stack = root.querySelector('.intro__stack');
  const polaroids = gsap.utils.toArray('.polaroid', root);
  const headline = root.querySelector('.intro__headline');
  const underline = root.querySelector('.underline');

  const helloWords = splitWords(hello);
  const words = splitWords(headline);
  home.hide();
  gsap.set(stack, STACK_CENTER);
  gsap.set([hello, headline], { autoAlpha: 1 });
  gsap.set(helloWords, { autoAlpha: 0, yPercent: 60 });
  gsap.set(words, { autoAlpha: 0, yPercent: 60 });
  gsap.set(underline, { '--underline-progress': 0 });

  // The intro reveals the top of the page, so start there (no restored mid-page scroll),
  // and flag it so other UI (the tab bar) stays out of the way until it's done.
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  document.documentElement.classList.add('is-intro');
  window.dispatchEvent(new CustomEvent('intro:start'));
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
  const finish = () => {
    removeSkip();
    lenis?.start();
    document.documentElement.style.overflow = '';
    if (document.documentElement.classList.contains('is-intro')) {
      document.documentElement.classList.remove('is-intro');
      window.dispatchEvent(new CustomEvent('intro:done'));
    }
  };

  const tl = gsap.timeline({ delay: 0.8, onComplete: finish }); // a beat of empty screen before the greeting

  // 1. "hi, i'm krish"
  // Words rise in one by one (same motion as the headline), then lift away in the same order.
  // Exits are quicker than entrances, and still ease-out (never ease-in).
  tl.to(helloWords, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'ui-out', stagger: 0.07 })
    .to(helloWords, { autoAlpha: 0, yPercent: -40, duration: 0.35, ease: 'ui-out', stagger: 0.04 }, '+=1');

  // 2. Polaroids drop in one by one and stack.
  polaroids.forEach((p, i) => {
    tl.fromTo(
      p,
      {
        ...POSES[i],
        autoAlpha: 0,
        y: () => window.innerHeight * 0.5,
        rotation: POSES[i].rotation + (i % 2 ? 14 : -14),
        scale: 1.1,
      },
      { autoAlpha: 1, y: 0, rotation: POSES[i].rotation, scale: 1, duration: 0.8, ease: 'back.out(1.2)' },
      i === 0 ? '+=0.1' : '-=0.45'
    );
  });

  // 3. Shrink a little, then slide down to rest on the bottom edge.
  tl.to(stack, { scale: 0.85, duration: 0.5, ease: 'ui-in-out' }, '+=0.5')
    .to(stack, { y: () => window.innerHeight / 2, ...STACK_END, duration: 1, ease: 'ui-in-out' });

  // 4. "lemme introduce you to my alter egos." with the underline drawing in.
  tl.to(words, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'ui-out', stagger: 0.06 }, '-=0.35')
    .to(underline, { '--underline-progress': 1, duration: 0.6, ease: 'ui-in-out' }, '-=0.15');

  // 5. Gradient wipe bottom → top; swap intro for home while it covers the screen.
  // (The same wipe every page change uses: cover, swap underneath, reveal.)
  tl.addLabel('wipe', '+=1')
    .add(wipeCover(), 'wipe')
    .set(root, { autoAlpha: 0 }, `wipe+=${WIPE_HALF}`)
    .add(wipeReveal(), `wipe+=${WIPE_HALF}`)
    .add(home.reveal(), `wipe+=${WIPE_HALF + 0.15}`);

  // Any click (or key press, for keyboard users) goes straight to the home page.
  const skip = () => tl.progress(1);
  function removeSkip() {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
  }
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);

  return () => {
    finish();
    tl.kill();
  };
}
