import { sfx } from './sound.js';
import gsap from 'gsap';

// The cat: a die-cut sticker waiting at the finish line. Every hover (a tap on touch, Enter on the
// keyboard) swaps it for another cat; grab it and stick it anywhere on the page. Where you leave
// it is remembered (this browser only; as shares of the page's width and height, so it lands in
// about the same place on another screen size). Dragging near the top or bottom of the screen
// scrolls the page, so it can travel all the way up to the Mac.
const CATS = [
  { src: '/assets/creative/cat-shaka.webp', w: 360, h: 272, alt: 'a kitten sticking its tongue out, hand doing a shaka' },
  { src: '/assets/creative/cat-thumb.webp', w: 360, h: 254, alt: 'a kitten giving a thumbs up' },
  { src: '/assets/creative/cat-plain.webp', w: 360, h: 253, alt: 'a kitten staring at you, unimpressed' },
];
const KEY = 'krish:cat';
const EDGE = 72; // px from the screen edge where dragging starts scrolling

export function initCat({ reducedMotion, lenis }) {
  const page = document.querySelector('.page--creative');
  const home = document.querySelector('.podium');
  if (!page || !home) return () => {};
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'catpet';
  el.setAttribute('aria-label', 'A cat sticker: hover or press Enter for another cat, drag to stick it anywhere');
  el.innerHTML = `${CATS.map((c, i) => `<img src="${c.src}" width="${c.w}" height="${c.h}" alt="" draggable="false" decoding="async"${i ? ' hidden' : ''} />`).join('')}<span class="catpet__hint note" aria-hidden="true">${fine.matches ? 'hover me.' : 'tap me.'}<br />then take me anywhere.</span>`;
  page.append(el);
  const imgs = [...el.querySelectorAll('img')];
  const hint = el.querySelector('.catpet__hint');
  el.dataset.cat = '0';

  let i = 0;
  const show = (n) => {
    i = (n + CATS.length) % CATS.length;
    imgs.forEach((im, j) => (im.hidden = j !== i));
    el.dataset.cat = String(i);
  };
  const next = () => {
    show(i + 1);
    sfx('mrrp');
    if (!reducedMotion) gsap.fromTo(el.querySelector('img:not([hidden])'), { scale: 0.86, rotation: gsap.utils.random(-10, 10) }, { scale: 1, rotation: 0, duration: 0.35, ease: 'back.out(2.4)' });
    hint.classList.add('is-gone');
  };

  // ---------- position (page coordinates; x as a share of the page width, so it survives resizes) ----------
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
  } catch {
    /* ignore */
  }
  const tilt = saved?.r ?? -8;
  const place = (x, y) => {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };
  // at the finish: right of the sign-off on wide screens, under it on phones
  const defaultSpot = () => {
    const p = page.getBoundingClientRect();
    const h = home.getBoundingClientRect();
    if (matchMedia('(min-width: 1024px)').matches) return { x: h.right - p.left - el.offsetWidth - 8, y: h.top - p.top + h.height * 0.5 };
    return { x: (p.width - el.offsetWidth) / 2 + 30, y: h.bottom - p.top + 8 };
  };
  const restore = () => {
    if (saved && Number.isFinite(saved.xr) && Number.isFinite(saved.yr)) {
      const maxX = page.clientWidth - el.offsetWidth;
      const maxY = page.scrollHeight - el.offsetHeight;
      place(Math.max(0, Math.min(maxX, saved.xr * page.clientWidth)), Math.max(0, Math.min(maxY, saved.yr * page.scrollHeight)));
      hint.classList.add('is-gone');
    } else {
      const d = defaultSpot();
      place(d.x, d.y);
    }
  };
  gsap.set(el, { rotation: tilt });
  restore();
  // fonts and images settle the layout after load; re-place if it was never moved
  window.addEventListener('load', restore, { once: true });
  window.addEventListener('resize', restore);

  // ---------- hover / tap / keyboard: another cat ----------
  let dragging = false;
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' && fine.matches && !dragging) next();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      next();
    }
  });

  // ---------- drag anywhere ----------
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    gsap.killTweensOf(el);
    const r0 = el.getBoundingClientRect();
    // grab offset, so it doesn't jump to the cursor
    const gx = e.clientX - r0.left;
    const gy = e.clientY - r0.top;
    let px = e.clientX;
    let py = e.clientY;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    let raf = 0;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or ended pointer */
    }
    if (!reducedMotion) gsap.to(el, { scale: 1.06, duration: 0.12, ease: 'ui-out' });

    const follow = () => {
      const p = page.getBoundingClientRect();
      const x = Math.max(-el.offsetWidth * 0.3, Math.min(p.width - el.offsetWidth * 0.7, px - p.left - gx));
      const y = Math.max(0, Math.min(page.scrollHeight - el.offsetHeight, py - p.top - gy));
      place(x, y);
    };
    // near the top / bottom edge: scroll the page and keep the cat under the pointer
    const tick = () => {
      const v = py < EDGE ? -(EDGE - py) : py > window.innerHeight - EDGE ? py - (window.innerHeight - EDGE) : 0;
      if (v && moved) {
        const by = Math.round(v * 0.35);
        if (lenis) lenis.scrollTo(lenis.scroll + by, { immediate: true, force: true });
        else window.scrollBy(0, by);
        follow();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const move = (ev) => {
      px = ev.clientX;
      py = ev.clientY;
      if (!moved && Math.hypot(px - start.x, py - start.y) > 5) {
        moved = true;
        dragging = true;
        el.classList.add('is-held');
        hint.classList.add('is-gone');
        sfx('peel');
        if (!reducedMotion) gsap.to(el, { scale: 1.12, rotation: 0, duration: 0.18, ease: 'ui-out' });
      }
      if (moved) follow();
    };
    const up = () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('is-held');
      dragging = false;
      if (!moved) {
        if (!reducedMotion) gsap.to(el, { scale: 1, duration: 0.2, ease: 'ui-out' });
        if (e.pointerType !== 'mouse' || !fine.matches) next(); // a tap swaps the cat on touch
        return;
      }
      sfx('drop');
      // slap it down: a new little tilt, a squash, then still
      const r = Math.round(gsap.utils.random(-12, 12));
      if (reducedMotion) gsap.set(el, { scale: 1, rotation: r });
      else gsap.timeline().to(el, { scale: 0.94, rotation: r, duration: 0.1, ease: 'ui-out' }).to(el, { scale: 1, duration: 0.35, ease: 'back.out(3)' });
      saved = { xr: parseFloat(el.style.left) / page.clientWidth, yr: parseFloat(el.style.top) / page.scrollHeight, r };
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
  // a drag is not a click
  el.addEventListener('click', (e) => e.preventDefault());

  return () => {
    window.removeEventListener('resize', restore);
    el.remove();
  };
}
