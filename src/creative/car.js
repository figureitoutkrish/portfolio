// The race-car mascot's sprites (a Cars-inspired tribute: red, windshield eyes, bumper grin,
// lightning-bolt decal; no names, numbers or logos). Drawn with shapes on a small canvas, then
// snapped to hard pixels and outlined so they stay crisp scaled up (image-rendering: pixelated).
//   front: facing you; the eyes look toward `look` (−1…1, −1…1)
//   side:  driving to the right (flip with CSS); `wheel` spins the rims
//   wink:  front, one eye shut, bigger grin
export const SPRITE = { front: { w: 56, h: 40 }, side: { w: 64, h: 34 }, wink: { w: 56, h: 40 } };

const PAL = {
  red: [228, 36, 27],
  deep: [160, 20, 14],
  gloss: [255, 120, 96],
  white: [252, 252, 250],
  iris: [58, 160, 255],
  pupil: [18, 18, 22],
  mouth: [70, 12, 12],
  yellow: [255, 210, 58],
  orange: [255, 140, 30],
  tyre: [26, 26, 28],
  rim: [200, 40, 30],
  ink: [20, 18, 18],
};
const rgb = (k) => `rgb(${PAL[k].join(',')})`;

export function drawCar(ctx, pose, { look = [0, 0], wheel = 0 } = {}) {
  const { w, h } = SPRITE[pose];
  ctx.clearRect(0, 0, w, h);
  if (pose === 'side') side(ctx, wheel);
  else front(ctx, pose === 'wink', look);
  pixelate(ctx, w, h);
}

function front(ctx, wink, [lx, ly]) {
  // wheels peeking out at the bottom corners
  fill(ctx, 'tyre', () => {
    rr(ctx, 2, 28, 10, 11, 3);
    rr(ctx, 44, 28, 10, 11, 3);
  });
  // body: wide and low, with a rounded hood
  fill(ctx, 'red', () => rr(ctx, 3, 15, 50, 20, 9));
  fill(ctx, 'deep', () => rr(ctx, 6, 30, 44, 5, 2));
  // cabin + windshield (the eyes live here)
  fill(ctx, 'red', () => rr(ctx, 10, 3, 36, 16, 8));
  fill(ctx, 'white', () => rr(ctx, 12, 6, 32, 11, 5));
  // eyes: blue irises that look toward the cursor
  const ox = Math.max(-1, Math.min(1, lx)) * 2;
  const oy = Math.max(-1, Math.min(1, ly)) * 1.2;
  [[20, 11.5], [36, 11.5]].forEach(([x, y], i) => {
    if (wink && i === 1) {
      fill(ctx, 'pupil', () => ctx.rect(x - 4, y, 8, 1.4));
      return;
    }
    fill(ctx, 'iris', () => circle(ctx, x + ox, y + oy, 3));
    fill(ctx, 'pupil', () => circle(ctx, x + ox * 1.1, y + oy, 1.5));
    fill(ctx, 'white', () => ctx.rect(Math.round(x + ox + 1), Math.round(y + oy - 2), 1, 1));
  });
  // eyelids: a red band over the top of the windshield (the determined look)
  fill(ctx, 'red', () => ctx.rect(12, 6, 32, 2.2));
  // headlights
  fill(ctx, 'orange', () => {
    rr(ctx, 5, 19, 6, 3, 1);
    rr(ctx, 45, 19, 6, 3, 1);
  });
  // the grin on the bumper
  fill(ctx, 'mouth', () => {
    ctx.moveTo(10, 22.5);
    ctx.quadraticCurveTo(28, wink ? 40 : 38, 46, 22.5);
    ctx.quadraticCurveTo(28, 28, 10, 22.5);
  });
  fill(ctx, 'white', () => {
    ctx.moveTo(12.5, 24);
    ctx.quadraticCurveTo(28, 34.5, 43.5, 24);
    ctx.quadraticCurveTo(28, 29, 12.5, 24);
  });
  // gloss sparkles
  fill(ctx, 'gloss', () => {
    ctx.rect(15, 17, 3, 1);
    ctx.rect(41, 17, 2, 1);
    ctx.rect(26, 4, 4, 1);
  });
}

function side(ctx, wheel) {
  // spoiler
  fill(ctx, 'deep', () => {
    ctx.rect(1, 9, 10, 2.5);
    ctx.rect(5, 11, 2, 5);
  });
  // body: low wedge, roof hump, sloped windshield, long hood
  fill(ctx, 'red', () => {
    ctx.moveTo(4, 27);
    ctx.lineTo(5, 16);
    ctx.lineTo(20, 14);
    ctx.quadraticCurveTo(24, 6, 33, 6);
    ctx.lineTo(41, 6);
    ctx.lineTo(51, 15);
    ctx.quadraticCurveTo(60, 16, 62, 21);
    ctx.lineTo(62, 26);
    ctx.lineTo(58, 28);
    ctx.lineTo(6, 28);
  });
  fill(ctx, 'deep', () => ctx.rect(8, 25, 50, 3));
  // side window + windshield with the eye
  fill(ctx, 'pupil', () => {
    ctx.moveTo(25, 13.5);
    ctx.quadraticCurveTo(27, 8.5, 32, 8.5);
    ctx.lineTo(38, 8.5);
    ctx.lineTo(38, 13.5);
  });
  fill(ctx, 'white', () => {
    ctx.moveTo(40, 8);
    ctx.lineTo(49.5, 14.5);
    ctx.lineTo(39.5, 14.5);
  });
  fill(ctx, 'iris', () => circle(ctx, 44.2, 12.2, 2.3));
  fill(ctx, 'pupil', () => circle(ctx, 45, 12.4, 1.1));
  fill(ctx, 'red', () => ctx.rect(40, 8, 7, 1.6)); // lid
  // the lightning bolt decal along the door
  fill(ctx, 'yellow', () => {
    ctx.moveTo(14, 19);
    ctx.lineTo(34, 17);
    ctx.lineTo(30, 19.6);
    ctx.lineTo(46, 18.4);
    ctx.lineTo(27, 24);
    ctx.lineTo(31, 21.2);
    ctx.lineTo(13, 22.4);
  });
  fill(ctx, 'orange', () => {
    ctx.moveTo(14, 21.4);
    ctx.lineTo(31, 20.6);
    ctx.lineTo(28, 22.4);
    ctx.lineTo(13, 22.4);
  });
  // grin at the front + headlight
  fill(ctx, 'mouth', () => {
    ctx.moveTo(52, 21.5);
    ctx.quadraticCurveTo(57, 25, 62, 21.5);
    ctx.lineTo(62, 23);
    ctx.quadraticCurveTo(57, 26.5, 52, 23);
  });
  fill(ctx, 'white', () => ctx.rect(55, 22.4, 6, 1));
  fill(ctx, 'orange', () => rr(ctx, 57, 16.5, 4, 2.5, 1));
  fill(ctx, 'gloss', () => ctx.rect(26, 7, 6, 1));
  // wheels
  [16, 50].forEach((x) => {
    fill(ctx, 'tyre', () => circle(ctx, x, 27.5, 6));
    fill(ctx, 'rim', () => circle(ctx, x, 27.5, 3));
    const a = (wheel * Math.PI) / 4;
    fill(ctx, 'tyre', () => ctx.rect(Math.round(x + Math.cos(a) * 1.7), Math.round(27.5 + Math.sin(a) * 1.7), 1, 1));
  });
}

// ---------- helpers ----------
function fill(ctx, color, path) {
  ctx.beginPath();
  path();
  ctx.fillStyle = rgb(color);
  ctx.fill();
}
const rr = (ctx, x, y, w, h, r) => (ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h));
const circle = (ctx, x, y, r) => {
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

// hard pixels: snap alpha, snap colours to the palette, then a 1px dark outline
function pixelate(ctx, W, H) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const cols = Object.values(PAL);
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i += 1) {
    if (d[i * 4 + 3] < 110) {
      d[i * 4 + 3] = 0;
      continue;
    }
    solid[i] = 1;
    let best = cols[0];
    let bd = Infinity;
    for (const c of cols) {
      const dist = (c[0] - d[i * 4]) ** 2 + (c[1] - d[i * 4 + 1]) ** 2 + (c[2] - d[i * 4 + 2]) ** 2;
      if (dist < bd) {
        bd = dist;
        best = c;
      }
    }
    d.set([...best, 255], i * 4);
  }
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W])) d.set([...PAL.ink, 255], i * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Top-down sprite for RACER.DSK (front = up): red body, windshield eyes, bolt stripes.
// K ink · R red · D deep red · W white · B blue · Y yellow · T tyre
export const TOP = [
  '...KKKKK...',
  '..KRRRRRK..',
  '.KRRRRRRRK.',
  'TKRWWWWWRKT',
  'TKWBWWWBWKT',
  'TKRWWWWWRKT',
  '.KRRRRRRRK.',
  '.KRYRRRYRK.',
  '.KRRYRYRRK.',
  '.KRRRYRRRK.',
  '.KRRRRRRRK.',
  'TKRRRRRRRKT',
  'TKRDDDDDRKT',
  'TKDDDDDDDKT',
  '..KKKKKKK..',
];
export const TOP_COLORS = { K: '#141212', R: '#e4241b', D: '#a0140e', W: '#fcfcfa', B: '#3aa0ff', Y: '#ffd23a', T: '#1a1a1c' };
