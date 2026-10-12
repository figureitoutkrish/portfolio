import gsap from 'gsap';
import { sfx, soundOn, setSound, onSoundChange } from '../sound.js';
import { mountSlideshow } from './apps/slideshow.js';
import { mountCircle } from './apps/circle.js';
import { mountRacer } from './apps/racer.js';
import { mountScores } from './apps/scores.js';
import { mountChat } from './apps/chat.js';
import { mountSecret } from './apps/secret.js';

// The vintage Mac's operating system: menu bar, desktop icons, one classic window at a time,
// alert / prompt dialogs, power and boot, and "game mode".
//   - Games only run from their floppy: opening Circle or Racer from the desktop without the
//     disk asks you to insert it (and nudges the right disk on the desk).
//   - Game mode holds the page still (Lenis stopped, arrow/space keys captured) so the keys
//     drive the game, not the page. Eject, power, Esc or the window's close box leave it.
const APPS = {
  work: { title: 'Work.slideshow', mount: mountSlideshow },
  circle: { title: 'CIRCLE.DSK', mount: mountCircle, disk: 'circle', game: true },
  racer: { title: 'RACER.DSK', mount: mountRacer, disk: 'racer', game: true },
  scores: { title: 'High Scores', mount: mountScores },
  chat: { title: 'Talk to Krish', mount: mountChat },
  secret: { title: 'MESSAGE.MOV', mount: mountSecret, disk: 'secret' }, // no desktop icon: it's a secret
};
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar', 'Enter', 'PageUp', 'PageDown', 'Home', 'End']);

export function createOS({ reducedMotion, lenis }) {
  const root = document.querySelector('[data-os]');
  if (!root) return null;
  const mac = root.closest('[data-mac]');
  const desk = root.querySelector('.os__desk');
  const icons = [...root.querySelectorAll('.os__icon')];
  const clock = root.querySelector('.os__clock');
  const listeners = new Set();

  const state = { on: true, disk: null, app: null, gaming: false };
  let current = null; // { name, win, api }
  const emit = (type, detail) => listeners.forEach((fn) => fn(type, detail));

  // ---------- clock ----------
  const tickClock = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = d.toISOString();
  };
  tickClock();
  const clockTimer = setInterval(tickClock, 15000);

  // ---------- dialogs (alert / prompt), classic Mac style ----------
  function dialog({ text, buttons = ['OK'], input = null, icon = '!' }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'os__modal';
      wrap.innerHTML = `
        <div class="os__dialog" role="alertdialog" aria-modal="true" aria-label="${text.replace(/"/g, '&quot;')}">
          <div class="os__dialog-row"><span class="os__dialog-icon" aria-hidden="true">${icon}</span><p class="os__dialog-text"></p></div>
          ${input ? `<input class="os__input" type="text" maxlength="${input.maxLength || 16}" placeholder="${input.placeholder || ''}" autocomplete="off" spellcheck="false" />` : ''}
          <div class="os__dialog-actions"></div>
        </div>`;
      wrap.querySelector('.os__dialog-text').textContent = text;
      const actions = wrap.querySelector('.os__dialog-actions');
      const field = wrap.querySelector('.os__input');
      const done = (value) => {
        wrap.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(value);
      };
      buttons.forEach((label, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `os__btn${i === buttons.length - 1 ? ' os__btn--default' : ''}`;
        b.textContent = label;
        b.addEventListener('click', () => done(input ? (i === buttons.length - 1 ? field.value.trim() : null) : label));
        actions.append(b);
      });
      const onKey = (e) => {
        if (!wrap.isConnected) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          done(input ? null : buttons[0]);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          actions.lastElementChild.click();
        }
      };
      document.addEventListener('keydown', onKey, true);
      root.append(wrap);
      sfx('alert');
      (field || actions.lastElementChild).focus({ preventScroll: true });
      if (!reducedMotion) gsap.from(wrap.firstElementChild, { scale: 0.92, autoAlpha: 0, duration: 0.18, ease: 'ui-out' });
    });
  }
  const alert = (text, opts) => dialog({ text, ...opts });
  const prompt = (text, opts = {}) => dialog({ text, buttons: ['Cancel', 'OK'], input: opts, icon: '?' });

  // ---------- game mode: the page holds still and the keys belong to the game ----------
  const onGameKey = (e) => {
    if (!state.gaming || e.target.closest?.('input, textarea')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (GAME_KEYS.has(e.key) || /^Key[WASD]$/.test(e.code)) {
      e.preventDefault(); // no page scrolling while you drive
      current?.api?.key?.(e.key === 'Spacebar' ? ' ' : e.key, e.type === 'keydown', e);
    }
  };
  function setGaming(on) {
    if (state.gaming === on) return;
    state.gaming = on;
    document.documentElement.classList.toggle('is-gaming', on);
    if (on) {
      // Bring the Mac fully into view first, then hold the page there.
      const r = mac.getBoundingClientRect();
      const off = r.top + r.height / 2 - window.innerHeight / 2;
      if (lenis && Math.abs(off) > 40) lenis.scrollTo(window.scrollY + off, { duration: 0.6, onComplete: () => state.gaming && lenis.stop() });
      else lenis?.stop();
      window.addEventListener('keydown', onGameKey, true);
      window.addEventListener('keyup', onGameKey, true);
    } else {
      lenis?.start();
      window.removeEventListener('keydown', onGameKey, true);
      window.removeEventListener('keyup', onGameKey, true);
    }
    emit('gaming', on);
  }

  // ---------- windows ----------
  function open(name, { from = null } = {}) {
    const app = APPS[name];
    if (!app || !state.on) return;
    if (app.disk && state.disk !== app.disk) {
      emit('need-disk', app.disk);
      alert(`Please insert the “${app.title}” disk. It's on the desk, next to the Mac.`, { icon: '◙' });
      return;
    }
    if (current?.name === name) {
      current.win.querySelector('.os__close')?.focus({ preventScroll: true });
      return;
    }
    close({ keepGame: true });
    const win = document.createElement('section');
    win.className = `os__win os__win--${name}${app.game ? ' os__win--game' : ''}`;
    win.setAttribute('aria-label', app.title);
    win.innerHTML = `
      <div class="os__bar"><button class="os__close" type="button" aria-label="Close ${app.title}"></button><span class="os__title">${app.title}</span></div>
      <div class="os__body"></div>`;
    desk.append(win);
    const api = app.mount(win.querySelector('.os__body'), { os: publicApi, reducedMotion }) || {};
    current = { name, win, api };
    state.app = name;
    win.querySelector('.os__close').addEventListener('click', () => close());
    if (!reducedMotion) {
      // grow out of the icon that opened it (or the screen's centre)
      let origin = '50% 40%';
      if (from) {
        const w = win.getBoundingClientRect();
        const f = from.getBoundingClientRect();
        origin = `${f.left + f.width / 2 - w.left}px ${f.top + f.height / 2 - w.top}px`;
      }
      gsap.from(win, { scale: 0.3, autoAlpha: 0, duration: 0.28, ease: 'ui-out', transformOrigin: origin });
    }
    setGaming(!!app.game);
    emit('open', name);
  }

  function close({ keepGame = false } = {}) {
    if (!current) return;
    const { win, api, name } = current;
    current = null;
    state.app = null;
    api.unmount?.();
    win.remove();
    if (!keepGame) setGaming(false);
    emit('close', name);
    if (!keepGame && APPS[name]?.disk) emit('game-closed', name); // closing a disk's app ejects it
  }

  // ---------- desktop icons: click selects, double-click / Enter / single tap opens ----------
  const select = (btn) => icons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  icons.forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('pointerdown', () => select(btn)); // highlight on press, not release
    btn.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') open(btn.dataset.app, { from: btn }); // no double-tap guessing on touch
    });
    btn.addEventListener('click', (e) => {
      select(btn);
      if (e.detail === 0) open(btn.dataset.app, { from: btn }); // keyboard Enter / Space
    });
    btn.addEventListener('dblclick', () => open(btn.dataset.app, { from: btn }));
  });
  desk.addEventListener('pointerdown', (e) => {
    if (e.target === desk) select(null);
  });

  // ---------- speaker (sound on/off), in the menu bar next to the clock ----------
  const speaker = document.createElement('button');
  speaker.type = 'button';
  speaker.className = 'os__speaker';
  const syncSpeaker = (v) => {
    speaker.setAttribute('aria-pressed', String(v));
    speaker.setAttribute('aria-label', v ? 'Sound on (turn off)' : 'Sound off (turn on)');
    speaker.innerHTML = `<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" shape-rendering="crispEdges"><path d="M1 4h2l3-3v10L3 8H1z" fill="currentColor"/>${v ? '<path d="M8 4c1 1 1 3 0 4M9.5 2.5c2 2 2 5 0 7" fill="none" stroke="currentColor"/>' : '<path d="M8 4l3 4M11 4l-3 4" stroke="currentColor"/>'}</svg>`;
  };
  syncSpeaker(soundOn());
  speaker.addEventListener('click', () => setSound(!soundOn()));
  const offSound = onSoundChange(syncSpeaker);
  clock.before(speaker);

  // ---------- menus ----------
  const MENUS = {
    File: [
      { label: 'Open Work', run: () => open('work') },
      { label: 'High Scores', run: () => open('scores') },
      { label: 'Close Window', run: () => close() },
    ],
    Edit: [
      { label: 'Undo', disabled: true },
      { label: 'Copy email', run: () => copyEmail() },
    ],
    Special: [
      { label: 'Eject Disk', run: () => emit('eject-request') },
      { label: 'Restart', run: () => restart() },
      { label: 'Koach Studio ↗', href: 'https://www.instagram.com/koach.studio/' },
      { label: 'Behance ↗', href: 'https://www.behance.net/theinvrangers' },
    ],
    Help: [
      { label: 'How to play', run: () => alert('Drag a floppy into the slot under the screen. Arrow keys or the keys below the Mac to play; eject (or Esc) to stop.', { icon: 'i' }) },
      { label: 'Talk to Krish', run: () => open('chat') },
    ],
  };
  let openMenu = null;
  const closeMenu = () => {
    openMenu?.list.remove();
    openMenu?.btn.setAttribute('aria-expanded', 'false');
    openMenu = null;
  };
  root.querySelectorAll('.os__menu').forEach((span) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'os__menu';
    btn.textContent = span.textContent;
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    span.replaceWith(btn);
    btn.addEventListener('click', () => {
      const same = openMenu?.btn === btn;
      closeMenu();
      if (same) return;
      const list = document.createElement('div');
      list.className = 'os__dropdown';
      list.setAttribute('role', 'menu');
      for (const item of MENUS[btn.textContent]) {
        const el = document.createElement(item.href ? 'a' : 'button');
        el.className = 'os__item';
        el.setAttribute('role', 'menuitem');
        el.textContent = item.label;
        if (item.href) Object.assign(el, { href: item.href, target: '_blank', rel: 'noopener' });
        else el.type = 'button';
        if (item.disabled) el.setAttribute('aria-disabled', 'true');
        el.addEventListener('click', () => {
          if (item.disabled) return;
          sfx('click');
          closeMenu();
          item.run?.();
        });
        list.append(el);
      }
      list.style.left = `${btn.offsetLeft}px`;
      root.append(list);
      openMenu = { btn, list };
      btn.setAttribute('aria-expanded', 'true');
      list.firstElementChild?.focus({ preventScroll: true });
    });
  });
  const onDocPointer = (e) => {
    if (openMenu && !e.target.closest('.os__dropdown, .os__menu')) closeMenu();
  };
  const onDocKey = (e) => {
    if (e.key === 'Escape' && openMenu) {
      openMenu.btn.focus({ preventScroll: true });
      closeMenu();
    } else if (openMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const items = [...openMenu.list.children];
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    } else if (e.key === 'Escape' && current && !state.gaming && mac.contains(document.activeElement)) {
      close();
    }
  };
  document.addEventListener('pointerdown', onDocPointer);
  document.addEventListener('keydown', onDocKey);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText('krishviramgamatir@gmail.com');
      alert('Copied krishviramgamatir@gmail.com', { icon: '✓' });
    } catch {
      alert('krishviramgamatir@gmail.com', { icon: '@' });
    }
  }

  // ---------- power ----------
  const boot = root.querySelector('.os__boot');
  let bootTimer = 0;
  function powerOff() {
    if (!state.on) return;
    clearTimeout(bootTimer);
    boot.hidden = true;
    closeMenu();
    close();
    state.on = false;
    mac.classList.add('is-off');
    if (reducedMotion) {
      gsap.set(root, { autoAlpha: 0 });
    } else {
      // The tube collapses to a bright line, then to a dot, then dark.
      gsap
        .timeline()
        .to(root, { scaleY: 0.012, filter: 'brightness(3)', duration: 0.16, ease: 'power2.in' })
        .to(root, { scaleX: 0, duration: 0.12, ease: 'power2.in' })
        .set(root, { autoAlpha: 0 });
    }
    emit('power', false);
  }
  function powerOn({ fast = false } = {}) {
    if (state.on) return;
    state.on = true;
    mac.classList.remove('is-off');
    gsap.set(root, { autoAlpha: 1, scaleX: 1, scaleY: 1, filter: 'none' });
    emit('power', true);
    if (reducedMotion || fast) {
      afterBoot();
      return;
    }
    boot.hidden = false;
    sfx('boot');
    gsap.fromTo(root, { filter: 'brightness(2.2)' }, { filter: 'brightness(1)', duration: 0.5, ease: 'ui-out' });
    bootTimer = setTimeout(() => {
      boot.hidden = true;
      afterBoot();
    }, 950);
  }
  function afterBoot() {
    if (state.disk) open(state.disk);
    else open('work');
  }
  function restart() {
    powerOff();
    setTimeout(() => powerOn(), 500);
  }

  // ---------- disks (the cabinet tells us) ----------
  function insertDisk(disk) {
    state.disk = disk;
    emit('disk', disk);
    if (!state.on) return;
    open(disk);
  }
  function ejectDisk() {
    const was = state.disk;
    state.disk = null;
    if (current && APPS[current.name]?.disk === was) {
      close();
      open('work');
    }
    emit('disk', null);
    return was;
  }

  const publicApi = {
    state,
    open,
    close,
    alert,
    prompt,
    powerOn,
    powerOff,
    insertDisk,
    ejectDisk,
    on: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    key: (key, down) => current?.api?.key?.(key, down), // the physical gamepad
    setBrightness: (v) => {
      const dim = mac.querySelector('.crt__dim');
      if (dim) dim.style.opacity = String(1 - v);
    },
  };

  open('work');

  publicApi.destroy = () => {
    clearInterval(clockTimer);
    offSound();
    close();
    document.removeEventListener('pointerdown', onDocPointer);
    document.removeEventListener('keydown', onDocKey);
  };
  return publicApi;
}
