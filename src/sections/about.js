import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from '../utils/split.js';

gsap.registerPlugin(ScrollTrigger);

// About (pamidordesign.co-inspired):
//   - the intro pins: the page holds still while the paragraph reveals word by word — each word
//     lights up in the accent blue and settles to ink, so a blue wave runs through the text —
//     then scrolling carries on
//   - the tilted photo drifts gently while pinned
//   - the blue card cycles through highlights (paused while the tab is hidden)
export function initAbout({ reducedMotion }) {
  const root = document.querySelector('.about');
  if (!root) return () => {};

  const intro = root.querySelector('.about__intro');
  const text = root.querySelector('.about__text');
  const photo = root.querySelector('.about__float');
  const stats = [...root.querySelectorAll('.stat')];
  const triggers = [];

  if (!reducedMotion) {
    const words = splitWords(text);
    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const ink = css.getPropertyValue('--fg').trim();
    gsap.set(words, { opacity: 0.16 });

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
    tl.to(words, { opacity: 1, color: accent, duration: 0.4, stagger: 0.12 }, 0).to(
      words,
      { color: ink, duration: 0.6, stagger: 0.12 },
      0.35
    );
    tl.fromTo(photo, { yPercent: 10 }, { yPercent: -10, duration: tl.duration() }, 0);
    tl.to({}, { duration: 0.8 }); // rest on the finished paragraph before letting go
    triggers.push(tl.scrollTrigger);
  }

  // Highlights card.
  let current = 0;
  let timer = null;
  gsap.set(stats.slice(1), { autoAlpha: 0 });
  if (stats.length > 1) {
    const show = () => {
      if (document.hidden) return;
      const out = stats[current];
      current = (current + 1) % stats.length;
      const into = stats[current];
      if (reducedMotion) {
        gsap.set(out, { autoAlpha: 0 });
        gsap.set(into, { autoAlpha: 1 });
        return;
      }
      // Blur bridges the swap so it reads as one thing changing, not two overlapping.
      gsap.to(out, { autoAlpha: 0, y: -12, filter: 'blur(3px)', duration: 0.3, ease: 'ui-out' });
      gsap.fromTo(
        into,
        { autoAlpha: 0, y: 12, filter: 'blur(3px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'ui-out', delay: 0.12 }
      );
    };
    timer = setInterval(show, 3400);
  }

  return () => {
    triggers.forEach((t) => t?.kill());
    clearInterval(timer);
  };
}
