import { PROJECTS } from './data/projects.js';
import { lap } from './modes/lap.js';
import { ROWS } from './modes/radio.js';
import { renderCheck, toggleCheck, turnCheck, leaveCheck, checkLevel } from './radio-check.js';
import { getBoard, postBoard } from './pitboard-client.js';
import { createGarageRadio } from './garage-radio.js';
import { sfx, loop, soundOn, onSoundChange } from '../audio/sfx.js';
import { LAYOUT } from './layout.js';

// The free roam's page side: out of the car and on foot in the garage (the 3D side is
// src/three/garage/roam.js). It reads the keys, the pointer and the station strip, and shows a
// station's content as HTML: laid over its screen when it has one (the pit wall's monitors, the
// engineers' stand, the TV), or as a panel beside the object (the car, the printer, the pit board,
// the team radio). Everything here is also reachable from the strip, so the 3D is a way to browse
// the same things, never the only way.
//
//   W S / ↑ ↓  walk (shift: run)   A D  step sideways   ← →  turn
//   look round: push the mouse to a screen edge, drag, or swipe sideways on a trackpad
//   click / tap        walk there, or open what's under it
//   1 … 7              jump to a station        esc     step back from it
//   E                  get back in the car (near it)
//   M                  the garage radio on / off (or click it); it's louder the closer you are
const STATIONS = [
  { id: 'gantry', key: '1', label: 'pit wall', what: 'projects' },
  { id: 'stand', key: '2', label: 'engineers', what: 'radio check' },
  { id: 'tv', key: '3', label: 'timing tv', what: 'your lap' },
  { id: 'car', key: '4', label: 'the car', what: 'get in' },
  { id: 'printer', key: '5', label: 'printer', what: 'cv' },
  { id: 'board', key: '6', label: 'pit board', what: 'sign it' },
  { id: 'headset', key: '7', label: 'team radio', what: 'contact' },
];
const ON_SCREEN = new Set(['gantry', 'stand', 'tv']); // HTML laid over a 3D screen
const CV_URL = '/assets/cv/krish-viramgama-cv.pdf';
const KEYS = { forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA'], right: ['KeyD'], turnLeft: ['ArrowLeft'], turnRight: ['ArrowRight'] };
const TURN = 1.9; // rad/s, the arrow keys
const EDGE = 0.8; // the outer 20% of the view, either side, turns you (mouse)
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function initRoam({ garage, cockpit, reducedMotion, onGetIn, onDrive }) {
  const root = cockpit.querySelector('.roam');
  const canvas = cockpit.querySelector('.cockpit__gl');
  const strip = root.querySelector('.roam__strip');
  const panel = root.querySelector('.roam__panel');
  const panelTag = panel.querySelector('[data-roam-tag]');
  const panelCount = panel.querySelector('[data-roam-count]');
  const body = panel.querySelector('[data-roam-body]');
  const prompts = panel.querySelector('[data-roam-prompts]');
  const hover = root.querySelector('.roam__hover');
  const objective = root.querySelector('[data-roam-objective]');
  const R = garage.roam;
  const touch = matchMedia('(pointer: coarse)').matches;
  const docEl = document.documentElement;

  strip.innerHTML = STATIONS.map((s) => `<button type="button" data-station="${s.id}"><kbd class="f1-key" aria-hidden="true">${s.key}</kbd><span>${s.label}</span><small>${s.what}</small></button>`).join('');

  // the projects you've opened this visit: ticked on their gantry monitors and counted on the strip
  const SEEN_KEY = 'krish:seen';
  let seen = [];
  try {
    seen = JSON.parse(sessionStorage.getItem(SEEN_KEY)) || [];
  } catch {
    /* storage off: it starts fresh */
  }
  const seenLabel = strip.querySelector('[data-station="gantry"] small');
  function showSeen() {
    garage.setSeen(seen);
    seenLabel.textContent = seen.length ? `${seen.length} / ${PROJECTS.length} seen` : 'projects';
  }
  function markSeen(i) {
    if (seen.includes(i)) return;
    seen = [...seen, i];
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {
      /* fine */
    }
    showSeen();
  }

  let active = false;
  let moving = false; // getting out / back in: a station picked now opens when it's done
  let pending = null;
  let open = null; // { id, index }
  let checkState = { clip: 0 };
  const say = (text) => objective.textContent !== text && (objective.textContent = text);

  // ---------- enter / leave ----------
  function enter() {
    if (active) return;
    active = true;
    root.hidden = false;
    void root.offsetWidth;
    root.classList.add('is-on');
    say('getting out…');
    getBoard().then(({ messages }) => garage.setBoard(messages[0]?.text)).catch(() => {}); // the newest line on the board
    showSeen();
    moving = true;
    R.enter(() => {
      moving = false;
      say(touch ? 'drag to look round · tap a screen or the floor' : 'look round: mouse to the edge, drag, or ← →');
      tipUntil = performance.now() + 6000; // (keeps that tip up for a few seconds)
      strip.querySelector('button')?.focus({ preventScroll: true });
      if (pending) openStation(pending.id, pending.index);
      pending = null;
    });
  }
  function leave() {
    if (!active) return;
    close({ instant: true });
    active = false;
    moving = true;
    pending = null;
    held.clear();
    R.move(0, 0);
    root.classList.remove('is-on');
    say('');
    R.leave(() => {
      moving = false;
      root.hidden = true;
      onGetIn?.();
    });
  }

  // ---------- stations ----------
  function openStation(id, index = 0) {
    if (!active) return;
    if (moving) return void (pending = { id, index });
    if (id === 'fridge') return drink();
    if (id === 'radio') return toggleRadio();
    close({ instant: true, keepCamera: true });
    open = { id, index };
    strip.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.station === id)));
    sfx('open');
    say(STATIONS.find((s) => s.id === id)?.what || '');
    R.setDock(cockpit.clientWidth < 760 ? 'bottom' : 'right');
    R.focus(id, index, () => {
      if (!open || open.id !== id) return;
      show();
    });
  }
  function show() {
    const { id, index } = open;
    const st = STATIONS.find((s) => s.id === id);
    panel.dataset.station = id;
    panelTag.textContent = st.label;
    panelCount.textContent = id === 'gantry' ? `${String(index + 1).padStart(2, '0')} / ${String(PROJECTS.length).padStart(2, '0')}` : '';
    RENDER[id](index);
    if (id === 'gantry') markSeen(index);
    panel.hidden = false;
    place();
    void panel.offsetWidth;
    panel.classList.add('is-on');
    panel.focus({ preventScroll: true });
  }
  function close({ instant = false, keepCamera = false } = {}) {
    if (!open) return;
    const was = open;
    open = null;
    if (was.id === 'stand') {
      leaveCheck();
      garage.setMeter(null);
    }
    panel.classList.remove('is-on');
    const hide = () => {
      if (!open) panel.hidden = true;
    };
    if (instant || reducedMotion) hide();
    else setTimeout(hide, 180);
    strip.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    if (!keepCamera) {
      sfx('close');
      R.unfocus();
      say(touch ? 'tap a screen or the floor · drag to look' : 'walk up to a screen · 1–7 jump to one');
      strip.querySelector(`[data-station="${was.id}"]`)?.focus({ preventScroll: true });
    }
  }
  // the gantry: the next monitor along
  function stepProject(d) {
    if (open?.id !== 'gantry') return;
    const n = Math.min(PROJECTS.length, R.stations.gantry.size);
    openStation('gantry', (open.index + d + n) % n);
  }

  // lay the panel over the station's screen (wide screens), or dock it (phones, objects)
  function place() {
    if (!open || panel.hidden) return;
    const narrow = cockpit.clientWidth < 760;
    const r = ON_SCREEN.has(open.id) && !narrow ? R.rect(open.id, open.index) : null;
    panel.classList.toggle('is-screen', !!r);
    panel.classList.toggle('is-docked', !r);
    if (r) Object.assign(panel.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    else panel.style.cssText = '';
  }
  window.addEventListener('resize', () => active && open && !R.busy && R.focus(open.id, open.index, place));

  // ---------- what each station shows ----------
  const RENDER = {
    gantry(i) {
      const p = PROJECTS[i];
      const sec = (title, text) => (text ? `<section class="p-sec"><h3>${title}</h3><p>${esc(text)}</p></section>` : '');
      const links = [p.links.repo && `<a href="${p.links.repo}" target="_blank" rel="noopener">code on github ↗</a>`, p.links.live && `<a href="${p.links.live}" target="_blank" rel="noopener">live ↗</a>`].filter(Boolean).join('');
      const check = p.check ? '<button type="button" class="p-check" data-roam-go="stand"><b>2</b> hear it at the engineers’ stand</button>' : '';
      body.innerHTML = `<article class="roam-brief">
          <header><p class="p-kind">${esc(p.kind)} · ${p.year}</p><h2 class="p-title" id="roam-title">${esc(p.title)}</h2>${p.team ? `<p class="p-team">${esc(p.team)}</p>` : ''}</header>
          <p class="p-summary">${esc(p.summary)}</p>
          ${check}
          ${sec('the question', p.problem)}${sec('how', p.approach)}${sec('what i learned', p.learned)}
          <ul class="p-stack">${p.stack.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
          <p class="p-links">${links}</p>
        </article>`;
      prompts.innerHTML = prompt([['‹ ›', 'project'], ['esc', 'back']]);
    },
    stand() {
      const p = PROJECTS.find((x) => x.check);
      checkState = { ...checkState, autoplay: true, fresh: true };
      renderCheck(body, p, checkState, ui);
      body.querySelector('.p-kind')?.setAttribute('id', 'roam-title');
      prompts.innerHTML = prompt([['‹ ›', 'clip'], ['↵', 'play / stop'], [touch ? 'slide' : '↑ ↓', 'model'], ['esc', 'back']]);
    },
    tv() {
      lap.render(body);
      const has = !body.querySelector('.lap-empty');
      if (!has) body.innerHTML = `<div class="lap-empty"><b>no lap set</b><span>you skipped the drive in. the tv shows it once you've done it.</span><p class="p-links"><button type="button" class="roam-btn roam-btn--primary" data-roam-act="drive">take the wheel</button></p></div>`;
      else body.insertAdjacentHTML('beforeend', `<p class="p-links"><button type="button" class="roam-btn" data-roam-act="drive">drive it again</button></p>`);
      body.firstElementChild?.setAttribute('id', 'roam-title');
      prompts.innerHTML = prompt([['esc', 'back']]);
    },
    car() {
      body.innerHTML = `<div class="roam-info">
          <h2 class="f1-info__t" id="roam-title">kv 01</h2>
          <p>2026 rules: lighter and narrower, half its power from the battery, active aero, no drs. built in code for this page, like everything else in the garage.</p>
          <p class="p-links"><button type="button" class="roam-btn roam-btn--primary" data-roam-act="getin">get in <kbd class="f1-key">E</kbd></button></p>
        </div>`;
      prompts.innerHTML = prompt([['E', 'get in'], ['esc', 'back']]);
    },
    printer() {
      body.innerHTML = `<div class="roam-info">
          <h2 class="f1-info__t" id="roam-title">print the cv</h2>
          <p data-cv-note>one page: education, the projects on the pit wall, the tools.</p>
          <p class="p-links"><button type="button" class="roam-btn roam-btn--primary" data-roam-act="print">print <kbd class="f1-key">↵</kbd></button></p>
        </div>`;
      prompts.innerHTML = prompt([['↵', 'print'], ['esc', 'back']]);
      cvReady().then((ok) => {
        if (ok || open?.id !== 'printer') return;
        body.querySelector('[data-cv-note]').textContent = 'out of paper: the cv is on its way. the team radio (7) reaches krish in the meantime.';
        body.querySelector('[data-roam-act="print"]').disabled = true;
      });
    },
    board() {
      body.innerHTML = `<div class="roam-info roam-board">
          <h2 class="f1-info__t" id="roam-title">the pit board</h2>
          <p>leave a line for the next driver in. short, like a real board.</p>
          <form class="roam-board__form" data-board-form>
            <label class="visually-hidden" for="board-text">your message</label>
            <input id="board-text" name="text" maxlength="28" autocomplete="off" placeholder="P1 · GG · BOX BOX" required />
            <button type="submit" class="roam-btn roam-btn--primary">post</button>
          </form>
          <p class="roam-board__msg" data-board-msg aria-live="polite"></p>
          <ol class="f1-rows roam-board__list" data-board-list></ol>
        </div>`;
      prompts.innerHTML = prompt([['↵', 'post'], ['esc', 'back']]);
      loadBoard();
    },
    headset() {
      body.innerHTML = `<div class="roam-info">
          <h2 class="f1-info__t" id="roam-title">team radio</h2>
          <p>pick a channel.</p>
          <ul class="f1-rows roam-radio">${ROWS.map((r) => `<li><a class="f1-row" href="${r.href}"${r.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${r.label}<span class="f1-row__v">${esc(r.value)}</span></a></li>`).join('')}</ul>
        </div>`;
      prompts.innerHTML = prompt([['↵', 'open'], ['esc', 'back']]);
      sfx('radio');
    },
  };
  const prompt = (list) => list.map(([k, t]) => `<span><kbd class="f1-key">${k}</kbd>${t}</span>`).join('');
  // what the radio check may drive while it's up (the wheel's ui, minus the wheel)
  const ui = { setLeds() {}, setKnob() {}, toast: (t) => say(t) };

  body.addEventListener('click', (e) => {
    const go = e.target.closest('[data-roam-go]');
    if (go) return openStation(go.dataset.roamGo);
    const act = e.target.closest('[data-roam-act]')?.dataset.roamAct;
    if (act === 'getin') leave();
    else if (act === 'drive') {
      close({ instant: true, keepCamera: true });
      active = false;
      root.classList.remove('is-on');
      R.leave(() => {
        root.hidden = true;
        onDrive?.();
      });
    } else if (act === 'print') print();
  });

  // ---------- the printer ----------
  let cvCheck = null;
  const cvReady = () => (cvCheck ??= fetch(CV_URL, { method: 'HEAD' }).then((r) => r.ok && !r.headers.get('content-type')?.includes('text/html')).catch(() => false));
  async function print() {
    if (!(await cvReady())) return;
    sfx('print');
    garage.printPage();
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = CV_URL;
      a.download = 'krish-viramgama-cv.pdf';
      a.click();
    }, reducedMotion ? 0 : 1400);
  }

  // ---------- the pit board ----------
  async function loadBoard() {
    const list = body.querySelector('[data-board-list]');
    if (!list) return;
    const { messages, local } = await getBoard();
    if (open?.id !== 'board') return;
    list.innerHTML = messages.length ? messages.map((m) => `<li class="f1-row"><span>${esc(m.text)}</span><span class="roam-board__when">${ago(m.at)}</span></li>`).join('') : '<li class="f1-row"><span>no messages yet: be the first</span></li>';
    const note = body.querySelector('[data-board-msg]');
    if (local && !note.textContent.includes('device')) note.textContent = `${note.textContent ? `${note.textContent} · ` : ''}only on this device for now`;
    garage.setBoard(messages[0]?.text);
  }
  body.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-board-form]');
    if (!form) return;
    e.preventDefault();
    const msg = body.querySelector('[data-board-msg]');
    const text = form.text.value;
    try {
      const { message } = await postBoard(text);
      form.reset();
      msg.textContent = 'on the board';
      sfx('chalk');
      garage.setBoard(message.text);
      loadBoard();
    } catch (err) {
      msg.textContent = err.message || 'no signal: try again';
    }
  });
  const ago = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };

  // ---------- the garage radio ----------
  const radio = createGarageRadio();
  const radioAt = garage.radioAt();
  function toggleRadio() {
    const on = radio.toggle();
    sfx('toggle');
    say(on ? 'radio on · walk up to it to turn it up' : 'radio off');
    tipUntil = performance.now() + 2500;
  }

  // ---------- the fridge ----------
  function drink() {
    sfx('drink');
    say('drinks bottle · it’s just water. you’re driving.');
  }

  // ---------- input ----------
  const held = new Set();
  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const busyPage = () => docEl.classList.contains('is-palette-open') || document.querySelector('.menu-btn[aria-expanded="true"]');
  function onKeyDown(e) {
    // (also while getting out / back in: the E that got you out is still on its way through the
    // listeners, and you're standing by the car, so it would read as "get back in")
    if (!active || moving || busyPage() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (typing(e)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === 'Escape' || e.key === 'Backspace') {
      if (open) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.code === 'KeyM' && !e.repeat) return toggleRadio();
    if (e.code === 'KeyE' && !e.repeat) {
      if (open?.id === 'car' || (!open && R.nearCar())) return leave();
    }
    const st = STATIONS.find((s) => s.key === e.key);
    if (st && !e.repeat) return openStation(st.id);
    if (open) {
      // inside a station: ← → step (projects / clips), ↑ ↓ the model dial, Enter the main action
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const d = e.key === 'ArrowLeft' ? -1 : 1;
        if (open.id === 'gantry') {
          e.preventDefault();
          return stepProject(d);
        }
        if (open.id === 'stand') {
          e.preventDefault();
          const n = PROJECTS.find((x) => x.check).check.length;
          checkState = { clip: (checkState.clip + d + n) % n, autoplay: true };
          sfx('shift');
          return renderCheck(body, PROJECTS.find((x) => x.check), checkState, ui);
        }
      }
      if (open.id === 'stand' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        return turnCheck(e.key === 'ArrowUp' ? 0.1 : -0.1);
      }
      if (e.key === 'Enter' && !document.activeElement?.closest?.('button, a, input')) {
        e.preventDefault();
        if (open.id === 'stand') return toggleCheck();
        if (open.id === 'printer') return print();
        if (open.id === 'car') return leave();
      }
      return;
    }
    const all = Object.values(KEYS).flat();
    if (all.includes(e.code) || e.key === 'Shift') {
      if (all.includes(e.code)) e.preventDefault();
      held.add(e.code === 'ShiftLeft' || e.code === 'ShiftRight' ? 'Shift' : e.code);
    }
  }
  const onKeyUp = (e) => {
    held.delete(e.code);
    if (e.key === 'Shift') held.delete('Shift');
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());

  // drag to look; a click (or tap) that didn't drag picks what's under it
  let drag = null;
  let edge = null; // the mouse over the view, −1…1 each way (null when it's off it)
  canvas.addEventListener('pointerdown', (e) => {
    if (!active || open || e.button > 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      const k = (touch ? 0.0055 : 0.0042) * (reducedMotion ? 0.7 : 1);
      R.look(dx * k, dy * k);
      root.classList.add('is-dragging');
      hover.hidden = true;
      return;
    }
    if (e.pointerType === 'mouse') {
      const r = canvas.getBoundingClientRect();
      edge = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1 };
      if (!open) hoverAt(e.clientX, e.clientY);
    }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    root.classList.remove('is-dragging');
    if (moved < 6 && e.type === 'pointerup') clickAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    hover.hidden = true;
    edge = null;
  });
  // a trackpad's sideways swipe turns you too
  canvas.addEventListener('wheel', (e) => {
    if (!active || open || moving || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    R.look(e.deltaX * 0.0035, 0);
  }, { passive: false });
  function rel(x, y) {
    const r = canvas.getBoundingClientRect();
    return [x - r.left, y - r.top];
  }
  function clickAt(x, y) {
    if (open || R.busy) return;
    const hit = R.pick(...rel(x, y));
    if (!hit) return;
    if (hit.station) return openStation(hit.station, hit.index);
    R.go(hit.point);
    marker(x, y);
  }
  // things you can click that aren't stations
  const EXTRAS = { fridge: () => ({ label: 'fridge', what: 'drink' }), radio: () => ({ label: 'radio', what: radio.on ? 'turn it off · M' : 'turn it on · M' }) };
  let hoverRaf = 0;
  function hoverAt(x, y) {
    cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => {
      const hit = R.busy ? null : R.pick(...rel(x, y));
      const st = hit?.station && (STATIONS.find((s) => s.id === hit.station) || EXTRAS[hit.station]?.());
      canvas.style.cursor = st ? 'pointer' : edge && Math.abs(edge.x) > EDGE ? (edge.x > 0 ? 'e-resize' : 'w-resize') : 'grab';
      hover.hidden = !st;
      if (st) {
        hover.innerHTML = `<b>${st.label}</b>${hit.station === 'gantry' ? esc(PROJECTS[hit.index]?.title || '') : st.what}`;
        hover.style.translate = `${x + 16}px ${y + 14}px`;
      }
    });
  }
  // where you clicked to go: a ring on the floor, briefly (a cue only, decorative)
  const ring = root.querySelector('.roam__ring');
  function marker(x, y) {
    if (reducedMotion) return;
    ring.style.translate = `${x}px ${y}px`;
    ring.classList.remove('is-on');
    void ring.offsetWidth;
    ring.classList.add('is-on');
  }

  strip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-station]');
    if (!b) return;
    if (open?.id === b.dataset.station) return close();
    openStation(b.dataset.station);
  });
  panel.querySelector('[data-roam-back]').addEventListener('click', () => close());
  panel.querySelector('[data-roam-prev]').addEventListener('click', () => stepProject(-1));
  panel.querySelector('[data-roam-next]').addEventListener('click', () => stepProject(1));

  // ---------- the garage's sound: a low rumble, cars on the straight, other teams' guns ----------
  let ambience = null;
  let nextAmb = 4;
  const startAmbience = () => {
    ambience?.stop();
    ambience = active && soundOn() ? loop('garage') : null;
  };
  const offSound = onSoundChange(() => startAmbience());

  // stand in the pit box too long and the radio tells you
  let inBox = 0;
  let boxCalled = false; // (a cooldown, so it isn't every few seconds)
  let tipUntil = 0; // a tip or the box call stays up until then

  // ---------- per frame ----------
  const offFrame = garage.onFrame((dt) => {
    // the radio: proximity while you're on foot, fading out when you get back in
    const lvl = radio.update(dt, {
      inGarage: active && !moving,
      listener: active ? garage.listener() : null,
      radio: radioAt,
      duck: open ? (open.id === 'stand' ? 0.06 : 0.45) : 1,
    });
    if (active) garage.setRadio({ level: lvl, label: radio.label });
    if (!active) {
      if (ambience) {
        ambience.stop();
        ambience = null;
      }
      return;
    }
    if (!ambience && soundOn()) startAmbience();
    nextAmb -= dt;
    if (nextAmb <= 0) {
      nextAmb = 5 + Math.random() * 9;
      sfx(Math.random() < 0.65 ? 'distant' : 'farGun');
    }
    const me = R.position();
    if (me && Math.abs(me.x - LAYOUT.pitBox.x) < 1.4 && Math.abs(me.z - LAYOUT.pitBox.z) < 2.6) {
      inBox += dt;
      if (inBox > 4 && !boxCalled) {
        boxCalled = true;
        tipUntil = performance.now() + 4000;
        sfx('radio');
        say('radio: box, box! …you’re standing in it.');
        setTimeout(() => (boxCalled = false), 20000);
      }
    } else inBox = 0;
    const on = (k) => KEYS[k].some((c) => held.has(c));
    R.move((on('forward') ? 1 : 0) - (on('back') ? 1 : 0), (on('right') ? 1 : 0) - (on('left') ? 1 : 0), held.has('Shift'));
    // turning: the arrow keys, or the mouse resting near a screen edge (faster the closer it gets)
    if (!open && !moving && !drag) {
      let yaw = ((on('turnRight') ? 1 : 0) - (on('turnLeft') ? 1 : 0)) * TURN;
      let pitch = 0;
      if (edge) {
        const ax = Math.abs(edge.x);
        if (ax > EDGE) yaw += Math.sign(edge.x) * Math.pow((ax - EDGE) / (1 - EDGE), 1.5) * 1.4;
        const ay = Math.abs(edge.y);
        if (ay > 0.82) pitch = Math.sign(edge.y) * Math.pow((ay - 0.82) / 0.18, 1.5) * 0.7;
      }
      if (yaw || pitch) R.look(yaw * dt, pitch * dt);
    }
    if (open?.id === 'stand') garage.setMeter(checkLevel());
    if (!open && !R.busy && performance.now() > tipUntil) say(R.nearCar() ? (touch ? 'tap the car to get in' : 'press E to get back in the car') : touch ? 'tap a screen or the floor · drag to look' : 'walk up to a screen · 1–7 jump to one');
  });
  const offStep = R.onStep(() => sfx('step'));

  return {
    get active() {
      return active;
    },
    enter,
    leave,
    destroy() {
      offFrame();
      offStep();
      offSound();
      ambience?.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
