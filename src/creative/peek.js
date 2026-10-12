import gsap from 'gsap';
import { PROJECTS } from './data/projects.js';

// Link previews (bryangarage.dev's "peek"): hover or keyboard-focus an outside link and a tiny
// Mac window shows where it goes before you click. Desktop pointers + keyboard only.
//   - the first one waits a beat (so passing over links doesn't flash cards); once one is open,
//     neighbours open instantly (Emil's tooltip rule)
//   - it grows from the link (origin-aware) and sits above it, or below if there's no room
const PEEKS = [
  { test: /instagram\.com\/koach\.studio/, title: 'Koach Studio', path: 'instagram.com/koach.studio', desc: 'The content & creative agency I co-founded in 2025.', icon: 'K', tone: '#b6ed68', ink: '#20221f' },
  { test: /instagram\.com\/figureitoutwithkrish/, title: 'figure it out with krish', path: 'instagram.com/figureitoutwithkrish', desc: 'My Instagram: life, content, figuring it out.', icon: '◎', tone: '#f77737', ink: '#fff' },
  { test: /youtube\.com\/@figureitoutwithkrish/, title: 'figure it out with krish', path: 'youtube.com/@figureitoutwithkrish', desc: 'Vlogs and videos on YouTube.', icon: '▶', tone: '#ff2a2a', ink: '#fff' },
  { test: /linkedin\.com/, title: 'Krish Viramgama', path: 'linkedin.com/in/krish-viramgama', desc: 'Experience, roles and the boring-but-important stuff.', icon: 'in', tone: '#0a66c2', ink: '#fff' },
  { test: /behance\.net\/theinvrangers/, title: 'Krish on Behance', path: 'behance.net/theinvrangers', desc: 'Every project in full: thumbnails, branding, social.', icon: 'Bē', tone: '#1769ff', ink: '#fff' },
  {
    test: /behance\.net\/gallery\//,
    resolve: (href) => {
      const p = PROJECTS.find((x) => x.behance && href.startsWith(x.behance));
      return { title: p ? p.title : 'Project on Behance', path: 'behance.net/gallery', desc: p ? `${p.subtitle}: the full case on Behance.` : 'The full project on Behance.', icon: 'Bē', tone: '#1769ff', ink: '#fff', img: p?.cover?.sm };
    },
  },
  { test: /^mailto:/, title: 'Email Krish', path: 'krishviramgamatir@gmail.com', desc: 'Opens your mail app.', icon: '@', tone: '#d9e8f8', ink: '#24548c' },
];

export function initPeek({ reducedMotion }) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const card = document.createElement('div');
  card.className = 'peek';
  card.setAttribute('role', 'tooltip');
  card.id = 'peek';
  card.hidden = true;
  card.innerHTML = `
    <div class="peek__bar"><span class="peek__dot" aria-hidden="true"></span><span class="peek__path"></span><span class="peek__ext" aria-hidden="true">↗</span></div>
    <div class="peek__body"><span class="peek__icon" aria-hidden="true"></span><span class="peek__text"><b class="peek__title"></b><span class="peek__desc"></span></span></div>`;
  document.body.append(card);
  const $ = (s) => card.querySelector(s);

  let current = null;
  let timer = 0;
  let lastHide = 0;

  const infoFor = (a) => {
    const href = a.getAttribute('href') || '';
    const hit = PEEKS.find((p) => p.test.test(href));
    if (!hit) return null;
    return hit.resolve ? hit.resolve(href) : hit;
  };

  function show(a) {
    const info = infoFor(a);
    if (!info) return;
    current = a;
    $('.peek__path').textContent = info.path;
    $('.peek__title').textContent = info.title;
    $('.peek__desc').textContent = info.desc;
    const icon = $('.peek__icon');
    icon.textContent = info.img ? '' : info.icon;
    icon.style.background = info.img ? `center / cover url(${info.img})` : info.tone;
    icon.style.color = info.ink;
    card.hidden = false;
    a.setAttribute('aria-describedby', 'peek');

    // place it: above the link, or below if it would leave the top of the screen
    const r = a.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const above = r.top - h - 12 > 8;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    const top = above ? r.top - h - 10 : r.bottom + 10;
    gsap.set(card, { left, top, transformOrigin: `${r.left + r.width / 2 - left}px ${above ? '100%' : '0%'}` });
    const instant = performance.now() - lastHide < 500 || reducedMotion;
    gsap.killTweensOf(card);
    if (instant) gsap.set(card, { autoAlpha: 1, scale: 1, y: 0 });
    else gsap.fromTo(card, { autoAlpha: 0, scale: 0.96, y: above ? 4 : -4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.16, ease: 'ui-out' });
  }

  function hide() {
    clearTimeout(timer);
    if (!current) return;
    current.removeAttribute('aria-describedby');
    current = null;
    lastHide = performance.now();
    gsap.killTweensOf(card);
    gsap.to(card, { autoAlpha: 0, duration: reducedMotion ? 0 : 0.1, ease: 'ui-out', onComplete: () => (card.hidden = true) });
  }

  const schedule = (a) => {
    clearTimeout(timer);
    const delay = performance.now() - lastHide < 500 ? 0 : 320;
    timer = setTimeout(() => show(a), delay);
  };

  const linkFrom = (e) => e.target.closest?.('a[href]');
  document.addEventListener('pointerover', (e) => {
    if (!fine.matches) return;
    const a = linkFrom(e);
    if (a && a !== current && infoFor(a) && !a.closest('.is-held')) schedule(a);
  });
  document.addEventListener('pointerout', (e) => {
    const a = linkFrom(e);
    if (a && !a.contains(e.relatedTarget)) {
      clearTimeout(timer);
      if (a === current) hide();
    }
  });
  document.addEventListener('focusin', (e) => {
    const a = linkFrom(e);
    if (a && e.target.matches(':focus-visible') && infoFor(a)) show(a);
  });
  document.addEventListener('focusout', (e) => linkFrom(e) === current && hide());
  // anything that moves or grabs things: get out of the way
  document.addEventListener('pointerdown', hide, true);
  window.addEventListener('scroll', hide, { passive: true });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
}
