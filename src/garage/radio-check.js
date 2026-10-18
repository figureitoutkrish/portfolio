import { PROJECTS } from './data/projects.js';
import { loadClip, createPlayer } from '../audio/radio-check.js';
import { sfx } from '../audio/sfx.js';

// The radio check: the speech-enhancement project, heard on the wheel. A real clip from its test
// set (a voice the model never trained on, under gunfire) loops on the display, and the SCROLL
// dial is the model: turn it and the raw recording crossfades into the model's output, the
// waveform's gunshot spikes shrink to the voice (what was removed stays as a red ghost) and the
// shift lights fill. Paddles change clip, OK plays / stops, BACK returns to the briefing.
// TALK, anywhere on the wheel, plays a radio call that the model cleans up halfway through.
//
// projects.js hands a project's check level to renderCheck(); wheel.js routes the dial (turn),
// the paddles (step) and leaving (leave) here through that mode.
const player = createPlayer();
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const db = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} db`;
let view = null; // the mounted check: { canvas, range, output, clip, data, ui, raf }

export const checkLeds = () => Math.round(player.mix * 15);
// the level you're hearing right now (0…1, from the clip's peaks at the playhead and the dial's mix),
// or null when nothing plays: the engineers' stand's LED meters follow it in the garage
export function checkLevel() {
  const d = view?.data;
  if (!d || !player.looping) return null;
  const { raw, model } = d.peaks;
  const i = Math.min(raw.length - 1, Math.floor(player.position() * raw.length));
  let top = 0;
  for (let k = 0; k < raw.length; k++) top = Math.max(top, raw[k]);
  const v = (raw[i] + (model[i] - raw[i]) * player.mix) / (top || 1);
  return Math.min(1, v * 1.15);
}

export function renderCheck(body, project, state, ui) {
  const clips = project.check;
  const clip = clips[state.clip ?? 0];
  const sameClip = view?.clip === clip;
  cancelAnimationFrame(view?.raf ?? 0);
  body.innerHTML = `<article class="rc">
      <p class="rc-head"><span class="p-kind">radio check · ${(state.clip ?? 0) + 1} / ${clips.length}</span><span class="rc-snr">snr ${db(clip.raw)} → <b>${db(clip.model)}</b></span></p>
      <canvas class="rc-wave" aria-hidden="true"></canvas>
      <p class="rc-says">“${esc(clip.says)}”</p>
      <label class="rc-dial"><span>model</span><input type="range" min="0" max="100" step="1" aria-label="model: how much of the cleaned audio you hear"><output>0%</output></label>
      <p class="rc-credit">${esc(project.checkNote)}</p>
    </article>`;
  view = {
    canvas: body.querySelector('.rc-wave'),
    range: body.querySelector('.rc-dial input'),
    output: body.querySelector('.rc-dial output'),
    clip,
    data: sameClip ? view.data : null,
    ui,
    raf: 0,
  };
  view.range.addEventListener('input', () => setMix(view.range.valueAsNumber / 100));
  if (state.fresh) setMix(0); // a fresh check starts raw, so the first turn is the reveal
  syncDial();
  draw();
  const want = state.autoplay;
  state.autoplay = state.fresh = false;
  loadClip(clip.id)
    .then((data) => {
      if (view?.clip !== clip) return;
      view.data = data;
      draw();
      if (want) play();
    })
    .catch(() => view?.clip === clip && ui.toast('radio check · no signal'));
}

function play() {
  if (!view?.data) return;
  player.play(view.data);
  tick();
}

// OK: play / stop the clip on screen
export function toggleCheck() {
  if (!view) return;
  if (player.looping) {
    player.stop();
    draw();
  } else if (view.data) play();
  else loadClip(view.clip.id).then(() => play()); // still arriving: play when it lands
}

// the dial: delta in model units (1 = all the way)
export function turnCheck(delta) {
  if (!view) return false;
  setMix(player.mix + delta);
  return true;
}

export function leaveCheck() {
  if (!view) return;
  cancelAnimationFrame(view.raf);
  if (player.looping) player.stop();
  view = null;
}

function setMix(m) {
  player.setMix(m);
  syncDial();
  if (!player.looping) draw(); // (while playing, the next frame shows it)
}

function syncDial() {
  if (!view) return;
  const pct = Math.round(player.mix * 100);
  if (view.range.valueAsNumber !== pct) view.range.value = String(pct);
  view.range.style.setProperty('--fill', `${pct}%`);
  view.output.textContent = `${pct}%`;
  view.ui.setLeds(checkLeds());
  view.ui.setKnob(player.mix * 240);
}

function tick() {
  if (!view) return;
  draw();
  if (player.looping) view.raf = requestAnimationFrame(tick);
}

function draw() {
  const v = view;
  if (!v) return;
  const cv = v.canvas;
  if (!cv.isConnected) return leaveCheck();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const mid = h / 2;
  if (!v.data) {
    g.fillStyle = 'rgba(242, 245, 247, 0.22)';
    g.fillRect(0, mid - 0.5, w, 1);
    return;
  }
  const { raw, model } = v.data.peaks;
  const n = raw.length;
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, raw[i]);
  top = top || 1;
  const mix = player.mix;
  const at = player.looping ? player.position() : -1;
  const step = w / n;
  const bar = Math.max(1, step * 0.62);
  const amp = h * 0.48;
  for (let i = 0; i < n; i++) {
    const a = raw[i] / top;
    const b = model[i] / top;
    const val = a + (b - a) * mix;
    const x = i * step;
    // what the model took out: the raw outline, in red as the dial comes up
    if (mix > 0.02 && a - val > 0.02) {
      g.fillStyle = `rgba(255, 59, 48, ${0.4 * mix})`;
      g.fillRect(x, mid - a * amp, bar, a * amp * 2);
    }
    const hh = Math.max(0.75, val * amp);
    g.fillStyle = i / n < at ? '#00d2be' : '#707376'; // solid, so the red ghost doesn't tint it
    g.fillRect(x, mid - hh, bar, hh * 2);
  }
}

// TALK: a radio call over gunfire, the model cutting in after a second
const CALL = PROJECTS.find((p) => p.check)?.check[0];
export function radioCall(ui) {
  if (!CALL || view) return false; // (inside the check, TALK stays a radio blip)
  sfx('radio');
  ui.toast('radio · gunfire removed by the model');
  loadClip(CALL.id)
    .then((data) => {
      if (!view) player.play(data, { loop: false, sweep: 1.1 });
    })
    .catch(() => {});
  return true;
}
