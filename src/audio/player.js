import gsap from 'gsap';
import { audio, sfx, soundOn, setSound, onSoundChange } from './sfx.js';
import { RECORDS } from './records.js';

// The record player: a small spinning record in every page's header. Tap it and a turntable
// grows out of it (origin-aware, like the menu): pick a record from the crate, drop the needle.
//   - music never starts by itself; it plays only when you press play (Apple: agency)
//   - the platter spins up and slows down with inertia (33⅓ rpm), the tonearm swings on and off,
//     and a little vinyl crackle sits under the music
//   - pages are separate documents, so the music can't play straight through a page change: it
//     fades out under the wipe and picks up at the same spot on the next page. If the browser
//     blocks that, the header record pulses: one tap resumes.
//   - the "sound effects" switch here is the same setting as the Mac's speaker and ⌘K → Sound
const STATE = 'krish:music'; // sessionStorage: { rec, i, t, playing }
const VOL = 'krish:volume'; // localStorage
const RPM = 1800; // ms per turn at 33⅓
const ARM_REST = 0;
const ARM_PLAY = 26;

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const read = (store, key) => {
  try {
    return JSON.parse(store.getItem(key));
  } catch {
    return null;
  }
};
const write = (store, key, v) => {
  try {
    store.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export function initPlayer({ reducedMotion }) {
  const header = document.querySelector('.site-header');
  const menuBtn = header?.querySelector('.menu-btn');
  if (!header || !menuBtn) return null;

  // ---------- markup ----------
  const end = document.createElement('div');
  end.className = 'site-header__end';
  menuBtn.before(end);
  end.append(menuBtn);

  const mini = document.createElement('button');
  mini.type = 'button';
  mini.className = 'spin';
  mini.setAttribute('aria-expanded', 'false');
  mini.setAttribute('aria-controls', 'turntable');
  mini.innerHTML = '<span class="spin__disc" aria-hidden="true"><i class="spin__label"></i></span>';
  end.prepend(mini);

  const panel = document.createElement('section');
  panel.id = 'turntable';
  panel.className = 'tt';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Record player');
  panel.hidden = true;
  panel.innerHTML = `
    <header class="tt__head"><span class="tt__kicker">record player</span><button class="tt__x" type="button" aria-label="Close record player">×</button></header>
    <div class="tt__deck">
      <div class="tt__platter"><div class="tt__vinyl"><div class="tt__label"><b class="tt__rec"></b><small class="tt__note"></small></div></div></div>
      <svg class="tt__arm" viewBox="0 0 60 150" width="60" height="150" aria-hidden="true"><circle cx="44" cy="16" r="11" class="tt__arm-base"/><path d="M44 16 L44 104 L30 128" class="tt__arm-rod"/><rect x="22" y="124" width="14" height="20" rx="3" transform="rotate(30 29 134)" class="tt__arm-head"/></svg>
      <button class="tt__arm-hit" type="button" aria-hidden="true" tabindex="-1"></button>
    </div>
    <div class="tt__now" aria-live="polite"><p class="tt__track"></p><p class="tt__artist"></p></div>
    <div class="tt__bar"><span class="tt__time">0:00</span><input class="tt__seek" type="range" min="0" max="1000" value="0" aria-label="Position in track" /><span class="tt__dur">0:00</span></div>
    <div class="tt__controls">
      <button class="tt__btn" type="button" data-act="prev" aria-label="Previous track"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 3v10M13 3 6 8l7 5z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
      <button class="tt__btn tt__btn--play" type="button" data-act="play" aria-label="Play"><svg class="tt__icon-play" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg><svg class="tt__icon-pause" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z" fill="currentColor"/></svg></button>
      <button class="tt__btn" type="button" data-act="next" aria-label="Next track"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M13 3v10M3 3l7 5-7 5z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
    </div>
    <div class="tt__crate" role="radiogroup" aria-label="Records">
      ${RECORDS.map((r) => `<button class="tt__sleeve" type="button" role="radio" aria-checked="false" data-rec="${r.id}" style="--rec:${r.color};--rec-ink:${r.ink}"><span class="tt__sleeve-art" aria-hidden="true"></span><span class="tt__sleeve-title">${r.title}</span><small>${r.tracks.length ? `${r.tracks.length} track${r.tracks.length > 1 ? 's' : ''}` : 'coming soon'}</small></button>`).join('')}
    </div>
    <div class="tt__foot">
      <label class="tt__vol"><span>volume</span><input type="range" min="0" max="100" value="70" aria-label="Music volume" /></label>
      <button class="tt__fx" type="button" role="switch" aria-checked="false"><span>sound effects</span><i aria-hidden="true"></i></button>
    </div>`;
  header.append(panel);

  const $ = (s) => panel.querySelector(s);
  const vinyl = $('.tt__vinyl');
  const arm = $('.tt__arm');
  const playBtn = $('[data-act="play"]');
  const seek = $('.tt__seek');
  const volEl = $('.tt__vol input');
  const fxBtn = $('.tt__fx');

  // ---------- state ----------
  const saved = read(sessionStorage, STATE) || {};
  let rec = RECORDS.find((r) => r.id === saved.rec) || RECORDS.find((r) => r.tracks.length) || RECORDS[0];
  let i = Math.min(saved.i || 0, Math.max(0, rec.tracks.length - 1));
  let playing = false;
  let waiting = false; // was playing on the last page, browser wants a tap to resume
  let volume = read(localStorage, VOL) ?? 0.7;
  volEl.value = String(Math.round(volume * 100));

  const el = new Audio();
  el.preload = 'metadata';
  el.volume = volume;

  // ---------- spin (WAAPI, so the platter can spin up / slow down with inertia) ----------
  const spinOpts = { duration: RPM, iterations: Infinity };
  const spins = [vinyl, mini.querySelector('.spin__disc')].map((n) => {
    const a = n.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], spinOpts);
    a.pause();
    return a;
  });
  const rate = { v: 0 };
  function spin(onNow) {
    if (reducedMotion) return; // a still record; the tonearm and the button still show state
    gsap.to(rate, {
      v: onNow ? 1 : 0,
      duration: onNow ? 0.7 : 1.1,
      ease: onNow ? 'power2.out' : 'power1.out',
      overwrite: true,
      onStart: () => onNow && spins.forEach((a) => a.play()),
      onUpdate: () => spins.forEach((a) => (a.playbackRate = Math.max(0.001, rate.v))),
      onComplete: () => !onNow && spins.forEach((a) => a.pause()),
    });
  }
  const swingArm = (on) => gsap.to(arm, { rotation: on ? ARM_PLAY : ARM_REST, svgOrigin: '44 16', duration: reducedMotion ? 0 : 0.45, ease: 'ui-in-out', overwrite: true });
  gsap.set(arm, { rotation: ARM_REST, svgOrigin: '44 16' });

  // ---------- vinyl crackle under the music (Web Audio, quiet) ----------
  let crackle = null;
  function crackleOn(on) {
    if (!on) {
      if (crackle) {
        const { g, src, a } = crackle;
        g.gain.setTargetAtTime(0.0001, a.currentTime, 0.2);
        src.stop(a.currentTime + 1);
        crackle = null;
      }
      return;
    }
    const a = audio();
    if (!a || crackle) return;
    const len = a.sampleRate * 3;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < len; k += 1) d[k] = (Math.random() * 2 - 1) * 0.04 + (Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.9 : 0);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2600;
    f.Q.value = 0.6;
    const g = a.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.05 * volume, a.currentTime, 0.3);
    src.connect(f).connect(g).connect(a.destination);
    src.start();
    crackle = { g, src, a };
  }

  // ---------- render ----------
  function render() {
    const t = rec.tracks[i];
    $('.tt__rec').textContent = rec.title;
    $('.tt__note').textContent = rec.note;
    panel.style.setProperty('--rec', rec.color);
    panel.style.setProperty('--rec-ink', rec.ink);
    mini.style.setProperty('--rec', rec.color);
    $('.tt__track').textContent = t ? t.title : 'this record is still in the sleeve';
    $('.tt__artist').textContent = t ? t.artist : 'tracks coming soon';
    panel.querySelectorAll('.tt__sleeve').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.rec === rec.id)));
    const empty = !rec.tracks.length;
    [playBtn, $('[data-act="prev"]'), $('[data-act="next"]'), seek].forEach((b) => (b.disabled = empty));
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    panel.classList.toggle('is-playing', playing);
    mini.classList.toggle('is-playing', playing);
    mini.classList.toggle('is-waiting', waiting);
    mini.setAttribute('aria-label', waiting ? `Resume music: ${t?.title}` : playing ? `Record player, playing ${t?.title}` : 'Record player');
  }
  const save = () => write(sessionStorage, STATE, { rec: rec.id, i, t: el.currentTime || 0, playing });

  let loaded = ''; // the track's own URL (el.src comes back absolute and percent-encoded)
  function load(keepTime = 0) {
    const t = rec.tracks[i];
    if (!t) return false;
    if (loaded !== t.src) {
      loaded = t.src;
      el.src = t.src;
    }
    if (keepTime) {
      const set = () => (el.currentTime = keepTime);
      if (el.readyState >= 1) set();
      else el.addEventListener('loadedmetadata', set, { once: true });
    }
    return true;
  }

  async function play({ fadeIn = false } = {}) {
    if (!load()) return;
    try {
      if (fadeIn) el.volume = 0;
      await el.play();
      playing = true;
      waiting = false;
      if (fadeIn) gsap.to(el, { volume, duration: 0.8, ease: 'power1.out', overwrite: true });
      swingArm(true);
      spin(true);
      crackleOn(true);
    } catch {
      // autoplay blocked (only on resume after a page change): wait for a tap
      waiting = true;
    }
    render();
    save();
  }
  function pause() {
    el.pause();
    playing = false;
    swingArm(false);
    spin(false);
    crackleOn(false);
    render();
    save();
  }
  function step(d) {
    if (!rec.tracks.length) return;
    i = (i + d + rec.tracks.length) % rec.tracks.length;
    load();
    if (playing) play();
    else render();
    save();
  }
  function pick(id) {
    const next = RECORDS.find((r) => r.id === id);
    if (!next || next === rec) return;
    const was = playing;
    if (was) pause();
    rec = next;
    i = 0;
    el.removeAttribute('src');
    loaded = '';
    load(); // show the new track's length right away
    sfx('tap');
    // the new record drops onto the platter
    if (!reducedMotion) gsap.fromTo(vinyl, { scale: 0.9, autoAlpha: 0.4 }, { scale: 1, autoAlpha: 1, duration: 0.35, ease: 'ui-out' });
    render();
    save();
    if (was && rec.tracks.length) play();
  }

  // ---------- events ----------
  el.addEventListener('timeupdate', () => {
    if (!Number.isFinite(el.duration)) return;
    if (document.activeElement !== seek) seek.value = String(Math.round((el.currentTime / el.duration) * 1000));
    $('.tt__time').textContent = fmt(el.currentTime);
    if (performance.now() - (save.last || 0) > 1000) {
      save.last = performance.now();
      save();
    }
  });
  el.addEventListener('loadedmetadata', () => ($('.tt__dur').textContent = fmt(el.duration)));
  el.addEventListener('ended', () => step(1));
  seek.addEventListener('input', () => {
    if (Number.isFinite(el.duration)) el.currentTime = (Number(seek.value) / 1000) * el.duration;
  });
  volEl.addEventListener('input', () => {
    volume = Number(volEl.value) / 100;
    el.volume = volume;
    if (crackle) crackle.g.gain.setTargetAtTime(0.05 * volume, crackle.a.currentTime, 0.1);
    write(localStorage, VOL, volume);
  });
  panel.querySelector('.tt__controls').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'play') (playing ? pause : play)();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
  });
  $('.tt__arm-hit').addEventListener('click', () => rec.tracks.length && (playing ? pause : play)());
  panel.querySelector('.tt__crate').addEventListener('click', (e) => {
    const s = e.target.closest('.tt__sleeve');
    if (s) pick(s.dataset.rec);
  });
  // arrow keys move through the crate (it's a radio group)
  panel.querySelector('.tt__crate').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const k = RECORDS.indexOf(rec) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    const next = RECORDS[(k + RECORDS.length) % RECORDS.length];
    pick(next.id);
    panel.querySelector(`[data-rec="${next.id}"]`).focus();
  });
  const fxRender = (on) => fxBtn.setAttribute('aria-checked', String(on));
  fxRender(soundOn());
  onSoundChange(fxRender);
  fxBtn.addEventListener('click', () => setSound(!soundOn()));

  // ---------- open / close (grows from the header record, like the menu from the burger) ----------
  let open = false;
  function setOpen(next, { instant = false, returnFocus = true } = {}) {
    if (next === open) return;
    open = next;
    mini.setAttribute('aria-expanded', String(open));
    const still = instant || reducedMotion;
    if (open) {
      panel.hidden = false;
      sfx('open');
      gsap.fromTo(panel, { autoAlpha: 0, scale: still ? 1 : 0.94, y: still ? 0 : -6 }, { autoAlpha: 1, scale: 1, y: 0, duration: still ? 0 : 0.24, ease: 'ui-out', overwrite: true });
      (rec.tracks.length ? playBtn : panel.querySelector('.tt__sleeve[aria-checked="true"]'))?.focus({ preventScroll: true });
    } else {
      sfx('close');
      gsap.to(panel, { autoAlpha: 0, scale: reducedMotion ? 1 : 0.96, y: reducedMotion ? 0 : -4, duration: still ? 0 : 0.16, ease: 'ui-out', overwrite: true, onComplete: () => !open && (panel.hidden = true) });
      if (returnFocus) mini.focus({ preventScroll: true });
    }
  }
  mini.addEventListener('click', (e) => {
    if (waiting) play({ fadeIn: true }); // one tap brings the music back
    setOpen(!open, { instant: e.detail === 0 });
  });
  $('.tt__x').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && open && setOpen(false, { instant: true }));
  document.addEventListener('pointerdown', (e) => open && !panel.contains(e.target) && !mini.contains(e.target) && setOpen(false, { returnFocus: false }));
  panel.addEventListener('focusout', (e) => open && e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== mini && setOpen(false, { returnFocus: false }));

  // ---------- page changes: fade out under the wipe, pick up on the next page ----------
  window.addEventListener('page:leave', () => {
    save();
    if (playing) gsap.to(el, { volume: 0, duration: 0.5, ease: 'power1.in', overwrite: true });
  });
  window.addEventListener('pagehide', save);

  render();
  load(saved.t || 0); // metadata only (preload), so the length shows before you press play
  if (saved.playing && rec.tracks.length) play({ fadeIn: true });

  return { open: () => setOpen(true), isPlaying: () => playing };
}
