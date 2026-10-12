import gsap from 'gsap';

// Pick-up-and-move for things on the desk (stickers, sticky notes). Tells a tap from a drag:
// a tap runs onTap (follow a link, flip a note); a drag never does. While held, the thing lifts
// (a little bigger, straighter, deeper shadow); on release it settles with a small spring.
export function makeDraggable(el, { onTap, onDrop, reducedMotion, store } = {}) {
  const rest = gsap.getProperty(el, 'rotation');
  let moved = false;

  // Restore where it was left this session.
  if (store) {
    const saved = store.get();
    if (saved) gsap.set(el, { x: saved.x, y: saved.y });
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('[data-nodrag]')) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = gsap.getProperty(el, 'x');
    const oy = gsap.getProperty(el, 'y');
    moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 5) {
        moved = true;
        el.classList.add('is-held');
        if (!reducedMotion) gsap.to(el, { scale: 1.06, rotation: rest * 0.4, duration: 0.18, ease: 'ui-out' });
      }
      if (moved) gsap.set(el, { x: ox + dx, y: oy + dy });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) return;
      el.classList.remove('is-held');
      // settle: back to its tilt, with a tiny overshoot so it feels like paper landing
      gsap.to(el, { scale: 1, rotation: rest, duration: reducedMotion ? 0 : 0.45, ease: 'back.out(2)' });
      const pos = { x: Math.round(gsap.getProperty(el, 'x')), y: Math.round(gsap.getProperty(el, 'y')) };
      store?.set(pos);
      onDrop?.(pos);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });

  // Clicks after a drag are swallowed (so a dragged link doesn't open).
  el.addEventListener(
    'click',
    (e) => {
      if (moved) {
        e.preventDefault();
        e.stopImmediatePropagation();
        moved = false;
        return;
      }
      onTap?.(e);
    },
    true
  );
}

// Session-only memory of where things were left on the desk.
export const sessionSpot = (id) => ({
  get() {
    try {
      return JSON.parse(sessionStorage.getItem(`krish:spot:${id}`));
    } catch {
      return null;
    }
  },
  set(v) {
    try {
      sessionStorage.setItem(`krish:spot:${id}`, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
});
