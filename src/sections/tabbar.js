import gsap from 'gsap';
import { createLiquidGlass } from '../utils/liquid-glass.js';
import { createSpring, project, rubberband } from '../utils/spring.js';

// The floating liquid-glass tab bar: the main way between pages.
//   - The circle marks the open page. It responds on press (not release), can be dragged
//     between icons 1:1, and on release is thrown to wherever the flick was heading.
//   - It's driven by springs, so it's interruptible and stretches like a droplet while moving.
//   - data-visibility="scroll" (home): hidden at the top, appears once you scroll down.
//     data-visibility="always" (other pages): always visible.
export function initTabbar({ reducedMotion, navigate }) {
  const bar = document.querySelector('.tabbar');
  if (!bar) return () => {};

  const items = [...bar.querySelectorAll('.tabbar__item')];
  const indicator = bar.querySelector('.tabbar__indicator');
  const glass = createLiquidGlass(bar, { bezel: 16, strength: 32 });

  let active = Math.max(0, items.findIndex((a) => a.getAttribute('aria-current') === 'page'));
  const centerOf = (i) => items[i].offsetLeft + items[i].offsetWidth / 2;
  const indexAt = (x) => {
    let best = 0;
    items.forEach((_, i) => {
      if (Math.abs(centerOf(i) - x) < Math.abs(centerOf(best) - x)) best = i;
    });
    return best;
  };

  // ---------- indicator: position spring + press spring ----------
  const state = { x: 0, v: 0, press: 1 };
  const render = () => {
    const stretch = reducedMotion ? 0 : Math.min(Math.abs(state.v) / 2600, 0.32);
    const sx = (1 + stretch) * state.press;
    const sy = (1 - stretch * 0.45) * state.press;
    indicator.style.transform = `translateX(${state.x}px) translateX(-50%) scale(${sx}, ${sy})`;
  };
  // Momentum interaction → a little bounce (damping 0.8), per Apple's drawer/sheet values.
  const xs = createSpring({
    response: 0.32,
    damping: 0.8,
    onUpdate: (x, v) => {
      state.x = x;
      state.v = v;
      render();
    },
  });
  const ps = createSpring({
    value: 1,
    response: 0.25,
    damping: 0.75,
    onUpdate: (s) => {
      state.press = s;
      render();
    },
  });
  const moveTo = (i, opts) => (reducedMotion ? xs.jump(centerOf(i)) : xs.set(centerOf(i), opts));
  const pressTo = (s) => (reducedMotion ? null : ps.set(s));

  const place = () => xs.jump(centerOf(active));
  place();
  window.addEventListener('resize', place);

  // ---------- press, drag, release ----------
  let pointer = null;
  let suppressClick = false;

  const velocity = () => {
    const s = pointer.samples;
    const a = s[0];
    const b = s[s.length - 1];
    const dt = (b.t - a.t) / 1000;
    return dt > 0 ? (b.x - a.x) / dt : 0;
  };

  const onDown = (e) => {
    if (pointer || e.button !== 0) return; // ignore extra fingers mid-gesture
    const local = e.clientX - bar.getBoundingClientRect().left;
    pointer = { id: e.pointerId, startX: e.clientX, dragging: false, samples: [{ x: local, t: e.timeStamp }] };
    moveTo(indexAt(local)); // respond on press: the lens goes to what you touched
    pressTo(1.14);
  };

  const onMove = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const local = e.clientX - bar.getBoundingClientRect().left;
    pointer.samples.push({ x: local, t: e.timeStamp });
    pointer.samples = pointer.samples.filter((s) => e.timeStamp - s.t < 100);

    if (!pointer.dragging && Math.abs(e.clientX - pointer.startX) > 8) {
      pointer.dragging = true;
      bar.setPointerCapture(e.pointerId);
    }
    if (!pointer.dragging) return;

    // 1:1 tracking between the first and last icon, rubber-banding past them.
    const min = centerOf(0);
    const max = centerOf(items.length - 1);
    let x = local;
    if (x < min) x = min - rubberband(min - x, bar.offsetWidth);
    if (x > max) x = max + rubberband(x - max, bar.offsetWidth);
    xs.track(x, velocity());
  };

  const onUp = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pressTo(1);
    if (pointer.dragging) {
      // Throw it: pick the icon nearest to where the flick would come to rest.
      const v = velocity();
      const target = indexAt(xs.value + project(v, 0.99));
      xs.set(centerOf(target), { velocity: v });
      suppressClick = true;
      if (target !== active) navigate(items[target].getAttribute('href'));
    }
    // A plain tap falls through to the link's click → page transition.
    pointer = null;
  };

  const onCancel = () => {
    if (!pointer) return;
    pointer = null;
    pressTo(1);
    moveTo(active);
  };

  // After a drag, the browser may still fire a click on whatever is under the pointer.
  const onClickCapture = (e) => {
    if (!suppressClick) return;
    suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  bar.addEventListener('pointerdown', onDown);
  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
  bar.addEventListener('pointercancel', onCancel);
  bar.addEventListener('lostpointercapture', onCancel);
  bar.addEventListener('click', onClickCapture, true);

  // ---------- show / hide ----------
  let shown = false;
  const setShown = (next) => {
    if (next === shown) return;
    shown = next;
    if (next) {
      glass.updateTone();
      gsap.to(bar, { autoAlpha: 1, y: 0, scale: 1, duration: reducedMotion ? 0.2 : 0.5, ease: 'expo.out', overwrite: true });
    } else {
      gsap.to(bar, {
        autoAlpha: 0,
        y: reducedMotion ? 0 : 16,
        scale: reducedMotion ? 1 : 0.94,
        duration: 0.25,
        ease: 'power2.out',
        overwrite: true,
      });
    }
  };

  let onScroll = null;
  if (bar.dataset.visibility === 'scroll') {
    gsap.set(bar, { autoAlpha: 0, y: reducedMotion ? 0 : 16, scale: reducedMotion ? 1 : 0.94 });
    onScroll = () => {
      const y = window.scrollY;
      // Hysteresis: appear after 20% of a screen, disappear again near the top.
      if (!shown && y > window.innerHeight * 0.2) setShown(true);
      else if (shown && y < window.innerHeight * 0.1) setShown(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    setShown(true);
  }

  return () => {
    glass.destroy();
    window.removeEventListener('resize', place);
    if (onScroll) window.removeEventListener('scroll', onScroll);
  };
}
