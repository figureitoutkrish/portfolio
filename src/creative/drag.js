import gsap from 'gsap';
import { project, rubberband } from '../utils/spring.js';

// Pick-up-and-move for things on the desk (stickers, sticky notes), Apple-style:
//   - responds on press (lifts a touch the moment you grab it), then tracks 1:1 from where you
//     grabbed it; grabbing it mid-animation stops that animation and starts from where it is
//   - a flick throws it: the release velocity is projected forward, then it settles there
//   - soft edges: past the desk it rubber-bands, and on release it comes back inside, so nothing
//     gets lost off-screen
//   - a tap runs onTap (follow a link, flip a note); a drag never does
export function makeDraggable(el, { onTap, onDrop, reducedMotion, store, bounds } = {}) {
  const rest = gsap.getProperty(el, 'rotation');
  let moved = false;

  if (store) {
    const saved = store.get();
    if (saved) gsap.set(el, { x: saved.x, y: saved.y });
  }

  // How far it may travel (in its own x/y offset space) and still be mostly on the desk.
  const limits = () => {
    const area = (bounds?.() || el.offsetParent || document.body).getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = gsap.getProperty(el, 'x');
    const y = gsap.getProperty(el, 'y');
    const keep = 0.4; // at least 40% of it stays inside
    return {
      minX: x + (area.left - r.left) - r.width * (1 - keep),
      maxX: x + (area.right - r.right) + r.width * (1 - keep),
      minY: y + (area.top - r.top) - r.height * (1 - keep),
      maxY: y + (area.bottom - r.bottom) + r.height * (1 - keep),
    };
  };
  const soft = (v, lo, hi, size) => (v < lo ? lo - rubberband(lo - v, size) : v > hi ? hi + rubberband(v - hi, size) : v);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('[data-nodrag]')) return;
    gsap.killTweensOf(el); // interruptible: start from where it is right now
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = gsap.getProperty(el, 'x');
    const oy = gsap.getProperty(el, 'y');
    const lim = limits();
    const samples = [{ x: sx, y: sy, t: e.timeStamp }];
    moved = false;
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or ended pointer */ }
    if (!reducedMotion) gsap.to(el, { scale: 1.03, duration: 0.12, ease: 'ui-out' }); // instant "picked up"

    const move = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      samples.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
      while (samples.length > 2 && ev.timeStamp - samples[0].t > 100) samples.shift();
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        el.classList.add('is-held');
        if (!reducedMotion) gsap.to(el, { scale: 1.07, rotation: rest * 0.4, duration: 0.18, ease: 'ui-out' });
      }
      if (moved) gsap.set(el, { x: soft(ox + dx, lim.minX, lim.maxX, 240), y: soft(oy + dy, lim.minY, lim.maxY, 240) });
    };
    const up = (ev) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) {
        if (!reducedMotion) gsap.to(el, { scale: 1, duration: 0.2, ease: 'ui-out' });
        return;
      }
      el.classList.remove('is-held');
      // throw: project the release velocity forward, land inside the desk
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = Math.max(1, b.t - a.t);
      const vx = ((b.x - a.x) / dt) * 1000;
      const vy = ((b.y - a.y) / dt) * 1000;
      const x = clamp(gsap.getProperty(el, 'x') + (reducedMotion ? 0 : project(vx, 0.99)), lim.minX, lim.maxX);
      const y = clamp(gsap.getProperty(el, 'y') + (reducedMotion ? 0 : project(vy, 0.99)), lim.minY, lim.maxY);
      // a little bounce only because a throw preceded it
      gsap.to(el, { x, y, scale: 1, rotation: rest, duration: reducedMotion ? 0 : 0.55, ease: 'back.out(1.6)' });
      const pos = { x: Math.round(x), y: Math.round(y) };
      store?.set(pos);
      onDrop?.(pos, ev);
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
