import './styles/main.css';
import './styles/data.css';
import './styles/wheel.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { initDrive } from './garage/drive.js';
import { initWheel } from './garage/wheel.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';

// Data page (alter ego 01): first person in an F1 car on a floodlit pit lane (src/three/garage/).
// Drive in, park, and the camera zooms into the steering wheel: the wheel (src/garage/wheel.js) is
// the page from then on. Without WebGL it's just the wheel. Plan: design-system/pages/data.md
const { reducedMotion, fontsReady, lenis } = initShared();
const viaWipe = arrivedViaWipe();

const cockpit = document.querySelector('.cockpit');
const canvas = cockpit.querySelector('.cockpit__gl');
const pct = cockpit.querySelector('.cockpit__load-pct');
const bar = cockpit.querySelector('.cockpit__load-track');
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
    garage = await createGarage(canvas, { quality: pickQuality(), reducedMotion, onProgress: progress });
  } catch (err) {
    console.error('[garage] 3D failed, showing the plain wheel', err);
    document.documentElement.classList.add('no-gl');
    return plainWheel();
  }
  progress(1);
  cockpit.classList.add('is-ready');
  if (import.meta.env.DEV) window.__garage = garage;
  if (!reducedMotion) gsap.to(lines, { yPercent: 0, duration: 0.9, ease: 'ui-out', stagger: 0.08, delay: 0.25 });

  let drive = null;
  const wheel = initWheel({ root: wheelEl, reducedMotion, onPit: () => drive?.restart() });
  drive = initDrive({ garage, cockpit, wheel, reducedMotion, lenis });
  if (import.meta.env.DEV) Object.assign(window, { __drive: drive, __wheel: wheel });
});

function progress(p) {
  const v = Math.max(0, Math.min(1, p));
  bar.style.setProperty('--p', v.toFixed(3));
  pct.textContent = `${Math.round(v * 100)}%`;
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
  wheelEl.querySelector('[data-act="pit"]').hidden = true;
  document.documentElement.dataset.drive = 'wheel';
  wheel.show({ instant: true });
}
