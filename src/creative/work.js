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
  bar.innerHTML = ['All', ...used]
    .map((c) => {
      const n = c === 'All' ? PROJECTS.length : PROJECTS.filter((p) => p.category === c).length;
      return `<button class="filter" type="button" data-filter="${c}" aria-pressed="${c === 'All'}">${c}<span class="filter__n">${n}</span></button>`;
    })
    .join('');

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
  const media = p.cover
    ? `<img src="${p.cover.sm}" srcset="${p.cover.sm} 640w, ${p.cover.src} ${p.cover.w}w" sizes="(min-width: 1100px) 40vw, (min-width: 640px) 50vw, 100vw" width="${p.cover.w}" height="${p.cover.h}" alt="" loading="lazy" decoding="async"${p.coverPosition === 'top' ? ' style="object-position:50% 0"' : ''} />`
    : `<div class="ph"><span>Placeholder · ${p.placeholder || 'coming soon'}</span></div>`;
  const tag = p.viaKoach ? '<span class="card__tag">via Koach</span>' : '';
  const result = p.result && p.size === 'feature' ? `<p class="card__result">${p.result}</p>` : '';
  return `
    <article class="card card--${p.size}" data-slug="${p.slug}" data-category="${p.category}">
      <button class="card__hit" type="button" aria-label="Open ${p.title}, ${p.subtitle}"></button>
      <div class="win__bar"><span class="win__lights" aria-hidden="true"><i></i><i></i><i></i></span><span class="win__title">Project ${num}</span>${tag}</div>
      <div class="card__media">${media}</div>
      <div class="card__foot">
        <div><h3 class="card__title">${p.title}</h3><p class="card__meta">${p.subtitle}${p.client ? ` · ${p.client}` : ''}</p>${result}</div>
        <span class="card__arrow" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      </div>
    </article>`;
}
