import { sfx } from './sound.js';
import gsap from 'gsap';
import { makeDraggable, sessionSpot } from './drag.js';
import { getNotes, postNote, deleteNote, moveNote } from './api-client.js';
import { checkNote } from './name-rules.js';

// Everything stuck around the Mac.
//   - Stickers and the house notes can be picked up and moved (kept for the session). A tap on
//     a sticker follows its link (Koach, YouTube, Behance); a drag never does.
//   - The rose note flips (tap / Enter): the thumbnail origin story.
//   - Visitors' notes: "+ leave a note" opens a little pad; the Mac holds the three newest, the
//     same for everyone (api/notes.js), or just this browser until the server is connected.
const TONES = ['canary', 'rose', 'tang', 'mint', 'sky'];
const PENS = { pen: 'pen', marker: 'marker', label: 'label maker' };
// The Mac holds three visitors' notes (api/notes.js keeps the three newest, the same for everyone);
// their spots around the Mac, newest first (percent of the desk).
const SLOTS = [
  { left: '24%', top: '-7%', r: 3 }, // on the Mac's top edge
  { left: '-3%', top: '24%', r: -5 }, // left, between the welcome note and the photo
  { left: '50%', top: '-9%', r: -3 }, // on the top edge, next to the first
];

export function initDesk({ reducedMotion }) {
  const desk = document.querySelector('.desk');
  if (!desk) return () => {};

  // ---------- stickers + house notes ----------
  desk.querySelectorAll('.sticker, .sticky[data-drag-id]').forEach((el) => {
    const id = el.dataset.dragId || el.className;
    makeDraggable(el, {
      reducedMotion,
      bounds: () => desk,
      store: sessionSpot(id),
      onTap: (e) => {
        if (el.classList.contains('sticky--flip')) {
          e.preventDefault();
          flip(el);
        }
      },
    });
  });
  const flip = (el) => {
    const next = el.getAttribute('aria-pressed') !== 'true';
    sfx('flip');
    if (reducedMotion) {
      el.setAttribute('aria-pressed', String(next));
      return;
    }
    // a quick paper turn: squash to an edge, swap faces, open back out
    gsap
      .timeline()
      .to(el, { scaleX: 0, duration: 0.12, ease: 'power2.in' })
      .call(() => el.setAttribute('aria-pressed', String(next)))
      .to(el, { scaleX: 1, duration: 0.2, ease: 'back.out(2)' });
  };
  desk.querySelectorAll('.sticky--flip').forEach((el) =>
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flip(el);
      }
    })
  );

  // ---------- visitors' notes ----------
  const layer = desk.querySelector('.notes');
  const ghost = desk.querySelector('.sticky--ghost');
  let offline = false;

  const renderNote = (note, i) => {
    const slot = SLOTS[i % SLOTS.length];
    const el = document.createElement('div');
    el.className = `sticky sticky--visitor sticky--${TONES.includes(note.tone) ? note.tone : 'canary'} pen--${PENS[note.pen] ? note.pen : 'pen'}`;
    el.tabIndex = 0;
    el.setAttribute('role', 'note');
    el.setAttribute('aria-label', `${note.mine ? 'Your note' : "A visitor's note"}: ${note.text}`);
    Object.entries(slot).forEach(([k, v]) => k !== 'r' && (el.style[k] = v));
    if (slot.right) el.style.left = 'auto'; // (the stylesheet's default left would win over right)
    el.style.setProperty('--r', `${slot.r}deg`);
    const text = document.createElement('span');
    text.className = 'sticky__text';
    text.textContent = note.text; // never HTML
    el.append(text);
    if (note.mine) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sticky__del';
      del.dataset.nodrag = '';
      del.setAttribute('aria-label', 'Remove your note');
      del.textContent = '×';
      del.addEventListener('click', async () => {
        await deleteNote(note.id);
        gsap.to(el, { autoAlpha: 0, scale: 0.8, duration: reducedMotion ? 0 : 0.2, onComplete: () => el.remove() });
      });
      el.append(del);
      if (offline) {
        const tag = document.createElement('small');
        tag.className = 'sticky__tag';
        tag.textContent = 'only you can see this for now';
        el.append(tag);
      }
    }
    layer.append(el);
    if (note.pos) gsap.set(el, { x: note.pos.x, y: note.pos.y });
    makeDraggable(el, {
      reducedMotion,
      bounds: () => desk,
      onDrop: (pos) => note.mine && moveNote(note.id, pos), // others' notes move on your screen only
    });
    return el;
  };

  async function load() {
    try {
      const { notes, local } = await getNotes();
      offline = local;
      layer.textContent = '';
      // the same three for everyone, newest first
      notes.slice(0, SLOTS.length).forEach(renderNote);
    } catch {
      /* the desk works without them */
    }
  }
  load();

  // ---------- the pad: write a note ----------
  let pad = null;
  function openPad() {
    if (pad) return;
    pad = document.createElement('form');
    pad.className = 'notepad sticky sticky--canary';
    pad.innerHTML = `
      <label class="visually-hidden" for="notepad-text">Your note</label>
      <textarea id="notepad-text" class="notepad__text" maxlength="60" rows="3" placeholder="say hi, leave a tip…"></textarea>
      <div class="notepad__row" role="radiogroup" aria-label="Paper colour">
        ${TONES.map((t, i) => `<button type="button" class="notepad__tone notepad__tone--${t}" role="radio" aria-checked="${i === 0}" aria-label="${t}" data-tone="${t}"></button>`).join('')}
      </div>
      <div class="notepad__row" role="radiogroup" aria-label="Pen">
        ${Object.entries(PENS).map(([k, label], i) => `<button type="button" class="notepad__pen pen--${k}" role="radio" aria-checked="${i === 0}" data-pen="${k}">${label}</button>`).join('')}
      </div>
      <p class="notepad__error" role="alert"></p>
      <div class="notepad__actions">
        <button type="button" class="notepad__btn" data-act="cancel">cancel</button>
        <button type="submit" class="notepad__btn notepad__btn--go">stick it</button>
      </div>`;
    desk.append(pad);
    let tone = TONES[0];
    let pen = 'pen';
    const field = pad.querySelector('textarea');
    const error = pad.querySelector('.notepad__error');
    const choose = (attr, value) => {
      pad.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === value)));
      if (attr === 'tone') {
        pad.className = `notepad sticky sticky--${value}`;
        tone = value;
      } else {
        field.className = `notepad__text pen--${value}`;
        pen = value;
      }
    };
    pad.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tone]');
      const p = e.target.closest('[data-pen]');
      if (t) choose('tone', t.dataset.tone);
      if (p) choose('pen', p.dataset.pen);
      if (e.target.closest('[data-act="cancel"]')) closePad();
    });
    pad.addEventListener('keydown', (e) => e.key === 'Escape' && closePad());
    pad.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { text, error: err } = checkNote(field.value);
      if (err) {
        error.textContent = err;
        return;
      }
      const go = pad.querySelector('.notepad__btn--go');
      go.disabled = true;
      go.textContent = 'sticking…';
      try {
        const { local } = await postNote({ text, tone, pen });
        offline = local;
        closePad(false);
        // yours is the newest now: it takes the first spot and the oldest of the three comes off
        await load();
        const el = layer.firstElementChild;
        if (el && !reducedMotion) gsap.from(el, { scale: 1.4, autoAlpha: 0, y: -30, duration: 0.45, ease: 'back.out(1.6)' });
        el?.focus({ preventScroll: true });
      } catch (ex) {
        error.textContent = ex.message || 'Could not stick it. Try again?';
        go.disabled = false;
        go.textContent = 'stick it';
      }
    });
    field.focus({ preventScroll: true });
    if (!reducedMotion) gsap.from(pad, { scale: 0.9, autoAlpha: 0, duration: 0.2, ease: 'ui-out' });
  }
  function closePad(refocus = true) {
    pad?.remove();
    pad = null;
    if (refocus) ghost.focus({ preventScroll: true });
  }
  ghost?.addEventListener('click', openPad);

  return () => closePad(false);
}
