import gsap from 'gsap';
import { sfx } from './sound.js';

// Rev, the desk mascot: an original little red pixel race car (headlight eye, "K" on the door),
// living on top of the Mac. It idles, blinks, now and then drives along the Mac's top, and when
// you tap it, it honks and gives a hint. It reacts to the Mac too (disks, games, power).
// Drawn on a tiny canvas with shapes, then snapped to hard pixels and outlined, so it stays
// crisp at any size (scaled up with image-rendering: pixelated).
const W = 48;
const H = 28;
const PALETTE = { red: [227, 48, 47], shade: [165, 30, 30], white: [250, 248, 240], glass: [43, 47, 54], shine: [159, 212, 255], tyre: [24, 24, 24], rim: [170, 170, 170], ink: [20, 20, 20], blush: [255, 150, 165] };

const HINTS = [
  'drag a floppy into the slot under the screen!',
  "i'm way faster in RACER.DSK. try it.",
  'can you draw a perfect circle? CIRCLE.DSK',
  'psst… the yellow note is hiding something.',
  '⌘K jumps anywhere on the site.',
  'the pink note flips over. tap it.',
  'leave a note on the Mac. everyone sees it!',
  'talk to krish: the speech bubble on the desktop.',
];

export function initMascot({ os, reducedMotion }) {
  const mac = document.querySelector('[data-mac]');
  if (!mac) return () => {};

  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'mascot';
  el.setAttribute('aria-label', 'Rev the race car: tap for a hint');
  el.innerHTML = `<canvas class="mascot__car" width="${W}" height="${H}" aria-hidden="true"></canvas><span class="mascot__bubble" role="status" aria-live="polite" hidden></span>`;
  mac.append(el);
  const canvas = el.querySelector('canvas');
  const bubble = el.querySelector('.mascot__bubble');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let wheel = 0;
  let eyes = 'open'; // open | blink | sleep | happy
  let facing = 1;

  // ---------- drawing ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const c = (k) => `rgb(${PALETTE[k].join(',')})`;
    // body: short and round (chibi)
    ctx.fillStyle = c('red');
    round(6, 10, 37, 12, 6);
    ctx.fillStyle = c('shade');
    ctx.fillRect(8, 19, 32, 3);
    // cabin + windows (tall bubble cabin)
    ctx.fillStyle = c('red');
    poly([13, 12], [16, 3], [29, 3], [34, 12]);
    ctx.fillStyle = c('glass');
    poly([16.5, 10.5], [18.5, 5], [27.5, 5], [31, 10.5]);
    ctx.fillStyle = c('shine');
    poly([19, 9.5], [20.2, 6.2], [21.6, 6.2], [20.4, 9.5]);
    // little spoiler
    ctx.fillStyle = c('shade');
    ctx.fillRect(4, 8, 6, 2);
    ctx.fillRect(7, 10, 2, 2);
    // stripe + door number
    ctx.fillStyle = c('white');
    ctx.fillRect(8, 13, 28, 1);
    ctx.beginPath();
    ctx.arc(21.5, 16.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c('ink');
    [[20, 15], [20, 16], [20, 17], [20, 18], [21, 16.5], [22, 15], [22, 18]].forEach(([x, y]) => ctx.fillRect(Math.round(x), Math.round(y), 1, 1));
    // the big headlight eye
    if (eyes === 'open' || eyes === 'happy') {
      ctx.fillStyle = c('white');
      ctx.beginPath();
      ctx.ellipse(37.5, 14, 4.2, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (eyes === 'open') {
        ctx.fillStyle = c('ink');
        ctx.beginPath();
        ctx.arc(38.6, 14.6, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c('white'); // two sparkles
        ctx.fillRect(39, 12, 1, 1);
        ctx.fillRect(37, 16, 1, 1);
      } else {
        ctx.fillStyle = c('ink'); // ^ happy eye
        ctx.fillRect(35, 15, 1, 1);
        ctx.fillRect(36, 14, 1, 1);
        ctx.fillRect(37, 13, 2, 1);
        ctx.fillRect(39, 14, 1, 1);
        ctx.fillRect(40, 15, 1, 1);
      }
    } else {
      ctx.fillStyle = c('ink'); // closed: a line (blink) or a lower line (sleep)
      ctx.fillRect(34, eyes === 'sleep' ? 16 : 14, 7, 1);
    }
    // blush + smile on the front
    ctx.fillStyle = c('blush');
    ctx.fillRect(34, 19, 2, 1);
    ctx.fillStyle = c('ink');
    ctx.fillRect(39, 20, 2, 1);
    ctx.fillRect(41, 19, 1, 1);
    // wheels (big and round)
    [15, 34].forEach((x) => {
      ctx.fillStyle = c('tyre');
      ctx.beginPath();
      ctx.arc(x, 21.5, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('rim');
      ctx.beginPath();
      ctx.arc(x, 21.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c('tyre');
      const a = (wheel * Math.PI) / 4;
      ctx.fillRect(Math.round(x + Math.cos(a) * 1.6), Math.round(21.5 + Math.sin(a) * 1.6), 1, 1);
    });
    pixelate();
  }
  function round(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    ctx.fill();
  }
  function poly(...pts) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  // hard pixels: snap alpha, snap colours to the palette, then a 1px dark outline
  function pixelate() {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const cols = Object.values(PALETTE);
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i += 1) {
      const a = d[i * 4 + 3];
      if (a < 110) {
        d[i * 4 + 3] = 0;
        continue;
      }
      solid[i] = 1;
      let best = cols[0];
      let bd = Infinity;
      for (const col of cols) {
        const dist = (col[0] - d[i * 4]) ** 2 + (col[1] - d[i * 4 + 1]) ** 2 + (col[2] - d[i * 4 + 2]) ** 2;
        if (dist < bd) {
          bd = dist;
          best = col;
        }
      }
      d.set([...best, 255], i * 4);
    }
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x;
        if (solid[i]) continue;
        const near = (x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W]);
        if (near) d.set([...PALETTE.ink, 255], i * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- life ----------
  draw();
  let driving = false;
  let wheelTimer = 0;
  const spin = (on) => {
    clearInterval(wheelTimer);
    if (on && !reducedMotion) {
      wheelTimer = setInterval(() => {
        wheel = (wheel + 1) % 8;
        draw();
      }, 70);
    }
  };

  // blink now and then
  const blinkTimer = setInterval(() => {
    if (eyes !== 'open' || document.hidden) return;
    eyes = 'blink';
    draw();
    setTimeout(() => {
      if (eyes === 'blink') eyes = 'open';
      draw();
    }, 140);
  }, 3800);

  // idle bob
  if (!reducedMotion) gsap.to(el, { y: -1.5, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  // drive along the top every so often
  let pos = 58; // % of the Mac's width
  function drive() {
    if (driving || eyes === 'sleep' || reducedMotion || document.hidden) return;
    const target = pos > 50 ? 26 + Math.random() * 10 : 56 + Math.random() * 10;
    const dir = Math.sign(target - pos);
    driving = true;
    facing = dir;
    el.style.setProperty('--face', String(facing));
    spin(true);
    gsap.to(el, {
      left: `${target}%`,
      duration: Math.abs(target - pos) / 14,
      ease: 'ui-in-out',
      onComplete: () => {
        pos = target;
        driving = false;
        spin(false);
      },
    });
  }
  const driveTimer = setInterval(drive, 11000);

  // ---------- talking ----------
  let hint = 0;
  let bubbleTimer = 0;
  function say(text, ms = 3600) {
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(bubbleTimer);
    if (!reducedMotion) gsap.fromTo(bubble, { autoAlpha: 0, scale: 0.85, y: 4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.2, ease: 'back.out(2)' });
    bubbleTimer = setTimeout(() => {
      if (reducedMotion) bubble.hidden = true;
      else gsap.to(bubble, { autoAlpha: 0, duration: 0.18, ease: 'ui-out', onComplete: () => (bubble.hidden = true) });
    }, ms);
  }
  function happy(ms = 900) {
    if (eyes === 'sleep') return;
    eyes = 'happy';
    draw();
    if (!reducedMotion) gsap.fromTo(canvas, { y: 0 }, { y: -6, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 });
    setTimeout(() => {
      if (eyes === 'happy') eyes = 'open';
      draw();
    }, ms);
  }

  el.addEventListener('click', () => {
    if (eyes === 'sleep') {
      say('zzz… (turn the Mac on?)');
      return;
    }
    sfx('honk');
    happy();
    say(HINTS[hint % HINTS.length]);
    hint += 1;
  });

  const off = os?.on((type, detail) => {
    if (type === 'disk' && detail) {
      happy();
      say(detail === 'secret' ? 'shh… you found it.' : 'ooh, a disk!', 2200);
    } else if (type === 'gaming' && detail) {
      say('vroom! let’s go.', 2000);
    } else if (type === 'power') {
      eyes = detail ? 'open' : 'sleep';
      draw();
      if (detail) say('morning!', 1600);
    }
  });

  // first hello, once the page has settled
  const hello = setTimeout(() => say('hi! i’m rev. tap me for hints.', 3200), 2600);

  return () => {
    [blinkTimer, driveTimer, wheelTimer].forEach(clearInterval);
    clearTimeout(hello);
    off?.();
  };
}
