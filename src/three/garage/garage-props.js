import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, taperedTube } from './geometry.js';
import { LAYOUT } from '../../garage/layout.js';
import { PROJECTS } from '../../garage/data/projects.js';

// Our garage, dressed like a real one (from Krish's photos of a team garage):
//   the pit wall gantry on the +z wall: five monitors on a desk, the canopy over it with the
//     session clock, the printer at the end, the pit board by the door;
//   the engineers' stand on the −z wall: one big monitor over a red-LED radio console, a headset
//     on its hook, chairs round it;
//   the wall TV on the back wall (the timing graphic), tool cabinets either side, the fridge,
//   a race suit and helmets on a stand, the tyre allocation board;
//   over the car: the light box, coiled air lines and a cooling duct hanging from it.
// These are the free roam's stations (src/three/garage/roam.js): each has the meshes the page lays
// its HTML over, and where the camera stands to look at it. Colliders keep you out of the props.
// World space: the garage runs x −8 (the opening) → −23 (back wall), z −7 → +7; the car is parked
// nose out at LAYOUT.box.
export function buildGarageProps(M, track) {
  const g = new THREE.Group();
  g.name = 'garage-props';
  const { garageFront: gx, garageDepth: gd } = LAYOUT;
  const back = gx - gd + 0.15; // the back wall's face
  const geos = [];
  const keep = (x) => (geos.push(x), x);
  const colliders = []; // [minX, maxX, minZ, maxZ]
  const block = (x0, x1, z0, z1) => colliders.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = g) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // static dark bits merged per material (one draw each)
  const batches = new Map();
  const add = (mat, geo, x, y, z, ry = 0, rx = 0) => {
    if (rx) geo.rotateX(rx);
    if (ry) geo.rotateY(ry);
    geo.translate(x, y, z);
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(geo);
  };
  const box = (mat, w, h, d, x, y, z, ry, rx) => add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, ry, rx);

  const P = {
    black: track(new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.45, metalness: 0.4 })),
    bezel: track(new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.3, metalness: 0.5 })),
    grey: track(new THREE.MeshStandardMaterial({ color: 0x8e939b, roughness: 0.55, metalness: 0.3 })),
    plastic: track(new THREE.MeshStandardMaterial({ color: 0xd9dce1, roughness: 0.5 })),
    rubber: track(new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.8 })),
    seat: track(new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.85 })),
    ledRed: track(new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false })),
    ledDim: track(new THREE.MeshBasicMaterial({ color: 0x3a0806, toneMapped: false })),
    suit: track(new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.85 })),
    glass: track(new THREE.MeshStandardMaterial({ color: 0xbfe9ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18 })),
    fridgeGlow: track(new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false })),
  };

  // a screen: a canvas the 3D scene shows until the page lays its HTML over it
  const screen = (w, h, draw, { px = 640 } = {}) => {
    const ph = Math.round((px * h) / w);
    const c = document.createElement('canvas');
    c.width = px;
    c.height = ph;
    const tex = track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat);
    const redraw = (...args) => {
      draw(c.getContext('2d'), px, ph, ...args);
      tex.needsUpdate = true;
    };
    redraw();
    m.userData.redraw = redraw;
    return m;
  };

  // ======================= the pit wall gantry (+z wall) =======================
  const gz = 6.55; // its back, against the wall
  const gxC = -13.6; // centre along the wall
  const gw = 6.4;
  // the desk, a radio rack under it with rows of red LEDs (photo 1), legs
  box(P.black, gw, 0.06, 0.95, gxC, 1.0, gz - 0.35);
  box(P.black, gw, 0.86, 0.6, gxC, 0.47, gz - 0.1);
  for (let i = 0; i < 6; i++) {
    const x = gxC - gw / 2 + 0.55 + i * ((gw - 1.1) / 5);
    box(P.bezel, 0.86, 0.12, 0.02, x, 0.78, gz - 0.41);
    for (let k = 0; k < 10; k++) box(k < 6 + (i % 3) ? P.ledRed : P.ledDim, 0.05, 0.03, 0.01, x - 0.3 + k * 0.066, 0.78, gz - 0.425);
  }
  // the riser behind the monitors and the canopy over them, on two posts
  box(P.black, gw, 0.9, 0.1, gxC, 1.62, gz + 0.05);
  box(P.black, gw + 0.2, 0.7, 1.0, gxC, 2.85, gz - 0.25);
  box(P.grey, 0.08, 2.6, 0.08, gxC - gw / 2 - 0.05, 1.3, gz - 0.1);
  box(P.grey, 0.08, 2.6, 0.08, gxC + gw / 2 + 0.05, 1.3, gz - 0.1);
  block(gxC - gw / 2 - 0.15, gxC + gw / 2 + 0.15, gz - 0.95, 7.7);
  // five monitors, one per project (the page lays each project's card over one when you look);
  // the ones you've opened this visit carry a SEEN mark
  const seen = new Set();
  const gantryScreens = [];
  for (let i = 0; i < Math.min(5, PROJECTS.length); i++) {
    const x = gxC - (i - 2) * 1.22; // 01 on the left as you face the gantry
    box(P.bezel, 1.12, 0.68, 0.05, x, 1.6, gz - 0.05, 0, -0.08);
    const s = screen(1.04, 0.6, drawProjectIdle(i, seen));
    s.position.set(x, 1.6, gz - 0.085);
    s.rotation.set(-0.08, Math.PI, 0);
    s.name = `gantry-${i}`;
    g.add(s);
    gantryScreens.push(s);
  }
  // the session clock in the canopy (orange digits in a light box, photo 1): time on the page
  const clock = screen(1.1, 0.34, drawClock, { px: 512 });
  clock.position.set(gxC, 2.86, gz - 0.755);
  clock.rotation.y = Math.PI;
  g.add(clock);
  // two small screens either side of it in the canopy
  const canopyL = screen(0.9, 0.42, drawMini('weather'));
  canopyL.position.set(gxC + 1.9, 2.86, gz - 0.755);
  canopyL.rotation.y = Math.PI;
  const canopyR = screen(0.9, 0.42, drawMini('onboard'));
  canopyR.position.set(gxC - 1.9, 2.86, gz - 0.755);
  canopyR.rotation.y = Math.PI;
  g.add(canopyL, canopyR);
  // keyboards and a mouse on the desk
  for (let i = 0; i < 3; i++) box(P.bezel, 0.46, 0.02, 0.15, gxC + (i - 1) * 2.1, 1.04, gz - 0.6);
  // the printer at the end of the desk (it prints the CV)
  const printer = new THREE.Group();
  printer.position.set(gxC - gw / 2 + 0.45, 1.03, gz - 0.42);
  g.add(printer);
  mesh(new THREE.BoxGeometry(0.5, 0.22, 0.42), P.plastic, 0, 0.11, 0, printer);
  mesh(new THREE.BoxGeometry(0.44, 0.02, 0.16), P.grey, 0, 0.23, 0.08, printer);
  mesh(new THREE.BoxGeometry(0.36, 0.015, 0.12), P.grey, 0, 0.06, -0.26, printer); // out tray
  const printerLed = mesh(new THREE.BoxGeometry(0.02, 0.01, 0.005), track(new THREE.MeshBasicMaterial({ color: 0x2bd46b, toneMapped: false })), 0.19, 0.15, -0.212, printer);
  const paper = mesh(new THREE.PlaneGeometry(0.21, 0.297), P.plastic, 0, 0.075, -0.2, printer);
  paper.rotation.x = -Math.PI / 2;
  paper.visible = false;
  // a headset on the desk
  addHeadset(g, gxC + 1.2, 1.06, gz - 0.55, keep, P.rubber, P.grey, Math.PI / 2);

  // ======================= the pit board (by the door, +z side) =======================
  const board = new THREE.Group();
  board.position.set(gx - 1.3, 0, 6.35);
  board.rotation.y = 2.6; // faces into the garage and the lane, toward the car coming in
  g.add(board);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 10), P.grey, 0, 0.85, 0, board);
  mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), P.black, 0, 0.02, 0, board);
  const boardFace = screen(1.0, 1.25, drawBoard, { px: 400 });
  boardFace.position.set(0, 2.25, 0.03);
  board.add(boardFace);
  mesh(new THREE.BoxGeometry(1.06, 1.31, 0.04), P.black, 0, 2.25, 0, board);
  block(gx - 1.9, gx - 0.7, 5.9, 6.8);

  // ======================= the engineers' stand (−z wall, photo 2) =======================
  const sx = -14.4;
  const sz = -5.25;
  const stand = new THREE.Group();
  stand.position.set(sx, 0, sz);
  g.add(stand);
  mesh(new THREE.CylinderGeometry(0.78, 0.82, 1.0, 8), P.black, 0, 0.5, 0, stand).rotation.y = Math.PI / 8;
  mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.05, 8), P.bezel, 0, 1.02, 0, stand).rotation.y = Math.PI / 8;
  // the radio console: a rack of red LED meters under the monitor (they move with the radio)
  mesh(new THREE.BoxGeometry(1.1, 0.24, 0.16), P.bezel, 0, 1.17, 0.12, stand);
  const meterGeo = keep(new THREE.BoxGeometry(0.03, 0.022, 0.01));
  const meters = new THREE.InstancedMesh(meterGeo, P.ledRed, 2 * 24);
  const meterBase = [];
  const tmp = new THREE.Object3D();
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 24; k++) {
      tmp.position.set(-0.46 + k * 0.04, 1.13 + r * 0.08, 0.205);
      tmp.updateMatrix();
      meters.setMatrixAt(r * 24 + k, tmp.matrix);
      meterBase.push(tmp.position.clone());
    }
  }
  stand.add(meters);
  // the big monitor on a stalk
  mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), P.grey, 0, 1.35, -0.05, stand);
  mesh(new THREE.BoxGeometry(1.34, 0.82, 0.07), P.bezel, 0, 1.85, 0, stand);
  const standScreen = screen(1.26, 0.74, drawStandIdle);
  standScreen.position.set(0, 1.85, 0.04);
  standScreen.name = 'stand';
  stand.add(standScreen);
  // the headset on its hook, on the monitor's side (the contact station)
  mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), P.grey, 0.72, 1.95, 0.02, stand);
  const headset = addHeadset(stand, 0.74, 1.82, 0.08, keep, P.rubber, P.grey, 0);
  headset.name = 'headset';
  // chairs round it
  for (const [a, d] of [[-0.9, 1.5], [0.25, 1.65], [1.3, 1.45], [2.6, 1.4]]) addChair(g, sx + Math.sin(a) * d, sz + Math.cos(a) * d, a + Math.PI, keep, P);
  block(sx - 0.95, sx + 0.95, sz - 0.95, sz + 0.95);

  // ======================= the back wall =======================
  // the wall TV: the timing graphic (LAP)
  box(P.bezel, 0.1, 2.0, 3.45, back + 0.05, 2.75, 0);
  const tv = screen(3.3, 1.86, drawTvIdle, { px: 960 });
  tv.position.set(back + 0.11, 2.75, 0);
  tv.rotation.y = Math.PI / 2;
  tv.name = 'tv';
  g.add(tv);
  box(P.black, 0.4, 0.08, 2.2, back + 0.2, 1.62, 0); // a shelf under it
  // tool cabinets either side of the TV, lit handles
  for (const dz of [-3.1, -4.9, 3.1, 4.9]) {
    box(M.cabinet, 0.75, 1.05, 1.6, back + 0.45, 0.53, dz);
    for (let k = 0; k < 4; k++) box(M.lampTeal, 0.02, 0.02, 1.2, back + 0.83, 0.25 + k * 0.24, dz);
  }
  block(back, back + 0.9, -5.75, -2.3);
  block(back, back + 0.9, 2.3, 5.75);
  // the fridge in the corner (DRINK)
  const fridge = new THREE.Group();
  fridge.position.set(back + 0.4, 0, 6.6);
  g.add(fridge);
  mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), P.black, 0, 0.95, 0, fridge);
  mesh(new THREE.PlaneGeometry(0.6, 1.7), P.fridgeGlow, 0.351, 0.98, 0, fridge).rotation.y = Math.PI / 2;
  const bottleGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10));
  const bottleMat = track(new THREE.MeshStandardMaterial({ color: 0x00d2be, roughness: 0.3, emissive: 0x00d2be, emissiveIntensity: 0.25 }));
  const bottles = new THREE.InstancedMesh(bottleGeo, bottleMat, 24);
  for (let i = 0; i < 24; i++) {
    tmp.position.set(0.3, 0.45 + Math.floor(i / 6) * 0.38, -0.22 + (i % 6) * 0.088);
    tmp.updateMatrix();
    bottles.setMatrixAt(i, tmp.matrix);
  }
  fridge.add(bottles);
  mesh(new THREE.PlaneGeometry(0.62, 1.72), P.glass, 0.36, 0.98, 0, fridge).rotation.y = Math.PI / 2;
  fridge.name = 'fridge';
  block(back, back + 0.8, 6.2, 7.4);
  // the garage radio: a boombox on the cabinets right of the TV. The page plays the garage's music
  // through it, louder as you walk up (src/garage/garage-radio.js); its cones pump with the beat
  const radio = new THREE.Group();
  radio.name = 'radio';
  radio.position.set(back + 0.45, 1.06, 4.0);
  radio.rotation.y = Math.PI / 2; // faces into the garage (+x)
  g.add(radio);
  const radioBody = track(new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.5, metalness: 0.35 }));
  const grille = track(new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.9 }));
  mesh(new THREE.BoxGeometry(0.66, 0.34, 0.2), radioBody, 0, 0.17, 0, radio);
  mesh(new THREE.BoxGeometry(0.62, 0.3, 0.01), grille, 0, 0.17, 0.101, radio);
  const cones = [];
  for (const sx of [-0.19, 0.19]) {
    mesh(new THREE.TorusGeometry(0.095, 0.012, 8, 32), P.grey, sx, 0.16, 0.108, radio);
    const cone = mesh(new THREE.CylinderGeometry(0.085, 0.03, 0.03, 32, 1, true), grille, sx, 0.16, 0.1, radio);
    cone.rotation.x = Math.PI / 2;
    const cap = mesh(new THREE.SphereGeometry(0.028, 16, 10), radioBody, sx, 0.16, 0.112, radio);
    cap.scale.z = 0.5;
    cone.userData.z = cone.position.z;
    cap.userData.z = cap.position.z;
    cones.push(cone, cap);
  }
  // the display between the speakers: station and level bars (redrawn by setRadio)
  const radioScreen = screen(0.13, 0.07, drawRadio, { px: 260 });
  radioScreen.position.set(0, 0.25, 0.108);
  radio.add(radioScreen);
  for (const sx of [-0.035, 0.035]) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 16), M.tealPaint, sx, 0.09, 0.11, radio).rotation.x = Math.PI / 2;
  // the handle and the antenna
  const handle = mesh(new THREE.TorusGeometry(0.22, 0.012, 8, 32, Math.PI), P.grey, 0, 0.34, 0, radio);
  handle.scale.y = 0.35;
  const antenna = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), P.grey, 0.28, 0.6, -0.06, radio);
  antenna.rotation.z = -0.5;
  block(back, back + 0.9, 3.6, 4.4);

  // the race suit on a stand and two helmets on a shelf (the −z corner)
  const suit = new THREE.Group();
  suit.position.set(back + 0.7, 0, -6.5);
  suit.rotation.y = Math.PI / 2;
  g.add(suit);
  mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.05, 16), P.black, 0, 0.025, 0, suit);
  mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 8), P.grey, 0, 0.6, 0, suit);
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.5, 6, 16), P.suit, 0, 1.3, 0, suit);
  torso.scale.set(1, 1, 0.6);
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 10), P.suit, s * 0.27, 1.25, 0, suit);
    arm.rotation.z = s * 0.12;
    const stripe = mesh(new THREE.BoxGeometry(0.02, 0.7, 0.13), M.tealPaint, s * 0.2, 1.3, 0, suit);
    stripe.rotation.z = s * 0.05;
  }
  box(P.black, 0.35, 0.04, 1.2, back + 0.2, 1.75, -5.95);
  for (const dz of [-6.3, -5.65]) {
    const helmet = mesh(new THREE.SphereGeometry(0.15, 24, 16), track(new THREE.MeshPhysicalMaterial({ color: 0xeef1f4, roughness: 0.25, clearcoat: 1 })), back + 0.25, 1.92, dz);
    helmet.scale.set(1, 0.95, 1.1);
    const visor = mesh(new THREE.SphereGeometry(0.152, 24, 8, Math.PI * 0.25, Math.PI * 0.5, Math.PI * 0.38, Math.PI * 0.2), track(new THREE.MeshPhysicalMaterial({ color: 0x111418, roughness: 0.05, metalness: 0.6, clearcoat: 1 })), back + 0.25, 1.92, dz);
    visor.rotation.y = -Math.PI / 2;
    const band = mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 32), M.tealPaint, back + 0.25, 1.9, dz);
    band.rotation.x = Math.PI / 2;
  }
  block(back, back + 1.1, -7.4, -5.4);
  // the tyre allocation board: S / M / H for the weekend (the team's compound wall)
  const tyreBoard = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(1.5, 0.9)),
    track(new THREE.MeshBasicMaterial({ map: track(canvasTexture(600, 360, drawTyreBoard)), toneMapped: false }))
  );
  tyreBoard.position.set(back + 0.02, 2.4, -4.0);
  tyreBoard.rotation.y = Math.PI / 2;
  g.add(tyreBoard);

  // ======================= the commits monitor (GitHub) =======================
  // A monitor on a rolling cart near the back-left, turned toward the car: Krish's contribution
  // calendar in the team colours and his latest commit (the page feeds it from /api/github).
  const cart = new THREE.Group();
  cart.position.set(back + 3.3, 0, -3.3);
  cart.rotation.y = 0.95; // facing out toward the car and the middle of the garage
  g.add(cart);
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.22, 0.22]) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), P.rubber, sx, 0.035, sz, cart).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.78, 0.05, 0.56), P.black, 0, 0.09, 0, cart);
  mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), P.grey, 0, 0.7, -0.1, cart);
  mesh(new THREE.BoxGeometry(0.5, 0.03, 0.34), P.black, 0, 0.78, 0, cart); // a shelf
  mesh(new THREE.BoxGeometry(1.32, 0.8, 0.06), P.bezel, 0, 1.62, -0.08, cart);
  const githubScreen = screen(1.24, 0.72, drawGithub, { px: 900 });
  githubScreen.position.set(0, 1.62, -0.045);
  githubScreen.name = 'github';
  cart.add(githubScreen);
  block(back + 2.7, back + 3.9, -3.9, -2.7);

  // ======================= tyre warmers =======================
  // A control box by each front corner's blanket stacks with its temperature. Stand next to the
  // stack and it cools (you're letting the heat out); walk off and it climbs back to 80 °C.
  const warmers = [
    { at: [gx - 1.85, -4.95], ry: 0, temp: 80, target: 80 }, // the −z stacks, facing into the garage
    { at: [gx - 2.3, 4.95], ry: Math.PI, temp: 79, target: 80 },
  ].map((w) => {
    const grp = new THREE.Group();
    grp.position.set(w.at[0], 0, w.at[1]);
    grp.rotation.y = w.ry;
    g.add(grp);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), P.grey, 0, 0.5, 0, grp);
    mesh(new THREE.BoxGeometry(0.34, 0.22, 0.1), P.black, 0, 1.1, 0, grp);
    const face = screen(0.28, 0.16, drawWarmer, { px: 280 });
    face.position.set(0, 1.1, 0.051);
    grp.add(face);
    // a cable down into the stack
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 1.0, -0.04), new THREE.Vector3(0.18, 0.7, -0.25), new THREE.Vector3(0.2, 0.5, -0.5)]);
    mesh(taperedTube(cable, { segments: 12, radial: 6, radiusAt: () => 0.008, roundTip: false }), P.rubber, 0, 0, 0, grp);
    return { ...w, face, shown: null };
  });
  function tickWarmers(dt, viewer) {
    for (const w of warmers) {
      const near = viewer && Math.hypot(viewer.x - w.at[0], viewer.z - w.at[1]) < 2.4;
      w.temp = near ? Math.max(58, w.temp - dt * 0.9) : Math.min(w.target, w.temp + dt * 1.6);
      const label = `${Math.round(w.temp)}|${near ? 1 : 0}`;
      if (label !== w.shown) {
        w.shown = label;
        w.face.userData.redraw(w.temp, near);
      }
    }
  }

  // ======================= over the car =======================
  const car = LAYOUT.box;
  const lbx = car.x - 0.4; // the car is longer behind its origin
  // the light box: a frame with a glowing underside, on four cables (photo 3)
  box(P.black, 5.6, 0.2, 2.8, lbx, 3.7, car.z);
  box(M.lamp, 5.4, 0.02, 2.6, lbx, 3.59, car.z);
  for (const [dx, dz] of [[-2.6, -1.2], [2.6, -1.2], [-2.6, 1.2], [2.6, 1.2]]) box(P.grey, 0.02, 1.2, 0.02, lbx + dx, 4.35, car.z + dz);
  // coiled air lines hanging from the frame, by each wheel (the wheel guns' air)
  const coilGeo = keep(coilGeometry());
  for (const [dx, dz] of [[2.1, -1.5], [2.1, 1.5], [-1.9, -1.5], [-1.9, 1.5]]) {
    const c = new THREE.Mesh(coilGeo, P.rubber);
    c.position.set(lbx + dx, 3.6, car.z + dz);
    g.add(c);
  }
  // a cooling duct from the frame down to the car's sidepod (big corrugated hose)
  const duct = new THREE.CatmullRomCurve3([
    new THREE.Vector3(lbx - 1.4, 3.6, car.z - 1.5),
    new THREE.Vector3(lbx - 1.3, 2.2, car.z - 1.85),
    new THREE.Vector3(lbx - 1.0, 1.0, car.z - 1.55),
    new THREE.Vector3(lbx - 0.9, 0.58, car.z - 1.02), // into the sidepod's inlet
  ]);
  mesh(taperedTube(duct, { segments: 40, radial: 16, radiusAt: (t) => 0.13 - t * 0.02, roundTip: false }), P.rubber);
  // the car itself, for walking round it
  block(car.x - 3.4, car.x + 2.7, car.z - 1.05, car.z + 1.05);

  // merge the static boxes
  for (const [mat, list] of batches) {
    const merged = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    mesh(merged, mat);
  }

  // ---------- live screens ----------
  const t0 = performance.now();
  let lastSec = -1;
  let screensT = 0;
  let meterLevel = 0;
  let meterTarget = 0;
  let meterT = 0;
  function update(dt, near = true, viewer = null) {
    // the session clock: time on the page, 00:16:07 style; red past an hour
    const sec = Math.floor((performance.now() - t0) / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      clock.userData.redraw(sec);
    }
    // the idle screens move a little (every 0.5 s: canvas redraws aren't free)
    screensT += dt;
    if (near && screensT > 0.5) {
      screensT = 0;
      const k = performance.now() / 1000;
      gantryScreens.forEach((s) => s.visible && !s.userData.held && s.userData.redraw(k));
      canopyL.userData.redraw(k);
      canopyR.userData.redraw(k);
    }
    // the radio console's meters: a level that jumps around like speech (or what the page feeds it)
    meterT -= dt;
    if (meterT <= 0) {
      meterT = 0.08 + Math.random() * 0.12;
      meterTarget = feed != null ? feed : Math.random() < 0.3 ? 0 : 0.2 + Math.random() * 0.6;
    }
    meterLevel += (meterTarget - meterLevel) * Math.min(1, dt * 18);
    tickPrinter(dt);
    if (near) tickWarmers(dt, viewer);
    const lit = Math.round(meterLevel * 24);
    if (lit !== litMeters) {
      litMeters = lit;
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 24; k++) {
          const p = meterBase[r * 24 + k];
          tmp.position.copy(p);
          tmp.scale.setScalar(k < lit - r * 2 ? 1 : 0.001);
          tmp.updateMatrix();
          meters.setMatrixAt(r * 24 + k, tmp.matrix);
        }
      }
      meters.instanceMatrix.needsUpdate = true;
    }
  }
  let litMeters = -1;
  let feed = null;
  // the printer: a sheet feeds out over ~1.2 s (the page downloads the PDF as it lands)
  let printT = -1;
  let radioLabel = null;
  function tickPrinter(dt) {
    if (printT < 0) return;
    printT += dt;
    const k = Math.min(1, printT / 1.2);
    paper.visible = true;
    paper.position.z = -0.2 - k * 0.2;
    paper.position.y = 0.075 - k * 0.01;
    printerLed.visible = Math.floor(printT * 8) % 2 === 0 || k >= 1;
    if (printT > 4) {
      printT = -1;
      paper.visible = false;
      printerLed.visible = true;
    }
  }

  return {
    group: g,
    colliders,
    update,
    // the stations' parts (roam.js decides where to stand and what's focusable)
    parts: { gantryScreens, clock, printer, paper, printerLed, board, boardFace, standScreen, headset, tv, fridge, tyreBoard, radio, githubScreen },
    // the radio console follows the page's audio level (0…1), or null for idle chatter
    setMeter: (v) => (feed = v),
    printPage: () => (printT = 0),
    // the projects you've opened this visit (indices): their monitors get a SEEN mark
    // the commits monitor: { days, total, commits } from /api/github, or null for "no signal"
    setGithub: (data) => githubScreen.userData.redraw(data),
    setSeen(list) {
      seen.clear();
      list.forEach((i) => seen.add(i));
      gantryScreens.forEach((m) => m.userData.redraw(performance.now() / 1000));
    },
    // the radio: cones pump with `level` (0…1); the display shows `label` (or OFF)
    setRadio({ level = 0, label } = {}) {
      cones.forEach((c) => (c.position.z = c.userData.z + level * 0.02)); // the cones push out on the beat
      if (label !== undefined && label !== radioLabel) {
        radioLabel = label;
        radioScreen.userData.redraw(label);
      }
    },
    // the pit board shows the newest message, chalked across up to four lines
    setBoard(text) {
      if (!text) return;
      const lines = [];
      for (const word of String(text).toUpperCase().split(' ')) {
        const last = lines[lines.length - 1];
        if (last && (last + ' ' + word).length <= 9) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
      }
      boardFace.userData.redraw(lines.slice(0, 4));
    },
    dispose() {
      geos.forEach((x) => x.dispose());
    },
  };
}

// ---------- pieces ----------
function addHeadset(parent, x, y, z, keep, rubber, grey, ry) {
  const h = new THREE.Group();
  h.position.set(x, y, z);
  h.rotation.y = ry;
  parent.add(h);
  const band = new THREE.Mesh(keep(new THREE.TorusGeometry(0.09, 0.012, 8, 24, Math.PI)), rubber);
  h.add(band);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 20)), grey);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.09, -0.01, 0);
    h.add(cup);
  }
  const mic = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6)), rubber);
  mic.rotation.set(0, 0, Math.PI / 2.6);
  mic.position.set(0.05, -0.05, 0.03);
  h.add(mic);
  return h;
}

function addChair(parent, x, z, ry, keep, P) {
  const c = new THREE.Group();
  c.position.set(x, 0, z);
  c.rotation.y = ry;
  parent.add(c);
  const part = (geo, mat, px, py, pz) => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.position.set(px, py, pz);
    c.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(0.46, 0.06, 0.44), P.seat, 0, 0.6, 0);
  const backrest = part(new THREE.BoxGeometry(0.46, 0.5, 0.05), P.seat, 0, 0.88, -0.22);
  backrest.rotation.x = -0.12;
  for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) part(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), P.grey, lx, 0.3, lz);
  return c;
}

// a coiled air line: a helix 0.9 m long hanging down, with a straight tail to a gun-sized end
function coilGeometry() {
  class Coil extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const turns = 14;
      const len = 0.9;
      if (t < 0.85) {
        const u = t / 0.85;
        const a = u * turns * Math.PI * 2;
        return target.set(Math.cos(a) * 0.075, -u * len, Math.sin(a) * 0.075);
      }
      const u = (t - 0.85) / 0.15;
      return target.set(0.075, -len - u * 0.5, 0);
    }
  }
  return new THREE.TubeGeometry(new Coil(), 420, 0.008, 6, false);
}

// ---------- screen drawings (the idle state; the page's HTML covers them when you look) ----------
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
const WIDE = '"Saira Variable", ui-sans-serif, system-ui';
const TEAL = '#00d2be';
function frame(c, w, h, title) {
  c.fillStyle = '#05070b';
  c.fillRect(0, 0, w, h);
  c.fillStyle = TEAL;
  c.fillRect(0, 0, w, h * 0.12);
  c.fillStyle = '#03201c';
  c.font = `italic 800 ${Math.round(h * 0.075)}px ${WIDE}`;
  c.textBaseline = 'middle';
  c.fillText(title, w * 0.03, h * 0.062);
}
function drawProjectIdle(i, seen) {
  return (c, w, h, k = 0) => {
    frame(c, w, h, `PROJECT 0${i + 1}`);
    // a trace that drifts, like a live channel
    c.strokeStyle = 'rgba(0,210,190,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const y = h * 0.62 + Math.sin(x * 0.02 + k * 1.3 + i) * h * 0.12 + Math.sin(x * 0.07 + k * 2.1) * h * 0.04;
      if (x === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    const p = PROJECTS[i];
    c.fillStyle = 'rgba(242,245,247,0.92)';
    c.font = `italic 800 ${Math.round(h * 0.085)}px ${WIDE}`;
    c.fillText(p ? p.title.toUpperCase() : '', w * 0.03, h * 0.26, w * 0.94);
    c.fillStyle = 'rgba(0,210,190,0.9)';
    c.font = `500 ${Math.round(h * 0.05)}px ${MONO}`;
    c.fillText(p ? p.kind.toUpperCase() : '', w * 0.03, h * 0.37, w * 0.94);
    c.fillStyle = 'rgba(242,245,247,0.45)';
    c.fillText(seen.has(i) ? 'SEEN · OPEN AGAIN' : 'LOOK TO OPEN', w * 0.03, h * 0.9);
    if (seen.has(i)) {
      // a check in the corner, like a ticked-off run plan
      const r = h * 0.07;
      const cx = w - r * 2.2;
      const cy = h * 0.24;
      c.fillStyle = TEAL;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#03201c';
      c.lineWidth = r * 0.32;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx - r * 0.45, cy + r * 0.02);
      c.lineTo(cx - r * 0.1, cy + r * 0.38);
      c.lineTo(cx + r * 0.5, cy - r * 0.35);
      c.stroke();
    }
  };
}
function drawClock(c, w, h, sec = 0) {
  c.fillStyle = '#f3efe6';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#e6dfd0';
  c.fillRect(w * 0.04, h * 0.12, w * 0.92, h * 0.76);
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor(sec / 60) % 60;
  const ss = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  c.fillStyle = hh >= 1 ? '#d8261c' : '#f07800';
  c.font = `700 ${Math.round(h * 0.62)}px ${MONO}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`${p(hh)}:${p(mm)}:${p(ss)}`, w / 2, h / 2 + h * 0.03);
  c.textAlign = 'start';
}
function drawMini(kind) {
  return (c, w, h, k = 0) => {
    c.fillStyle = '#05070b';
    c.fillRect(0, 0, w, h);
    if (kind === 'weather') {
      // a radar sweep with a band of rain that drifts across
      c.fillStyle = 'rgba(0,210,190,0.12)';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = ((i * 53 + k * 18) % (w + 80)) - 40;
        const y = (i * 37) % h;
        c.fillStyle = `rgba(80,160,255,${0.15 + (i % 5) * 0.08})`;
        c.beginPath();
        c.arc(x, y, 10 + (i % 4) * 6, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#f2f5f7';
      c.font = `600 ${Math.round(h * 0.13)}px ${MONO}`;
      c.fillText('RADAR · DRY 0%', w * 0.04, h * 0.18);
    } else {
      // the onboard view: a track map with a dot going round
      c.strokeStyle = 'rgba(242,245,247,0.7)';
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(w / 2, h / 2, w * 0.36, h * 0.3, 0.2, 0, Math.PI * 2);
      c.stroke();
      const a = k * 0.8;
      c.fillStyle = TEAL;
      c.beginPath();
      c.arc(w / 2 + Math.cos(a) * w * 0.36, h / 2 + Math.sin(a) * h * 0.3, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f2f5f7';
      c.font = `600 ${Math.round(h * 0.13)}px ${MONO}`;
      c.fillText('ONBOARD · KV 01', w * 0.04, h * 0.18);
    }
  };
}
function drawStandIdle(c, w, h) {
  frame(c, w, h, 'RADIO · CHANNEL 1');
  c.fillStyle = 'rgba(242,245,247,0.8)';
  c.font = `600 ${Math.round(h * 0.07)}px ${MONO}`;
  c.fillText('RADIO CHECK', w * 0.04, h * 0.3);
  c.fillStyle = 'rgba(242,245,247,0.5)';
  c.font = `500 ${Math.round(h * 0.055)}px ${MONO}`;
  c.fillText('PUT THE HEADSET ON TO LISTEN', w * 0.04, h * 0.42);
  c.strokeStyle = 'rgba(255,69,58,0.8)';
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 0; x < w; x += 3) {
    const y = h * 0.7 + (Math.sin(x * 0.3) * Math.sin(x * 0.013)) * h * 0.12;
    if (x === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
}
function drawTvIdle(c, w, h) {
  frame(c, w, h, 'TIMING · BOX 01');
  const rows = ['KV  YOU', '— —', '— —', '— —', '— —'];
  c.font = `600 ${Math.round(h * 0.05)}px ${MONO}`;
  rows.forEach((r, i) => {
    const y = h * (0.22 + i * 0.1);
    if (i % 2 === 0) {
      c.fillStyle = 'rgba(255,255,255,0.04)';
      c.fillRect(w * 0.03, y - h * 0.04, w * 0.4, h * 0.08);
    }
    c.fillStyle = i === 0 ? TEAL : 'rgba(242,245,247,0.35)';
    c.fillRect(w * 0.04, y - h * 0.025, 4, h * 0.05);
    c.fillStyle = 'rgba(242,245,247,0.85)';
    c.fillText(`${String(i + 1).padStart(2, '0')}  ${r}`, w * 0.06, y);
  });
  c.fillStyle = 'rgba(242,245,247,0.5)';
  c.fillText('LAP · YOUR DRIVE IN', w * 0.5, h * 0.22);
}
function drawBoard(c, w, h, lines = ['P1', 'KV', 'BOX', '+0.0']) {
  c.fillStyle = '#0b0d10';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#f2f5f7';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((l, i) => {
    const size = Math.min(h / (n + 0.6), (w * 1.5) / Math.max(2, l.length));
    c.font = `800 ${Math.round(size * 0.8)}px ${WIDE}`;
    c.fillStyle = i === 0 ? '#ffd60a' : '#f2f5f7';
    c.fillText(l.toUpperCase(), w / 2, (h * (i + 0.8)) / (n + 0.6));
  });
  c.textAlign = 'start';
}
function drawGithub(c, w, h, data) {
  frame(c, w, h, 'COMMITS · GITHUB');
  const days = data?.days || [];
  if (!days.length) {
    c.fillStyle = 'rgba(242,245,247,0.5)';
    c.font = `600 ${Math.round(h * 0.06)}px ${MONO}`;
    c.fillText(data === undefined ? 'TUNING IN…' : 'NO SIGNAL FROM GITHUB', w * 0.04, h * 0.5);
    return;
  }
  // the calendar: weeks as columns (sunday on top), five teal steps
  const weeks = Math.ceil((days.length + new Date(days[0].date).getUTCDay()) / 7);
  const gap = 2;
  const cell = Math.floor(Math.min((w * 0.92) / weeks - gap, (h * 0.46) / 7 - gap));
  const x0 = (w - weeks * (cell + gap)) / 2;
  const y0 = h * 0.2;
  const STEPS = ['#14181d', '#0b4a43', '#0b7a6d', '#06a896', '#00d2be'];
  const offset = new Date(days[0].date).getUTCDay();
  days.forEach((d, i) => {
    const k = i + offset;
    c.fillStyle = STEPS[Math.min(4, d.level)];
    c.fillRect(x0 + Math.floor(k / 7) * (cell + gap), y0 + (k % 7) * (cell + gap), cell, cell);
  });
  c.fillStyle = '#f2f5f7';
  c.font = `italic 800 ${Math.round(h * 0.075)}px ${WIDE}`;
  c.fillText(`${data.total} CONTRIBUTIONS · LAST 12 MONTHS`, w * 0.04, h * 0.8);
  const last = data.commits?.[0];
  if (last) {
    c.fillStyle = 'rgba(0,210,190,0.9)';
    c.font = `500 ${Math.round(h * 0.045)}px ${MONO}`;
    c.fillText(`LATEST · ${last.repo.toUpperCase()} · ${last.message.toUpperCase()}`, w * 0.04, h * 0.91, w * 0.92);
  }
}
function drawWarmer(c, w, h, temp = 80, cooling = false) {
  c.fillStyle = '#0d0a05';
  c.fillRect(0, 0, w, h);
  // amber when hot, cooling toward blue as the heat gets out
  const k = Math.max(0, Math.min(1, (80 - temp) / 20));
  const mix = (a, b) => Math.round(a + (b - a) * k);
  c.fillStyle = `rgb(${mix(255, 110)}, ${mix(168, 180)}, ${mix(40, 255)})`; // (straight across, no green on the way)
  c.font = `700 ${Math.round(h * 0.5)}px ${MONO}`;
  c.textBaseline = 'middle';
  c.fillText(`${Math.round(temp)}°C`, w * 0.07, h * 0.42);
  c.fillStyle = 'rgba(242,245,247,0.6)';
  c.font = `600 ${Math.round(h * 0.15)}px ${MONO}`;
  c.fillText(cooling ? 'LID OPEN · COOLING' : 'BLANKETS · FRONT', w * 0.07, h * 0.82);
}
function drawRadio(c, w, h, label = 'KV FM') {
  c.fillStyle = '#041512';
  c.fillRect(0, 0, w, h);
  c.fillStyle = label === 'OFF' ? 'rgba(0,210,190,0.35)' : TEAL;
  c.font = `700 ${Math.round(h * 0.42)}px ${MONO}`;
  c.textBaseline = 'middle';
  c.fillText(label, w * 0.07, h * 0.5);
}
function drawTyreBoard(c, w, h) {
  c.fillStyle = '#f3f4f6';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#0b0d10';
  c.font = `italic 800 ${Math.round(h * 0.1)}px ${WIDE}`;
  c.fillText('TYRE ALLOCATION', w * 0.06, h * 0.16);
  const sets = [['S', '#e8302a', 8], ['M', '#f2c200', 3], ['H', '#e9ecef', 2]];
  sets.forEach(([l, col, n], i) => {
    const cx = w * (0.2 + i * 0.3);
    const cy = h * 0.55;
    c.fillStyle = '#121214';
    c.beginPath();
    c.arc(cx, cy, h * 0.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = col;
    c.lineWidth = h * 0.035;
    c.beginPath();
    c.arc(cx, cy, h * 0.15, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#f2f5f7';
    c.font = `800 ${Math.round(h * 0.13)}px ${WIDE}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(l, cx, cy + 2);
    c.fillStyle = '#0b0d10';
    c.font = `700 ${Math.round(h * 0.08)}px ${MONO}`;
    c.fillText(`× ${n}`, cx, h * 0.88);
    c.textAlign = 'start';
    c.textBaseline = 'alphabetic';
  });
}
