import gsap from 'gsap';
import { createLiquidGlass } from '../utils/liquid-glass.js';
import { createSpring, project, rubberband } from '../utils/spring.js';
import { arrivedViaWipe } from '../utils/transition.js';

// The floating liquid-glass tab bar: the main way between pages.
//   - A capsule marks the open page. It responds on press (not release), can be dragged
//     between icons 1:1, and on release is thrown to wherever the flick was heading. It runs
//     on springs, so it's interruptible and stretches like a droplet while moving.
//   - Icons cross-fade outline → filled for the selected page (with a touch of blur so the
//     two states blend instead of visibly swapping).
//   - The bar sits above the page wipe, so it stays put while pages change underneath.
//   - data-visibility="scroll" (home): hidden at the top, materialises once you scroll.
//     data-visibility="always" (other pages): always visible.
export function initTabbar({ reducedMotion, navigate }) {
  const bar = document.querySelector('.tabbar');
  if (!bar) return () => {};

  const items = [...bar.querySelectorAll('.tabbar__item')];
  const indicator = bar.querySelector('.tabbar__indicator');
  const glass = createLiquidGlass(bar, { bezel: 18, strength: 36 });

  let active = Math.max(0, items.findIndex((a) => a.getAttribute('aria-current') === 'page'));
  const centerOf = (i) => items[i].offsetLeft + items[i].offsetWidth / 2;
  const indexAt = (x) => {
    let best = 0;
    items.forEach((_, i) => {
      if (Math.abs(centerOf(i) - x) < Math.abs(centerOf(best) - x)) best = i;
    });
    return best;
  };

  let selected = -1;
  const select = (i) => {
    if (i === selected) return;
    selected = i;
    items.forEach((a, j) => a.classList.toggle('is-selected', j === i));
  };
  select(active);

  // ---------- indicator: position spring + press spring ----------
  const state = { x: 0, v: 0, press: 1 };
  const render = () => {
    const stretch = reducedMotion ? 0 : Math.min(Math.abs(state.v) / 2600, 0.28);
    const sx = (1 + stretch) * state.press;
    const sy = (1 - stretch * 0.4) * state.press;
    indicator.style.transform = `translateX(${state.x}px) translateX(-50%) scale(${sx}, ${sy})`;
  };
  // A little bounce (damping 0.8) because the capsule is often thrown — Apple's sheet values.
  const xs = createSpring({
    response: 0.34,
    damping: 0.8,
    onUpdate: (x, v) => {
      state.x = x;
      state.v = v;
      render();
    },
  });
  const ps = createSpring({
    value: 1,
    response: 0.22,
    damping: 0.8,
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
    const dt = (s[s.length - 1].t - s[0].t) / 1000;
    return dt > 0 ? (s[s.length - 1].x - s[0].x) / dt : 0;
  };

  const onDown = (e) => {
    if (pointer || e.button !== 0) return; // ignore extra fingers mid-gesture
    const local = e.clientX - bar.getBoundingClientRect().left;
    pointer = { id: e.pointerId, startX: e.clientX, dragging: false, samples: [{ x: local, t: e.timeStamp }] };
    const i = indexAt(local);
    moveTo(i); // respond on press: the capsule goes to what you touched
    select(i);
    pressTo(1.06);
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
    select(indexAt(x)); // icons light up as the capsule passes them
  };

  const onUp = (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    pressTo(1);
    if (pointer.dragging) {
      // Throw it: pick the icon nearest to where the flick would come to rest.
      const v = velocity();
      const target = indexAt(xs.value + project(v, 0.99));
      xs.set(centerOf(target), { velocity: v });
      select(target);
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
    select(active);
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

  // ---------- tone while the page wipe passes underneath ----------
  // The wipe's deep blue middle sits right behind the bar, so go dark until the new page shows.
  const onCover = () => glass.setTone('dark');
  const onRevealed = () => glass.updateTone();
  window.addEventListener('wipe:cover', onCover);
  window.addEventListener('wipe:revealed', onRevealed);
  window.addEventListener('theme:change', () => requestAnimationFrame(onRevealed)); // instant switches (no sweep)
  if (arrivedViaWipe()) glass.setTone('dark');

  // ---------- show / hide ----------
  // Enter: the glass materialises — the pill swells out from a narrower droplet while its
  // lensing fades up, then the icons resolve out of a soft blur, one after another.
  // Exit: quicker and simpler than the entrance.
  const refraction = { v: 0 };
  const setRefraction = (v) => {
    refraction.v = v;
    glass.setStrength(v);
  };
  let shown = false;
  let motion = null;

  const setShown = (next, { instant = false } = {}) => {
    if (next === shown) return;
    shown = next;
    motion?.kill();
    gsap.killTweensOf([bar, items, indicator, refraction]);

    if (next) glass.updateTone();

    if (instant || reducedMotion) {
      gsap.set(bar, { autoAlpha: next ? 1 : 0, y: 0, scaleX: 1, scaleY: 1 });
      gsap.set(items, { opacity: 1, scale: 1, filter: 'none' });
      gsap.set(indicator, { opacity: 1 });
      setRefraction(next ? glass.strength : 0);
      return;
    }

    if (next) {
      motion = gsap
        .timeline()
        .fromTo(bar, { autoAlpha: 0, y: 20, scaleX: 0.82, scaleY: 0.9 }, { autoAlpha: 1, y: 0, scaleX: 1, scaleY: 1, duration: 0.5, ease: 'ui-out' }, 0)
        .fromTo(refraction, { v: 0 }, { v: glass.strength, duration: 0.6, ease: 'ui-out', onUpdate: () => setRefraction(refraction.v) }, 0)
        .fromTo(indicator, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'ui-out' }, 0.1)
        .fromTo(
          items,
          { opacity: 0, scale: 0.86, filter: 'blur(4px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.35, ease: 'ui-out', stagger: 0.045, clearProps: 'filter' },
          0.08
        );
    } else {
      motion = gsap
        .timeline()
        .to(bar, { autoAlpha: 0, y: 12, scaleX: 0.94, scaleY: 0.94, duration: 0.18, ease: 'ui-out' }, 0)
        .to(refraction, { v: 0, duration: 0.18, ease: 'ui-out', onUpdate: () => setRefraction(refraction.v) }, 0);
    }
  };

  let onScroll = null;
  if (bar.dataset.visibility === 'scroll') {
    gsap.set(bar, { autoAlpha: 0 });
    onScroll = () => {
      if (document.documentElement.classList.contains('is-intro')) {
        setShown(false, { instant: true }); // never over the intro
        return;
      }
      const y = window.scrollY;
      // Hysteresis: appear after 20% of a screen, disappear again near the top.
      if (!shown && y > window.innerHeight * 0.2) setShown(true);
      else if (shown && y < window.innerHeight * 0.1) setShown(false);
    };
    if (arrivedViaWipe()) {
      // Coming from another page the bar was on screen: keep it there through the wipe,
      // then let it slip away if we've landed at the top.
      setShown(true, { instant: true });
      window.addEventListener('wipe:revealed', () => setTimeout(onScroll, 250), { once: true });
    } else {
      onScroll();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('intro:start', onScroll);
    window.addEventListener('intro:done', onScroll);
  } else {
    // Persist across a page change; materialise on a fresh landing.
    if (arrivedViaWipe()) setShown(true, { instant: true });
    else gsap.delayedCall(0.25, () => setShown(true));
  }

  return () => {
    glass.destroy();
    window.removeEventListener('resize', place);
    window.removeEventListener('wipe:cover', onCover);
    window.removeEventListener('wipe:revealed', onRevealed);
    if (onScroll) window.removeEventListener('scroll', onScroll);
  };
}
