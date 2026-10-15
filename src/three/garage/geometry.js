import * as THREE from 'three';

// Small geometry builders shared by the procedural cockpit, gloves and garage.

// A tube along a curve whose radius follows radiusAt(t) (0…1), with a rounded tip at the end.
// TubeGeometry can't taper; fingers, halo ends and forearms need to.
export function taperedTube(curve, { segments = 24, radial = 12, radiusAt = () => 0.01, roundTip = true } = {}) {
  const frames = curve.computeFrenetFrames(segments, false);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, p);
    let r = radiusAt(t);
    // ease the last 12% into a dome so fingertips aren't flat cut-offs
    if (roundTip && t > 0.88) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.88) / 0.12) ** 2));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.set(0, 0, 0).addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a)).normalize();
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nor.push(n.x, n.y, n.z);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The Frenet frames can come out left-handed for some curves (e.g. one heading down), which
  // winds every triangle inward: the outside would be culled. Check one face against its outward
  // direction and flip the winding if needed.
  const P = (i) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const mid = Math.floor(segments / 2) * (radial + 1);
  const [i0, i1, i2] = [mid, mid + radial + 1, mid + 1];
  const faceN = P(i1).sub(P(i0)).cross(P(i2).sub(P(i0)));
  const outward = new THREE.Vector3(nor[i0 * 3], nor[i0 * 3 + 1], nor[i0 * 3 + 2]);
  if (faceN.dot(outward) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals(); // smooths the dome where the rings converge
  return g;
}

// Skin a surface through a list of cross-sections. Each section is an array of the same number of
// Vector3 points (a closed ring). Used for the nose cone and the tub.
export function loft(sections, { closeStart = false, closeEnd = false } = {}) {
  const ring = sections[0].length;
  const pos = [];
  const uv = [];
  const idx = [];
  sections.forEach((s, i) => {
    s.forEach((pt, j) => {
      pos.push(pt.x, pt.y, pt.z);
      uv.push(j / (ring - 1), i / (sections.length - 1));
    });
  });
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring;
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      const c = (i + 1) * ring + j2;
      const d = i * ring + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  const cap = (si, flip) => {
    const s = sections[si];
    const c = s.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / s.length);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    uv.push(0.5, si ? 1 : 0);
    for (let j = 0; j < ring; j++) {
      const a = si * ring + j;
      const b = si * ring + ((j + 1) % ring);
      if (flip) idx.push(ci, b, a);
      else idx.push(ci, a, b);
    }
  };
  if (closeStart) cap(0, true);
  if (closeEnd) cap(sections.length - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A superellipse ring: rounded-rectangle-ish cross-section, centred at (cx, cy, z) in the XY plane.
// k = 2 is an ellipse; higher is boxier (F1 noses sit around 3).
export function superRing(cx, cy, z, w, h, { k = 3, n = 24, flatBottom = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** (2 / k) * (w / 2);
    let y = Math.sign(s) * Math.abs(s) ** (2 / k) * (h / 2);
    if (s < 0) y *= 1 - flatBottom; // a flatter floor
    pts.push(new THREE.Vector3(cx + x, cy + y, z));
  }
  return pts;
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Canvas-made textures (no image files needed).
export function canvasTexture(w, h, draw, { srgb = true, repeat } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

// 2x2 twill carbon weave, tiled.
export function carbonTexture(tint = '#0b0c0e') {
  return canvasTexture(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = tint;
      g.fillRect(0, 0, w, h);
      const s = 16;
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          const odd = ((x + y) / s) % 2 === 0;
          const grd = odd ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s);
          grd.addColorStop(0, 'rgba(255,255,255,0.02)');
          grd.addColorStop(0.5, 'rgba(255,255,255,0.11)');
          grd.addColorStop(1, 'rgba(255,255,255,0.02)');
          g.fillStyle = grd;
          g.fillRect(x + 0.5, y + 0.5, s - 1, s - 1);
        }
      }
    },
    { repeat: [6, 6] }
  );
}

// Fine fabric noise for the gloves (used as a bump map, so not sRGB).
export function fabricTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const x = i % w;
        const y = (i / w) | 0;
        const weave = (Math.sin(x * 1.9) + Math.sin(y * 1.9)) * 18;
        const v = 128 + weave + (Math.random() - 0.5) * 50;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: [3, 3] }
  );
}
