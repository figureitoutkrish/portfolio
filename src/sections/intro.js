import gsap from 'gsap';

// Resting pose of each polaroid in the stack (back to front).
const POSES = [
  { xPercent: -18, yPercent: -4, rotation: -7 },
  { xPercent: 20, yPercent: -8, rotation: 8 },
  { xPercent: 0, yPercent: 0, rotation: -2 },
];

// Stack centred on screen vs. shrunk onto the bottom edge (the drop itself is a `y` tween).
const STACK_CENTER = { xPercent: -50, yPercent: -50, scale: 1 };
const STACK_END = { xPercent: -50, yPercent: -62, scale: 0.42 };

// The wipe travels from just below the screen to just above it. With a symmetric ease it
// sits at -60vh — fully covering the screen — exactly halfway through.
const WIPE_DURATION = 1.6;

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

// Wraps each word of the headline in a span so words can rise in one by one.
// Child elements (the underlined "alter egos") are kept whole and animate as one word.
function splitWords(el) {
  const words = [];
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.add('word');
      words.push(node);
      return;
    }
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        frag.append(token);
        return;
      }
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = token;
      frag.append(span);
      words.push(span);
    });
    node.replaceWith(frag);
  });
  return words;
}

// Plays the intro over the home page, then wipes to it. `home` is the object from initHome();
// `lenis` (optional) is paused so the page underneath can't scroll during the intro.
export function initIntro({ reducedMotion, home, lenis }) {
  const root = document.querySelector('.intro');
  const wipe = document.querySelector('.wipe');

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

  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
  const finish = () => {
    removeSkip();
    lenis?.start();
    document.documentElement.style.overflow = '';
  };

  const tl = gsap.timeline({ delay: 0.8, onComplete: finish }); // a beat of empty screen before the greeting

  // 1. "hi, i'm krish"
  // Words rise in one by one (same motion as the headline), then lift away in the same order.
  tl.to(helloWords, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09 })
    .to(helloWords, { autoAlpha: 0, yPercent: -40, duration: 0.45, ease: 'power2.in', stagger: 0.05 }, '+=1');

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
  tl.to(stack, { scale: 0.85, duration: 0.5, ease: 'power2.inOut' }, '+=0.5')
    .to(stack, { y: () => window.innerHeight / 2, ...STACK_END, duration: 1, ease: 'power3.inOut' });

  // 4. "lemme introduce you to my alter egos." with the underline drawing in.
  tl.to(words, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, '-=0.35')
    .to(underline, { '--underline-progress': 1, duration: 0.6, ease: 'power2.inOut' }, '-=0.15');

  // 5. Gradient wipe bottom → top; swap intro for home while it covers the screen.
  tl.addLabel('wipe', '+=1')
    .set(wipe, { autoAlpha: 1 }, 'wipe')
    .fromTo(
      wipe,
      { y: () => window.innerHeight },
      { y: () => -2.2 * window.innerHeight, duration: WIPE_DURATION, ease: 'power2.inOut' },
      'wipe'
    )
    .set(root, { autoAlpha: 0 }, `wipe+=${WIPE_DURATION / 2}`)
    .add(home.reveal(), `wipe+=${WIPE_DURATION / 2 + 0.15}`)
    .set(wipe, { autoAlpha: 0 }, `wipe+=${WIPE_DURATION}`);

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
