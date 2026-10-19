import { createVehicle } from './vehicle.js';
import { createRecorder } from './telemetry.js';
import { LAYOUT } from './layout.js';
import { sfx, loop, soundOn, onSoundChange } from '../audio/sfx.js';
import { initRoam } from './roam-ui.js';

// The drive, done the way it's done in F1: rolling in at 110 km/h → brake under 80 before the pit
// entry line and switch the limiter on → down the pit lane → turn into your box and stop on the
// crew's marks → jack up, wheel guns → the mechanics push you back into the garage → the camera
// zooms into the steering wheel and the HTML wheel (wheel.js) takes over as the page.
// Runs inside the garage's frame loop (garage.onFrame) so the car, the wheel display, the HUD and
// the sound move in the same frame. Phases (html data-drive): intro · driving · paused · parked ·
// wheel · roam (out of the car, on foot in the garage: roam-ui.js). The drive is recorded
// (telemetry.js) for the wheel's LAP mode.
//
// Controls (only while driving; never while typing, and never over the menu/palette):
//   W ↑ throttle · S ↓ Space brake · A D ← → steer · L pit limiter · Esc pause
//   touch: brake and go pedals, the PIT button, drag anywhere on the cockpit to steer
const KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown', 'Space'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  limiter: ['KeyL'],
};
const STORE = 'krish:garage';
const BOX_NEAR = 55; // metres out: the turn-in call
const MAP_NEAR = 33; // the box from above covers the last 33 m

export function initDrive({ garage, cockpit, wheel, reducedMotion, lenis }) {
  const root = document.documentElement;
  const vehicle = createVehicle();
  const s = vehicle.state;
  const rec = createRecorder();
  const hud = cockpit.querySelector('.hud');
  const phaseEl = hud.querySelector('[data-hud-phase]');
  const msgEl = hud.querySelector('[data-hud-msg]');
  const timeEl = hud.querySelector('[data-hud-time]');
  const timingEl = hud.querySelector('.hud__timing');
  const sectorEls = [...hud.querySelectorAll('[data-sector]')];
  const goalEl = hud.querySelector('[data-hud-goal]');
  const goalLabel = goalEl.querySelector('[data-goal-label]');
  const goalDist = goalEl.querySelector('[data-goal-dist]');
  const speedEl = hud.querySelector('[data-goal-speed]');
  const speedGauge = hud.querySelector('[data-gauge="speed"]');
  const battGauge = hud.querySelector('[data-gauge="batt"]');
  const battEl = hud.querySelector('[data-batt]');
  const rpmEl = hud.querySelector('[data-rpm]');
  const gearEl = hud.querySelector('[data-gear]');
  const limEl = hud.querySelector('[data-goal-limiter]');
  const boxEl = hud.querySelector('[data-hud-box]');
  const carEl = boxEl.querySelector('[data-hud-car]');
  const distEl = boxEl.querySelector('[data-hud-dist]');
  const pause = cockpit.querySelector('.cockpit__pause');
  const touch = matchMedia('(pointer: coarse)').matches;
  root.classList.toggle('drive-touch', touch);

  let phase = 'intro';
  const setPhase = (p) => {
    phase = p;
    root.dataset.drive = p;
    if (p === 'driving') {
      // the cockpit fills the screen while you drive; the page doesn't scroll under it
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
      lenis?.stop();
    } else lenis?.start();
  };
  setPhase('intro');

  // ---------- input ----------
  const held = new Set();
  let limiterPress = false; // one press = one toggle, picked up by the next frame
  const input = { throttle: 0, brake: 0, steer: 0, limiter: false };
  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const busy = () => root.classList.contains('is-palette-open') || document.querySelector('.menu-btn[aria-expanded="true"]');
  const ALL = Object.values(KEYS).flat();
  function onKeyDown(e) {
    // the intro: Enter takes the wheel (the button shows the key), unless a control has focus
    if (phase === 'intro' && e.key === 'Enter' && !e.repeat && !typing(e) && !busy() && !document.activeElement?.closest?.('button, a, summary')) return start();
    if (phase === 'driving' && e.code === 'Escape') return setPaused(true);
    if (phase === 'paused' && e.code === 'Escape') return setPaused(false);
    if (phase !== 'driving' || typing(e) || busy() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!ALL.includes(e.code)) return;
    e.preventDefault(); // arrows and space would scroll the page
    if (KEYS.limiter.includes(e.code)) {
      if (!e.repeat) limiterPress = true;
      return;
    }
    held.add(e.code);
  }
  const onKeyUp = (e) => held.delete(e.code);
  const onBlur = () => held.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // touch pedals (and they work with a mouse too)
  const pedals = { throttle: 0, brake: 0 };
  hud.querySelectorAll('[data-pedal]').forEach((btn) => {
    const k = btn.dataset.pedal;
    const down = (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic or already-released pointer */
      }
      pedals[k] = 1;
      btn.classList.add('is-down');
    };
    const up = () => {
      pedals[k] = 0;
      btn.classList.remove('is-down');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('lostpointercapture', up);
  });
  hud.querySelector('[data-limiter]')?.addEventListener('click', () => (limiterPress = true));
  // drag to steer (touch), anywhere on the cockpit that isn't a control
  let dragId = null;
  let dragX = 0;
  let dragSteer = 0;
  const canvas = cockpit.querySelector('.cockpit__gl');
  canvas.addEventListener('pointerdown', (e) => {
    if (phase !== 'driving' || e.pointerType === 'mouse') return;
    dragId = e.pointerId;
    dragX = e.clientX;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === dragId) dragSteer = Math.max(-1, Math.min(1, (e.clientX - dragX) / 110));
  });
  // mouse: look around (never steers). On the cockpit, not the canvas: the intro sits over it.
  cockpit.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion) return;
    const r = canvas.getBoundingClientRect();
    look.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    look.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  const endDrag = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    dragSteer = 0;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  cockpit.addEventListener('pointerleave', () => ((look.x = 0), (look.y = 0)));
  const look = { x: 0, y: 0 };

  function readInput() {
    const on = (k) => KEYS[k].some((c) => held.has(c));
    input.throttle = on('throttle') || pedals.throttle ? 1 : 0;
    input.brake = on('brake') || pedals.brake ? 1 : 0;
    input.steer = (on('right') ? 1 : 0) - (on('left') ? 1 : 0) || dragSteer;
    input.limiter = limiterPress;
    limiterPress = false;
  }

  // ---------- sound ----------
  let engine = null;
  const startEngine = () => {
    engine?.stop();
    engine = soundOn() ? loop('f1') : null;
  };
  const offSound = onSoundChange((on) => {
    if (!on) {
      engine?.stop();
      engine = null;
    } else if (phase !== 'intro' && s.mode !== 'parked') startEngine();
  });

  // ---------- per frame ----------
  let blink = 0;
  let lift = 0; // the front jack, 0…1
  // 2026 cars run half their power off the battery: it drains on the throttle and refills under
  // braking (harvesting). Only for the HUD's BATT gauge; it doesn't change the car.
  let batt = 1;
  let lapTime = 0;
  const offFrame = garage.onFrame((dt) => {
    if (phase === 'driving') {
      readInput();
      vehicle.step(dt, input);
      if (s.mode === 'drive') {
        lapTime += dt;
        batt = Math.max(0, Math.min(1, batt - input.throttle * dt * 0.035 + input.brake * Math.min(1, s.speed / 10) * dt * 0.06));
      }
      rec.frame(dt, s, input);
      for (const ev of s.events) {
        if (ev === 'shift') sfx('shift');
        else if (ev === 'limiter-on' || ev === 'limiter-off') {
          sfx('toggle');
          if (ev === 'limiter-on') rec.mark('limiter', { dz: s.z - LAYOUT.entryLine });
        } else if (ev === 'limiter') sfx('limiter');
        else if (ev === 'line') rec.mark('line', { kph: s.kph });
        else if (ev === 'bump') sfx('clunk');
        else if (ev === 'stopped') {
          rec.mark('stopped', { error: s.offMarks, maxPit: s.maxPitKph, overshot: s.overshot });
          rec.finish();
          service();
        } else if (ev === 'parked') park();
      }
    } else if (phase === 'parked') vehicle.step(dt, {});
    tickZoom(dt);
    lift += ((jack ? 1 : 0) - lift) * Math.min(1, dt * 8);

    // hand the car's state to the scene
    garage.pose.x = s.x;
    garage.pose.z = s.z;
    garage.pose.heading = s.heading;
    garage.pose.lift = lift;
    const d = garage.drive;
    const idle = phase === 'intro'; // sat in the car before you take the wheel
    d.speed = idle ? 0 : s.kph;
    d.rpm = idle ? 3800 : s.rpm;
    d.gear = idle ? 'N' : s.gear;
    d.wheel = s.wheel;
    d.road = s.road;
    d.spin = s.spin;
    blink += dt;
    d.limiter = s.limiter && s.mode === 'drive';
    d.flash = d.limiter && Math.floor(blink * 4) % 2 === 0; // the shift lights blink while the limiter is on
    d.message = phase === 'intro' ? '' : s.message;
    d.mode = 'P';
    // look around, eased toward the pointer: sat in the car before the drive, a good look round
    // (±30° / ±11°); while driving, just a glance (±6° / ±3°) so the road stays ahead
    const wide = phase === 'intro';
    const range = wide ? [0.52, 0.19] : [0.1, 0.05];
    garage.look.yaw += (-look.x * range[0] - garage.look.yaw) * Math.min(1, dt * (wide ? 3 : 4));
    garage.look.pitch += (look.y * range[1] - garage.look.pitch) * Math.min(1, dt * (wide ? 3 : 4));
    engine?.set({ rpm: s.rpm, load: s.throttle, cut: s.onLimit && Math.floor(blink * 14) % 2 === 0 }); // the limiter's stutter

    updateHud();
  });

  // ---------- the HUD: what's happening, what to do next, how far ----------
  const KEY = touch ? { brake: 'brake', limiter: 'PIT', steer: 'drag', go: 'go' } : { brake: 'S', limiter: 'L', steer: 'A D', go: 'W' };
  const shown = {};
  const put = (el, k, v) => {
    if (shown[k] !== v) el.textContent = shown[k] = v;
  };
  const attr = (el, k, name, v) => {
    if (shown[k] !== v) el.setAttribute(name, (shown[k] = v));
  };
  const arc = (gauge, k, v) => {
    const d = `${(Math.max(0, Math.min(1, v)) * 75).toFixed(1)} 100`; // a 270° arc
    if (shown[k] !== d) gauge.querySelector('.f1-gauge__v').style.strokeDasharray = shown[k] = d;
  };
  // the sector box, graded in the game's timing colours (purple best, green good, yellow slow,
  // red a limit broken). S1: speed at the pit entry line. S2: where the limiter went on.
  // S3: how close to the marks you stopped.
  const sectors = { 1: null, 2: null, 3: null };
  function grade() {
    const limit = LAYOUT.speedLimit;
    const m = rec.marks;
    if (m.line) {
      const v = Math.round(m.line.kph);
      sectors[1] = { state: v > limit ? 'red' : v >= limit - 6 ? 'purple' : 'green', text: `${v} km/h` };
    }
    if (m.limiter) {
      const dz = Math.round(m.limiter.dz);
      sectors[2] = { state: Math.abs(dz) <= 5 ? 'purple' : dz < 0 || dz <= 25 ? 'green' : 'yellow', text: `${dz > 0 ? '+' : ''}${dz} m` };
    }
    if (m.stopped) {
      const off = m.stopped.error;
      sectors[3] = m.stopped.overshot
        ? { state: 'red', text: `+${Math.round(m.stopped.overshot)} m past` }
        : { state: off <= 0.5 ? 'purple' : off <= 1.5 ? 'green' : 'yellow', text: off < 1 ? `${Math.round(off * 100)} cm` : `${off.toFixed(1)} m` };
    }
  }
  function updateHud() {
    const limit = LAYOUT.speedLimit;
    const kph = Math.round(s.kph);
    let phaseText;
    let msg;
    let label = '';
    let dist = '';
    let warn = false;
    let live = 0; // the sector you're in
    if (s.mode === 'service') {
      phaseText = s.overshot ? `overshot by ${Math.round(s.overshot)} m` : s.offMarks < 0.5 ? 'on the marks' : `${s.offMarks.toFixed(1)} m off the marks`;
      msg = s.overshot ? 'the crew drags you back to the box · new tyres' : 'jack up · new tyres';
    } else if (s.mode === 'push' || s.mode === 'parked') {
      phaseText = 'into the garage';
      msg = 'the crew pushes you back in';
    } else if (!s.pitLane) {
      const toLine = Math.max(0, LAYOUT.entryLine - s.z);
      phaseText = 'box, box';
      msg = kph > limit ? `brake under ${limit} km/h before the pit entry line` : s.limiter ? 'limiter on: roll on down to the pit lane' : `under ${limit}: press ${KEY.limiter} at the line for the limiter`;
      label = 'pit entry line';
      dist = `${Math.round(toLine)} m`;
      warn = kph > limit && toLine < 60;
      live = 1;
    } else if (!s.limiter) {
      phaseText = s.speeding ? 'pit lane speeding' : 'pit lane';
      msg = `press ${KEY.limiter}: pit limiter on`;
      label = 'limiter';
      dist = 'off';
      warn = true;
      live = 2;
    } else if (s.toMarks > BOX_NEAR) {
      phaseText = 'pit lane';
      msg = 'your crew is out on the right · KV';
      label = 'your box';
      dist = `${Math.round(s.toMarks)} m`;
      live = 3;
    } else {
      phaseText = 'your box';
      const lateral = s.x - LAYOUT.pitBox.x; // + = still left of the box
      msg = lateral > 1.2 ? `move right into the box (${KEY.steer})` : s.speed > 0.3 ? `brake: stop on the marks (${KEY.brake})` : 'hold it there';
      label = 'the marks';
      dist = s.toMarks > -0.5 ? `${Math.max(0, s.toMarks).toFixed(s.toMarks < 10 ? 1 : 0)} m` : `${(-s.toMarks).toFixed(1)} m past`;
      live = 3;
    }
    put(phaseEl, 'phase', phaseText);
    put(msgEl, 'msg', msg);
    put(timeEl, 'time', lapTime.toFixed(1));
    put(goalLabel, 'label', label);
    put(goalDist, 'dist', dist);
    goalEl.hidden = !label;
    timingEl.classList.toggle('is-warn', warn);

    // sectors: graded once done, the live one fills as you go
    grade();
    sectorEls.forEach((el, i) => {
      const n = i + 1;
      const done = sectors[n];
      attr(el, `s${n}`, 'data-state', done ? done.state : n === live ? 'live' : 'none');
      put(el.lastElementChild, `s${n}t`, done ? done.text : '');
    });
    const toLine = LAYOUT.entryLine - LAYOUT.startZ;
    const fill = live === 1 ? 1 - Math.max(0, LAYOUT.entryLine - s.z) / toLine : live === 2 ? 0.5 : live === 3 ? 1 - Math.max(0, Math.min(1, s.toMarks / (LAYOUT.pitBox.z - LAYOUT.entryLine))) : 0;
    const liveEl = sectorEls[live - 1];
    if (liveEl && !sectors[live]) liveEl.style.setProperty('--fill', fill.toFixed(3));

    // the cluster: battery, gear and limiter, speed (red over the limit in the lane)
    const over = (s.pitLane || LAYOUT.entryLine - s.z < 60) && kph > limit;
    put(speedEl, 'speed', `${kph}`);
    put(rpmEl, 'rpm', `${Math.round(s.rpm / 10) * 10}`);
    put(gearEl, 'gear', String(s.gear));
    put(battEl, 'batt', `${Math.round(batt * 100)}%`);
    arc(speedGauge, 'spd', s.kph / 320);
    arc(battGauge, 'bat', batt);
    speedGauge.classList.toggle('is-over', over);
    limEl.classList.toggle('is-on', s.limiter);
    limEl.classList.toggle('is-flash', s.limiter && garage.drive.flash);

    // the box from above: shown on the way in
    const showBox = s.mode === 'drive' && s.pitLane && s.toMarks < MAP_NEAR;
    if (boxEl.hidden === showBox) boxEl.hidden = !showBox;
    if (showBox) {
      carEl.setAttribute('transform', `translate(${s.x.toFixed(2)} ${(-s.z).toFixed(2)}) rotate(${((s.heading * 180) / Math.PI).toFixed(1)})`);
      put(distEl, 'boxd', Math.abs(s.x - LAYOUT.pitBox.x) < 0.6 && Math.abs(s.toMarks) < 0.6 ? 'on the marks' : `${Math.max(0, s.toMarks).toFixed(1)} m to the marks`);
    }
  }
  function resetHud() {
    batt = 1;
    lapTime = 0;
    sectors[1] = sectors[2] = sectors[3] = null;
    sectorEls.forEach((el) => el.style.removeProperty('--fill'));
  }

  // reduced motion runs no loop: put the car where it is and draw one frame
  function syncPose() {
    garage.pose.x = s.x;
    garage.pose.z = s.z;
    garage.pose.heading = s.heading;
    garage.pose.lift = 0;
    Object.assign(garage.drive, { speed: 0, rpm: 3800, gear: 'N', wheel: 0, road: 0, flash: false, message: '', limiter: false });
    garage.render();
  }

  // ---------- the zoom into the wheel ----------
  // Glide from the driver's eye to face the wheel, sized to the screen: on wide screens the whole
  // wheel fits between the header and the tab bar; on phones its display fills the width (the
  // outer controls go off-screen and the page's dock stands in for them). Then the page's screen
  // and hotspots are laid over the real 3D wheel.
  let zoomAnim = null;
  let attached = false;
  function fitWheel() {
    const c = cockpit.getBoundingClientRect();
    const size = garage.wheelSize();
    const narrow = c.width < 760 || c.height > c.width * 1.15; // phones, and tablets held upright
    wheel.setCompact(narrow);
    // phones: the display fills the width; upright tablets: 72% (it's big enough, and the row of
    // buttons under it stays clear of the dock); wide screens: the whole wheel
    const fill = c.width < 760 ? 0.94 : 0.72;
    const px = narrow ? c.width * fill * (size.width / size.display) : Math.min(c.width * 0.9, (c.height - 230) * (size.width / size.height));
    garage.view.fit = px / c.width;
    const top = 76; // the header
    let centre;
    if (narrow) {
      // the display is what matters here: put it just under the header, the wheel follows
      const ppm = px / size.width; // pixels per metre at this zoom
      centre = top + 0.016 * ppm + (size.displayHeight * ppm) / 2 + size.displayLift * ppm; // (room for the shift lights above it)
    } else centre = (top + c.height - 130) / 2; // the whole wheel, between the header and the tab bar
    garage.view.offsetY = (centre - c.height / 2) / c.height;
  }
  function zoomTo(to, seconds, done) {
    if (reducedMotion || seconds === 0) {
      garage.view.zoom = to;
      garage.render();
      return done?.();
    }
    zoomAnim = { from: garage.view.zoom, to, t: 0, seconds, done };
  }
  function tickZoom(dt) {
    if (!zoomAnim) return;
    zoomAnim.t = Math.min(1, zoomAnim.t + dt / zoomAnim.seconds);
    garage.view.zoom = zoomAnim.from + (zoomAnim.to - zoomAnim.from) * zoomAnim.t;
    if (zoomAnim.t >= 1) {
      const done = zoomAnim.done;
      zoomAnim = null;
      done?.();
    }
  }
  function toWheel({ delay = 0, seconds = 1.5 } = {}) {
    fitWheel();
    setTimeout(() => {
      garage.hands(false); // parked: hands off the wheel
      zoomTo(1, seconds, onWheel);
    }, reducedMotion ? 0 : delay);
  }
  function onWheel() {
    garage.drive.blank = true; // the page's screen sits on the display
    setPhase('wheel');
    garage.hold(true); // nothing moves now: draw only when a button or knob does
    if (!attached) {
      attached = true;
      wheel.attach({
        layout: () => garage.wheelLayout(),
        pressControl: (id) => garage.pressControl(id),
        turnControl: (id, deg) => garage.turnControl(id, deg),
        setLeds: (n) => garage.setLeds(n),
      });
    }
    wheel.show();
    wheel.layout();
  }
  // the window changed size while on the wheel: re-fit the zoom, then the overlay follows
  window.addEventListener('resize', () => {
    if (phase !== 'wheel') return;
    fitWheel();
    garage.render();
  });

  function remember() {
    try {
      localStorage.setItem(STORE, 'parked');
    } catch {
      /* ignore */
    }
  }

  // ---------- phases ----------
  let jack = false;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, reducedMotion ? 0 : ms));
  const clearTimers = () => timers.splice(0).forEach(clearTimeout);
  function start() {
    if (phase !== 'intro') return;
    vehicle.reset();
    setPhase('driving');
    cockpit.classList.add('is-driving');
    rec.start();
    sfx('radio'); // box, box
    startEngine();
    resetHud();
    hud.focus({ preventScroll: true }); // off the start button (which hides), onto the HUD
  }
  function setPaused(on) {
    if (on && phase !== 'driving') return;
    if (!on && phase !== 'paused') return;
    setPhase(on ? 'paused' : 'driving');
    pause.hidden = !on;
    held.clear();
    if (on) {
      engine?.set({ rpm: 3800, load: 0 });
      pause.querySelector('[data-resume]')?.focus();
    }
  }
  // stopped at the box: jack up, the wheel guns, jack down, then the crew pushes you in
  function service() {
    held.clear();
    later(150, () => {
      jack = true;
      sfx('clunk');
    });
    later(450, () => sfx('airgun'));
    later(800, () => sfx('airgun'));
    later(1500, () => {
      jack = false;
      sfx('clunk');
    });
    later(1900, () => {
      engine?.set({ rpm: 4000, load: 0 });
      garage.crew('push');
      vehicle.push();
    });
  }
  // in the garage, nose out: engine off, then into the wheel
  function park() {
    setPhase('parked');
    remember();
    later(250, () => {
      engine?.stop();
      engine = null;
    });
    wheel.refresh(); // the new lap
    toWheel({ delay: 350, seconds: 1.5 });
  }
  function skip() {
    clearTimers();
    jack = false;
    vehicle.reset({ parked: true });
    garage.crew('push'); // the car's in the garage: the gunners aren't waiting at an empty box
    engine?.stop();
    engine = null;
    pause.hidden = true;
    setPhase('parked');
    cockpit.classList.add('is-driving');
    remember();
    syncPose();
    toWheel({ seconds: 1.1 });
  }
  // PIT on the wheel: back in the car before the pit entry, rolling, engine running
  function restart() {
    clearTimers();
    jack = false;
    wheel.hide();
    garage.hands(true);
    garage.drive.blank = false;
    garage.setLeds(null);
    garage.hold(false);
    zoomAnim = null;
    garage.view.zoom = 0;
    vehicle.reset();
    garage.crew('ready');
    cockpit.classList.add('is-driving');
    setPhase('driving');
    rec.start();
    resetHud();
    sfx('radio');
    startEngine();
  }

  // ---------- out of the car: the garage on foot ----------
  const roam = initRoam({
    garage,
    cockpit,
    reducedMotion,
    onGetIn: () => {
      // back in the seat (the camera is on the driver's head again): zoom into the wheel
      setPhase('parked');
      toWheel({ seconds: 1.1 });
    },
    onDrive: () => restart(),
  });
  function getOut() {
    if (phase !== 'wheel') return;
    wheel.hide();
    garage.drive.blank = false; // the display shows the car's own screen again
    garage.setLeds(null);
    garage.hold(false);
    setPhase('roam');
    roam.enter(); // takes the camera from where it is (the wheel's close-up)…
    garage.view.zoom = 0; // …so the driver's head can go back to the eye for the way in
  }

  cockpit.querySelector('[data-start]').addEventListener('click', start);
  cockpit.querySelectorAll('[data-skip]').forEach((b) => b.addEventListener('click', skip));
  pause.querySelector('[data-resume]')?.addEventListener('click', () => setPaused(false));

  // returning visitors land parked (the drive is a first-visit thing)
  let seen = null;
  try {
    seen = localStorage.getItem(STORE);
  } catch {
    /* ignore */
  }
  if (seen === 'parked' || reducedMotion) {
    vehicle.reset({ parked: true });
    garage.crew('push');
    cockpit.classList.add('is-driving');
    fitWheel();
    garage.view.zoom = 1;
    garage.hands(false);
    syncPose();
    onWheel();
  } else syncPose(); // the intro: sat in the car before the pit entry

  return {
    get phase() {
      return phase;
    },
    vehicle,
    start,
    skip,
    restart,
    getOut,
    roam,
    destroy() {
      clearTimers();
      offFrame();
      offSound();
      engine?.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
