import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from '../utils/split.js';

gsap.registerPlugin(ScrollTrigger);

// About (pamidordesign.co-inspired):
//   - the intro pins: the page holds still while the paragraph reveals word by word — each word
//     lights up in the accent blue and settles to ink, so a blue wave runs through the text —
//     then scrolling carries on
//   - the two polaroids drift while pinned, at different rates, so they shift against each other
//   - the numbers strip below it lives in metrics.js
export function initAbout({ reducedMotion }) {
  const root = document.querySelector('.about');
  if (!root) return () => {};

  const intro = root.querySelector('.about__intro');
  const text = root.querySelector('.about__text');
  const [back, front] = root.querySelectorAll('.about__pol');
  const triggers = [];

  if (!reducedMotion) {
    const words = splitWords(text);
    // --blue (0 → 1 → 0) mixes the accent into the text colour in CSS, so the wave follows
    // whichever theme is active instead of baking in fixed colours.
    gsap.set(words, { opacity: 0.16, '--blue': 0 });

    const tl = gsap.timeline({
      defaults: { ease: 'none' }, // scrubbed: the scroll itself is the easing
      scrollTrigger: {
        trigger: intro,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 1.6)}`, // ~1.6 screens of scrolling to read it
        pin: true,
        scrub: 0.8, // a little lag so the reveal glides instead of stepping with the wheel
        invalidateOnRefresh: true,
      },
    });
    tl.to(words, { opacity: 1, '--blue': 1, duration: 0.4, stagger: 0.12 }, 0).to(
      words,
      { '--blue': 0, duration: 0.6, stagger: 0.12 },
      0.35
    );
    tl.fromTo(back, { yPercent: 14, rotate: 6 }, { yPercent: -12, rotate: 3, duration: tl.duration() }, 0);
    tl.fromTo(front, { yPercent: 6, rotate: -7 }, { yPercent: -8, rotate: -5, duration: tl.duration() }, 0);
    tl.to({}, { duration: 0.8 }); // rest on the finished paragraph before letting go
    triggers.push(tl.scrollTrigger);
  }

  return () => {
    triggers.forEach((t) => t?.kill());
  };
}
