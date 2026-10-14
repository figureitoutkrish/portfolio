import { createVehicle } from './vehicle.js';
import { LAYOUT } from './layout.js';
import { sfx, loop, soundOn, onSoundChange } from '../audio/sfx.js';

// The drive: start → pit lane → stop past the garage → reverse into the box → parked.
// Runs inside the garage's frame loop (garage.onFrame) so the car, the wheel display, the HUD and
// the sound move in the same frame. Phases (html data-drive): intro · driving · paused · parked.
//
// Controls (only while driving; never while typing, and never over the menu/palette):
//   W ↑ throttle · S ↓ brake, then hold to reverse · A D ← → steer · Space brake · Esc pause
//   touch: the pedals bottom-left/right, drag anywhere on the cockpit to steer
const KEYS = {
  throttle: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  brake: ['Space'],
};
const STORE = 'krish:garage';

export function initDrive({ garage, cockpit, reducedMotion, lenis, onParked }) {
  const root = document.documentElement;
  const vehicle = createVehicle();
  const s = vehicle.state;
  const hud = cockpit.querySelector('.hud');
  const phaseEl = hud.querySelector('[data-hud-phase]');
  const msgEl = hud.querySelector('[data-hud-msg]');
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
  const input = { throttle: 0, brake: 0, back: 0, steer: 0 };
  const typing = (e) => e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const busy = () => root.classList.contains('is-palette-open') || document.querySelector('.menu-btn[aria-expanded="true"]');
  const ALL = Object.values(KEYS).flat();
  function onKeyDown(e) {
    if (phase === 'driving' && e.code === 'Escape') return setPaused(true);
    if (phase === 'paused' && e.code === 'Escape') return setPaused(false);
    if (phase !== 'driving' || typing(e) || busy() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!ALL.includes(e.code)) return;
    e.preventDefault(); // arrows and space would scroll the page
    held.add(e.code);
  }
  const onKeyUp = (e) => held.delete(e.code);
  const onBlur = () => held.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // touch pedals (and they work with a mouse too)
  const pedals = { throttle: 0, back: 0 };
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
    else if (e.pointerType === 'mouse' && !reducedMotion) {
      // mouse: a slight look around (never steers)
      const r = canvas.getBoundingClientRect();
      look.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      look.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
  });
  const endDrag = (e) => {
    if (e.pointerId !== dragId) return;
    dragId = null;
    dragSteer = 0;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => ((look.x = 0), (look.y = 0)));
  const look = { x: 0, y: 0 };

  function readInput() {
    const on = (k) => KEYS[k].some((c) => held.has(c));
    input.throttle = on('throttle') || pedals.throttle ? 1 : 0;
    input.back = on('back') || pedals.back ? 1 : 0;
    input.brake = on('brake') ? 1 : 0;
    input.steer = (on('right') ? 1 : 0) - (on('left') ? 1 : 0) || dragSteer;
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
    } else if (phase !== 'intro') startEngine();
  });

  // ---------- per frame ----------
  let flash = 0;
  let lastMsg = '';
  let lastPhaseText = '';
  const offFrame = garage.onFrame((dt) => {
    if (phase === 'driving') {
      readInput();
      vehicle.step(dt, input);
      for (const ev of s.events) {
        if (ev === 'shift') sfx('shift');
        else if (ev === 'reverse') sfx('clunk');
        else if (ev === 'forward') sfx('clunk');
        else if (ev === 'limiter') sfx('limiter');
        else if (ev === 'bump') sfx('clunk');
        else if (ev === 'parked') park();
      }
    } else if (phase === 'parked') vehicle.step(dt, {});

    // hand the car's state to the scene
    garage.pose.x = s.x;
    garage.pose.z = s.z;
    garage.pose.heading = s.heading;
    const d = garage.drive;
    d.speed = s.kph;
    d.rpm = s.rpm;
    d.gear = s.gear;
    d.steer = s.steer * 0.55; // radians of wheel at full lock: about 30°, plenty for a pit lane
    flash += dt;
    d.flash = s.onLimit && Math.floor(flash * 8) % 2 === 0;
    d.limiter = s.mode !== 'parked';
    d.message = phase === 'intro' ? '' : s.message;
    d.mode = s.mode === 'reverse' ? 'R' : 'P';
    // look around: eased toward the pointer, ±6° / ±3°
    garage.look.yaw += (-look.x * 0.1 - garage.look.yaw) * Math.min(1, dt * 4);
    garage.look.pitch += (look.y * 0.05 - garage.look.pitch) * Math.min(1, dt * 4);
    engine?.set({ rpm: s.rpm, load: s.throttle, cut: d.flash });

    updateHud();
  });

  function updateHud() {
    let phaseText = 'pit lane';
    let msg = touch ? 'hold go to accelerate · drag to steer' : 'W / ↑ to accelerate · A D to steer';
    const zRel = s.z - LAYOUT.ours;
    if (s.mode === 'reverse') {
      phaseText = 'reversing into the box';
      msg = touch ? 'hold R to back in · go to pull forward' : 'S / ↓ to back in · W / ↑ to pull forward';
    } else if (s.mode === 'parked') {
      phaseText = 'parked';
      msg = 'engine to idle';
    } else if (zRel > LAYOUT.reverseZone[0]) {
      phaseText = 'past the garage';
      msg = s.speed > 0.2 ? (touch ? 'brake to stop' : 'S / ↓ to brake') : touch ? 'hold R to reverse in' : 'hold S / ↓ to reverse in';
    } else if (zRel > -LAYOUT.approach) {
      phaseText = 'box this lap';
      msg = 'your garage is on the right · stop just past it';
    } else if (s.kph > 1) msg = 'pit limiter on · 80 km/h';
    if (phaseText !== lastPhaseText) phaseEl.textContent = lastPhaseText = phaseText;
    if (msg !== lastMsg) msgEl.textContent = lastMsg = msg;

    // the parking diagram: shown once you're in the zone or reversing
    const showBox = s.mode === 'reverse' || (s.mode === 'lane' && zRel > LAYOUT.reverseZone[0] - 6);
    if (boxEl.hidden === showBox) boxEl.hidden = !showBox;
    if (showBox) {
      carEl.setAttribute('transform', `translate(${s.x.toFixed(2)} ${(-s.z).toFixed(2)}) rotate(${((s.heading * 180) / Math.PI).toFixed(1)})`);
      distEl.textContent = s.mode === 'reverse' ? s.message.toLowerCase() : 'stop here, then reverse';
    }
  }

  // reduced motion runs no loop: put the car where it is and draw one frame
  function syncPose() {
    garage.pose.x = s.x;
    garage.pose.z = s.z;
    garage.pose.heading = s.heading;
    Object.assign(garage.drive, { speed: 0, rpm: 3800, gear: 'N', steer: 0, flash: false, message: '' });
    garage.render();
  }

  // ---------- phases ----------
  function start() {
    if (phase !== 'intro') return;
    setPhase('driving');
    cockpit.classList.add('is-driving');
    sfx('ignition');
    setTimeout(startEngine, 650);
    hud.querySelector('.hud__keys summary')?.focus({ preventScroll: true });
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
  function park() {
    setPhase('parked');
    try {
      localStorage.setItem(STORE, 'parked');
    } catch {
      /* ignore */
    }
    setTimeout(() => sfx('airgun'), 450);
    setTimeout(() => {
      engine?.stop();
      engine = null;
    }, 2200);
    onParked?.({ skipped: false });
  }
  function skip() {
    vehicle.reset({ parked: true });
    engine?.stop();
    engine = null;
    pause.hidden = true;
    setPhase('parked');
    cockpit.classList.add('is-driving');
    try {
      localStorage.setItem(STORE, 'parked');
    } catch {
      /* ignore */
    }
    syncPose();
    onParked?.({ skipped: true });
  }
  function restart() {
    vehicle.reset();
    cockpit.classList.add('is-driving');
    setPhase('driving');
    sfx('ignition');
    setTimeout(startEngine, 650);
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
    setPhase('parked');
    cockpit.classList.add('is-driving');
    syncPose();
    onParked?.({ skipped: true, returning: true });
  }

  return {
    get phase() {
      return phase;
    },
    vehicle,
    start,
    skip,
    restart,
    destroy() {
      offFrame();
      offSound();
      engine?.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
