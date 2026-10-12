import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { PROJECTS, CATEGORIES, projectBySlug } from './data/projects.js';
import { openProject, initProjectWindow } from './project-window.js';

gsap.registerPlugin(Flip);

// The work: an asymmetric bento of window-style cards, with category filters that glide
// (GSAP Flip) instead of jumping. Cards open the project window (project-window.js).
export function initWork({ reducedMotion, lenis }) {
  const section = document.getElementById('work');
  const grid = section?.querySelector('.bento');
  const bar = section?.querySelector('.filters');
  if (!grid || !bar) return () => {};

  // ---------- filters ----------
  const used = CATEGORIES.filter((c) => PROJECTS.some((p) => p.category === c));
  bar.innerHTML = `<span class="filters__label" aria-hidden="true">view</span><div class="filters__seg">${['All', ...used]
    .map((c) => {
      const n = c === 'All' ? PROJECTS.length : PROJECTS.filter((p) => p.category === c).length;
      return `<button class="filter" type="button" data-filter="${c}" aria-pressed="${c === 'All'}">${c}<span class="filter__n">${n}</span></button>`;
    })
    .join('')}</div>`;

  // ---------- cards ----------
  grid.innerHTML = PROJECTS.map((p, i) => card(p, i)).join('');
  const cards = [...grid.querySelectorAll('.card')];

  let current = 'All';
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn || btn.dataset.filter === current) return;
    current = btn.dataset.filter;
    bar.querySelectorAll('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const state = Flip.getState(cards);
    cards.forEach((c) => (c.hidden = current !== 'All' && c.dataset.category !== current));
    if (reducedMotion) return;
    Flip.from(state, {
      duration: 0.5,
      ease: 'ui-in-out',
      absolute: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'ui-out' }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.2, ease: 'ui-out' }),
    });
  });

  // Blurry preview → sharp image: fade the real one in once it has loaded.
  grid.querySelectorAll('.card__img').forEach((im) => {
    const done = () => im.classList.add('is-loaded');
    if (im.complete && im.naturalWidth) done();
    else im.addEventListener('load', done, { once: true });
  });

  // Hover: cycle through this project's own images (desktop pointers, not reduced motion).
  if (!reducedMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cards.forEach((c) => {
      const p = projectBySlug(c.dataset.slug);
      const frames = (p.hover || p.gallery || []).filter((g) => g.sm !== p.cover?.sm);
      const imgEl = c.querySelector('.card__img');
      if (!imgEl || frames.length < 1) return;
      let timer = 0;
      let i = 0;
      let layer = null;
      const show = () => {
        const f = frames[i % frames.length];
        i += 1;
        const next = new Image();
        next.src = f.sm;
        next.className = 'card__img card__img--cycle';
        next.alt = '';
        next.decode?.().catch(() => {}).finally(() => {
          if (!c.matches(':hover')) return;
          c.querySelector('.card__media').append(next);
          gsap.fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'ui-out', onComplete: () => { layer?.remove(); layer = next; } });
        });
      };
      c.addEventListener('pointerenter', () => {
        frames.forEach((f) => (new Image().src = f.sm)); // warm them
        timer = setInterval(show, 900);
        setTimeout(show, 280);
      });
      c.addEventListener('pointerleave', () => {
        clearInterval(timer);
        i = 0;
        const stale = c.querySelectorAll('.card__img--cycle');
        gsap.to(stale, { autoAlpha: 0, duration: 0.25, ease: 'ui-out', onComplete: () => stale.forEach((n) => n.remove()) });
        layer = null;
      });
    });
  }

  grid.addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (c && c.dataset.slug) openProject(c.dataset.slug, { from: c });
  });

  // Gentle reveal as the grid comes into view (once).
  if (!reducedMotion) {
    gsap.set(cards, { autoAlpha: 0, y: 24 });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          gsap.to(en.target, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'ui-out', delay: (cards.indexOf(en.target) % 3) * 0.06 });
        });
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    cards.forEach((c) => io.observe(c));
  }

  // The Mac's slideshow "Open" button lands here.
  window.addEventListener('creative:open-project', (e) => {
    const p = projectBySlug(e.detail.slug);
    if (!p) return;
    const el = grid.querySelector(`[data-slug="${p.slug}"]`);
    if (lenis) lenis.scrollTo(section, { duration: 1, onComplete: () => openProject(p.slug, { from: el }) });
    else {
      section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      setTimeout(() => openProject(p.slug, { from: el }), reducedMotion ? 0 : 700);
    }
  });

  initProjectWindow({ reducedMotion, lenis });
  return () => {};
}

function card(p, i) {
  const num = String(i + 1).padStart(2, '0');
  const pos = p.coverPosition === 'top' ? 'object-position:50% 0;' : '';
  const media = p.cover
    ? `<img class="card__img" src="${p.cover.sm}" srcset="${p.cover.sm} 640w, ${p.cover.src} ${p.cover.w}w" sizes="(min-width: 1100px) 40vw, (min-width: 640px) 50vw, 100vw" width="${p.cover.w}" height="${p.cover.h}" alt="" loading="lazy" decoding="async" style="${pos}" />`
    : `<div class="ph"><span>Placeholder · ${p.placeholder || 'coming soon'}</span></div>`;
  const tag = p.viaKoach ? '<span class="card__tag">via Koach</span>' : '';
  const result = p.result && p.size === 'feature' ? `<p class="card__result">${p.result}</p>` : '';
  return `
    <article class="card card--${p.size}" data-slug="${p.slug}" data-category="${p.category}">
      <button class="card__hit" type="button" aria-label="Open ${p.title}, ${p.subtitle}"></button>
      <div class="win__bar"><span class="win__lights" aria-hidden="true"><i></i><i></i><i></i></span><span class="win__title">Project ${num}</span>${tag}</div>
      <div class="card__media"${p.cover?.lqip ? ` style="background-image:url(${p.cover.lqip})"` : ''}>${media}</div>
      <div class="card__foot">
        <div><h3 class="card__title">${p.title}</h3><p class="card__meta">${p.subtitle}${p.client ? ` · ${p.client}` : ''}</p>${result}</div>
        <span class="card__arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      </div>
    </article>`;
}
