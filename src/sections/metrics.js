import { createSpring } from '../utils/spring.js';

// Numbers strip on home (kstoimenov.com-inspired):
//   - four columns divided by hairlines; the big numbers and their units slide up out of a mask
//     when the strip scrolls into view, one column after another
//   - hover a column and it fills with the blue gradient (+ fine grain), the text flips to ink
//   - a round "+" cursor follows the pointer over the strip (separate X / Y springs, so it lags
//     a touch behind like a real object); the system cursor hides there
// Reduced motion: no slide, no cursor; the hover fill stays (it's a colour change, not motion).
export function initMetrics({ reducedMotion }) {
  const root = document.querySelector('.metrics');
  if (!root) return () => {};

  // stagger: numbers 120ms apart, each unit 220ms after its number
  root.querySelectorAll('.metric').forEach((m, i) => {
    const [num, unit] = m.querySelectorAll('.metric__slide');
    if (num) num.style.transitionDelay = `${i * 0.12}s`;
    if (unit) unit.style.transitionDelay = `${i * 0.12 + 0.22}s`;
  });

  if (reducedMotion || !('IntersectionObserver' in window)) {
    root.classList.add('is-in');
    return () => {};
  }
  root.classList.add('is-armed'); // only now do the numbers start hidden (no JS = always visible)
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      root.classList.add('is-in');
      io.disconnect();
    },
    { threshold: 0.35 }
  );
  io.observe(root);

  // the "+" cursor: mouse and trackpad only
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return () => io.disconnect();
  const cur = document.createElement('span');
  cur.className = 'metrics__cursor';
  cur.setAttribute('aria-hidden', 'true');
  root.append(cur);
  const pos = { x: 0, y: 0 };
  const draw = () => (cur.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`);
  const sx = createSpring({ value: 0, response: 0.22, damping: 1, onUpdate: (v) => ((pos.x = v), draw()) });
  const sy = createSpring({ value: 0, response: 0.22, damping: 1, onUpdate: (v) => ((pos.y = v), draw()) });
  let inside = false;
  const onMove = (e) => {
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (!inside) {
      // appear right where the pointer is, then follow
      inside = true;
      sx.jump(x);
      sy.jump(y);
      root.classList.add('has-cursor');
    }
    sx.set(x);
    sy.set(y);
  };
  const onLeave = () => {
    inside = false;
    root.classList.remove('has-cursor');
  };
  root.addEventListener('pointermove', onMove, { passive: true });
  root.addEventListener('pointerleave', onLeave);
  return () => {
    io.disconnect();
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    cur.remove();
  };
}
