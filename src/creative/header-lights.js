import gsap from 'gsap';
import { navigate } from '../utils/transition.js';

// The traffic lights before "krish." in the header (creative page only):
//   red    → a Mac alert, "Quit Creative?" → home through the page wipe
//   yellow → "minimise": glide past the hero to the work
//   green  → the Mac goes full screen (play mode); green again or Esc to come back
export function initHeaderLights({ lenis, reducedMotion }) {
  const lights = document.querySelector('.lights');
  const desk = document.querySelector('.desk');
  if (!lights) return { zoom() {}, isZoomed: () => false, destroy() {} };

  // ---------- red: quit ----------
  let modal = null;
  function quit() {
    if (modal) return;
    const opener = document.activeElement;
    modal = document.createElement('div');
    modal.className = 'qalert';
    modal.innerHTML = `
      <div class="qalert__box win" role="alertdialog" aria-modal="true" aria-labelledby="qalert-t" aria-describedby="qalert-d">
        <div class="win__bar"><span class="win__lights" aria-hidden="true"><i></i><i></i><i></i></span></div>
        <div class="qalert__body">
          <span class="qalert__icon" aria-hidden="true">!</span>
          <div>
            <p id="qalert-t" class="qalert__title">Quit Creative?</p>
            <p id="qalert-d" class="qalert__text">The work will miss you. Home is one click away.</p>
          </div>
        </div>
        <div class="qalert__actions">
          <button class="pill pill--glossy-white" type="button" data-q="stay">Stay</button>
          <button class="pill pill--glossy" type="button" data-q="home">Go home</button>
        </div>
      </div>`;
    document.body.append(modal);
    const box = modal.firstElementChild;
    const done = (go) => {
      document.removeEventListener('keydown', onKey, true);
      const m = modal;
      modal = null;
      const remove = () => m.remove();
      if (reducedMotion) remove();
      else gsap.to(m, { autoAlpha: 0, duration: 0.15, ease: 'ui-out', onComplete: remove });
      if (go) navigate('/', { reducedMotion, lenis });
      else opener?.focus?.({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(false);
      } else if (e.key === 'Tab') {
        // keep focus inside the alert
        const btns = [...box.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        e.preventDefault();
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    modal.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]')?.dataset.q;
      if (q) done(q === 'home');
      else if (e.target === modal) done(false);
    });
    box.querySelector('[data-q="home"]').focus({ preventScroll: true });
    if (!reducedMotion) {
      gsap.from(modal, { autoAlpha: 0, duration: 0.18, ease: 'ui-out' });
      gsap.from(box, { scale: 0.94, y: 8, duration: 0.24, ease: 'ui-out' });
    }
  }

  // ---------- yellow: minimise ----------
  function minimise() {
    const work = document.getElementById('work');
    if (!work) return;
    if (lenis) lenis.scrollTo(work, { duration: 1 });
    else work.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // ---------- green: Mac full screen ----------
  let zoomed = false;
  function zoom(on = !zoomed) {
    if (!desk || on === zoomed) return;
    zoomed = on;
    document.documentElement.classList.toggle('is-mac-zoom', on);
    desk.classList.toggle('is-zoomed', on);
    lights.querySelector('[data-light="zoom"]').setAttribute('aria-pressed', String(on));
    if (on) {
      lenis?.stop();
      if (!reducedMotion) gsap.from(desk, { autoAlpha: 0, scale: 0.97, duration: 0.3, ease: 'ui-out' });
      document.addEventListener('keydown', onZoomKey);
    } else {
      // stay stopped if a game is still holding the page
      if (!document.documentElement.classList.contains('is-gaming')) lenis?.start();
      document.removeEventListener('keydown', onZoomKey);
      desk.scrollIntoView({ block: 'center' });
    }
  }
  const onZoomKey = (e) => {
    // Esc leaves full screen, unless a game or dialog inside is using it first
    if (e.key === 'Escape' && !document.documentElement.classList.contains('is-gaming') && !document.querySelector('.os__modal')) zoom(false);
  };

  lights.addEventListener('click', (e) => {
    const which = e.target.closest('[data-light]')?.dataset.light;
    if (which === 'close') quit();
    else if (which === 'min') minimise();
    else if (which === 'zoom') zoom();
  });
  // A small "exit full screen" button lives on the zoomed desk too.
  desk?.querySelector('.desk__exit')?.addEventListener('click', () => zoom(false));

  return { zoom, isZoomed: () => zoomed, destroy: () => document.removeEventListener('keydown', onZoomKey) };
}
