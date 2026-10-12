import gsap from 'gsap';
import { PROJECTS, projectBySlug } from './data/projects.js';

// The project window: a big paper Mac window that grows out of the card you clicked and shrinks
// back into it. Shareable (#project/<slug>), back/forward aware, Esc / backdrop / red dot close,
// ← → for previous / next, focus stays inside while open and returns to the card after.
let api = null;

export function openProject(slug, opts) {
  api?.open(slug, opts);
}

export function initProjectWindow({ reducedMotion, lenis }) {
  const root = document.createElement('div');
  root.className = 'pw';
  root.hidden = true;
  root.innerHTML = `
    <div class="pw__backdrop" data-close></div>
    <article class="pw__win win" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <div class="win__bar pw__bar">
        <span class="pw__lights"><button class="pw__dot pw__dot--close" type="button" aria-label="Close project" data-close></button><i aria-hidden="true"></i><i aria-hidden="true"></i></span>
        <span class="win__title pw__file"></span>
        <span class="pw__nav">
          <button class="pw__step" type="button" data-step="-1" aria-label="Previous project">&larr;</button>
          <button class="pw__step" type="button" data-step="1" aria-label="Next project">&rarr;</button>
        </span>
      </div>
      <div class="pw__scroll" data-lenis-prevent>
        <header class="pw__head">
          <p class="clabel pw__label"></p>
          <h2 id="pw-title" class="pw__title"></h2>
          <p class="pw__sub"></p>
          <dl class="pw__facts"></dl>
          <p class="pw__about"></p>
          <p class="pw__result"></p>
          <a class="pill pill--ink pw__behance" target="_blank" rel="noopener">View on Behance <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 9 9 3M4 3h5v5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></a>
        </header>
        <div class="pw__gallery"></div>
      </div>
    </article>`;
  document.body.append(root);
  const win = root.querySelector('.pw__win');
  const scroller = root.querySelector('.pw__scroll');
  const $ = (s) => root.querySelector(s);

  const visible = () => PROJECTS;
  let current = null;
  let fromEl = null;
  let opener = null;

  function fill(p) {
    const i = PROJECTS.indexOf(p);
    $('.pw__file').textContent = `${p.slug}.proj`;
    $('.pw__label').innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span> [ ${p.category.toLowerCase()} ]`;
    $('.pw__title').textContent = p.title;
    $('.pw__sub').textContent = p.subtitle;
    const facts = [['Client', p.client], ['Category', p.category], ['Tools', p.tools?.join(', ')], ['Via', p.viaKoach ? 'Koach' : null]].filter(([, v]) => v);
    $('.pw__facts').innerHTML = facts.map(([k]) => `<div><dt>${k}</dt><dd></dd></div>`).join('');
    [...$('.pw__facts').querySelectorAll('dd')].forEach((dd, j) => (dd.textContent = facts[j][1]));
    $('.pw__about').textContent = p.about || '';
    $('.pw__about').hidden = !p.about;
    $('.pw__result').textContent = p.result || '';
    $('.pw__result').hidden = !p.result;
    const be = $('.pw__behance');
    be.hidden = !p.behance;
    if (p.behance) be.href = p.behance;
    const gallery = $('.pw__gallery');
    gallery.innerHTML = p.gallery?.length
      ? p.gallery
          .map((g, j) => `<figure class="pw__shot${g.h > g.w * 1.4 ? ' pw__shot--tall' : ''}"${g.lqip ? ` style="background-image:url(${g.lqip})"` : ''}><img src="${g.src}" width="${g.w}" height="${g.h}" alt="${p.title}, image ${j + 1}" loading="${j < 2 ? 'eager' : 'lazy'}" decoding="async" /></figure>`)
          .join('') + (p.galleryNote ? `<p class="pw__note note">${p.galleryNote}</p>` : '')
      : `<div class="ph ph--wide"><span>Placeholder · ${p.placeholder || 'visuals coming soon'}</span></div>`;
    gallery.querySelectorAll('img').forEach((im) => {
      const done = () => im.classList.add('is-loaded');
      if (im.complete && im.naturalWidth) done();
      else im.addEventListener('load', done, { once: true });
    });
    scroller.scrollTop = 0;
  }

  function open(slug, { from = null, push = true } = {}) {
    const p = projectBySlug(slug);
    if (!p) return;
    const wasOpen = !!current;
    current = p;
    fill(p);
    if (push) history.pushState({ project: slug }, '', `#project/${slug}`);
    if (wasOpen) {
      if (!reducedMotion) gsap.fromTo(scroller, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.25, ease: 'ui-out' });
      return;
    }
    opener = document.activeElement;
    fromEl = from;
    root.hidden = false;
    document.documentElement.classList.add('is-pw-open');
    lenis?.stop();
    document.addEventListener('keydown', onKey);
    win.focus({ preventScroll: true });
    $('.pw__dot--close').focus({ preventScroll: true });
    if (reducedMotion) return;
    gsap.fromTo(root.querySelector('.pw__backdrop'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'ui-out' });
    // grow out of the card
    const t = fromRect(fromEl);
    if (t) gsap.fromTo(win, { x: t.x, y: t.y, scale: t.s, autoAlpha: 0.6 }, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'drawer' });
    else gsap.fromTo(win, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'ui-out' });
  }

  function fromRect(el) {
    if (!el || el.hidden) return null;
    const a = el.getBoundingClientRect();
    const b = win.getBoundingClientRect();
    if (!a.width) return null;
    return { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), s: Math.max(0.2, a.width / b.width) };
  }

  function close({ push = true } = {}) {
    if (!current) return;
    current = null;
    document.removeEventListener('keydown', onKey);
    if (push && location.hash.startsWith('#project/')) history.pushState({}, '', location.pathname);
    const done = () => {
      root.hidden = true;
      gsap.set([win, scroller], { clearProps: 'all' });
      document.documentElement.classList.remove('is-pw-open');
      lenis?.start();
      (fromEl?.querySelector('.card__hit') || opener)?.focus?.({ preventScroll: true });
    };
    if (reducedMotion) return done();
    const t = fromRect(fromEl);
    gsap.to(root.querySelector('.pw__backdrop'), { autoAlpha: 0, duration: 0.25, ease: 'ui-out' });
    // exits are quicker than entrances
    gsap.to(win, t ? { x: t.x, y: t.y, scale: t.s, autoAlpha: 0, duration: 0.3, ease: 'ui-in-out', onComplete: done } : { y: 16, autoAlpha: 0, duration: 0.2, ease: 'ui-out', onComplete: done });
  }

  function step(dir) {
    const list = visible();
    const i = list.indexOf(current);
    const next = list[(i + dir + list.length) % list.length];
    fromEl = document.querySelector(`.card[data-slug="${next.slug}"]`);
    open(next.slug, { push: false });
    history.replaceState({ project: next.slug }, '', `#project/${next.slug}`);
  }

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' && !e.target.closest('input,textarea')) step(1);
    else if (e.key === 'ArrowLeft' && !e.target.closest('input,textarea')) step(-1);
    else if (e.key === 'Tab') {
      const f = [...win.querySelectorAll('button, a[href]')].filter((el) => !el.hidden && el.offsetParent);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    }
  };
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    const s = e.target.closest('[data-step]');
    if (s) step(Number(s.dataset.step));
  });

  // Deep links and back/forward.
  const route = () => {
    const m = location.hash.match(/^#project\/([\w-]+)/);
    if (m && projectBySlug(m[1])) open(m[1], { push: false, from: document.querySelector(`.card[data-slug="${m[1]}"]`) });
    else if (current) close({ push: false });
  };
  window.addEventListener('popstate', route);
  route();

  api = { open, close };
}
