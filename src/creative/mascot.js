import gsap from 'gsap';
import { createSpring } from '../utils/spring.js';
import { SPRITE, drawCar } from './car.js';
import { sfx } from './sound.js';

// The race-car mascot.
//   Mouse / trackpad: it follows you around the whole page, a few car-lengths behind the cursor.
//   Driving fast it turns side-on (bolt and spinning wheels, facing where it's going) and leaves
//   fading tyre marks; when it slows it turns to face you, eyes on your cursor. Separate X / Y
//   springs (Apple's rule for 2D motion), so it chases naturally and never jumps.
//   Touch or reduced motion: it parks on top of the Mac and gives hints when tapped.
// It speaks up at the right moments (a disk goes in, a game starts, the Mac sleeps) and, if you
// idle, now and then drops a hint. It hides while a game, project window or ⌘K is open.
const HINTS = [
  'drag a floppy into the slot under the screen!',
  "i'm faster in RACER.DSK. wanna race?",
  'can you draw a perfect circle? CIRCLE.DSK',
  'psst… the yellow note is hiding something.',
  '⌘K takes you anywhere.',
  'the pink note flips over. tap it.',
  'leave a note on the Mac. everyone sees it!',
  'grab the cans in RACER.DSK. krish runs on the stuff.',
];
const SCALE = 1.6; // css px per sprite px (scaled again on small screens)

export function initMascot({ os, reducedMotion }) {
  const mac = document.querySelector('[data-mac]');
  if (!mac) return () => {};
  const follow = !reducedMotion && matchMedia('(hover: hover) and (pointer: fine)').matches;

  const el = document.createElement(follow ? 'div' : 'button');
  el.className = `racer-pet${follow ? ' racer-pet--follow' : ' racer-pet--park'}`;
  if (!follow) {
    el.type = 'button';
    el.setAttribute('aria-label', 'The race car: tap for a hint');
  } else el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<canvas class="racer-pet__car"></canvas><span class="racer-pet__bubble" role="status" aria-live="polite" hidden></span>';
  (follow ? document.body : mac).append(el);
  const canvas = el.querySelector('canvas');
  const bubble = el.querySelector('.racer-pet__bubble');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let pose = 'front';
  let wheel = 0;
  let look = [0, 0];
  let sleeping = false;
  let winkUntil = 0;
  let lastKey = '';
  const render = (force = false) => {
    const p = performance.now() < winkUntil ? 'wink' : pose;
    const key = `${p}|${wheel}|${look[0].toFixed(1)}|${look[1].toFixed(1)}|${sleeping}`;
    if (!force && key === lastKey) return;
    lastKey = key;
    const { w, h } = SPRITE[p];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w * SCALE}px`;
    }
    drawCar(ctx, p, { look: sleeping ? [0, 1] : look, wheel });
  };
  render(true);

  // ---------- talking ----------
  let bubbleTimer = 0;
  let lastSaid = 0;
  function say(text, ms = 3200) {
    lastSaid = performance.now();
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(bubbleTimer);
    if (!reducedMotion) gsap.fromTo(bubble, { autoAlpha: 0, scale: 0.85, y: 4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.2, ease: 'back.out(2)' });
    bubbleTimer = setTimeout(() => {
      if (reducedMotion) bubble.hidden = true;
      else gsap.to(bubble, { autoAlpha: 0, duration: 0.18, ease: 'ui-out', onComplete: () => (bubble.hidden = true) });
    }, ms);
  }
  const wink = (ms = 700) => {
    winkUntil = performance.now() + ms;
    render(true);
    setTimeout(() => render(true), ms + 10);
  };
  let hint = 0;
  const nextHint = () => say(HINTS[hint++ % HINTS.length]);

  const offOs = os?.on((type, detail) => {
    if (type === 'disk' && detail) {
      wink();
      say(detail === 'secret' ? 'shh… you found it.' : 'ooh, a disk!', 2200);
    } else if (type === 'power') {
      sleeping = !detail;
      render(true);
      if (detail) say('morning!', 1600);
    }
  });

  // ---------- parked mode (touch / reduced motion) ----------
  if (!follow) {
    el.addEventListener('click', () => {
      if (sleeping) return say('zzz… (turn the Mac on?)');
      sfx('honk');
      wink();
      nextHint();
    });
    const hello = setTimeout(() => say('hi! tap me for hints.', 2800), 2400);
    return () => {
      clearTimeout(hello);
      offOs?.();
    };
  }

  // ---------- follow mode ----------
  const marks = document.createElement('canvas'); // tyre marks, fading
  marks.className = 'racer-pet__marks';
  marks.setAttribute('aria-hidden', 'true');
  document.body.append(marks);
  const mctx = marks.getContext('2d');
  const sizeMarks = () => {
    marks.width = window.innerWidth;
    marks.height = window.innerHeight;
  };
  sizeMarks();
  window.addEventListener('resize', sizeMarks);

  // start parked on the Mac's top, until the pointer moves
  const start = mac.getBoundingClientRect();
  const pos = { x: start.left + start.width * 0.6, y: start.top - 30 };
  const target = { x: pos.x, y: pos.y };
  const cursor = { x: pos.x, y: pos.y };
  let facing = 1;
  let vx = 0;
  let vy = 0;
  const sx = createSpring({ value: pos.x, response: 0.7, damping: 0.9, onUpdate: (v, vel) => ((pos.x = v), (vx = vel)) });
  const sy = createSpring({ value: pos.y, response: 0.7, damping: 0.9, onUpdate: (v, vel) => ((pos.y = v), (vy = vel)) });

  let moved = false;
  let lastMove = performance.now();
  const onMove = (e) => {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
    lastMove = performance.now();
    if (!moved) {
      moved = true;
      say("hi! i'll follow you around.", 2600);
    }
    // park a little behind and below the cursor, on the side it came from
    const side = cursor.x > pos.x ? -1 : 1;
    target.x = cursor.x + side * 64;
    target.y = cursor.y + 34;
    sx.set(target.x);
    sy.set(target.y);
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // hide while something big is open (a game, a project, the palette)
  const hidden = () => {
    const d = document.documentElement;
    return d.classList.contains('is-gaming') || d.classList.contains('is-pw-open') || d.classList.contains('is-palette-open') || d.classList.contains('is-mac-zoom');
  };

  let raf = 0;
  let wheelAcc = 0;
  let lastT = performance.now();
  let lastMark = null;
  const loop = (t) => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const speed = Math.hypot(vx, vy);
    // pose: side-on when really driving, facing you when slow
    if (Math.abs(vx) > 140) {
      pose = 'side';
      facing = Math.sign(vx);
    } else if (speed < 60) pose = 'front';
    if (pose === 'side') {
      wheelAcc += Math.abs(vx) * dt * 0.08;
      wheel = Math.floor(wheelAcc) % 8;
    }
    const dx = cursor.x - pos.x;
    const dy = cursor.y - pos.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    look = [dx / dist, dy / dist];
    render();

    const w = canvas.offsetWidth || 90;
    const h = canvas.offsetHeight || 60;
    const tilt = pose === 'side' ? Math.max(-8, Math.min(8, vy * 0.01)) * facing : 0;
    el.style.transform = `translate3d(${pos.x - w / 2}px, ${pos.y - h / 2}px, 0)`;
    canvas.style.transform = `scaleX(${pose === 'side' ? facing : 1}) rotate(${tilt}deg)`;
    el.style.opacity = hidden() ? '0' : '1';

    // tyre marks on fast turns, fading away
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fillStyle = 'rgba(0,0,0,0.06)';
    mctx.fillRect(0, 0, marks.width, marks.height);
    mctx.globalCompositeOperation = 'source-over';
    if (speed > 260 && !hidden()) {
      const wy = pos.y + h * 0.38;
      const pts = [pos.x - w * 0.28, pos.x + w * 0.24];
      mctx.strokeStyle = 'rgba(10, 30, 20, 0.28)';
      mctx.lineWidth = 3;
      if (lastMark) {
        pts.forEach((px, i) => {
          mctx.beginPath();
          mctx.moveTo(lastMark[i], lastMark[2]);
          mctx.lineTo(px, wy);
          mctx.stroke();
        });
      }
      lastMark = [...pts, wy];
    } else lastMark = null;

    // idle hints, sparingly
    if (moved && !sleeping && t - lastMove > 7000 && t - lastSaid > 30000 && !hidden()) nextHint();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // a quick honk + wink when you click near it (it's under your cursor, so it can't be clicked)
  const onDown = (e) => {
    if (Math.hypot(e.clientX - pos.x, e.clientY - pos.y) < 70 && !sleeping) {
      sfx('honk');
      wink();
    }
  };
  window.addEventListener('pointerdown', onDown, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    offOs?.();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('resize', sizeMarks);
    el.remove();
    marks.remove();
  };
}
