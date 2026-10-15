import * as THREE from 'three';
import { carbonTexture, canvasTexture, fabricTexture, taperedTube } from './geometry.js';

// The published steering wheel, built in code (no model files): a 2020-era F1 wheel in its usual
// form. Carbon body with raised top corners, rubber grips down the outer edges, a gloss bezel
// holding the display, the shift-light slot above it, a few unassigned buttons for realism and a
// KV emblem where a team badge would sit. The working buttons and knobs are added by controls.js
// at car.controlSpots, which match the local model's layout, so both wheels drive the same way.
//
// Pivot space: x = the driver's left, y up, the face looks back at the driver (−z). Metres.
const FACE = -0.0275; // the display's surface (the frontmost face)

// a smooth closed outline through the given half-points (x ≥ 0), mirrored across x = 0
function mirroredShape(half) {
  const pts = [...half.map(([x, y]) => new THREE.Vector2(x, y)), ...half.slice(1, -1).reverse().map(([x, y]) => new THREE.Vector2(-x, y))];
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  s.splineThru([...pts.slice(1), pts[0]]);
  return s;
}
function roundedRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
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
// extrude a shape so its front face sits at z = front, `depth` deep toward +z
function slab(shape, depth, front, { bevel = 0.0015, segs = 2, curve = 48 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: curve });
  g.translate(0, 0, front + bevel);
  return g;
}

export function buildWheelModel() {
  const pivot = new THREE.Group();
  pivot.name = 'steer';
  pivot.position.set(0, 0.605, 0.33);

  const carbon = carbonTexture('#0d0e11');
  carbon.repeat.set(70, 70); // extrude UVs are in metres: a ~1.4cm twill
  const rubberBump = fabricTexture();
  rubberBump.repeat.set(40, 40);
  const own = [carbon, rubberBump];
  const mats = {
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x24272c, map: carbon, roughness: 0.42, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    face: new THREE.MeshPhysicalMaterial({ color: 0x1a1c20, map: carbon, roughness: 0.38, metalness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    rubber: new THREE.MeshPhysicalMaterial({ color: 0x1c2026, roughness: 0.6, sheen: 0.35, sheenColor: new THREE.Color(0x58606c), bumpMap: rubberBump, bumpScale: 0.4 }),
    bezel: new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 }),
    slot: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x8d939b, roughness: 0.35, metalness: 1 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.45, metalness: 0.2 }),
    collar: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.6 }),
  };

  // ---- body: the whole silhouette, top corners raised ----
  const body = new THREE.Mesh(
    slab(
      mirroredShape([
        // (narrower down the sides: the grips form the outer edge there)
        [0, 0.076], [0.05, 0.077], [0.085, 0.079], [0.105, 0.0845], [0.123, 0.0845], [0.137, 0.077], [0.141, 0.06],
        [0.132, 0.03], [0.128, -0.03], [0.122, -0.06], [0.113, -0.074], [0.103, -0.077], [0.096, -0.07], [0.092, -0.062],
        [0.08, -0.06], [0.04, -0.064], [0, -0.066],
      ]),
      0.028,
      -0.016,
      { bevel: 0.004, segs: 3 }
    ),
    mats.carbon
  );
  body.name = 'wheel-body';
  pivot.add(body);

  // ---- face plate: a raised centre panel the display and buttons sit on ----
  const face = new THREE.Mesh(
    slab(mirroredShape([[0, 0.069], [0.06, 0.07], [0.084, 0.065], [0.091, 0.045], [0.091, -0.028], [0.086, -0.051], [0.06, -0.058], [0, -0.06]]), 0.004, -0.0235, { bevel: 0.0012 }),
    mats.face
  );
  face.name = 'wheel-face';
  pivot.add(face);

  // ---- rubber grips: sculpted handles down the outer edges, growing out of the carbon at the top
  // corners (which stay carbon, for the big knobs) and rounded off at the bottom ----
  const grips = [];
  for (const s of [1, -1]) {
    const spine = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.122, 0.036, -0.002),
      new THREE.Vector3(s * 0.125, 0.01, -0.009),
      new THREE.Vector3(s * 0.123, -0.025, -0.01),
      new THREE.Vector3(s * 0.117, -0.057, -0.008),
      new THREE.Vector3(s * 0.108, -0.074, -0.004),
    ]);
    const r = (t) => 0.024 * Math.min(1, 0.45 + t * 3); // grows out of the top corner, full by a third of the way down
    const g = new THREE.Mesh(taperedTube(spine, { segments: 48, radial: 24, radiusAt: r }), mats.rubber);
    g.scale.set(1, 1, 1.12); // a little deeper than wide, like a real handle
    g.name = 'wheel-grip';
    pivot.add(g);
    grips.push(g);
  }

  // ---- the display in its gloss bezel, and the shift-light slot above ----
  const bezel = new THREE.Mesh(slab(roundedRect(0.113, 0.071, 0.006, 0, 0.026), 0.003, -0.0262, { bevel: 0.0008 }), mats.bezel);
  pivot.add(bezel);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.0974, 0.0571), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  lcd.position.set(0, 0.026, FACE);
  lcd.rotation.y = Math.PI; // faces the driver
  lcd.name = 'lcd';
  pivot.add(lcd);
  const slot = new THREE.Mesh(slab(roundedRect(0.122, 0.009, 0.0045, 0, 0.0655), 0.002, -0.0252, { bevel: 0.0005 }), mats.slot);
  pivot.add(slot);
  const leds = [];
  const ledGeo = new THREE.SphereGeometry(0.0024, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2); // little domes facing the driver
  own.push(ledGeo);
  for (let i = 0; i < 15; i++) {
    const m = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({ color: 0x1b1d20, emissive: 0x000000, roughness: 0.25 }));
    m.position.set(0.0525 - i * 0.0075, 0.0655, -0.0262);
    m.name = `LED_RPM_${i}`;
    pivot.add(m);
    leds.push(m);
  }

  // ---- unassigned buttons (every real wheel has more than you'd use in a pit garage) ----
  const capGeo = new THREE.CylinderGeometry(0.0036, 0.004, 0.003, 24).rotateX(-Math.PI / 2);
  const collarGeo = new THREE.CylinderGeometry(0.0052, 0.0055, 0.0016, 24).rotateX(Math.PI / 2);
  own.push(capGeo, collarGeo);
  // [x, y, the surface's z]: the face plate is at −0.0235, the body at −0.016
  for (const [x, y, z] of [
    [0.0832, -0.0382, -0.0235],
    [0.097, 0.066, -0.016], [-0.097, 0.066, -0.016], // the top corners, either side of the shift lights
    [0.106, 0.075, -0.016], [-0.106, 0.075, -0.016],
    [0.085, 0.045, -0.0235], [-0.085, 0.045, -0.0235], // beside the display
    [0.086, 0.008, -0.0235], [-0.086, 0.008, -0.0235],
  ]) {
    const collar = new THREE.Mesh(collarGeo, mats.collar);
    collar.position.set(x, y, z - 0.0008);
    const cap = new THREE.Mesh(capGeo, mats.cap);
    cap.position.set(x, y, z - 0.0031);
    pivot.add(collar, cap);
  }

  // ---- a KV emblem at the foot of the face, where a team badge would go ----
  const badge = canvasTexture(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#00d2be';
    g.font = '700 46px "Nohemi", ui-sans-serif, system-ui';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KV', w / 2, h / 2 + 2);
  });
  own.push(badge);
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.006), new THREE.MeshBasicMaterial({ map: badge, transparent: true, toneMapped: false }));
  emblem.position.set(0, -0.052, -0.0249);
  emblem.rotation.y = Math.PI;
  pivot.add(emblem);

  // ---- paddles behind the grips, the hub and the column into the dash ----
  for (const s of [-1, 1]) {
    const paddle = new THREE.Mesh(slab(roundedRect(0.07, 0.05, 0.008), 0.003, 0.016, { bevel: 0.001 }), mats.carbon);
    paddle.position.set(s * 0.085, 0.03, 0);
    paddle.rotation.y = s * 0.12;
    pivot.add(paddle);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.016, 32).rotateX(Math.PI / 2), mats.alu);
  hub.position.set(0, 0, 0.022);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.2, 20).rotateX(Math.PI / 2), mats.alu);
  column.position.set(0, 0, 0.13);
  pivot.add(hub, column);

  return {
    pivot,
    leds,
    lcd,
    surfaces: [body, face], // what the working buttons sit on
    width: 0.288,
    height: 0.1665,
    face: FACE,
    // where the hands go (pivot space), for the gloves
    grips: [1, -1].map((s) => ({
      center: new THREE.Vector3(s * 0.122, -0.022, 0.002),
      up: new THREE.Vector3(0, 1, 0),
      out: new THREE.Vector3(s, 0, 0),
      back: new THREE.Vector3(0, 0, 1),
      radius: 0.019,
    })),
    dispose() {
      pivot.traverse((o) => o.geometry?.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      leds.forEach((l) => l.material.dispose());
      emblem.material.dispose();
      own.forEach((x) => x.dispose());
    },
  };
}
