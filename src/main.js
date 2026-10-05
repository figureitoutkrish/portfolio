import './styles/main.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene } from './three/scene.js';

gsap.registerPlugin(ScrollTrigger);

const world = createScene(document.getElementById('webgl'));

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
