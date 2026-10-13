import gsap from 'gsap';
import { REELS, THEMES, PROFILE, compact } from './data/reels.js';

// The Content section: Instagram numbers as race telemetry, P1's feature, and a standings board
// of the top reels (like a timing tower: position, team colour = theme, views as a bar).
//   - numbers count up once when they come into view (they're already in the HTML, so they read
//     fine without JS or with reduced motion)
//   - bars use a log scale, or P1's 13.6M would flatten everyone else to a sliver
//   - each row opens that reel on Instagram (or the reels tab until its link is added)
const SHOW = 10;

export function initContent({ reducedMotion }) {
  const list = document.querySelector('.standings__list');
  if (!list) return;
  const more = document.querySelector('.standings__more');

  const max = Math.log10(REELS[0].views);
  const min = Math.log10(REELS[REELS.length - 1].views) - 0.6;
  const width = (v) => Math.max(0.06, (Math.log10(v) - min) / (max - min));

  list.innerHTML = REELS.map((r, i) => {
    const t = THEMES[r.theme];
    const href = r.url || `${PROFILE}reels/`;
    const img = r.thumb ? `<img src="${r.thumb}" width="160" height="160" alt="" loading="lazy" decoding="async" />` : '<span aria-hidden="true">&#9654;</span>';
    return `<li class="lap${i === 0 ? ' lap--leader' : ''}"${i >= SHOW ? ' hidden' : ''} style="--team:${t.color}">
      <a class="lap__link" href="${href}" target="_blank" rel="noopener">
        <span class="lap__pos">P${i + 1}</span>
        <span class="lap__thumb">${img}</span>
        <span class="lap__name"><span class="lap__title"></span><span class="lap__team">${t.label}</span></span>
        <span class="lap__bar" aria-hidden="true"><i style="--w:${width(r.views).toFixed(3)}"></i></span>
        <span class="lap__views"><b>${compact(r.views)}</b> views</span>
        <span class="lap__meta">${r.likes ? `♥ ${compact(r.likes)}` : ''}${r.shares ? ` · ↗ ${compact(r.shares)}` : ''}</span>
      </a>
    </li>`;
  }).join('');
  // titles go in as text (they're captions)
  [...list.querySelectorAll('.lap__title')].forEach((el, i) => (el.textContent = REELS[i].title));

  if (more && REELS.length > SHOW) {
    more.hidden = false;
    more.textContent = `show all ${REELS.length}`;
    more.addEventListener('click', () => {
      const rows = [...list.querySelectorAll('.lap[hidden]')];
      rows.forEach((li) => (li.hidden = false));
      more.hidden = true;
      if (!reducedMotion) gsap.from(rows, { autoAlpha: 0, y: 8, duration: 0.3, ease: 'ui-out', stagger: 0.04, clearProps: 'all' });
      rows[0]?.querySelector('a')?.focus({ preventScroll: true });
    });
  }

  if (reducedMotion) return;

  // count up once, the first time each number shows up
  const counters = [...document.querySelectorAll('.content [data-count]')];
  const bars = [...list.querySelectorAll('.lap__bar i')];
  gsap.set(bars, { scaleX: 0 });
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        if (e.target === list) {
          gsap.to(bars, { scaleX: 1, duration: 0.9, ease: 'ui-out', stagger: 0.05 });
          return;
        }
        const el = e.target;
        const to = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const n = { v: 0 };
        gsap.to(n, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: () => (el.textContent = compact(Math.round(n.v)) + suffix), onComplete: () => (el.textContent = compact(to) + suffix) });
      });
    },
    { threshold: 0.4 }
  );
  counters.forEach((c) => io.observe(c));
  io.observe(list);
}
