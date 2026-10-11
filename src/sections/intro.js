import gsap from 'gsap';

// Resting pose of each polaroid in the stack (back to front).
const POSES = [
  { xPercent: -18, yPercent: -4, rotation: -7 },
  { xPercent: 20, yPercent: -8, rotation: 8 },
  { xPercent: 0, yPercent: 0, rotation: -2 },
];

// Stack centred on screen vs. shrunk onto the bottom edge (top itself is handled separately).
const STACK_CENTER = { xPercent: -50, yPercent: -50, scale: 1 };
const STACK_END = { xPercent: -50, yPercent: -62, scale: 0.42 };

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

export function initIntro({ reducedMotion }) {
  const root = document.querySelector('.intro');
  if (!root) return () => {};

  const hello = root.querySelector('.intro__hello');
  const stack = root.querySelector('.intro__stack');
  const polaroids = gsap.utils.toArray('.polaroid', root);
  const headline = root.querySelector('.intro__headline');
  const underline = root.querySelector('.underline');

  const settle = () => {
    root.classList.add('is-done');
    gsap.set(stack, { clearProps: 'top' }); // CSS takes over: top: 100%
  };

  // Reduced motion: jump straight to the end state.
  if (reducedMotion) {
    settle();
    gsap.set(stack, STACK_END);
    polaroids.forEach((p, i) => gsap.set(p, { ...POSES[i], autoAlpha: 1 }));
    gsap.set(headline, { autoAlpha: 1 });
    return () => {};
  }

  const words = splitWords(headline);
  gsap.set(stack, STACK_CENTER);
  gsap.set(headline, { autoAlpha: 1 });
  gsap.set(words, { autoAlpha: 0, yPercent: 60 });
  gsap.set(underline, { '--underline-progress': 0 });

  const tl = gsap.timeline({ delay: 0.2, onComplete: removeSkip });

  // 1. "hi, my name is krish"
  tl.fromTo(hello, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' })
    .to(hello, { autoAlpha: 0, y: -16, duration: 0.5, ease: 'power2.in' }, '+=1.1');

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
    .to(stack, { top: '100%', ...STACK_END, duration: 1, ease: 'power3.inOut' })
    .call(settle);

  // 4. "lemme introduce you to my alter egos." with the underline drawing in.
  tl.to(words, { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, '-=0.35')
    .to(underline, { '--underline-progress': 1, duration: 0.6, ease: 'power2.inOut' }, '-=0.15');

  // Any click or key press skips to the end.
  const skip = () => tl.progress(1);
  function removeSkip() {
    window.removeEventListener('pointerdown', skip);
    window.removeEventListener('keydown', skip);
  }
  window.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);

  return () => {
    removeSkip();
    tl.kill();
  };
}
