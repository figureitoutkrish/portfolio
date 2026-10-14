import * as THREE from 'three';
import { loft, superRing, taperedTube, canvasTexture, carbonTexture } from './geometry.js';

// The cockpit built in code (what the published site shows; a real model replaces it when one is
// present, see car.js). Only what the driver can see is modelled: the tub and its rim, nose,
// front tyres and arms, mirrors and the steering wheel. Car space: +z forward, +x the driver's
// left, y up, ground at 0, in metres (sized like a 2020 car).
const TEAL = 0x00d2be;

export function buildFallbackCar() {
  const car = new THREE.Group();
  car.name = 'car';
  const carbon = carbonTexture();
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0x15171b, roughness: 0.45, metalness: 0.2, clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x1a1c20, map: carbon, roughness: 0.38, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.75 }),
    teal: new THREE.MeshPhysicalMaterial({ color: TEAL, roughness: 0.3, clearcoat: 1, emissive: TEAL, emissiveIntensity: 0.06 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.3, metalness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1 }),
  };

  // ---- nose: lofted forward from the front bulkhead to the tip ----
  const noseSections = [
    [0.6, 0.57, 0.5, 0.28],
    [0.9, 0.55, 0.42, 0.27],
    [1.2, 0.52, 0.35, 0.25],
    [1.5, 0.46, 0.29, 0.22],
    [2.0, 0.37, 0.22, 0.17],
    [2.45, 0.3, 0.15, 0.11],
    [2.55, 0.28, 0.08, 0.07],
  ].map(([z, cy, w, h]) => superRing(0, cy, z, w, h, { k: 3.2, n: 32, flatBottom: 0.2 }));
  const nose = new THREE.Mesh(loft(noseSections, { closeEnd: true }), mats.paint);
  car.add(nose);
  // a teal pinstripe down the nose's spine, like the 2020 livery
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.712, 0.62),
    new THREE.Vector3(0.0, 0.69, 0.9),
    new THREE.Vector3(0.0, 0.648, 1.2),
    new THREE.Vector3(0.0, 0.574, 1.5),
    new THREE.Vector3(0.0, 0.457, 2.0),
  ]);
  for (const side of [-1, 1]) {
    const stripe = new THREE.CatmullRomCurve3(spine.points.map((p, i) => p.clone().add(new THREE.Vector3(side * (0.075 - i * 0.012), -0.004 - i * 0.004, 0))));
    car.add(new THREE.Mesh(taperedTube(stripe, { segments: 40, radial: 6, radiusAt: () => 0.0045, roundTip: false }), mats.teal));
  }

  // ---- tub: a deck around the cockpit opening (top view outline with a hole), extruded down ----
  const deck = new THREE.Shape();
  // outline in (x, -z): from the back of the cockpit to the front bulkhead
  const outline = [
    [-0.46, 0.9], [-0.48, 0.3], [-0.42, -0.2], [-0.3, -0.5], [-0.26, -0.62],
    [0.26, -0.62], [0.3, -0.5], [0.42, -0.2], [0.48, 0.3], [0.46, 0.9],
  ];
  deck.moveTo(outline[0][0], outline[0][1]);
  outline.slice(1).forEach(([x, y]) => deck.lineTo(x, y));
  deck.closePath();
  const hole = new THREE.Path();
  hole.absellipse(0, 0.12, 0.25, 0.62, 0, Math.PI * 2, false, 0); // runs forward past the wheel
  deck.holes.push(hole);
  const deckGeo = new THREE.ExtrudeGeometry(deck, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 4, curveSegments: 48 });
  deckGeo.rotateX(-Math.PI / 2);
  const tub = new THREE.Mesh(deckGeo, mats.paint);
  tub.position.y = 0.42;
  car.add(tub);
  // the padded rim around the opening (where the headrest foam meets the deck)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 10, 64), mats.matte);
  rim.scale.set(0.25, 0.62, 1);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, 0.78, -0.12);
  car.add(rim);
  // the dash between the wheel and the nose (what you see behind the wheel)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.14), mats.matte);
  dash.position.set(0, 0.6, 0.56);
  car.add(dash);

  // ---- sidepods, low on either side ----
  for (const side of [-1, 1]) {
    const pod = loft(
      [
        [0.25, 0.48, 0.18, 0.2],
        [0.0, 0.52, 0.4, 0.34],
        [-0.6, 0.52, 0.44, 0.38],
        [-1.4, 0.45, 0.34, 0.3],
        [-2.0, 0.38, 0.18, 0.18],
      ].map(([z, cy, w, h]) => superRing(side * 0.66, cy, z, w, h, { k: 2.6, n: 24 })),
      { closeStart: true, closeEnd: true }
    );
    car.add(new THREE.Mesh(pod, mats.paint));
  }

  // (no halo: it's the one thing between the driver and the view; the view comes first)

  // ---- front tyres, rims and suspension ----
  const sidewall = canvasTexture(512, 512, (g, w) => {
    g.fillStyle = '#121214';
    g.fillRect(0, 0, w, w);
    const c = w / 2;
    g.lineWidth = 10;
    g.strokeStyle = '#e8c400'; // medium compound
    g.beginPath();
    g.arc(c, c, w * 0.42, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e8e8e8';
    g.font = '600 34px ui-sans-serif, system-ui';
    g.textAlign = 'center';
    for (let i = 0; i < 2; i++) {
      g.save();
      g.translate(c, c);
      g.rotate(i * Math.PI);
      g.fillText('K V', 0, -w * 0.33);
      g.restore();
    }
  });
  const tyreMats = [
    new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: sidewall, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: sidewall, roughness: 0.85 }),
  ];
  for (const side of [-1, 1]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.36, 48, 1), tyreMats);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(side * 0.8, 0.33, 1.45);
    tyre.name = side > 0 ? 'tyre_fl' : 'tyre_fr';
    car.add(tyre);
    const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.37, 32), mats.matte);
    rimMesh.rotation.z = Math.PI / 2;
    rimMesh.position.copy(tyre.position);
    car.add(rimMesh);
    // wishbones: thin aero-section tubes from the chassis to the hub
    for (const [y0, y1, z0] of [[0.56, 0.48, 1.25], [0.4, 0.26, 1.3], [0.58, 0.47, 1.62]]) {
      const arm = new THREE.LineCurve3(new THREE.Vector3(side * 0.16, y0, z0), new THREE.Vector3(side * 0.62, y1, 1.45));
      const m = new THREE.Mesh(taperedTube(arm, { segments: 2, radial: 8, radiusAt: () => 0.012, roundTip: false }), mats.carbon);
      car.add(m);
    }
  }

  // ---- front wing endplates (the bits that show past the nose) ----
  for (const side of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.6), mats.carbon);
    plate.position.set(side * 0.95, 0.2, 2.25);
    car.add(plate);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.012, 0.3), mats.paint);
    flap.position.set(side * 0.55, 0.22 + 0.05, 2.2);
    flap.rotation.x = -0.25;
    car.add(flap);
    const flapTeal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.006, 0.04), mats.teal);
    flapTeal.position.set(side * 0.55, 0.31, 2.08);
    flapTeal.rotation.x = -0.25;
    car.add(flapTeal);
  }

  // ---- mirrors on stalks ----
  for (const side of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.09, 6, 16), mats.paint);
    housing.rotation.z = Math.PI / 2;
    housing.position.set(side * 0.5, 0.77, 0.32);
    car.add(housing);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), mats.mirror);
    glass.position.set(side * 0.5, 0.77, 0.289);
    glass.rotation.y = Math.PI; // faces the driver
    car.add(glass);
    const stalk = new THREE.LineCurve3(new THREE.Vector3(side * 0.42, 0.72, 0.36), new THREE.Vector3(side * 0.47, 0.77, 0.33));
    car.add(new THREE.Mesh(taperedTube(stalk, { segments: 2, radial: 6, radiusAt: () => 0.008, roundTip: false }), mats.carbon));
  }

  const wheel = buildWheel();
  car.add(wheel.pivot);

  return {
    group: car,
    steer: wheel.pivot,
    leds: wheel.leds,
    lcdMesh: wheel.lcd,
    // grips in the steering pivot's space (for the gloves)
    grips: [1, -1].map((s) => ({
      center: new THREE.Vector3(s * 0.128, -0.005, 0.004),
      up: new THREE.Vector3(0, 1, 0),
      out: new THREE.Vector3(s, 0, 0),
      back: new THREE.Vector3(0, 0, 1),
      radius: 0.018,
    })),
    wheelWidth: 0.304,
    wheelHeight: 0.17,
    wheelFace: 0.315,
    wheelSurfaces: [wheel.body],
    controlSpots: {
      mode: [0.095, 0.052, 0.0085],
      scroll: [-0.095, 0.052, 0.0085],
      prev: [0.075, 0.012, 0.0058],
      next: [-0.075, 0.012, 0.0058],
      back: [0.08, -0.02, 0.006],
      ok: [-0.08, -0.02, 0.0068],
      talk: [0.035, -0.043, 0.0058],
      drs: [0, -0.046, 0.0058],
      drink: [-0.035, -0.043, 0.0058],
      pit: [-0.1, -0.052, 0.006],
    },
    eye: new THREE.Vector3(0, 0.99, -0.2),
    dispose() {
      car.traverse((o) => o.geometry?.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      tyreMats.forEach((m) => m.dispose());
      carbon.dispose();
      sidewall.dispose();
      wheel.dispose();
    },
  };
}

// ---- the steering wheel: carbon body, rubber grips, display, 15 shift lights, buttons, rotaries,
// paddles. Built around a pivot at the wheel's centre; the face looks back at the driver (−z).
function buildWheel() {
  const pivot = new THREE.Group();
  pivot.name = 'steer';
  pivot.position.set(0, 0.6, 0.33);
  pivot.rotation.x = -0.06; // column tilt

  const carbon = carbonTexture('#0e0f12');
  carbon.repeat.set(3, 3);
  const mats = {
    body: new THREE.MeshPhysicalMaterial({ color: 0x1b1d21, map: carbon, roughness: 0.32, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.95 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x8d939b, roughness: 0.35, metalness: 1 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.5 }),
  };

  // body outline (symmetric), extruded 3.5cm deep
  const half = [
    [0, 0.074], [0.085, 0.074], [0.118, 0.066], [0.142, 0.05], [0.152, 0.0], [0.146, -0.058],
    [0.124, -0.084], [0.1, -0.072], [0.076, -0.052], [0.04, -0.06], [0, -0.062],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(-half[0][0], half[0][1]);
  [...half.slice(1)].forEach(([x, y]) => shape.lineTo(x, y));
  [...half].reverse().slice(1).forEach(([x, y]) => shape.lineTo(-x, y));
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3 });
  const body = new THREE.Mesh(bodyGeo, mats.body);
  body.position.z = 0.0; // face at z = -0.006 (bevel), back at 0.036
  pivot.add(body);

  // rubber grips
  for (const s of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, 0.085, 8, 18), mats.grip);
    g.position.set(s * 0.128, -0.005, 0.012);
    g.scale.set(1, 1, 1.25);
    pivot.add(g);
  }

  // display, set into a bezel
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.07, 0.006), mats.dark);
  bezel.position.set(0, 0.016, -0.008);
  pivot.add(bezel);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05625), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  lcd.position.set(0, 0.016, -0.0115);
  lcd.rotation.y = Math.PI;
  lcd.name = 'lcd';
  pivot.add(lcd);

  // 15 shift lights along the top edge: left (+x) to right
  const leds = [];
  const ledGeo = new THREE.BoxGeometry(0.0055, 0.0045, 0.003);
  for (let i = 0; i < 15; i++) {
    const m = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, roughness: 0.3 }));
    m.position.set(0.0525 - i * 0.0075, 0.06, -0.008);
    m.name = `LED_RPM_${i}`;
    pivot.add(m);
    leds.push(m);
  }

  // (the buttons and rotaries are the working controls: controls.js, placed by car.controlSpots)

  // shift paddles behind the grips, and the column into the dash
  for (const s of [-1, 1]) {
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.004), mats.body);
    paddle.position.set(s * 0.095, 0.03, 0.048);
    paddle.rotation.y = s * 0.15;
    pivot.add(paddle);
  }
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.2, 20), mats.alu);
  column.rotation.x = Math.PI / 2;
  column.position.set(0, 0, 0.13);
  pivot.add(column);

  return {
    pivot,
    body,
    leds,
    lcd,
    dispose() {
      pivot.traverse((o) => o.geometry?.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      leds.forEach((l) => l.material.dispose());
      carbon.dispose();
    },
  };
}
