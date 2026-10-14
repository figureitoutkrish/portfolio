import './styles/main.css';
import './styles/data.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import gsap from 'gsap';
import { initShared } from './shared.js';
import { arrivedViaWipe, revealArrival } from './utils/transition.js';
import { PROJECTS } from './garage/data/projects.js';

// Data page (alter ego 01): first person in the car on a night pit lane (src/three/garage/), then
// the garage's stations. The stations are plain HTML too: that's the page without WebGL or JS, and
// what "skip the drive" jumps to. Plan: design-system/pages/data.md
const { reducedMotion, fontsReady } = initShared();
const viaWipe = arrivedViaWipe();

const cockpit = document.querySelector('.cockpit');
const canvas = cockpit.querySelector('.cockpit__gl');
const pct = cockpit.querySelector('.cockpit__load-pct');
const bar = cockpit.querySelector('.cockpit__load-track');
const lines = cockpit.querySelectorAll('.cockpit__title .line > span');

renderProjects();

const gl = webglAvailable();
if (!gl) document.documentElement.classList.add('no-gl');
if (!reducedMotion) gsap.set(lines, { yPercent: 110 });

fontsReady.then(async () => {
  if (viaWipe) revealArrival();
  if (!gl) return;
  let garage;
  try {
    const { createGarage } = await import('./three/garage/index.js');
    garage = await createGarage(canvas, { quality: pickQuality(), reducedMotion, onProgress: progress });
  } catch (err) {
    console.error('[garage] 3D failed, showing the plain page', err);
    document.documentElement.classList.add('no-gl');
    return;
  }
  progress(1);
  cockpit.classList.add('is-ready');
  if (import.meta.env.DEV) window.__garage = garage;
  if (!reducedMotion) gsap.to(lines, { yPercent: 0, duration: 0.9, ease: 'ui-out', stagger: 0.08, delay: 0.25 });

  // M1: the start button only clears the intro; driving arrives with the vehicle model
  cockpit.querySelector('[data-start]').addEventListener('click', () => cockpit.classList.add('is-driving'));
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

function renderProjects() {
  const list = document.querySelector('[data-projects]');
  if (!list) return;
  list.innerHTML = PROJECTS.map(
    (p) => `<li class="brief" id="project-${p.slug}">
      <p class="brief__meta"><span></span><span>${p.year}</span></p>
      <h3 class="brief__title"></h3>
      <p class="brief__summary"></p>
      <ul class="brief__stack">${p.stack.map(() => '<li></li>').join('')}</ul>
      <p class="brief__links">${p.links.repo ? `<a href="${p.links.repo}" target="_blank" rel="noopener">code ↗</a>` : ''}${p.links.live ? `<a href="${p.links.live}" target="_blank" rel="noopener">live ↗</a>` : ''}</p>
    </li>`
  ).join('');
  // text goes in as text
  [...list.children].forEach((li, i) => {
    const p = PROJECTS[i];
    li.querySelector('.brief__meta span').textContent = p.kind;
    li.querySelector('.brief__title').textContent = p.title;
    li.querySelector('.brief__summary').textContent = p.summary;
    li.querySelectorAll('.brief__stack li').forEach((el, k) => (el.textContent = p.stack[k]));
  });
}
