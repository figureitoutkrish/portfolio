import gsap from 'gsap';

// Cursor trail over the portrait (inspired by pamidordesign.co): every SPACING px of pointer
// travel, the next of Krish's 8 blue illustrations drops where the pointer is, pops in, then
// fades. Decorative only — pointer devices only, nothing for touch or reduced motion.
const SPACING = 90;

export function initTrail({ reducedMotion }) {
  const area = document.querySelector('.home__photo');
  const layer = area?.querySelector('.trail');
  if (!layer || reducedMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {};

  const images = [...layer.querySelectorAll('img')];
  // The images are only fetched here — touch devices and reduced motion never download them.
  const load = () => images.forEach((img) => img.dataset.src && (img.src = img.dataset.src));
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2000 });
  else setTimeout(load, 1200);
  let next = 0;
  let z = 1;
  let last = null;

  const local = (e) => {
    const r = area.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drop = ({ x, y }) => {
    const img = images[next];
    next = (next + 1) % images.length;
    gsap.killTweensOf(img);
    gsap.set(img, { x: x - img.offsetWidth / 2, y: y - img.offsetHeight / 2, rotation: gsap.utils.random(-14, 14), zIndex: z++ });
    gsap
      .timeline()
      .fromTo(img, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'ui-out' })
      .to(img, { opacity: 0, scale: 0.9, duration: 0.3, ease: 'ui-out' }, '+=0.45'); // leaves faster than it arrives
  };

  const onMove = (e) => {
    const p = local(e);
    if (!last) {
      last = p;
      drop(p);
      return;
    }
    if (Math.hypot(p.x - last.x, p.y - last.y) >= SPACING) {
      last = p;
      drop(p);
    }
  };
  const onLeave = () => {
    last = null;
  };

  area.addEventListener('pointermove', onMove);
  area.addEventListener('pointerleave', onLeave);
  return () => {
    area.removeEventListener('pointermove', onMove);
    area.removeEventListener('pointerleave', onLeave);
  };
}
