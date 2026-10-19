import { saveScore } from './scores.js';
import { sfx, loop } from '../../sound.js';
import { TOP, TOP_COLORS } from '../../car.js';

// RACER.DSK: top-down pixel racer. Dodge traffic, your speed climbs, score = distance + bonuses.
// Until you touch a key it drives itself (demo); ← → steer, ↑ faster, ↓ slower.
// It gets hard fast: the road speeds up every lap (30s), traffic comes in walls with one gap,
// slow trucks rush at you, some cars change lanes (they blink first) and cones sit dead still.
// Bonuses: shave past a car for "close!" (+10), grab an energy can (+25 and a few seconds
// airborne, flying over everything; Krish runs on the stuff).
// 1-bit look: paper verge, black road, paper cars; only you and the cans are in colour.
const W = 200;
const H = 140;
const ROAD_L = 50;
const ROAD_R = 150;
const LANES = [66, 100, 134];
const PX_PER_M = 4;
const PY = H - 26; // your car's y
const LAP = 30; // seconds per lap
const BEST = 'krish:racer-best';

const PAPER = '#f4f4ee';
const INK = '#111';
const AMBER = '#ffd23a';

// sprites: 1 = body, 2 = glass/detail
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
const TRUCK = [
  '.1111111.',
  '111222111',
  '112222211',
  '111111111',
  '.1.....1.',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '121212121',
  '111111111',
  '111111111',
  '1.1...1.1',
  '.1.....1.',
];
// cone: P paper stripe, I ink
const CONE = ['..P..', '.PIP.', '.IPI.', 'PPIPP', 'IIIII'];
// energy can (a nod, no brand): S silver, B blue, Y bolt, K rim
const CAN = ['.KKK.', 'KBBBK', 'KSYSK', 'KSYYK', 'KYYSK', 'KSYSK', 'KBBBK', '.KKK.'];
const CAN_COLORS = { K: '#3a3f4a', S: '#d7dae0', B: '#2c5cff', Y: AMBER };

const HALF = { car: 7, truck: 11, cone: 2, can: 4 };

export function mountRacer(body, { os, reducedMotion }) {
  body.classList.add('os__body--game');
  body.innerHTML = `
    <canvas class="game__canvas" width="${W}" height="${H}" role="img" aria-label="Racer: arrow keys or the keys under the Mac to steer"></canvas>
    <div class="game__hud"><span class="game__msg">demo · press ↑ or A to drive · esc / eject to quit</span><span class="game__best"></span></div>
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
  const fresh = () => ({
    x: LANES[1],
    speed: 80,
    t: 0,
    dist: 0,
    bonus: 0,
    spawnIn: 0.5,
    canIn: 4 + Math.random() * 2,
    things: [],
    scroll: 0,
    shake: 0,
    flash: 0,
    sparks: [],
    pops: [],
    air: 0,
    lap: 1,
    banner: 0,
    startedAt: performance.now(),
  });
  const score = () => Math.round(g.dist + g.bonus);

  let engine = null; // the engine hum, only while you drive
  const stopEngine = () => {
    engine?.stop();
    engine = null;
  };
  function start(newMode) {
    if (newMode === 'play') sfx('start');
    stopEngine();
    if (newMode === 'play') engine = loop('engine');
    mode = newMode;
    g = fresh();
    actions.hidden = true;
    msg.textContent = mode === 'demo' ? 'demo · press ↑ or A to drive · esc / eject to quit' : 'go! · shave past cars, grab the cans · esc to quit';
  }

  const pop = (text, x, y = PY - 12) => g.pops.push({ text, x, y, life: 0.9 });

  function crash() {
    g.shake = reducedMotion ? 0 : 0.35;
    g.flash = 0.12;
    for (let i = 0; i < 16; i += 1) {
      const a = Math.random() * Math.PI * 2;
      g.sparks.push({ x: g.x, y: PY, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.5 });
    }
    if (mode === 'demo') {
      setTimeout(() => mode === 'demo-crash' && start('demo'), 900);
      mode = 'demo-crash';
      return;
    }
    mode = 'over';
    stopEngine();
    sfx('crash');
    const s = score();
    msg.textContent = `crashed · lap ${g.lap} · ${s}m`;
    if (s > best) {
      best = s;
      try {
        localStorage.setItem(BEST, String(best));
      } catch {
        /* ignore */
      }
      showBest();
      msg.textContent = `crashed · lap ${g.lap} · ${s}m · new best!`;
    }
    actions.hidden = false;
  }

  // Demo driver: head for the lane whose nearest obstacle ahead is furthest away (cans count double).
  function autopilot() {
    let bestLane = LANES[1];
    let bestGap = -Infinity;
    for (const lx of LANES) {
      const near = g.things.filter((c) => Math.abs(c.x - lx) < 14 && c.y < PY + 6);
      const ahead = near.filter((c) => c.kind !== 'can').map((c) => PY - c.y);
      const gap = ahead.length ? Math.min(...ahead) : 999;
      const s = gap - Math.abs(lx - g.x) * 0.25 + (near.some((c) => c.kind === 'can') ? 40 : 0);
      if (s > bestGap) {
        bestGap = s;
        bestLane = lx;
      }
    }
    return Math.sign(bestLane - g.x) * (Math.abs(bestLane - g.x) > 2 ? 1 : 0);
  }

  // A lane is open at the top if nothing in it is still near the spawn line.
  const openAtTop = (lx, band = 52) => !g.things.some((c) => c.kind !== 'can' && Math.abs(c.x - lx) < 18 && c.y - HALF[c.kind] < band);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function spawnRow() {
    const open = LANES.filter((lx) => openAtTop(lx));
    // always leave at least one lane clear across the top band
    if (open.length < 2) return;
    const wall = g.t > 12 && open.length === 3 && Math.random() < Math.min(0.5, 0.2 + g.t * 0.006);
    const lanes = wall ? open.sort(() => Math.random() - 0.5).slice(0, 2) : [pick(open)];
    const v = 18 + Math.random() * 38; // a wall moves together, so its gap stays a gap
    for (const x of lanes) {
      let kind = 'car';
      const r = Math.random();
      if (g.t > 25 && r < 0.16) kind = 'cone';
      else if (g.t > 8 && r < 0.36) kind = 'truck';
      const thing = { kind, x, y: -HALF[kind] - 2, v: kind === 'cone' ? 0 : kind === 'truck' ? 6 + Math.random() * 10 : v, passed: false };
      // lane changers: only loose cars, and they signal first
      if (!wall && kind === 'car' && g.t > 16 && Math.random() < Math.min(0.45, 0.15 + g.t * 0.006)) {
        const i = LANES.indexOf(x);
        thing.shiftTo = pick([LANES[i - 1], LANES[i + 1]].filter(Boolean));
      }
      g.things.push(thing);
    }
  }

  function spawnCan() {
    const open = LANES.filter((lx) => !g.things.some((c) => Math.abs(c.x - lx) < 18 && c.y < 40));
    if (open.length) g.things.push({ kind: 'can', x: pick(open), y: -6, v: 0 });
  }

  function update(dt) {
    if (!g) return;
    g.shake = Math.max(0, g.shake - dt);
    g.flash = Math.max(0, g.flash - dt);
    g.banner = Math.max(0, g.banner - dt);
    g.sparks = g.sparks.filter((s) => ((s.x += s.vx * dt), (s.y += s.vy * dt), (s.life -= dt)) > 0);
    g.pops = g.pops.filter((p) => ((p.y -= 18 * dt), (p.life -= dt)) > 0);
    if (mode === 'over' || mode === 'demo-crash') return;

    g.t += dt;
    const lap = 1 + Math.floor(g.t / LAP);
    if (lap > g.lap) {
      g.lap = lap;
      g.banner = 1.4;
      if (mode === 'play') sfx('lap');
    }
    // the road gets faster the longer you last, with a kick each lap
    const base = Math.min(280, 80 + g.t * 3.6 + (g.lap - 1) * 14);
    let steer = 0;
    let boost = 1;
    if (mode === 'demo') steer = autopilot();
    else {
      steer = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      if (keys.has('ArrowUp') || keys.has('w')) boost = 1.25;
      if (keys.has('ArrowDown') || keys.has('s')) boost = 0.75;
    }
    if (g.air > 0) boost = Math.max(boost, 1.2);
    g.speed += (base * boost - g.speed) * Math.min(1, dt * 3);
    engine?.set(Math.min(1, (g.speed - 60) / 300));
    g.x = Math.max(ROAD_L + 8, Math.min(ROAD_R - 8, g.x + steer * (100 + g.speed * 0.15) * dt));
    g.scroll = (g.scroll + g.speed * dt) % 20;
    g.dist += (g.speed * dt) / PX_PER_M;
    g.air = Math.max(0, g.air - dt);

    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      g.spawnIn = Math.max(0.3, 1.0 - g.t * 0.017) * (0.75 + Math.random() * 0.5);
      spawnRow();
    }
    g.canIn -= dt;
    if (g.canIn <= 0) {
      g.canIn = 6 + Math.random() * 4;
      spawnCan();
    }

    for (const c of g.things) {
      c.y += (g.speed - c.v) * dt;
      if (c.shiftTo !== undefined && c.y > 18) {
        // swerve only if the other lane is clear around it, else give up
        const clear = !g.things.some((o) => o !== c && o.kind !== 'can' && Math.abs(o.x - c.shiftTo) < 12 && Math.abs(o.y - c.y) < 30);
        if (!clear && c.x === Math.round(c.x) && LANES.includes(c.x)) c.shiftTo = undefined;
        else {
          const d = c.shiftTo - c.x;
          c.x += Math.sign(d) * Math.min(Math.abs(d), 46 * dt);
          if (Math.abs(c.shiftTo - c.x) < 0.5) {
            c.x = c.shiftTo;
            c.shiftTo = undefined;
          }
        }
      }
    }

    // collisions, pickups, close calls
    for (const c of g.things) {
      const dx = Math.abs(c.x - g.x);
      const dy = Math.abs(c.y - PY);
      if (c.kind === 'can') {
        if (!c.got && dx < 9 && dy < 10) {
          c.got = true;
          g.bonus += 25;
          g.air = 2.6;
          pop('+25 fuelled!', g.x);
          sfx('fizz');
        }
        continue;
      }
      if (g.air > 0) continue; // flying over it
      const reach = c.kind === 'cone' ? 6 : 8;
      if (dx < reach && dy < HALF[c.kind] + 6) return crash();
      if (!c.passed && c.y - HALF[c.kind] > PY + 7) {
        c.passed = true;
        if (c.kind !== 'cone' && dx < 15) {
          g.bonus += 10;
          pop('close! +10', g.x);
          sfx('shave');
        }
      }
    }
    g.things = g.things.filter((c) => c.y < H + 30 && !c.got);
  }

  function drawRows(rows, x, y, color) {
    const ox = Math.round(x - Math.floor(rows[0].length / 2));
    const oy = Math.round(y - Math.floor(rows.length / 2));
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        const c = row[i];
        if (c === '.') continue;
        const fill = color(c, i, j);
        if (!fill) continue;
        ctx.fillStyle = fill;
        ctx.fillRect(ox + i, oy + j, 1, 1);
      }
    });
  }
  // traffic is hatched paper (reads as grey on the 1-bit screen)
  const hatched = (c, i, j) => (c === '2' ? INK : (i + j) % 2 ? null : PAPER);

  function drawThing(c) {
    if (c.kind === 'can') {
      const bob = Math.round(Math.sin(performance.now() / 160) * 1);
      drawRows(CAN, c.x, c.y + bob, (k) => CAN_COLORS[k]);
      return;
    }
    if (c.kind === 'cone') return drawRows(CONE, c.x, c.y, (k) => (k === 'P' ? PAPER : AMBER));
    drawRows(c.kind === 'truck' ? TRUCK : CAR, c.x, c.y, hatched);
    // indicator: blinks on the side it's about to move to
    if (c.shiftTo !== undefined && Math.floor(performance.now() / 160) % 2) {
      const side = c.shiftTo > c.x ? 5 : -6;
      ctx.fillStyle = AMBER;
      ctx.fillRect(Math.round(c.x + side), Math.round(c.y - 6), 1, 2);
      ctx.fillRect(Math.round(c.x + side), Math.round(c.y + 4), 1, 2);
    }
  }

  // You: the red race car (the mascot, from above), in full colour on the 1-bit road.
  function player() {
    const flying = g.air > 0;
    const lift = flying ? 3 : 0;
    if (flying) {
      // shadow, then wings that flap; blink in the last half-second as a warning
      if (g.air < 0.6 && Math.floor(performance.now() / 80) % 2) return;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(Math.round(g.x - 4), PY - 5, 9, 13);
      const flap = Math.floor(performance.now() / 90) % 2;
      ctx.fillStyle = PAPER;
      for (const s of [-1, 1]) {
        const wx = Math.round(g.x + s * 7) - (s < 0 ? 3 : 0);
        ctx.fillRect(wx, PY - lift - 3 + flap, 4, 1);
        ctx.fillRect(wx + (s < 0 ? 1 : 0), PY - lift - 2 + flap, 3, 1);
        ctx.fillRect(wx + (s < 0 ? 2 : 0), PY - lift - 1 + flap, 2, 1);
      }
    }
    drawRows(TOP, g.x, PY - lift, (k) => TOP_COLORS[k]);
  }

  function text(str, x, y, fg = PAPER, bg = INK) {
    const w = Math.ceil(ctx.measureText(str).width) + 6;
    ctx.fillStyle = bg;
    ctx.fillRect(Math.round(x - w / 2), y - 1, w, 11);
    ctx.fillStyle = fg;
    ctx.fillText(str, Math.round(x - w / 2) + 3, y + 1);
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
    for (const c of g.things) drawThing(c);
    player();
    ctx.fillStyle = PAPER;
    for (const s of g.sparks) ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);

    ctx.font = '8px "Pixelify Sans", monospace';
    ctx.textBaseline = 'top';
    for (const p of g.pops) text(p.text, Math.max(30, Math.min(W - 30, p.x)), Math.round(p.y), INK, AMBER);
    // HUD: score left, lap + speed right
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, 46, 11);
    ctx.fillRect(W - 50, 0, 50, 11);
    ctx.fillStyle = PAPER;
    ctx.fillText(`${score()}m`, 3, 2);
    ctx.fillText(`L${g.lap} ${Math.round(g.speed * 0.9)}kmh`, W - 47, 2);
    if (g.banner) text(`LAP ${g.lap} · FASTER`, W / 2, H / 2 - 24);
    if (mode === 'demo' && Math.floor(performance.now() / 500) % 2) text('PRESS ↑ / A', W / 2, H / 2 - 4);
    if (g.flash) {
      ctx.fillStyle = 'rgba(244,244,238,.8)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // (named tick, not loop: `loop` is the sound import that starts the engine hum. When this was
  // called loop too, starting a race called the game loop with "engine" as its time and every
  // number on screen went NaN)
  let raf = 0;
  let last = null;
  const tick = (now) => {
    const dt = last === null ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!document.hidden) {
      update(dt);
      draw();
    }
    raf = requestAnimationFrame(tick);
  };

  actions.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'again') start('play');
    else if (act === 'save' && mode === 'over') {
      saveScore(os, 'racer', score(), { duration: Math.round(performance.now() - g.startedAt), dist: Math.round(g.dist), bonus: g.bonus });
    }
  });
  // Tap the screen to take over on touch devices; steer with the keys below.
  canvas.addEventListener('pointerdown', () => mode === 'demo' && start('play'));

  start('demo');
  raf = requestAnimationFrame(tick);

  return {
    key(key, down) {
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (down) keys.add(k);
      else keys.delete(k);
      if (!down) return;
      if (mode === 'demo' && ['ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'w', 'a', 'd'].includes(k)) start('play');
      else if (mode === 'over' && (k === 'Enter' || k === ' ')) start('play');
    },
    unmount: () => {
      cancelAnimationFrame(raf);
      stopEngine();
    },
  };
}
