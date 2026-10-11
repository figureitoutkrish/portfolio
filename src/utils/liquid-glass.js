import { createSpring } from './spring.js';

// Behaviour for `.glass` surfaces (see styles/glass.css):
//   - refraction: an SVG displacement map that bends the backdrop toward the centre near the
//     edges, like the rim of a lens. Chromium only (it's the one engine that accepts SVG
//     filters in backdrop-filter); elsewhere the CSS layers carry the effect on their own.
//   - adaptive tone: samples what's underneath (including image pixels) and flips the glass
//     between light and dark so icons keep their contrast.
//   - shine: the specular highlight drifts toward the pointer on a soft spring.

const SVG_NS = 'http://www.w3.org/2000/svg';
let filterCount = 0;
let svgRoot = null;

const supportsRefraction = (() => {
  const brands = navigator.userAgentData?.brands ?? [];
  return brands.some((b) => /Chromium/.test(b.brand)) && CSS.supports('backdrop-filter', 'url(#a) blur(1px)');
})();

function filterHost() {
  if (!svgRoot) {
    svgRoot = document.createElementNS(SVG_NS, 'svg');
    svgRoot.setAttribute('aria-hidden', 'true');
    svgRoot.setAttribute('width', '0');
    svgRoot.setAttribute('height', '0');
    svgRoot.style.position = 'absolute';
    document.body.append(svgRoot);
  }
  return svgRoot;
}

// Encodes, per pixel, which direction to sample the backdrop from (R = x, G = y, 128 = none).
// Inside a `bezel`-wide band along the edge, samples are pulled inward, strongest at the rim.
function displacementMap(width, height, radius, bezel) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw, hh);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - hw;
      const py = y + 0.5 - hh;
      const qx = Math.abs(px) - (hw - r);
      const qy = Math.abs(py) - (hh - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const inset = -(outside + Math.min(Math.max(qx, qy), 0) - r); // distance in from the edge

      let dx = 0;
      let dy = 0;
      if (inset > 0 && inset < bezel) {
        let nx;
        let ny;
        if (qx > 0 && qy > 0 && outside > 0) {
          nx = ox / outside;
          ny = oy / outside;
        } else if (qx > qy) {
          nx = 1;
          ny = 0;
        } else {
          nx = 0;
          ny = 1;
        }
        const t = 1 - inset / bezel;
        const strength = t * t;
        dx = -nx * Math.sign(px || 1) * strength;
        dy = -ny * Math.sign(py || 1) * strength;
      }
      const i = (y * width + x) * 4;
      image.data[i] = 128 + dx * 127;
      image.data[i + 1] = 128 + dy * 127;
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function setupRefraction(el, { radius, bezel, strength }) {
  const id = `liquid-glass-${++filterCount}`;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.innerHTML = `<feImage result="map" x="0" y="0" preserveAspectRatio="none"></feImage>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="${strength}" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>`;
  filterHost().append(filter);
  const feImage = filter.querySelector('feImage');

  let size = '';
  const build = () => {
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (!w || !h || `${w}x${h}` === size) return;
    size = `${w}x${h}`;
    feImage.setAttribute('width', w);
    feImage.setAttribute('height', h);
    feImage.setAttribute('href', displacementMap(w, h, radius ?? h / 2, bezel));
    el.style.setProperty('--glass-refraction', `url(#${id})`);
  };
  build();
  const ro = new ResizeObserver(build);
  ro.observe(el);
  return () => {
    ro.disconnect();
    filter.remove();
  };
}

// ---------- adaptive tone ----------

const imageCache = new WeakMap();

function imageLuminanceSampler(img) {
  if (imageCache.has(img)) return imageCache.get(img);
  if (!img.complete || !img.naturalWidth) return null;
  const w = 48;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // cross-origin image
  }
  const sampler = { w, h, data };
  imageCache.set(img, sampler);
  return sampler;
}

const toLinear = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

function luminanceAt(x, y, self) {
  const hit = document.elementsFromPoint(x, y).find((n) => !self.contains(n));
  if (!hit) return null;

  if (hit.tagName === 'IMG') {
    const s = imageLuminanceSampler(hit);
    if (s) {
      // Map the point into the image, accounting for object-fit: cover (centred).
      const rect = hit.getBoundingClientRect();
      const scale = Math.max(rect.width / s.w, rect.height / s.h);
      const u = Math.floor((x - rect.left - (rect.width - s.w * scale) / 2) / scale);
      const v = Math.floor((y - rect.top - (rect.height - s.h * scale) / 2) / scale);
      if (u >= 0 && v >= 0 && u < s.w && v < s.h) {
        const i = (v * s.w + u) * 4;
        return luminance(s.data[i], s.data[i + 1], s.data[i + 2]);
      }
    }
  }

  for (let n = hit; n; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
    if (m && (m[3] === undefined || +m[3] > 0.5)) return luminance(+m[0], +m[1], +m[2]);
  }
  return null;
}

// ---------- public ----------

export function createLiquidGlass(el, { radius, bezel = 14, strength = 28, adaptive = true, shine = true } = {}) {
  const cleanups = [];

  if (supportsRefraction) cleanups.push(setupRefraction(el, { radius, bezel, strength }));

  // Adaptive tone, with hysteresis so it doesn't flicker on mid-grey backgrounds.
  let tone = el.dataset.tone || 'light';
  function updateTone() {
    if (!adaptive) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const y = rect.top + rect.height / 2;
    const samples = [0.15, 0.35, 0.5, 0.65, 0.85]
      .map((f) => luminanceAt(rect.left + rect.width * f, y, el))
      .filter((l) => l !== null);
    if (!samples.length) return;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const next = tone === 'dark' ? (avg > 0.5 ? 'light' : 'dark') : avg < 0.36 ? 'dark' : 'light';
    if (next !== tone) {
      tone = next;
      el.dataset.tone = tone;
    }
  }
  if (adaptive) {
    let queued = false;
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        updateTone();
      });
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    cleanups.push(() => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    });
  }

  // Specular highlight that drifts toward the pointer (desktop only, decorative).
  const shineEl = el.querySelector(':scope > .glass__shine');
  if (shine && shineEl && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const rest = () => ({ x: el.offsetWidth * 0.3, y: 0 });
    const sx = createSpring({ value: rest().x, response: 0.6, onUpdate: (v) => shineEl.style.setProperty('--shine-x', `${v}px`) });
    const sy = createSpring({ value: 0, response: 0.6, onUpdate: (v) => shineEl.style.setProperty('--shine-y', `${v}px`) });
    shineEl.style.setProperty('--shine-x', `${rest().x}px`);
    const move = (e) => {
      const r = el.getBoundingClientRect();
      sx.set(e.clientX - r.left);
      sy.set(Math.min(e.clientY - r.top, r.height * 0.4)); // light stays near the top surface
      shineEl.style.setProperty('--shine-opacity', '0.8');
    };
    const leave = () => {
      const p = rest();
      sx.set(p.x);
      sy.set(p.y);
      shineEl.style.removeProperty('--shine-opacity');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    });
  }

  return {
    updateTone,
    destroy: () => cleanups.forEach((fn) => fn()),
  };
}
