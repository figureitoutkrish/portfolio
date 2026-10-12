import gsap from 'gsap';
import { PROJECTS } from '../../data/projects.js';

// Work.slideshow: the Mac's idle screen. Cycles through the project covers; "Open" scrolls down
// to that project and opens its window (src/creative/work.js listens for creative:open-project).
const DELAY = 3500;

export function mountSlideshow(body, { reducedMotion }) {
  const slides = PROJECTS.filter((p) => p.cover);
  let i = 0;
  let timer = 0;

  body.classList.add('os__body--slides');
  body.innerHTML = `
    <div class="slides__stage"><img class="slides__img" alt="" decoding="async" /></div>
    <div class="slides__bar">
      <button class="os__btn slides__nav" type="button" data-dir="-1" aria-label="Previous project">&lsaquo;</button>
      <p class="slides__caption" aria-live="polite"></p>
      <button class="os__btn slides__nav" type="button" data-dir="1" aria-label="Next project">&rsaquo;</button>
      <button class="os__btn os__btn--default slides__open" type="button">Open</button>
    </div>`;
  const imgEl = body.querySelector('.slides__img');
  const caption = body.querySelector('.slides__caption');

  // Warm the next image so the swap never shows an empty frame.
  const preload = (n) => {
    const p = slides[(n + slides.length) % slides.length];
    const im = new Image();
    im.src = p.cover.sm;
  };

  const show = (n, animate = true) => {
    i = (n + slides.length) % slides.length;
    const p = slides[i];
    const apply = () => {
      imgEl.src = p.cover.sm;
      imgEl.style.objectPosition = p.coverPosition === 'top' ? '50% 0%' : '50% 50%';
      caption.textContent = `${String(i + 1).padStart(2, '0')}/${String(slides.length).padStart(2, '0')}  ${p.title}`;
    };
    if (!animate || reducedMotion) apply();
    else {
      gsap
        .timeline()
        .to(imgEl, { autoAlpha: 0, filter: 'blur(2px)', duration: 0.14, ease: 'ui-out' })
        .call(apply)
        .to(imgEl, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.24, ease: 'ui-out' });
    }
    preload(i + 1);
  };
  const restart = () => {
    clearInterval(timer);
    timer = setInterval(() => !document.hidden && show(i + 1), DELAY);
  };

  body.addEventListener('click', (e) => {
    const nav = e.target.closest('.slides__nav');
    if (nav) {
      show(i + Number(nav.dataset.dir));
      restart();
    } else if (e.target.closest('.slides__open')) {
      window.dispatchEvent(new CustomEvent('creative:open-project', { detail: { slug: slides[i].slug } }));
    }
  });

  show(0, false);
  restart();
  return { unmount: () => clearInterval(timer) };
}
