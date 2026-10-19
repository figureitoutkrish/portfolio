import { loadLap } from '../telemetry.js';
import { createVehicle } from '../vehicle.js';
import { LAYOUT } from '../layout.js';
import { createNet, train, predict } from '../nn.js';

// LAB mode: teach a tiny neural network (nn.js) to brake for the pit entry line, from your own
// drive. Each tenth of a second you drove before the line is one example: how fast you were going,
// how far from the line, and whether you were on the brake. The net learns where braking starts;
// the screen shows what it thinks for every speed and distance (a heat map, your samples as dots),
// its loss falling, and the network itself, connections thickening as it learns. Skipped the drive?
// It learns from Krish's reference laps instead, and says so.
//   OK      train / pause            paddles  hidden neurons: 2 · 4 · 8 (starts over)
//   SCROLL  learning rate            BACK     start over (new random weights)
//   shift lights: how far training has got
const SIZES = [2, 4, 8];
const RATES = [0.03, 0.1, 0.3, 1];
const MAX_STEPS = 3000;
const PER_FRAME = 20;
const D_MAX = 150; // metres before the line the heat map covers
const V_MIN = 40;
const V_MAX = 140;

let data = null; // { X, Y, raw: [[d, kph, brake]], who: 'you' | 'krish', brake: { d, kph } }
let net = null;
let sizeIx = 1;
let rateIx = 2;
let running = false;
let raf = 0;
let losses = [];
let view = null; // the mounted screen's canvases and labels
let uiRef = null;
let dial = 0; // the SCROLL dial, turned a notch at a time

export const lab = {
  id: 'lab',
  size: () => 1,
  count: () => `${SIZES[sizeIx]} neurons · lr ${RATES[rateIx]}`,
  render(body, state, ui) {
    uiRef = ui;
    // (built once; again if a drive has happened since it learned from Krish's laps)
    if (!data || (data.who === 'krish' && loadLap()?.samples?.length)) {
      stop();
      data = buildData();
      net = null;
    }
    if (!net) reset();
    body.innerHTML = `<article class="lab">
        <p class="lab-head"><span class="p-kind">lab · teach it to brake</span><span class="lab-who">${data.who === 'you' ? 'learning from your drive' : 'learning from krish’s laps (you skipped yours)'}</span></p>
        <div class="lab-main">
          <figure class="lab-map"><canvas aria-hidden="true"></canvas><figcaption><span>150 m</span><span>distance to the line</span><span>0</span></figcaption><span class="lab-y">km/h</span></figure>
          <div class="lab-side">
            <svg class="lab-net" viewBox="0 0 100 70" aria-hidden="true"></svg>
            <canvas class="lab-loss" aria-hidden="true"></canvas>
            <p class="lab-stat"><b data-lab-steps>0</b> steps · loss <b data-lab-loss>–</b> · lr <b data-lab-rate>${RATES[rateIx]}</b></p>
          </div>
        </div>
        <p class="lab-say" data-lab-say aria-live="polite"></p>
      </article>`;
    view = {
      map: body.querySelector('.lab-map canvas'),
      loss: body.querySelector('.lab-loss'),
      svg: body.querySelector('.lab-net'),
      steps: body.querySelector('[data-lab-steps]'),
      lossEl: body.querySelector('[data-lab-loss]'),
      rate: body.querySelector('[data-lab-rate]'),
      say: body.querySelector('[data-lab-say]'),
    };
    draw();
  },
  hints: () => `<span><b>ok</b> ${running ? 'pause' : net?.steps ? 'train on' : 'train'}</span><span><b>‹ ›</b> neurons</span><span class="h-wide"><b>scroll</b> learn rate</span><span><b>back</b> start over</span>`,
  labels: () => ({ ok: running ? 'pause' : 'train', prev: 'fewer', next: 'more', scroll: 'rate', back: 'reset' }),
  ok() {
    running ? stop() : start();
    return {}; // (re-renders, so the hints and labels say train / pause)
  },
  back() {
    stop();
    reset();
    return {};
  },
  // the paddles: hidden size (a new network)
  step(state, delta) {
    sizeIx = Math.max(0, Math.min(SIZES.length - 1, sizeIx + delta));
    stop();
    reset();
    return {};
  },
  // SCROLL: the learning rate, a notch per turn
  turn(state, delta) {
    dial += delta;
    if (Math.abs(dial) < 0.1) return true;
    rateIx = Math.max(0, Math.min(RATES.length - 1, rateIx + Math.sign(dial)));
    dial = 0;
    uiRef?.toast(`learning rate ${RATES[rateIx]}`);
    uiRef?.refresh?.();
    if (view?.rate) view.rate.textContent = String(RATES[rateIx]);
    return true;
  },
  leave: () => stop(),
  leds: () => (net ? Math.round(Math.min(1, net.steps / MAX_STEPS) * 15) : 0),
};

function reset() {
  net = createNet(SIZES[sizeIx], 7 + sizeIx);
  losses = [];
  draw();
}
function start() {
  if (net.steps >= MAX_STEPS) reset();
  running = true;
  const tick = () => {
    if (!running) return;
    const L = train(net, data.X, data.Y, RATES[rateIx], PER_FRAME);
    losses.push(L);
    draw();
    uiRef?.setLeds(lab.leds());
    if (net.steps >= MAX_STEPS || !view?.map.isConnected) return stop(true);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
function stop(done = false) {
  if (!running) return;
  running = false;
  cancelAnimationFrame(raf);
  if (done) draw();
  uiRef?.refresh?.();
}

// ---------- the examples ----------
// Your lap's samples before the pit entry line: [distance to the line, speed, braking]. Scaled for
// the net: speed / 120, distance / 150.
function buildData() {
  const lap = loadLap();
  const who = lap?.samples?.length ? 'you' : 'krish';
  const samples = who === 'you' ? lap.samples : referenceLaps();
  const raw = [];
  for (const [, z, kph, , brake] of samples) {
    const d = LAYOUT.entryLine - z;
    if (d >= 0 && d <= D_MAX) raw.push([d, kph, brake ? 1 : 0]);
  }
  // where the driver first braked, and how fast they were going then
  const b = who === 'you' ? lap.marks?.brake && { d: LAYOUT.entryLine - lap.marks.brake.z, kph: lap.marks.brake.kph } : refBrakeAt;
  return { who, raw, X: raw.map(([d, kph]) => [kph / 120, d / D_MAX]), Y: raw.map((r) => r[2]), brake: b };
}

// Krish's laps: the same car model driven by a script from four speeds (90 to 135 km/h): off the
// throttle, then on the brakes once the line is closer than the stopping distance plus a margin,
// down to 76 for the line. Four runs, so the net can see that faster means braking earlier.
let refBrakeAt = null;
function referenceLaps() {
  const out = [];
  for (const kph of [90, 105, 120, 135]) {
    const v = createVehicle({ ...LAYOUT, startKph: kph });
    const s = v.state;
    v.reset();
    let since = 0;
    let on = false;
    for (let i = 0; i < 60 * 20 && !s.pitLane; i++) {
      const d = LAYOUT.entryLine - s.z;
      const stop = Math.max(0, (s.speed ** 2 - (76 / 3.6) ** 2) / (2 * 9));
      const brake = s.kph > 77 && (on || d < stop + 12) ? 1 : 0;
      on = !!brake;
      if (brake && kph === 120 && refBrakeAt == null) refBrakeAt = { d, kph: s.kph };
      v.step(1 / 60, { throttle: 0, brake, steer: 0, limiter: false });
      since += 1 / 60;
      if (since >= 0.1) {
        since = 0;
        out.push([0, s.z, s.kph, 0, brake, 0]);
      }
    }
  }
  return out;
}

// ---------- drawing ----------
function draw() {
  if (!view || !view.map.isConnected) return;
  drawMap();
  drawLoss();
  drawNet();
  view.steps.textContent = String(net.steps);
  view.lossEl.textContent = losses.length ? losses[losses.length - 1].toFixed(3) : '–';
  view.say.textContent = verdict();
}

function fit(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

// what the net thinks for every distance (x: 150 m on the left → the line on the right) and speed
// (y: 40 at the bottom → 140 at the top): dark = keep going, red = brake; the 50% line in white
function drawMap() {
  const { g, w, h } = fit(view.map);
  if (!w || !h) return;
  const cols = 60;
  const rows = 30;
  const cw = w / cols;
  const ch = h / rows;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const kph = V_MAX - ((r + 0.5) / rows) * (V_MAX - V_MIN);
    grid.push([]);
    for (let c = 0; c < cols; c++) {
      const d = D_MAX - ((c + 0.5) / cols) * D_MAX;
      const p = predict(net, [kph / 120, d / D_MAX]);
      grid[r].push(p);
      g.fillStyle = mix(p);
      g.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
    }
  }
  // the decision line: cells where it flips across 50%
  g.fillStyle = 'rgba(242,245,247,0.9)';
  for (let r = 0; r < rows; r++) for (let c = 1; c < cols; c++) if (grid[r][c] > 0.5 !== grid[r][c - 1] > 0.5) g.fillRect(c * cw - 1, r * ch, 2, ch + 0.5);
  // the samples
  for (const [d, kph, b] of data.raw) {
    const x = ((D_MAX - d) / D_MAX) * w;
    const y = ((V_MAX - kph) / (V_MAX - V_MIN)) * h;
    g.fillStyle = b ? '#ff453a' : '#f2f5f7';
    g.beginPath();
    g.arc(x, y, Math.max(2, w / 160), 0, Math.PI * 2);
    g.fill();
  }
  // 80 km/h, the limit
  const y80 = ((V_MAX - 80) / (V_MAX - V_MIN)) * h;
  g.strokeStyle = 'rgba(255,214,10,0.7)';
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(0, y80);
  g.lineTo(w, y80);
  g.stroke();
  g.setLineDash([]);
}
const mix = (p) => {
  // keep going (deep teal-black) → brake (red)
  const a = [8, 34, 32];
  const b = [255, 69, 58];
  const k = Math.pow(p, 1.2);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)}, ${Math.round(a[1] + (b[1] - a[1]) * k)}, ${Math.round(a[2] + (b[2] - a[2]) * k)})`;
};

function drawLoss() {
  const { g, w, h } = fit(view.loss);
  if (!w || !h) return;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  g.fillRect(0, 0, w, h);
  if (losses.length < 2) return;
  const top = Math.max(...losses.slice(0, 5), 0.8);
  g.strokeStyle = '#00d2be';
  g.lineWidth = 1.5;
  g.beginPath();
  losses.forEach((L, i) => {
    const x = (i / Math.max(1, MAX_STEPS / PER_FRAME - 1)) * w;
    const y = h - 2 - (Math.min(L, top) / top) * (h - 4);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
}

// 2 → hidden → 1, connections as thick as their weights, teal positive, red negative
function drawNet() {
  const H = net.hidden;
  const inY = [22, 48];
  const hY = Array.from({ length: H }, (_, j) => 8 + ((j + 0.5) / H) * 54);
  const node = (x, y, label) => `<circle cx="${x}" cy="${y}" r="3.2" class="lab-node"/>${label ? `<text x="${x - 6}" y="${y + 1.5}" class="lab-txt" text-anchor="end">${label}</text>` : ''}`;
  const line = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${w >= 0 ? '#00d2be' : '#ff453a'}" stroke-width="${Math.min(3, 0.3 + Math.abs(w) * 0.9).toFixed(2)}" stroke-opacity="${Math.min(1, 0.25 + Math.abs(w) * 0.35).toFixed(2)}"/>`;
  let out = '';
  hY.forEach((y, j) => {
    out += line(18, inY[0], 50, y, net.w1[j][0]) + line(18, inY[1], 50, y, net.w1[j][1]) + line(50, y, 84, 35, net.w2[j]);
  });
  out += node(18, inY[0], 'km/h') + node(18, inY[1], 'm');
  hY.forEach((y) => (out += node(50, y)));
  out += node(84, 35) + `<text x="90" y="36.5" class="lab-txt">brake</text>`;
  view.svg.innerHTML = out;
}

// one line: where it learned to brake at the speed the driver was doing, against where they did
function verdict() {
  const who = data.who === 'you' ? 'you' : 'krish';
  if (!net.steps) return `press ok: ${data.raw.length} moments from ${data.who === 'you' ? 'your drive' : 'krish’s laps'}, ${data.Y.filter(Boolean).length} of them on the brake.`;
  const kph = Math.round(data.brake?.kph ?? 110);
  let from = null;
  for (let d = D_MAX; d >= 0; d -= 1) {
    if (predict(net, [kph / 120, d / D_MAX]) > 0.5) {
      from = d;
      break;
    }
  }
  const them = data.brake ? ` ${who} braked at ${Math.max(0, Math.round(data.brake.d))} m.` : ` ${who} never braked.`;
  if (from == null) return `${running ? 'learning…' : 'it hasn’t found the brake yet.'}${them}`;
  return `at ${kph} km/h it brakes from ${Math.round(from)} m before the line.${them}`;
}
