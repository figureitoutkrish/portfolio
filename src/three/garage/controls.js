import * as THREE from 'three';

// The wheel's working controls, as physical parts on the 3D wheel: coloured button caps that press
// in, knurled rotaries that turn. Defined per car (car.controls) in the steering pivot's space;
// both cars get the same set, so the page drives either wheel the same way.
//
// The page lays its HTML (labels, focusable hotspots, the screen's content) over them using
// layout(), which projects each control and the display to CSS pixels.
//   def: { id, kind: 'button' | 'rotary', x, y, r (m), color }
const PRESS_DEPTH = 0.0026;
const PRESS_MS = 140;

export function buildControls(pivot, defs, { surfaces = [] } = {}) {
  const parts = new Map();
  const own = [];
  const keep = (x) => (own.push(x), x);
  const ray = new THREE.Raycaster();
  const knurl = keep(knurlTexture());

  pivot.updateMatrixWorld(true);
  const toWorld = (v) => v.clone().applyMatrix4(pivot.matrixWorld);
  const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const dir = new THREE.Vector3(0, 0, 1).transformDirection(pivot.matrixWorld);

  for (const d of defs) {
    // sit the part on the wheel's face: find the surface under it
    let z = -0.012;
    if (surfaces.length) {
      ray.set(toWorld(new THREE.Vector3(d.x, d.y, -0.3)), dir);
      const hit = ray.intersectObjects(surfaces, true)[0];
      if (hit) z = hit.point.clone().applyMatrix4(inv).z;
    }
    const part = new THREE.Group();
    part.name = `ctl_${d.id}`;
    if (d.kind === 'rotary') {
      const body = new THREE.Mesh(
        keep(new THREE.CylinderGeometry(d.r, d.r * 1.04, 0.01, 36).rotateX(Math.PI / 2)),
        keep(new THREE.MeshStandardMaterial({ color: 0x8b929b, roughness: 0.35, metalness: 0.9, map: knurl }))
      );
      const cap = new THREE.Mesh(keep(new THREE.CircleGeometry(d.r * 0.62, 32)), keep(new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.5, metalness: 0.4 })));
      cap.position.z = -0.0051;
      cap.rotation.y = Math.PI;
      const pointer = new THREE.Mesh(keep(new THREE.PlaneGeometry(d.r * 0.16, d.r * 0.55)), keep(new THREE.MeshBasicMaterial({ color: 0x00d2be, toneMapped: false })));
      pointer.position.set(0, d.r * 0.55, -0.0053);
      pointer.rotation.y = Math.PI;
      part.add(body, cap, pointer);
      part.position.set(d.x, d.y, z - 0.005);
    } else {
      // a cap with a gently domed top, on a dark collar
      const mat = keep(new THREE.MeshPhysicalMaterial({ color: d.color, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: d.color, emissiveIntensity: 0.08 }));
      const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(d.r * 0.86, d.r, 0.004, 32).rotateX(-Math.PI / 2)), mat);
      // the top of a sphere, squashed: its rim (at 0.77 R from the centre, then halved) meets the cap
      const R = d.r * 0.86;
      const dome = new THREE.Mesh(keep(new THREE.SphereGeometry(R, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.22)), mat);
      dome.rotation.x = -Math.PI / 2; // its pole (+y) turns to face the driver (−z)
      dome.scale.set(1, 0.5, 1);
      dome.position.z = -0.002 + R * 0.77 * 0.5;
      const collar = new THREE.Mesh(keep(new THREE.CylinderGeometry(d.r * 1.18, d.r * 1.22, 0.002, 32).rotateX(Math.PI / 2)), keep(new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6 })));
      collar.position.z = 0.0015;
      part.add(collar, cap, dome);
      part.position.set(d.x, d.y, z - 0.0025);
    }
    part.userData = { def: d, rest: part.position.z, turn: 0, target: 0, pressT: 0 };
    pivot.add(part);
    parts.set(d.id, part);
  }

  // ---------- motion ----------
  let busy = 0; // ms of animation left (the caller keeps rendering while > 0)
  function press(id) {
    const p = parts.get(id);
    if (!p) return;
    p.userData.pressT = PRESS_MS;
    busy = Math.max(busy, PRESS_MS + 40);
  }
  function turn(id, deg) {
    const p = parts.get(id);
    if (!p) return;
    p.userData.target = THREE.MathUtils.degToRad(deg);
    busy = Math.max(busy, 320);
  }
  function update(dtMs) {
    for (const p of parts.values()) {
      const u = p.userData;
      if (u.pressT > 0) {
        u.pressT = Math.max(0, u.pressT - dtMs);
        const k = Math.sin((u.pressT / PRESS_MS) * Math.PI); // in, then out
        p.position.z = u.rest + k * PRESS_DEPTH;
      } else p.position.z = u.rest;
      u.turn += (u.target - u.turn) * Math.min(1, dtMs / 70);
      p.rotation.z = u.turn; // seen from the driver's seat (looking +z), + turns clockwise
    }
    busy = Math.max(0, busy - dtMs);
    return busy > 0;
  }

  // ---------- projection for the page's HTML ----------
  const v = new THREE.Vector3();
  function project(camera, w, h) {
    const out = [];
    for (const [id, p] of parts) {
      const d = p.userData.def;
      p.getWorldPosition(v);
      const c = v.clone().project(camera);
      // radius: project a point on the rim
      const rim = new THREE.Vector3(d.r, 0, 0).applyMatrix4(p.matrixWorld).project(camera);
      out.push({ id, kind: d.kind, x: ((c.x + 1) / 2) * w, y: ((1 - c.y) / 2) * h, r: Math.abs(rim.x - c.x) * (w / 2) });
    }
    return out;
  }

  return {
    parts,
    press,
    turn,
    update,
    project,
    dispose() {
      own.forEach((x) => x.dispose());
      parts.forEach((p) => p.removeFromParent());
    },
  };
}

// fine grooves round a rotary's rim
function knurlTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 256; x += 4) {
    g.fillStyle = x % 8 ? '#5a6068' : '#c3c9d0';
    g.fillRect(x, 0, 4, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The one control set (ids and colours), placed per car.
export const CONTROL_SET = {
  mode: { kind: 'rotary' },
  scroll: { kind: 'rotary' },
  prev: { kind: 'button', color: 0x2f6bff },
  next: { kind: 'button', color: 0x2f6bff },
  back: { kind: 'button', color: 0xe23a2e },
  ok: { kind: 'button', color: 0xeef1f4 },
  talk: { kind: 'button', color: 0x0fb3a1 },
  drs: { kind: 'button', color: 0x18a957 },
  drink: { kind: 'button', color: 0x9aa0a6 },
  pit: { kind: 'button', color: 0xf08c00 },
};
export const placeControls = (spots) => Object.entries(spots).map(([id, [x, y, r]]) => ({ id, ...CONTROL_SET[id], x, y, r }));
