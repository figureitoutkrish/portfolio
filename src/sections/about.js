import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from '../utils/split.js';

gsap.registerPlugin(ScrollTrigger);

// About (pamidordesign.co-inspired):
//   - the intro paragraph brightens word by word as it scrolls through the screen
//   - the tilted photo drifts a little slower than the page
//   - the blue card cycles through highlights (paused while the tab is hidden)
export function initAbout({ reducedMotion }) {
  const root = document.querySelector('.about');
  if (!root) return () => {};

  const text = root.querySelector('.about__text');
  const photo = root.querySelector('.about__float');
  const stats = [...root.querySelectorAll('.stat')];
  const triggers = [];

  if (!reducedMotion) {
    const words = splitWords(text);
    // Opacity rather than colour: compositor-friendly, and reads as grey → black on the light page.
    const reveal = gsap.fromTo(
      words,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: text, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
      }
    );
    const drift = gsap.fromTo(
      photo,
      { yPercent: 14 },
      { yPercent: -14, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true } }
    );
    triggers.push(reveal.scrollTrigger, drift.scrollTrigger);
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
