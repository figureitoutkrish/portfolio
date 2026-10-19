import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { canvasTexture } from './geometry.js';
import { buildGarageProps } from './garage-props.js';
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
    asphalt: track(new THREE.MeshStandardMaterial({ color: 0x34383f, roughness: 0.85 })),
    concrete: track(new THREE.MeshStandardMaterial({ color: 0x5a5f67, roughness: 0.8 })),
    epoxy: track(new THREE.MeshStandardMaterial({ color: 0x969ba3, roughness: 0.4 })),
    wall: track(new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 0.85 })),
    wallLight: track(new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.8 })),
    facade: track(new THREE.MeshStandardMaterial({ color: 0x1c2027, roughness: 0.7 })),
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

  // ---------- garages ----------
  const bays = [];
  for (let z = LAYOUT.ours - pitch * 17; z <= zTo - 8; z += pitch) bays.push(z);
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

  // ---------- the way in: the entry line, chevrons, distance boards, our box and crew ----------
  const guide = buildGuide(M, track);
  world.add(guide.group);

  // ---------- lights ----------
  // a floodlit night race: bright and even, like the circuit's light towers are on
  const hemi = new THREE.HemisphereLight(0xc8d6ff, 0x30333a, 1.1);
  world.add(hemi);
  const flood = new THREE.DirectionalLight(0xfff6e8, 1.6);
  flood.position.set(40, 60, -30);
  world.add(flood);
  const fill = new THREE.DirectionalLight(0xbfd2ff, 0.5);
  fill.position.set(-30, 25, 40);
  world.add(fill);
  // our garage's ceiling: two big soft panels
  for (const dx of [-5, -11]) {
    const panel = new THREE.RectAreaLight(0xf2f6ff, 3.2, 4, 9);
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

  function update(carPos, dt = 0, viewer = null) {
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
    ours.update(dt, Math.abs(carPos.z - LAYOUT.ours) < 60, viewer);
  }

  return {
    group: world,
    stations: ours.stations,
    colliders: [...ours.colliders, ...guide.colliders],
    setMeter: ours.props.setMeter,
    printPage: ours.props.printPage,
    setRadio: ours.props.setRadio,
    setSeen: ours.props.setSeen,
    setGithub: ours.props.setGithub,
    setBoard: ours.props.setBoard,
    update,
    setCrew: guide.setCrew,
    outsideAt: (x) => Math.max(0, Math.min(1, (x - gx + 1) / 4)),
    dispose() {
      disposables.forEach((d) => d.dispose());
      ours.dispose();
      guide.dispose();
    },
  };
}

// Our garage: polished floor with the box marked out, our signage, tyre stacks in blankets, the
// stations and dressing (garage-props.js), and the crew waiting.
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

  // the stations and the dressing: gantry, engineers' stand, wall TV, light box, air lines…
  const props = buildGarageProps(M, track);
  g.add(props.group);

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

  // crew: in team kit (white shirts, dark trousers, a headset), standing round the car the way
  // they do in the photos, clear of the walkways
  const shirt = track(new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.75 }));
  const trousers = track(new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 }));
  const skin = track(new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.7 }));
  const figure = crewFigure(keep);
  // (placed to leave a clear lane either side of the car)
  const crew = [];
  for (const [x, z, ry] of [[box.x + 2.6, z0 - 2.7, -2.4], [box.x - 2.2, z0 + 2.9, 0.3], [box.x - 6.2, z0 - 1.4, 1.2], [gx - 1.4, z0 + 3.6, -1.9], [box.x + 1.2, z0 + 3.0, 3.0]]) {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(figure.shirt, shirt), new THREE.Mesh(figure.trousers, trousers), new THREE.Mesh(figure.dark, M.crew));
    const hd = new THREE.Mesh(figure.head, skin); // its own mesh: the head turns to look at you
    hd.position.y = 1.6;
    hd.add(new THREE.Mesh(figure.headset, M.crew));
    p.add(hd);
    const stripe = new THREE.Mesh(figure.stripe, M.tealPaint);
    p.add(stripe);
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    p.userData.head = hd;
    g.add(p);
    crew.push(p);
  }
  // crew life: a slow sway and the odd shift of weight, and heads that turn to you as you walk by
  let t = 0;
  const seeds = crew.map((_, i) => i * 1.7 + 0.4);
  const local3 = new THREE.Vector3();
  function crewLife(dt, viewer) {
    t += dt;
    crew.forEach((p, i) => {
      const s = seeds[i];
      p.rotation.z = Math.sin(t * 0.7 + s) * 0.012 + (Math.sin(t * 0.11 + s * 3) > 0.7 ? 0.02 : 0); // weight onto one leg now and then
      const hd = p.userData.head;
      let want = Math.sin(t * 0.23 + s) * 0.25; // looking round the garage
      if (viewer) {
        local3.copy(viewer);
        p.worldToLocal(local3);
        const d = Math.hypot(local3.x, local3.z);
        if (d < 4.5 && d > 0.3) want = Math.max(-1.1, Math.min(1.1, Math.atan2(local3.x, local3.z))); // at you, within reason
      }
      hd.rotation.y += (want - hd.rotation.y) * Math.min(1, dt * 3);
    });
  }
  const colliders = [...props.colliders, ...crew.map((p) => [p.position.x - 0.3, p.position.x + 0.3, p.position.z - 0.3, p.position.z + 0.3])];

  return {
    group: g,
    stations: { ...props.parts, crew },
    props,
    colliders,
    update(dt, near, viewer) {
      props.update(dt, near, viewer);
      if (near) crewLife(dt, viewer);
    },
    dispose() {
      local.forEach((x) => x.dispose());
      props.dispose();
    },
  };
}

// A crew member in team kit, merged per material (shirt, trousers, the dark bits, the head, the
// shirt's teal band): legs, hips, torso, arms behind the back (as they stand in the garage), a
// neck, and a headset. 1.78 m tall, facing +z.
function crewFigure(keep) {
  const parts = { shirt: [], trousers: [], dark: [] };
  const put = (list, geo, x, y, z, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz);
    if (rx) geo.rotateX(rx);
    if (rz) geo.rotateZ(rz);
    geo.translate(x, y, z);
    list.push(geo);
  };
  for (const s of [-1, 1]) {
    put(parts.trousers, new THREE.CapsuleGeometry(0.085, 0.72, 4, 10), s * 0.1, 0.47, 0);
    put(parts.dark, new THREE.BoxGeometry(0.11, 0.07, 0.24), s * 0.1, 0.035, 0.04); // boots
    // arms: from the shoulder down and back, hands meeting behind
    put(parts.shirt, new THREE.CapsuleGeometry(0.052, 0.5, 4, 10), s * 0.2, 1.17, -0.07, 0.32, s * 0.16);
  }
  put(parts.trousers, new THREE.CapsuleGeometry(0.16, 0.1, 4, 12), 0, 0.93, 0, 0, Math.PI / 2, 1, 1, 0.75);
  put(parts.shirt, new THREE.CapsuleGeometry(0.17, 0.36, 6, 14), 0, 1.24, 0, 0, 0, 1.18, 1, 0.66);
  put(parts.shirt, new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), 0, 1.5, 0); // neck (collar)
  // the headset, in the head's own space so it turns with it: band over the top, cups at the
  // ears, and the mic boom forward to the mouth (what shows which way they're looking)
  parts.headset = [];
  put(parts.headset, new THREE.TorusGeometry(0.118, 0.012, 6, 20, Math.PI), 0, 0, 0); // (an arc in x–y: ear to ear over the top)
  for (const s of [-1, 1]) {
    const cup = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14);
    cup.rotateZ(Math.PI / 2);
    cup.translate(s * 0.115, 0, 0);
    parts.headset.push(cup);
  }
  const boom = new THREE.CylinderGeometry(0.006, 0.006, 0.13, 6);
  boom.rotateX(Math.PI / 2);
  boom.rotateY(-0.5);
  boom.translate(0.08, -0.05, 0.06);
  parts.headset.push(boom);
  const head = keep(new THREE.SphereGeometry(0.105, 18, 14));
  head.scale(0.92, 1.08, 1);
  const stripe = keep(new THREE.CylinderGeometry(0.2, 0.2, 0.035, 16));
  stripe.scale(1.18, 1, 0.66);
  stripe.translate(0, 1.33, 0);
  const merge = (list) => {
    const m = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    return keep(m);
  };
  return { shirt: merge(parts.shirt), trousers: merge(parts.trousers), dark: merge(parts.dark), headset: merge(parts.headset), head, stripe };
}

// What a real pit lane shows you, so the HUD is a backup rather than the only guide:
//   the pit entry line across the lane, with 80 boards either side (the limit starts here)
//   teal chevrons down the fast lane, then four that swing right toward our box
//   distance boards hung from the garage fronts: 100 / 50 / 25 m to the box
//   our box in the working lane: the car's outline, the white T the front tyres stop on, KV
//   our crew at their stations: lollipop at the nose, the front jack, a gunner at each corner
function buildGuide(M, track) {
  const g = new THREE.Group();
  g.name = 'guide';
  const own = [];
  const keep = (x) => (own.push(x), x);
  const { ours, entryLine, garageFront: gx, pitWall, pitBox, axles } = LAYOUT;
  const paint = (w, d, x, z, mat = M.paint, y = 0.014) => {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 0.012, d)), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const decal = (tex, w, h, x, z, rot = 0) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI + rot; // reads the right way up from the car
    m.position.set(x, 0.016, z);
    g.add(m);
    return m;
  };
  const text = (str, { w = 512, h = 160, size = 120, color = '#ffffff', weight = 800 } = {}) =>
    track(
      canvasTexture(w, h, (c) => {
        c.fillStyle = color;
        c.font = `${weight} ${size}px "Nohemi", ui-sans-serif, system-ui`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(str, w / 2, h / 2 + 6);
      })
    );

  // ---- the pit entry line ----
  const laneW = pitWall - 0.3 - gx;
  paint(laneW, 0.5, (pitWall - 0.3 + gx) / 2, entryLine);
  decal(text('PIT ENTRY', { w: 1024, size: 140 }), 7, 1.1, 3, entryLine + 3);
  // speed-limit boards: a white disc ringed red, on poles either side
  const limitTex = track(
    canvasTexture(256, 256, (c, w) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
      c.fill();
      c.lineWidth = 26;
      c.strokeStyle = '#e10600';
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 17, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#0b0d10';
      c.font = '800 112px "Nohemi", ui-sans-serif, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('80', w / 2, w / 2 + 6);
    })
  );
  const discGeo = keep(new THREE.CircleGeometry(0.55, 40));
  const discMat = keep(new THREE.MeshBasicMaterial({ map: limitTex, toneMapped: false }));
  const poleGeo = keep(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8));
  for (const x of [gx + 0.6, pitWall - 0.7]) {
    const pole = new THREE.Mesh(poleGeo, M.steel);
    pole.position.set(x, 1.2, entryLine - 1);
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(x, 2.7, entryLine - 1);
    disc.rotation.y = Math.PI; // faces the oncoming car
    g.add(pole, disc);
  }

  // ---- chevrons: down the fast lane, then swinging right toward the box ----
  const chevTex = track(
    canvasTexture(128, 128, (c, w) => {
      c.strokeStyle = '#00d2be';
      c.lineWidth = 18;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(18, 88);
      c.lineTo(w / 2, 34);
      c.lineTo(w - 18, 88);
      c.stroke();
    })
  );
  const chevMat = keep(new THREE.MeshBasicMaterial({ map: chevTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 }));
  const chevGeo = keep(new THREE.PlaneGeometry(1.5, 1.5));
  chevGeo.rotateX(-Math.PI / 2);
  chevGeo.rotateY(Math.PI); // the point faces +z, the way you drive
  const spots = [];
  for (let z = ours - 110; z <= ours - 46; z += 8) spots.push([3, z, 0]);
  // the swing into the box: along a curve from the fast lane to the box's line
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const z = ours - 46 + t * 30;
    const x = 3 + (pitBox.x - 3) * (t * t * (3 - 2 * t));
    spots.push([x, z, -0.45 * Math.sin(t * Math.PI)]); // turned toward the right
  }
  const chev = new THREE.InstancedMesh(chevGeo, chevMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach(([x, z, ry], i) => chev.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.015, z), q.setFromAxisAngle(up, ry), new THREE.Vector3(1, 1, 1))));
  g.add(chev);

  // ---- distance boards, hung from the garage fronts above the working lane ----
  const board = (label) =>
    track(
      canvasTexture(256, 160, (c, w, h) => {
        c.fillStyle = '#0b0d10';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#00d2be';
        c.fillRect(0, 0, w, 14);
        c.fillStyle = '#ffffff';
        c.font = '700 84px "Nohemi", ui-sans-serif, system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(label, w / 2, h / 2 + 10);
      })
    );
  const boardGeo = keep(new THREE.PlaneGeometry(1.3, 0.8));
  const hangGeo = keep(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6));
  for (const d of [100, 50, 25]) {
    const z = pitBox.z - d;
    const b = new THREE.Mesh(boardGeo, keep(new THREE.MeshBasicMaterial({ map: board(`${d}`), toneMapped: false })));
    b.position.set(gx + 1.2, 3.55, z);
    b.rotation.y = Math.PI;
    const hang = new THREE.Mesh(hangGeo, M.steel);
    hang.position.set(gx + 1.2, 4.4, z);
    g.add(b, hang);
  }

  // ---- our box: the car's outline, the T for the front tyres, the team's letters ----
  const bx = pitBox.x;
  const bz = pitBox.z;
  const L = 5.4;
  const W = 2.1;
  const zc = bz - 0.45; // the outline's centre (the car is longer behind its origin)
  paint(W, 0.1, bx, zc - L / 2, M.tealPaint);
  paint(W, 0.1, bx, zc + L / 2, M.tealPaint);
  paint(0.1, L, bx - W / 2, zc, M.tealPaint);
  paint(0.1, L, bx + W / 2, zc, M.tealPaint);
  paint(2.9, 0.16, bx, bz + axles.front, M.paint, 0.017); // the T: front tyres stop on this line
  paint(0.16, 1.2, bx, bz + axles.front + 0.6, M.paint, 0.017);
  decal(text('KV', { w: 256, h: 160, size: 120, color: 'rgba(0,210,190,0.9)' }), 1.6, 1, bx, bz - 2.4);

  // ---- the crew at their stations, facing the car coming in ----
  const bodyGeo = keep(new THREE.CapsuleGeometry(0.2, 0.75, 6, 12));
  const headGeo = keep(new THREE.SphereGeometry(0.14, 16, 12));
  const stripeGeo = keep(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 16));
  const person = (x, z, ry, { crouch = false } = {}) => {
    const p = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, M.crew);
    body.scale.set(1, crouch ? 0.62 : 1, 0.75);
    body.position.y = crouch ? 0.52 : 0.8;
    const head = new THREE.Mesh(headGeo, M.tealPaint); // team helmets
    head.position.y = crouch ? 1.02 : 1.62;
    const stripe = new THREE.Mesh(stripeGeo, M.tealPaint);
    stripe.scale.set(1, 1, 0.75);
    stripe.position.y = crouch ? 0.8 : 1.18;
    p.add(body, head, stripe);
    p.position.set(x, 0, z);
    p.rotation.y = ry;
    g.add(p);
    return p;
  };
  // a gunner at each corner, crouched by the wheel
  const gunners = [[1.6, axles.front], [-1.6, axles.front], [1.6, axles.rear], [-1.6, axles.rear]].map(([dx, dz]) => person(bx + dx, bz + dz, Math.atan2(-dx, 0) + Math.PI, { crouch: true }));
  // the front jack, waiting in front of the nose
  const jackMan = person(bx, bz + 4.2, Math.PI);
  const jack = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 0.12, 1.4)), M.steel);
  jack.position.set(0, 0.35, 0.75);
  jack.rotation.x = 0.3;
  jackMan.add(jack);
  // the lollipop: beside the cockpit on the lane side, the board held out over it
  const lolly = person(bx + 2.5, bz + 1.2, Math.PI / 2 + 0.35);
  const stick = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8)), M.steel);
  stick.rotation.z = Math.PI / 2.6;
  stick.position.set(-0.55, 1.45, 0);
  const lollyTex = track(
    canvasTexture(256, 256, (c, w) => {
      c.fillStyle = '#00d2be';
      c.beginPath();
      c.arc(w / 2, w / 2, w / 2 - 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#05070b';
      c.font = '800 54px "Nohemi", ui-sans-serif, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('BRAKES', w / 2, w / 2 + 4);
    })
  );
  const disc = new THREE.Mesh(keep(new THREE.CircleGeometry(0.36, 32)), keep(new THREE.MeshBasicMaterial({ map: lollyTex, toneMapped: false, side: THREE.DoubleSide })));
  disc.position.set(-1.15, 1.75, -0.05);
  lolly.add(stick, disc);

  // once the car is serviced the gunners go round to the back to push it in (and out of its way)
  function setCrew(state) {
    gunners.forEach((p) => (p.visible = state !== 'push'));
  }

  return {
    group: g,
    setCrew,
    // the jack man and the lollipop stay at the box: walk round them, not through them
    colliders: [jackMan, lolly].map((p) => [p.position.x - 0.32, p.position.x + 0.32, p.position.z - 0.32, p.position.z + 0.32]),
    dispose() {
      own.forEach((x) => x.dispose());
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
