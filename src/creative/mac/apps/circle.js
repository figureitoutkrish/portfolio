import { scoreCircle } from './circle-score.js';
import { saveScore } from './scores.js';
import { sfx, loop } from '../../sound.js';

// CIRCLE.DSK: draw a perfect circle around the dot. Mouse, pen or finger.
// Chunky low-res canvas (scaled up, pixelated) to match the 1-bit screen.
const W = 240;
const H = 168;
const BEST = 'krish:circle-best';

const VERDICTS = [
  [98, 'unreal. are you a compass?'],
  [94, 'superb.'],
  [90, 'very nice.'],
  [82, 'not bad at all.'],
  [70, 'a decent wobble.'],
  [0, 'that’s… a shape.'],
];

export function mountCircle(body, { os }) {
  body.classList.add('os__body--game');
  body.innerHTML = `
    <canvas class="game__canvas game__canvas--draw" width="${W}" height="${H}" aria-label="Drawing area: draw a circle around the dot"></canvas>
    <div class="game__hud"><span class="game__msg">draw a perfect circle around the dot</span><span class="game__best"></span></div>
    <div class="game__actions" hidden>
      <button class="os__btn" type="button" data-act="again">Try again</button>
      <button class="os__btn os__btn--default" type="button" data-act="save">Save score</button>
    </div>`;
  const canvas = body.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const msg = body.querySelector('.game__msg');
  const bestEl = body.querySelector('.game__best');
  const actions = body.querySelector('.game__actions');
  const center = [W / 2, H / 2];

  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST)) || 0;
  } catch {
    /* ignore */
  }
  const showBest = () => (bestEl.textContent = best ? `best ${best.toFixed(1)}%` : '');
  showBest();

  let points = [];
  let drawing = false;
  let result = null;

  function clear() {
    ctx.fillStyle = '#f4f4ee';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(center[0] - 2, center[1] - 2, 4, 4); // the dot
  }
  function dot(x, y) {
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  // Bresenham-ish: pixel steps between samples so fast strokes stay continuous.
  function line(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i += 1) dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n);
  }
  // The canvas is letterboxed (object-fit: contain): map the pointer into the drawn area only,
  // otherwise every circle comes out as an ellipse.
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * s) / 2;
    const oy = (r.height - H * s) / 2;
    return [(e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s];
  };

  function reset() {
    points = [];
    result = null;
    actions.hidden = true;
    msg.textContent = 'draw a perfect circle around the dot · esc / eject to quit';
    clear();
  }

  let pencil = null; // the pencil-on-paper sound while drawing
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    reset();
    drawing = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or ended pointer */ }
    points.push(local(e));
    ctx.fillStyle = '#111';
    pencil?.stop();
    pencil = loop('pencil');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = local(e);
    const last = points[points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.6) return;
    line(last, p);
    points.push(p);
    pencil?.set(Math.hypot(p[0] - last[0], p[1] - last[1]) / 6);
  });
  const finish = () => {
    if (!drawing) return;
    drawing = false;
    pencil?.stop();
    pencil = null;
    const r = scoreCircle(points, center, Math.min(W, H));
    if (r.error) {
      msg.textContent = r.error.toLowerCase();
      return;
    }
    result = r.score;
    sfx('score');
    // Show the ideal circle, dotted, so you can see where it wandered.
    const radius = points.reduce((a, [x, y]) => a + Math.hypot(x - center[0], y - center[1]), 0) / points.length;
    ctx.fillStyle = 'rgba(17,17,17,.35)';
    for (let a = 0; a < Math.PI * 2; a += 0.09) dot(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius);
    const verdict = VERDICTS.find(([min]) => result >= min)[1];
    msg.textContent = `${result.toFixed(1)}%  ${verdict}`;
    if (result > best) {
      best = result;
      try {
        localStorage.setItem(BEST, String(best));
      } catch {
        /* ignore */
      }
      showBest();
    }
    actions.hidden = false;
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  actions.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'again') reset();
    else if (act === 'save' && result !== null) {
      const proof = { points: points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]), w: W, h: H };
      saveScore(os, 'circle', result, proof);
    }
  });

  reset();
  return {
    key(key, down) {
      if (down && (key === 'Enter' || key === ' ')) reset();
    },
    unmount: () => pencil?.stop(),
  };
}
