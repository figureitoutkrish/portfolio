import './styles/main.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene } from './three/scene.js';
import { prefersReducedMotion } from './utils/motion.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = prefersReducedMotion();
const world = createScene(document.getElementById('webgl'), { reducedMotion });

// Reduced motion: keep native scrolling and skip the reveal animations entirely.
if (!reducedMotion) {
  const lenis = new Lenis();
  lenis.on('scroll', ({ scroll }) => {
    ScrollTrigger.update();
    world.setScroll(scroll);
  });
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.from(el, {
      y: 60,
      opacity: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
}
