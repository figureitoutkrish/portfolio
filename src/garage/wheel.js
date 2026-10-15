import { projects } from './modes/projects.js';
import { lap } from './modes/lap.js';
import { radio } from './modes/radio.js';
import { sfx } from '../audio/sfx.js';

// The steering wheel as the page. Two ways to show it:
//   overlay  (with the 3D car) the real 3D wheel is the device: its display shows this page's
//            screen (positioned exactly over it) and its physical buttons and knobs are the
//            controls; each gets a focusable hotspot with a printed label over it, and pressing
//            one presses the 3D part (attach(surface)).
//   drawn    (no WebGL) the same controls on a wheel drawn in HTML/SVG.
// Every control is a real button with one job:
//   paddles − / +   previous / next (← →, or swipe the screen)
//   MODE rotary     projects · lap · radio (1 2 3)
//   SCROLL rotary   scroll the screen (↑ ↓, wheel, drag the knob)
//   OK / BACK       open / back (enter / esc)
//   PIT             drive in again
//   DRS TALK DRINK  little radio moments
//   shift lights    where you are (project 3 of 6; on LAP: how close you parked)
const MODES = { projects, lap, radio };
const ORDER = ['projects', 'lap', 'radio'];
const KNOB = { projects: -50, lap: 0, radio: 50 };
const TOASTS = {
  drs: 'drs disabled · pit lane',
  drink: 'drinks bottle · red bull, obviously',
  talk: 'radio check · loud and clear',
};

export function initWheel({ root, reducedMotion, onPit }) {
  const body = root.querySelector('[data-screen-body]');
  const modeEl = root.querySelector('[data-screen-mode]');
  const countEl = root.querySelector('[data-screen-count]');
  const hintsEl = root.querySelector('[data-screen-hints]');
  const toastEl = root.querySelector('[data-screen-toast]');
  const ledsEl = root.querySelector('.leds');
  const modeKnob = root.querySelector('.rotary--mode .rotary__knob');
  const scrollKnob = root.querySelector('[data-scroll-knob]');
  const modeBtns = [...root.querySelectorAll('[data-mode]')];
  ledsEl.innerHTML = '<i></i>'.repeat(15);
  const leds = [...ledsEl.children];

  const state = { mode: 'projects', index: 0, detail: false };
  let visible = false;
  let surface = null; // the 3D wheel, once attached
  const LABELS = { mode: 'mode', scroll: 'scroll', prev: 'prev', next: 'next', back: 'back', ok: 'ok', talk: 'talk', drs: 'drs', drink: 'drink', pit: 'pit' };

  function render(dir = '') {
    const m = MODES[state.mode];
    body.classList.remove('from-prev', 'from-next');
    if (dir && !reducedMotion) body.classList.add(dir === 'prev' ? 'from-prev' : 'from-next');
    m.render(body, state);
    body.scrollTop = 0;
    modeEl.textContent = state.mode;
    countEl.textContent = m.count(state);
    hintsEl.innerHTML = m.hints(state);
    modeKnob.style.setProperty('--knob', `${KNOB[state.mode]}deg`);
    modeBtns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    const lit = m.leds(state);
    leds.forEach((l, i) => l.classList.toggle('on', i < lit));
    root.querySelectorAll('.hot__pos').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));
    if (surface) {
      surface.setLeds(lit);
      surface.turnControl('mode', KNOB[state.mode]);
    }
    syncScrollKnob();
  }

  function setMode(id) {
    if (!MODES[id] || id === state.mode) return;
    Object.assign(state, { mode: id, index: 0, detail: false });
    sfx('toggle');
    render();
  }

  function step(delta) {
    const m = MODES[state.mode];
    const n = m.size(state);
    if (n < 2) return;
    state.index = (state.index + delta + n) % n;
    sfx('shift');
    render(delta < 0 ? 'prev' : 'next');
  }

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  function act(name) {
    const m = MODES[state.mode];
    if (name === 'mode') return setMode(ORDER[(ORDER.indexOf(state.mode) + 1) % ORDER.length]);
    if (name === 'prev') return step(-1);
    if (name === 'next') return step(1);
    if (name === 'up' || name === 'down') return scrollBy(name === 'up' ? -1 : 1);
    if (name === 'pit') return onPit?.();
    if (TOASTS[name]) {
      sfx(name === 'talk' ? 'radio' : 'tap');
      return toast(TOASTS[name]);
    }
    if (name === 'ok') {
      sfx('tap');
      const patch = m.ok(state);
      if (patch?.action === 'drive') return onPit?.();
      if (patch) {
        Object.assign(state, patch);
        render('next');
      }
      return;
    }
    if (name === 'back') {
      const patch = m.back(state);
      if (patch) {
        sfx('tap');
        Object.assign(state, patch);
        render('prev');
      }
    }
  }

  // scroll the screen, and turn the knob with it (a turn per screenful, roughly)
  function scrollBy(dir) {
    body.scrollBy({ top: dir * body.clientHeight * 0.45, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
  let knobDeg = 0;
  function syncScrollKnob() {
    const deg = (body.scrollTop / Math.max(1, body.clientHeight)) * 120;
    scrollKnob.style.setProperty('--knob', `${deg}deg`);
    if (surface && Math.abs(deg - knobDeg) > 3) {
      knobDeg = deg;
      surface.turnControl('scroll', deg);
    }
  }
  body.addEventListener('scroll', syncScrollKnob, { passive: true });

  // dragging the scroll knob round scrolls the screen
  let drag = null;
  scrollKnob.addEventListener('pointerdown', (e) => {
    const r = scrollKnob.getBoundingClientRect();
    drag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) };
    try {
      scrollKnob.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  scrollKnob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
    let d = a - drag.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    drag.a = a;
    body.scrollTop += (d / (Math.PI * 2 / 3)) * body.clientHeight;
  });
  const endDrag = () => (drag = null);
  scrollKnob.addEventListener('pointerup', endDrag);
  scrollKnob.addEventListener('pointercancel', endDrag);

  // buttons (a press shows on the cap even when it came from the keyboard)
  // the 3D part goes down the moment you press (pointer-down / key-down), not when you let go
  const PRESSABLE = new Set(['prev', 'next', 'back', 'ok', 'talk', 'drs', 'drink', 'pit']);
  const pressPart = (id) => surface && PRESSABLE.has(id) && surface.pressControl(id);
  root.addEventListener('pointerdown', (e) => pressPart(e.target.closest('[data-act]')?.dataset.act));
  root.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) pressPart(e.target.closest?.('[data-act]')?.dataset.act);
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-mode]');
    if (!b || !root.contains(b)) return;
    if (b.dataset.mode) return setMode(b.dataset.mode);
    act(b.dataset.act);
  });
  const press = (sel) => {
    // drawn wheel: the cap; on the 3D wheel the part itself moves (act → pressControl)
    const el = surface ? null : root.querySelector(sel);
    if (!el) return;
    el.classList.add('is-pressed');
    setTimeout(() => el.classList.remove('is-pressed'), 130);
  };

  // swipe the screen sideways = paddles (touch)
  let sw = null;
  body.addEventListener('touchstart', (e) => (sw = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true });
  body.addEventListener('touchend', (e) => {
    if (!sw) return;
    const dx = e.changedTouches[0].clientX - sw.x;
    const dy = e.changedTouches[0].clientY - sw.y;
    sw = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      press(dx < 0 ? '.paddle--next' : '.paddle--prev');
      step(dx < 0 ? 1 : -1);
    }
  });

  // keys, only while the wheel is up (and never while typing or with the menu / palette open)
  const docEl = document.documentElement;
  function onKey(e) {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (docEl.classList.contains('is-palette-open') || document.querySelector('.menu-btn[aria-expanded="true"]')) return;
    const map = { ArrowLeft: ['prev', '.paddle--prev'], ArrowRight: ['next', '.paddle--next'], Enter: ['ok', '.cap--ok'], Escape: ['back', '.cap--red'], Backspace: ['back', '.cap--red'] };
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (document.activeElement === body) return; // the screen scrolls itself
      e.preventDefault();
      return scrollBy(e.key === 'ArrowUp' ? -1 : 1);
    }
    if (['1', '2', '3'].includes(e.key)) return setMode(ORDER[Number(e.key) - 1]);
    const hit = map[e.key];
    if (!hit) return;
    // Enter on a focused control clicks that control; only take it when nothing is focused
    if (e.key === 'Enter' && document.activeElement?.closest?.('button, a')) return;
    e.preventDefault();
    press(hit[1]);
    pressPart(hit[0]);
    act(hit[0]);
  }
  window.addEventListener('keydown', onKey);

  // ---------- overlay on the 3D wheel ----------
  const wheelBody = root.querySelector('.wheel__body');
  const screenEl = root.querySelector('.screen');
  const hots = document.createElement('div');
  hots.className = 'hots';
  wheelBody.append(hots);
  function attach(s) {
    surface = s;
    root.classList.add('is-overlay');
    hots.innerHTML = '';
    for (const id of Object.keys(LABELS)) {
      const el = document.createElement(id === 'scroll' ? 'div' : 'button');
      el.className = `hot hot--${id}`;
      el.dataset.hot = id;
      if (id === 'scroll') {
        el.setAttribute('aria-hidden', 'true'); // ↑ ↓ and the screen itself scroll; this is the knob
      } else {
        el.type = 'button';
        if (id === 'mode') el.setAttribute('aria-label', 'mode: next');
        else el.dataset.act = id;
      }
      el.innerHTML = `<span class="hot__label">${LABELS[id]}</span>`;
      hots.append(el);
    }
    // the mode positions printed round the knob (each one selects its mode)
    ORDER.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hot__pos';
      b.dataset.mode = id;
      b.setAttribute('role', 'radio');
      b.textContent = id;
      hots.append(b);
    });
    hots.setAttribute('role', 'group');
    hots.setAttribute('aria-label', 'wheel controls');
    layout();
    render();
  }
  // put the screen and every hotspot where the 3D parts are
  function layout() {
    if (!surface) return;
    const L = surface.layout();
    const r = L.screen;
    Object.assign(screenEl.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    for (const c of L.controls) {
      const el = hots.querySelector(`[data-hot="${c.id}"]`);
      if (!el) continue;
      const size = Math.max(c.r * 2, 44); // a full 44px target, whatever the button's size on screen
      Object.assign(el.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${size}px`, height: `${size}px` });
      el.style.setProperty('--ring', `${Math.round(c.r * 2)}px`);
      el.classList.toggle('hot--label-up', c.y > r.top + r.height * 1.25); // the row under the display: label above
      if (c.id === 'mode') {
        // positions printed in an arc above the knob, at the knob's pointer angles
        const R = c.r + 16;
        hots.querySelectorAll('.hot__pos').forEach((b) => {
          const a = (KNOB[b.dataset.mode] * Math.PI) / 180;
          Object.assign(b.style, { left: `${c.x + Math.sin(a) * R}px`, top: `${c.y - Math.cos(a) * R}px` });
        });
      }
    }
  }
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => surface && visible && layout(), 120);
  });
  // the scroll knob on the 3D wheel: drag it round, or use the wheel/trackpad over it
  hots.addEventListener('wheel', (e) => {
    if (!e.target.closest('.hot--scroll')) return;
    e.preventDefault();
    body.scrollTop += e.deltaY;
  }, { passive: false });
  let knobDrag = null;
  hots.addEventListener('pointerdown', (e) => {
    const k = e.target.closest('.hot--scroll');
    if (!k) return;
    const r = k.getBoundingClientRect();
    knobDrag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) };
    try {
      k.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  hots.addEventListener('pointermove', (e) => {
    if (!knobDrag) return;
    const a = Math.atan2(e.clientY - knobDrag.cy, e.clientX - knobDrag.cx);
    let d = a - knobDrag.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    knobDrag.a = a;
    body.scrollTop += (d / ((Math.PI * 2) / 3)) * body.clientHeight;
  });
  hots.addEventListener('pointerup', () => (knobDrag = null));
  hots.addEventListener('pointercancel', () => (knobDrag = null));
  // the mode knob itself: a click steps to the next mode
  hots.addEventListener('click', (e) => {
    if (e.target.closest('.hot--mode')) act('mode');
  });

  render();

  return {
    attach,
    layout,
    get visible() {
      return visible;
    },
    // lay the wheel out without showing it, so the 3D zoom can be sized to it
    prepare() {
      if (!visible) {
        root.classList.add('is-measuring');
        root.hidden = false;
      }
    },
    // the wheel body's on-screen box at rest (undoing the small entrance scale)
    bodyRect() {
      const el = root.querySelector('.wheel__body');
      const r = el.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const originY = r.top + r.height * 0.45; // transform-origin: 50% 45%
      const top = originY - h * 0.45;
      return { left: r.left + r.width / 2 - w / 2, top, width: w, height: h };
    },
    show({ instant = false } = {}) {
      root.classList.remove('is-measuring');
      root.hidden = false;
      visible = true;
      render();
      if (!instant && !reducedMotion) void root.offsetWidth; // commit the hidden state so the fade runs
      root.classList.add('is-on');
      root.focus({ preventScroll: true });
    },
    hide() {
      visible = false;
      root.classList.remove('is-on');
      setTimeout(() => {
        if (!visible) root.hidden = true;
      }, reducedMotion ? 0 : 420);
    },
    setMode,
    // compact framing (display full width + the dock): phones and upright tablets
    setCompact: (on) => root.classList.toggle('is-compact', on),
    refresh: () => render(),
    destroy: () => window.removeEventListener('keydown', onKey),
  };
}
