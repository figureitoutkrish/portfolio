import './styles/main.css';
import './styles/f1ui.css'; // the F1-game UI language first; page styles build on it
import './styles/data.css';
import './styles/wheel.css';
import './styles/roam.css';
import '@fontsource-variable/saira/wdth.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { initQuickLap } from './sections/quicklap.js';
import { initDrive } from './garage/drive.js';
import { initWheel } from './garage/wheel.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';

// Data page (alter ego 01): first person in an F1 car on a floodlit pit lane (src/three/garage/).
// Drive in, park, and the camera zooms into the steering wheel: the wheel (src/garage/wheel.js) is
// the page from then on. Without WebGL it's just the wheel. Plan: design-system/pages/data.md
const { reducedMotion, fontsReady, lenis } = initShared();
initQuickLap({ page: 'data', reducedMotion }); // the 60-second version, for people short on time
const viaWipe = arrivedViaWipe();

const cockpit = document.querySelector('.cockpit');
const canvas = cockpit.querySelector('.cockpit__gl');
const pct = cockpit.querySelector('.cockpit__load-pct');
const bar = cockpit.querySelector('.cockpit__load-track');

// ---------- the loader: honest, but never a blink ----------
// Each line ticks only once that part has really loaded, in order, at most one every ~320 ms, with
// a spinner on the one being worked on; the percentage counts up smoothly toward the real progress;
// the whole thing takes at least ~1.4 s so a fast load still reads as loading.
const ORDER = ['engine', 'lane', 'car', 'radio'];
const STEP = 320;
const MIN_TOTAL = 1400;
const loadStart = performance.now();
const loaded = new Set();
let ticked = 0;
let lastTick = loadStart;
let carIn = false; // the loading manager reports 1/1 before it knows about every texture: don't trust it until the car is in
let realP = 0;
let shownP = 0;
let pumpTimer = 0;
let doneLoading;
const loaderDone = new Promise((r) => (doneLoading = r));
const lineOf = (name) => cockpit.querySelector(`[data-check="${name}"]`);
lineOf(ORDER[0])?.classList.add('is-active');
function check(name) {
  if (name === 'car') carIn = true;
  loaded.add(name);
  pump();
}
function pump() {
  clearTimeout(pumpTimer);
  const now = performance.now();
  const next = ORDER[ticked];
  if (next && loaded.has(next)) {
    const wait = reducedMotion ? 0 : STEP - (now - lastTick);
    if (wait > 0) return void (pumpTimer = setTimeout(pump, wait));
    lineOf(next)?.classList.replace('is-active', 'is-done') || lineOf(next)?.classList.add('is-done');
    ticked += 1;
    lastTick = now;
    lineOf(ORDER[ticked])?.classList.add('is-active');
    return pump();
  }
  if (!next) {
    const left = reducedMotion ? 0 : MIN_TOTAL - (now - loadStart);
    if (left > 0) return void (pumpTimer = setTimeout(pump, left));
    doneLoading();
  }
}
// the bar and the number ease toward what's really loaded (and what the checklist says)
function showProgress() {
  // a quarter per line: the line being worked on fills part of its quarter (more once it's in)
  const working = ORDER[ticked];
  const part = !working ? 0 : loaded.has(working) ? 0.85 : working === 'car' ? 0.75 * realP * (carIn ? 1 : 0.9) : 0.35;
  const target = Math.min(1, (ticked + part) / ORDER.length);
  shownP += (target - shownP) * (reducedMotion ? 1 : 0.12);
  if (Math.abs(target - shownP) < 0.002) shownP = target;
  bar.style.setProperty('--p', shownP.toFixed(3));
  pct.textContent = `${Math.round(shownP * 100)}%`;
  if (!cockpit.classList.contains('is-ready')) requestAnimationFrame(showProgress);
}
requestAnimationFrame(showProgress);
const lines = cockpit.querySelectorAll('.cockpit__title .line > span');
const wheelEl = document.getElementById('wheel');

const gl = webglAvailable();
if (!gl) document.documentElement.classList.add('no-gl');
if (!reducedMotion) gsap.set(lines, { yPercent: 110 });

fontsReady.then(async () => {
  if (viaWipe) revealArrival();
  if (!gl) return plainWheel();
  let garage;
  try {
    const { createGarage } = await import('./three/garage/index.js');
    check('engine');
    garage = await createGarage(canvas, { quality: pickQuality(), reducedMotion, onProgress: progress, onStage: check });
  } catch (err) {
    console.error('[garage] 3D failed, showing the plain wheel', err);
    document.documentElement.classList.add('no-gl');
    return plainWheel();
  }
  progress(1);
  await loaderDone; // (every line ticked, and at least ~1.4 s on screen)
  bar.style.setProperty('--p', '1');
  pct.textContent = '100%';
  cockpit.classList.add('is-ready');
  if (import.meta.env.DEV) window.__garage = garage;
  if (!reducedMotion) gsap.to(lines, { yPercent: 0, duration: 0.9, ease: 'ui-out', stagger: 0.08, delay: 0.25 });

  let drive = null;
  const wheel = initWheel({ root: wheelEl, reducedMotion, onPit: () => drive?.restart(), onOut: () => drive?.getOut() });
  drive = initDrive({ garage, cockpit, wheel, reducedMotion, lenis });
  if (import.meta.env.DEV) Object.assign(window, { __drive: drive, __wheel: wheel });
});

function progress(p) {
  realP = Math.max(realP, Math.min(1, p));
}

// phones, tablets and low-memory devices get the light version; ?q=low|high overrides
function pickQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'high') return q;
  const small = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  const weak = (navigator.deviceMemory || 8) < 4 || (navigator.hardwareConcurrency || 8) < 4;
  return small || weak ? 'low' : 'high';
}

function webglAvailable() {
  if (new URLSearchParams(location.search).has('nogl')) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// no WebGL (or it failed): the wheel on its own is the page; PIT has nowhere to drive to
function plainWheel() {
  const wheel = initWheel({ root: wheelEl, reducedMotion, onPit: () => {} });
  wheelEl.querySelectorAll('[data-act="pit"], [data-act="out"]').forEach((b) => (b.hidden = true)); // nowhere to drive or walk
  document.documentElement.dataset.drive = 'wheel';
  wheel.show({ instant: true });
}
