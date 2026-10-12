import { saveScore } from './scores.js';

// RACER.DSK: top-down pixel racer. Dodge traffic, your speed climbs, score = distance.
// Until you touch a key it drives itself (demo); ← → steer, ↑ faster, ↓ slower.
// 1-bit look: paper verge, black road, paper cars. Low-res canvas, scaled up pixelated.
const W = 200;
const H = 140;
const ROAD_L = 50;
const ROAD_R = 150;
const LANES = [66, 100, 134];
const PX_PER_M = 4;
const BEST = 'krish:racer-best';

const PAPER = '#f4f4ee';
const INK = '#111';

// 9×15 car sprites (1 = body, 2 = glass/detail)
const CAR = [
  '..11111..',
  '.1111111.',
  '111222111',
  '112222211',
  '112222211',
  '111111111',
  '111111111',
  '1.11111.1',
  '111111111',
  '111111111',
  '112222211',
  '112222211',
  '111111111',
  '.1111111.',
  '..1...1..',
];

export function mountRacer(body, { os, reducedMotion }) {
  body.classList.add('os__body--game');
  body.innerHTML = `
    <canvas class="game__canvas" width="${W}" height="${H}" role="img" aria-label="Racer: arrow keys or the keys under the Mac to steer"></canvas>
    <div class="game__hud"><span class="game__msg">demo · press ↑ or A to drive</span><span class="game__best"></span></div>
    <div class="game__actions" hidden>
      <button class="os__btn" type="button" data-act="again">Retry</button>
      <button class="os__btn os__btn--default" type="button" data-act="save">Save score</button>
    </div>`;
  const canvas = body.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const msg = body.querySelector('.game__msg');
  const bestEl = body.querySelector('.game__best');
  const actions = body.querySelector('.game__actions');

  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST)) || 0;
  } catch {
    /* ignore */
  }
  const showBest = () => (bestEl.textContent = best ? `best ${Math.round(best)}m` : '');
  showBest();

  const keys = new Set();
  let mode = 'demo'; // demo | play | over
  let g;
  const fresh = () => ({ x: LANES[1], speed: 70, t: 0, dist: 0, spawnIn: 0.6, cars: [], scroll: 0, shake: 0, flash: 0, sparks: [], startedAt: performance.now() });

  function start(newMode) {
    mode = newMode;
    g = fresh();
    actions.hidden = true;
    msg.textContent = mode === 'demo' ? 'demo · press ↑ or A to drive' : 'go!';
  }

  function crash() {
    g.shake = reducedMotion ? 0 : 0.35;
    g.flash = 0.12;
    for (let i = 0; i < 16; i += 1) {
      const a = Math.random() * Math.PI * 2;
      g.sparks.push({ x: g.x, y: H - 26, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.5 });
    }
    if (mode === 'demo') {
      setTimeout(() => mode === 'demo' && start('demo'), 900);
      mode = 'demo-crash';
      return;
    }
    mode = 'over';
    const m = Math.round(g.dist);
    msg.textContent = `crashed · ${m}m`;
    if (m > best) {
      best = m;
      try {
        localStorage.setItem(BEST, String(best));
      } catch {
        /* ignore */
      }
      showBest();
      msg.textContent = `crashed · ${m}m · new best!`;
    }
    actions.hidden = false;
  }

  // Demo driver: head for the lane whose nearest car ahead is furthest away.
  function autopilot() {
    let bestLane = LANES[1];
    let bestGap = -1;
    for (const lx of LANES) {
      const ahead = g.cars.filter((c) => Math.abs(c.x - lx) < 14 && c.y < H - 20).map((c) => H - 20 - c.y);
      const gap = ahead.length ? Math.min(...ahead) : 999;
      const score = gap - Math.abs(lx - g.x) * 0.2;
      if (score > bestGap) {
        bestGap = score;
        bestLane = lx;
      }
    }
    return Math.sign(bestLane - g.x) * (Math.abs(bestLane - g.x) > 2 ? 1 : 0);
  }

  function update(dt) {
    if (!g) return;
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt);
    g.sparks = g.sparks.filter((s) => ((s.x += s.vx * dt), (s.y += s.vy * dt), (s.life -= dt)) > 0);
    if (mode === 'over' || mode === 'demo-crash') return;

    g.t += dt;
    const base = Math.min(185, 70 + g.t * 4.2); // the road gets faster the longer you last
    let steer = 0;
    let boost = 1;
    if (mode === 'demo') steer = autopilot();
    else {
      steer = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      if (keys.has('ArrowUp') || keys.has('w')) boost = 1.35;
      if (keys.has('ArrowDown') || keys.has('s')) boost = 0.7;
    }
    g.speed += (base * boost - g.speed) * Math.min(1, dt * 3);
    g.x = Math.max(ROAD_L + 8, Math.min(ROAD_R - 8, g.x + steer * 95 * dt));
    g.scroll = (g.scroll + g.speed * dt) % 20;
    g.dist += (g.speed * dt) / PX_PER_M;

    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      g.spawnIn = Math.max(0.42, 1.15 - g.t * 0.018) * (0.7 + Math.random() * 0.6);
      // never block all three lanes: skip lanes that already have a car near the top
      const free = LANES.filter((lx) => !g.cars.some((c) => c.x === lx && c.y < 30));
      if (free.length > 1) g.cars.push({ x: free[Math.floor(Math.random() * free.length)], y: -16, v: 25 + Math.random() * 30 });
    }
    for (const c of g.cars) c.y += (g.speed - c.v) * dt;
    g.cars = g.cars.filter((c) => c.y < H + 20);

    const py = H - 26;
    if (g.cars.some((c) => Math.abs(c.x - g.x) < 8 && Math.abs(c.y - py) < 13)) crash();
  }

  // You: a solid paper car. Traffic: hatched (reads as grey on the 1-bit screen).
  function sprite(x, y, hatched) {
    const ox = Math.round(x - 4);
    const oy = Math.round(y - 7);
    CAR.forEach((row, j) => {
      for (let i = 0; i < 9; i += 1) {
        const c = row[i];
        if (c === '.' || c === undefined) continue;
        if (c === '2') ctx.fillStyle = INK;
        else if (hatched && (i + j) % 2) continue;
        else ctx.fillStyle = PAPER;
        ctx.fillRect(ox + i, oy + j, 1, 1);
      }
    });
  }

  function draw() {
    if (!g) return;
    ctx.save();
    if (g.shake) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
    // verge: paper with a scrolling dither
    ctx.fillStyle = PAPER;
    ctx.fillRect(-4, -4, W + 8, H + 8);
    ctx.fillStyle = INK;
    for (let y = -20; y < H + 20; y += 5) {
      const yy = Math.round(y + (g.scroll % 5) * 2);
      for (let x = (y / 5) % 2 ? 2 : 0; x < ROAD_L - 4; x += 6) ctx.fillRect(x, yy, 1, 1);
      for (let x = ROAD_R + 4 + ((y / 5) % 2 ? 2 : 0); x < W; x += 6) ctx.fillRect(x, yy, 1, 1);
    }
    // road + edges + lane dashes
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(ROAD_L + 2, 0, 1, H);
    ctx.fillRect(ROAD_R - 3, 0, 1, H);
    for (let y = -20 + g.scroll; y < H; y += 20) {
      ctx.fillRect(83, Math.round(y), 1, 9);
      ctx.fillRect(117, Math.round(y), 1, 9);
    }
    // roadside posts
    for (let y = -40 + ((g.scroll * 2) % 40); y < H; y += 40) {
      ctx.fillStyle = INK;
      ctx.fillRect(ROAD_L - 8, Math.round(y), 3, 7);
      ctx.fillRect(ROAD_R + 5, Math.round(y + 20), 3, 7);
    }
    for (const c of g.cars) sprite(c.x, c.y, true);
    sprite(g.x, H - 26, false);
    ctx.fillStyle = PAPER;
    for (const s of g.sparks) ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    // HUD
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, 44, 11);
    ctx.fillStyle = PAPER;
    ctx.font = '8px "Pixelify Sans", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(g.dist)}m`, 3, 2);
    if (mode === 'demo' && Math.floor(performance.now() / 500) % 2) {
      ctx.fillStyle = INK;
      ctx.fillRect(W / 2 - 34, H / 2 - 9, 68, 18);
      ctx.fillStyle = PAPER;
      ctx.fillText('PRESS ↑ / A', W / 2 - 26, H / 2 - 4);
    }
    if (g.flash) {
      ctx.fillStyle = 'rgba(244,244,238,.8)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  let raf = 0;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) {
      update(dt);
      draw();
    }
    raf = requestAnimationFrame(loop);
  };

  actions.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'again') start('play');
    else if (act === 'save' && mode === 'over') {
      saveScore(os, 'racer', Math.round(g.dist), { duration: Math.round(performance.now() - g.startedAt), dist: Math.round(g.dist) });
    }
  });
  // Tap the screen to take over on touch devices; swipe-free steering via the keys below.
  canvas.addEventListener('pointerdown', () => mode === 'demo' && start('play'));

  start('demo');
  raf = requestAnimationFrame(loop);

  return {
    key(key, down) {
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (down) keys.add(k);
      else keys.delete(k);
      if (!down) return;
      if (mode === 'demo' && ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'w', 'a', 'd'].includes(k)) start('play');
      else if (mode === 'over' && (k === 'Enter' || k === ' ')) start('play');
    },
    unmount: () => cancelAnimationFrame(raf),
  };
}
