import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { canvasTexture } from './geometry.js';
import { LAYOUT } from '../../garage/layout.js';

// The night pit lane: a row of garages on the driver's right (−x), the pit wall and its stand on
// the left, the main straight and grandstands beyond. Ours is the garage at z = 0, drawn in full;
// the rest share merged geometry (one draw per material) so the lane stays cheap.
// World and numbers: src/garage/layout.js (shared with the vehicle model).

export { LAYOUT };
const TEAL = 0x00d2be;

export function buildWorld({ quality = 'high' } = {}) {
  RectAreaLightUniformsLib.init();
  const world = new THREE.Group();
  world.name = 'world';
  const disposables = [];
  const track = (x) => (disposables.push(x), x);

  // ---------- materials ----------
  const M = {
    asphalt: track(new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.36, metalness: 0.05 })),
    concrete: track(new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.4 })),
    epoxy: track(new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.22, metalness: 0.1 })),
    wall: track(new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.8 })),
    wallLight: track(new THREE.MeshStandardMaterial({ color: 0xd9dde3, roughness: 0.7 })),
    facade: track(new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.5, metalness: 0.3 })),
    steel: track(new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.35, metalness: 0.8 })),
    cabinet: track(new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.3, metalness: 0.6 })),
    paint: track(new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.6 })),
    tealPaint: track(new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.5, emissive: TEAL, emissiveIntensity: 0.15 })),
    lamp: track(new THREE.MeshBasicMaterial({ color: 0xf4f7ff, toneMapped: false })),
    lampWarm: track(new THREE.MeshBasicMaterial({ color: 0xffd9a8, toneMapped: false })),
    lampTeal: track(new THREE.MeshBasicMaterial({ color: new THREE.Color(TEAL).multiplyScalar(1.6), toneMapped: false })),
    window: track(new THREE.MeshStandardMaterial({ color: 0x0b1118, roughness: 0.1, metalness: 0.8, emissive: 0x1a2a3a, emissiveIntensity: 0.6 })),
    tyre: track(new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.9 })),
    blanket: track(new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.95 })),
    crew: track(new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.8 })),
    barrier: track(new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.7 })),
    fence: track(new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.6, metalness: 0.6, transparent: true, opacity: 0.55 })),
  };

  // collect static boxes per material, merged at the end
  const batches = new Map();
  const add = (mat, geo, x, y, z, ry = 0) => {
    geo.rotateY(ry);
    geo.translate(x, y, z);
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(geo);
  };
  const box = (mat, w, h, d, x, y, z, ry) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, ry);

  const { garageFront: gx, garageDepth: gd, garageWidth: gw, pitch } = LAYOUT;
  const zFrom = LAYOUT.startZ - 60;
  const zTo = 70;
  const len = zTo - zFrom;
  const zMid = (zFrom + zTo) / 2;

  // ---------- ground ----------
  box(M.asphalt, 40, 0.02, len, 2, -0.01, zMid);
  box(M.concrete, 6, 0.012, len, gx + 3, 0.0, zMid); // the working lane in front of the garages
  // lines: garage-side edge, fast-lane edge, pit wall edge
  box(M.paint, 0.12, 0.014, len, gx + 6.05, 0.001, zMid);
  box(M.paint, 0.12, 0.014, len, LAYOUT.pitWall - 1.2, 0.001, zMid);
  // dashed centre line
  for (let z = zFrom; z < zTo; z += 6) box(M.paint, 0.1, 0.014, 3, 1.3, 0.001, z);
  // the speed-limit line at the start of the lane
  box(M.paint, 16, 0.014, 0.3, 0, 0.001, LAYOUT.startZ + 18);

  // ---------- garages ----------
  const bays = [];
  for (let z = LAYOUT.ours - pitch * 13; z <= zTo - 8; z += pitch) bays.push(z);
  for (const z of bays) {
    const ours = z === LAYOUT.ours;
    // floor, back wall, side walls, ceiling
    box(ours ? M.epoxy : M.concrete, gd, 0.02, gw, gx - gd / 2, 0.005, z);
    box(ours ? M.wallLight : M.wall, 0.3, 5, gw, gx - gd, 2.5, z);
    box(M.wall, gd, 5, 0.3, gx - gd / 2, 2.5, z - gw / 2 - 0.85);
    box(M.wall, gd, 5, 0.3, gx - gd / 2, 2.5, z + gw / 2 + 0.85);
    box(M.facade, gd, 0.3, gw + 2, gx - gd / 2, 5.1, z);
    // pillars between garages and the header beam over the opening
    box(M.facade, 1.6, 9, 1.8, gx + 0.2, 4.5, z + pitch / 2);
    box(M.facade, 0.8, 1.6, gw, gx + 0.1, 5.6, z);
    // ceiling light panels (bright, they bloom)
    for (const dz of [-4, 0, 4]) for (const dx of [-3, -8, -12]) box(M.lamp, 2.4, 0.04, 0.5, gx + dx, 4.92, z + dz);
    // a warm downlight strip under the header
    box(ours ? M.lampTeal : M.lampWarm, 0.15, 0.05, gw - 1, gx + 0.35, 4.78, z);
    if (!ours) {
      // other teams: cabinets along the back wall, a monitor bank, tyre stacks
      for (let i = -2; i <= 2; i++) box(M.cabinet, 0.7, 1.1, 2.2, gx - gd + 0.6, 0.55, z + i * 2.4);
      box(M.window, 0.08, 1, 3.2, gx - gd + 0.3, 2.2, z);
    }
  }
  // the building above the garages: a glass upper floor with lit windows, and a canopy lip
  box(M.facade, 8, 4, len, gx - gd / 2 + 1, 7.2, zMid);
  box(M.window, 0.1, 2.2, len, gx + 0.3 - 0.02, 7.1, zMid);
  box(M.facade, 2.6, 0.4, len, gx + 1.1, 5.5, zMid);
  for (let z = zFrom; z < zTo; z += 4) box(M.lamp, 0.5, 0.04, 1.4, gx + 1.6, 5.29, z);

  // ---------- pit wall: barrier, fence, team stands, the straight and grandstands ----------
  box(M.barrier, 0.6, 1.1, len, LAYOUT.pitWall, 0.55, zMid);
  box(M.fence, 0.05, 3.2, len, LAYOUT.pitWall + 0.2, 2.7, zMid);
  for (let z = zFrom; z < zTo; z += 3) box(M.steel, 0.08, 4.2, 0.08, LAYOUT.pitWall + 0.2, 2.1, z);
  for (const z of bays) {
    if (z === LAYOUT.ours) continue;
    // a stand on the lane side of the wall: roof, a bench of monitors
    box(M.facade, 2.6, 0.14, 7, LAYOUT.pitWall - 1.5, 2.75, z);
    box(M.window, 0.06, 0.5, 5.6, LAYOUT.pitWall - 0.9, 1.75, z, 0);
    box(M.steel, 0.1, 2.7, 0.1, LAYOUT.pitWall - 2.6, 1.35, z - 3.2);
    box(M.steel, 0.1, 2.7, 0.1, LAYOUT.pitWall - 2.6, 1.35, z + 3.2);
  }
  box(M.asphalt, 30, 0.02, len, LAYOUT.pitWall + 15.5, -0.012, zMid); // the main straight
  for (let z = zFrom; z < zTo; z += 24) {
    // grandstand tiers across the straight
    for (let r = 0; r < 6; r++) box(M.facade, 2, 0.8, 22, LAYOUT.pitWall + 34 + r * 2, 0.4 + r * 1.2, z);
  }

  // merge each material's boxes into a single mesh
  for (const [mat, geos] of batches) {
    const g = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    world.add(track(g) && mesh);
  }

  // ---------- floodlights and crowd lights in the distance (points; they bloom) ----------
  const dots = [];
  for (let z = zFrom; z < zTo; z += 1.6) {
    for (let r = 0; r < 6; r++) if (Math.random() < 0.35) dots.push(LAYOUT.pitWall + 34 + r * 2, 1.3 + r * 1.2, z + Math.random());
  }
  const crowdGeo = track(new THREE.BufferGeometry());
  crowdGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  world.add(new THREE.Points(crowdGeo, track(new THREE.PointsMaterial({ color: 0xffe2b8, size: 0.09, toneMapped: false }))));
  const towerGeo = track(new THREE.BoxGeometry(0.6, 34, 0.6));
  const headGeo = track(new THREE.BoxGeometry(0.4, 2.4, 4.2));
  for (let z = zFrom + 20; z < zTo; z += 60) {
    for (const x of [LAYOUT.pitWall + 50, -60]) {
      const t = new THREE.Mesh(towerGeo, M.steel);
      t.position.set(x, 17, z);
      world.add(t);
      const h = new THREE.Mesh(headGeo, M.lamp);
      h.position.set(x, 34, z);
      world.add(h);
    }
  }

  // ---------- our garage, in detail ----------
  const ours = buildOurGarage(M, track);
  world.add(ours.group);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0x7f98bd, 0x0b0c10, 0.35);
  world.add(hemi);
  const moon = new THREE.DirectionalLight(0x9db6ff, 0.35);
  moon.position.set(30, 40, -20);
  world.add(moon);
  // our garage's ceiling: two big soft panels
  for (const dx of [-5, -11]) {
    const panel = new THREE.RectAreaLight(0xf2f6ff, 2.6, 4, 9);
    panel.position.set(gx + dx, 4.85, LAYOUT.ours);
    panel.lookAt(gx + dx, 0, LAYOUT.ours);
    world.add(panel);
  }
  // spill from the garages onto the lane: a few lights that hop along to the bays nearest the car
  const spills = [];
  const nSpill = quality === 'low' ? 2 : 4;
  for (let i = 0; i < nSpill; i++) {
    const l = new THREE.PointLight(0xfff1dc, 26, 22, 1.6);
    world.add(l);
    spills.push(l);
  }
  // a cool overhead light from the canopy that rides with the car
  const canopy = new THREE.SpotLight(0xe8efff, 16, 30, 0.9, 0.7, 1.4);
  world.add(canopy, canopy.target);

  function update(carPos) {
    // the lane's lights fade out as the car backs into the garage (its own panels take over)
    const outside = Math.max(0, Math.min(1, (carPos.x - gx + 1) / 4));
    const nearest = Math.round((carPos.z - LAYOUT.ours) / pitch);
    spills.forEach((l, i) => {
      const k = nearest + i - Math.floor(nSpill / 2);
      l.position.set(gx + 1.5, 3.6, LAYOUT.ours + k * pitch);
      l.intensity = (k === 0 ? 30 : 14) * outside;
    });
    canopy.intensity = 16 * outside;
    canopy.position.set(gx + 3, 5.6, carPos.z + 2);
    canopy.target.position.set(carPos.x, 0.6, carPos.z + 1);
    ours.update?.();
  }

  return {
    group: world,
    stations: ours.stations,
    update,
    outsideAt: (x) => Math.max(0, Math.min(1, (x - gx + 1) / 4)),
    dispose() {
      disposables.forEach((d) => d.dispose());
      ours.dispose();
    },
  };
}

// Our garage: polished floor with the box marked out, our signage, tyre stacks in blankets, tool
// cabinets, the engineers' desks, a wall of screens, and the crew (silhouettes) waiting.
function buildOurGarage(M, track) {
  const g = new THREE.Group();
  g.name = 'our-garage';
  const { garageFront: gx, garageDepth: gd, garageWidth: gw, box } = LAYOUT;
  const z0 = LAYOUT.ours;
  const local = [];
  const keep = (x) => (local.push(x), x);

  // box markings: a T for the front wheels and a teal outline for the car
  const lineMat = M.paint;
  const mark = (w, d, x, z, mat = lineMat) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 0.012, d)), mat);
    m.position.set(x, 0.012, z);
    g.add(m);
  };
  mark(5.9, 0.08, box.x, z0 - 1.05, M.tealPaint);
  mark(5.9, 0.08, box.x, z0 + 1.05, M.tealPaint);
  mark(0.08, 2.1, box.x - 2.95, z0, M.tealPaint);
  mark(0.5, 2.6, box.x + 2.4, z0); // the stop T, under the front wheels
  mark(0.08, 3.6, box.x + 2.4, z0);

  // signage over the opening
  const sign = canvasTexture(2048, 256, (c, w, h) => {
    c.fillStyle = '#07080a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.font = '700 150px "Nohemi", ui-sans-serif, system-ui';
    c.textBaseline = 'middle';
    c.fillText('KV', 70, h / 2 + 6);
    c.fillStyle = '#00d2be';
    c.fillRect(330, 70, 6, 116);
    c.fillStyle = '#e8ecf1';
    c.font = '600 64px "Nohemi", ui-sans-serif, system-ui';
    c.fillText('KRISH VIRAMGAMA', 380, 104);
    c.fillStyle = 'rgba(232,236,241,0.6)';
    c.font = '500 44px "JetBrains Mono Variable", ui-monospace, monospace';
    c.fillText('DATA ENGINEERING TEAM', 382, 172);
    c.fillStyle = 'rgba(232,236,241,0.85)';
    c.font = '700 150px "Nohemi", ui-sans-serif, system-ui';
    c.textAlign = 'right';
    c.fillText('01', w - 70, h / 2 + 6);
  });
  track(sign);
  const signMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(gw - 0.4, (gw - 0.4) / 8)), track(new THREE.MeshBasicMaterial({ map: sign, toneMapped: false })));
  signMesh.position.set(gx + 0.52, 5.6, z0);
  signMesh.rotation.y = Math.PI / 2;
  g.add(signMesh);

  // the back wall's screen bank (the projects station)
  const screens = [];
  const screenTex = (seed) =>
    track(
      canvasTexture(512, 288, (c, w, h) => {
        c.fillStyle = '#05080b';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = 'rgba(0,210,190,0.9)';
        c.lineWidth = 3;
        c.beginPath();
        let y = h * 0.6;
        for (let x = 0; x <= w; x += 8) {
          y += Math.sin(x * 0.03 + seed) * 6 + (Math.random() - 0.5) * 8;
          y = Math.min(h - 20, Math.max(40, y));
          if (x === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.font = '500 22px ui-monospace, monospace';
        c.fillText(['LAP 12  1:29.402', 'S1  28.114  S2  31.902', 'TYRE  MED  14 LAPS', 'ERS  DEPLOY  78%'][seed % 4], 20, 32);
      })
    );
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.4, 1.35)), track(new THREE.MeshBasicMaterial({ map: screenTex(i), toneMapped: false })));
    s.position.set(gx - gd + 0.2, 2.6, z0 + (i - 1) * 2.7);
    s.rotation.y = Math.PI / 2;
    g.add(s);
    screens.push(s);
  }

  // engineers' desks with monitors on both side walls (the debrief station)
  const desk = keep(new THREE.BoxGeometry(3.2, 0.06, 0.9));
  const leg = keep(new THREE.BoxGeometry(0.05, 0.74, 0.05));
  const mon = keep(new THREE.PlaneGeometry(0.62, 0.36));
  for (const side of [-1, 1]) {
    const zw = z0 + side * (gw / 2 - 0.7);
    for (const xd of [gx - 4.5, gx - 9]) {
      const d = new THREE.Mesh(desk, M.steel);
      d.position.set(xd, 0.76, zw);
      g.add(d);
      for (const [lx, lz] of [[-1.5, -0.4], [1.5, -0.4], [-1.5, 0.4], [1.5, 0.4]]) {
        const l = new THREE.Mesh(leg, M.steel);
        l.position.set(xd + lx, 0.37, zw + lz);
        g.add(l);
      }
      for (const k of [-0.8, 0, 0.8]) {
        const m = new THREE.Mesh(mon, track(new THREE.MeshBasicMaterial({ map: screenTex(Math.round(xd + k * 10)), toneMapped: false })));
        m.position.set(xd + k, 1.12, zw + side * 0.3);
        m.rotation.y = side > 0 ? Math.PI : 0;
        g.add(m);
      }
    }
  }

  // tyre stacks in blankets, front corners of the garage
  const tyreGeo = keep(new THREE.CylinderGeometry(0.34, 0.34, 0.37, 28));
  const blanketGeo = keep(new THREE.CylinderGeometry(0.36, 0.36, 0.35, 28));
  for (const [x, z] of [[gx - 1.4, z0 - 5.6], [gx - 2.3, z0 - 5.6], [gx - 1.4, z0 + 5.6], [gx - 2.3, z0 + 5.6], [gx - 3.2, z0 + 5.6]]) {
    for (let k = 0; k < 4; k++) {
      const t = new THREE.Mesh(k % 2 ? tyreGeo : blanketGeo, k % 2 ? M.tyre : M.blanket);
      t.position.set(x, 0.19 + k * 0.37, z);
      g.add(t);
    }
    const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.365, 0.365, 0.05, 28)), M.tealPaint);
    band.position.set(x, 0.19 + 3 * 0.37 + 0.2, z);
    g.add(band);
  }

  // tool cabinets along the back wall
  const cab = keep(new THREE.BoxGeometry(0.75, 1.05, 1.6));
  const handle = keep(new THREE.BoxGeometry(0.02, 0.02, 1.2));
  for (const dz of [-5.2, -3.4, 3.4, 5.2]) {
    const c = new THREE.Mesh(cab, M.cabinet);
    c.position.set(gx - gd + 0.6, 0.53, z0 + dz);
    g.add(c);
    for (let k = 0; k < 4; k++) {
      const h = new THREE.Mesh(handle, M.lampTeal);
      h.position.set(gx - gd + 0.98, 0.25 + k * 0.24, z0 + dz);
      g.add(h);
    }
  }

  // crew: silhouettes standing by, ready for the car
  const body = keep(new THREE.CapsuleGeometry(0.2, 0.75, 6, 12));
  const head = keep(new THREE.SphereGeometry(0.13, 16, 12));
  const crew = [];
  for (const [x, z, ry] of [[gx - 6, z0 - 3.1, 0.2], [gx - 9.5, z0 + 3.2, Math.PI - 0.3], [gx - 13.5, z0 - 2.6, 0.6], [gx - 3, z0 + 3.4, Math.PI + 0.4], [gx - 11, z0 - 5.5, 0]]) {
    const p = new THREE.Group();
    const b = new THREE.Mesh(body, M.crew);
    b.position.y = 0.6 + 0.2;
    b.scale.set(1, 1, 0.75);
    const hd = new THREE.Mesh(head, M.crew);
    hd.position.y = 1.62;
    const stripe = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 16)), M.tealPaint);
    stripe.position.y = 1.18;
    stripe.scale.set(1, 1, 0.75);
    p.add(b, hd, stripe);
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    g.add(p);
    crew.push(p);
  }

  return {
    group: g,
    stations: { screens, crew },
    dispose() {
      local.forEach((x) => x.dispose());
    },
  };
}

// A dark env map for reflections: the lane's light strips and the garage glow, prefiltered once.
export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05070a);
  const strip = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const warm = new THREE.MeshBasicMaterial({ color: 0xffe0b8 });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const add = (mat, sx, sy, sz, x, y, z, k = 1) => {
    const m = new THREE.Mesh(geo, mat.clone());
    m.material.color.multiplyScalar(k);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    env.add(m);
  };
  // garage openings on the right, canopy strips overhead, floodlights far left
  for (let z = -20; z <= 20; z += 8) add(warm, 0.2, 2.5, 5, -6, 2, z, 3);
  for (let z = -20; z <= 20; z += 5) add(strip, 0.6, 0.1, 2, -3, 5, z, 4);
  add(strip, 0.2, 0.6, 3, 18, 9, -10, 8);
  add(strip, 0.2, 0.6, 3, 18, 9, 12, 8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  geo.dispose();
  env.traverse((o) => o.material?.dispose());
  return rt;
}
