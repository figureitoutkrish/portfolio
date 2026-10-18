import * as THREE from 'three';
import { loft, superRing, taperedTube, canvasTexture, carbonTexture } from './geometry.js';
import { buildWheelModel } from './wheel-model.js';
import { addCarBody } from './car-body.js';

// The car built in code (what the published site shows; a real model replaces it when one is
// present, see car.js). This file is the cockpit: the tub and its rim, nose, front tyres and arms,
// mirrors and the steering wheel; car-body.js adds the rest for when you walk round it. Car space: +z forward, +x the driver's
// left, y up, ground at 0, in metres (sized like a 2020 car).
const TEAL = 0x00d2be;

// One chassis cross-section (a closed ring, counter-clockwise like superRing). open = 1 gives a U:
// outer walls, a lip, inner walls down to the cockpit floor; open = 0 closes the top, gently domed.
function chassisRing(z, w, top, open, xo, bottom) {
  const floor = 0.14;
  const h = top - bottom;
  const mix = (a, b, t) => a + (b - a) * t;
  const R = [
    [0, bottom],
    [0.3 * w, bottom],
    [0.46 * w, bottom + 0.15 * h],
    [0.5 * w, bottom + 0.5 * h],
    [0.47 * w, top - 0.08 * h],
    [0.4 * w, top - 0.006],
    [Math.min(0.4 * w - 0.01, xo + 0.04), top],
    [xo + 0.012, top - 0.002 - 0.01 * open],
    [xo, top - 0.03 * open],
    [xo - 0.012 * open, mix(top, floor + 0.08, open)],
    [xo * 0.65, mix(top + 0.008, floor + 0.01, open)],
    [0, mix(top + 0.012, floor, open)],
  ];
  const ring = [...R, ...R.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
  return ring.map(([x, y]) => new THREE.Vector3(x, y, z));
}

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

  // ---- chassis: one lofted body from behind the driver to the nose tip. Around the driver the
  // sections are a U (side walls, an opening, inner walls down to a deep floor); ahead of the
  // wheel they close into a low front deck you look over, then narrow and fall away into the
  // nose. [z, width, top height, open (1 = cockpit opening, 0 = closed), opening half-width, bottom]
  const SECTIONS = [
    [-0.86, 0.78, 0.8, 0, 0.2, 0.1],
    [-0.76, 0.86, 0.81, 1, 0.21, 0.1],
    [-0.4, 0.9, 0.8, 1, 0.25, 0.1],
    [0.0, 0.88, 0.785, 1, 0.255, 0.1],
    [0.25, 0.78, 0.76, 1, 0.245, 0.1],
    [0.42, 0.64, 0.73, 0.75, 0.215, 0.11],
    [0.55, 0.54, 0.715, 0.2, 0.18, 0.12],
    [0.65, 0.5, 0.705, 0, 0.16, 0.13],
    [0.9, 0.42, 0.68, 0, 0.14, 0.15],
    [1.2, 0.36, 0.64, 0, 0.12, 0.17],
    [1.5, 0.3, 0.58, 0, 0.1, 0.19],
    [2.0, 0.23, 0.47, 0, 0.08, 0.21],
    [2.45, 0.16, 0.37, 0, 0.05, 0.23],
    [2.56, 0.09, 0.32, 0, 0.03, 0.25],
  ];
  const chassis = new THREE.Mesh(loft(SECTIONS.map((p) => chassisRing(...p)), { closeStart: true, closeEnd: true }), mats.paint);
  chassis.name = 'chassis';
  car.add(chassis);
  // teal pinstripes: along the cockpit rim on each side, and two down the nose (2020 livery)
  for (const side of [-1, 1]) {
    const rimLine = new THREE.CatmullRomCurve3(SECTIONS.filter((p) => p[3] > 0.5).map(([z, , top, , xo]) => new THREE.Vector3(side * (xo + 0.012), top + 0.001, z)));
    car.add(new THREE.Mesh(taperedTube(rimLine, { segments: 60, radial: 6, radiusAt: () => 0.0042, roundTip: false }), mats.teal));
    const noseLine = new THREE.CatmullRomCurve3(SECTIONS.filter((p) => p[0] >= 0.65 && p[0] <= 2.0).map(([z, , top], i) => new THREE.Vector3(side * (0.055 - i * 0.008), top + 0.012 - i * 0.001, z)));
    car.add(new THREE.Mesh(taperedTube(noseLine, { segments: 60, radial: 6, radiusAt: () => 0.0042, roundTip: false }), mats.teal));
  }

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
  // each front wheel: a steering pivot (the kingpin) holding a rolling group (tyre + rim)
  const wheels = { steer: [], spin: [] };
  for (const side of [-1, 1]) {
    const kingpin = new THREE.Group();
    kingpin.position.set(side * 0.71, 0.33, 1.44);
    const roll = new THREE.Group();
    roll.position.set(side * 0.09, 0, 0);
    kingpin.add(roll);
    car.add(kingpin);
    wheels.steer.push(kingpin);
    wheels.spin.push(roll);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.36, 48, 1), tyreMats);
    tyre.rotation.z = Math.PI / 2;
    tyre.name = side > 0 ? 'tyre_fl' : 'tyre_fr';
    const rimMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.37, 32), mats.matte);
    rimMesh.rotation.z = Math.PI / 2;
    roll.add(tyre, rimMesh);
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

  // the rest of the car, seen when you get out (engine cover, floor, rear wheels, wings, halo)
  const body = addCarBody(car, mats, { tyreMats, wheels });

  const wheel = buildWheelModel();
  car.add(wheel.pivot);

  return {
    group: car,
    steer: wheel.pivot,
    leds: wheel.leds,
    lcdMesh: wheel.lcd,
    grips: wheel.grips,
    wheelWidth: wheel.width,
    wheelHeight: wheel.height,
    wheelFace: wheel.pivot.position.z + wheel.face,
    wheelSurfaces: wheel.surfaces,
    // the same layout as the local model's wheel (see car.js), so both drive identically
    controlSpots: {
      mode: [0.1136, 0.0487, 0.0068],
      scroll: [-0.1136, 0.0487, 0.0068],
      prev: [0.0739, 0.0235, 0.0046],
      next: [-0.0739, 0.0235, 0.0046],
      back: [0.0818, -0.0082, 0.0049],
      ok: [-0.0818, -0.0082, 0.0055],
      talk: [0.038, -0.0385, 0.0052],
      overtake: [0, -0.0377, 0.0052],
      drink: [-0.038, -0.0385, 0.0052],
      pit: [-0.0832, -0.0382, 0.0046],
    },
    eye: new THREE.Vector3(0, 0.99, -0.2),
    wheels,
    halo: body.halo,
    setAero: body.setAero,
    dispose() {
      car.traverse((o) => o.geometry?.dispose());
      body.dispose();
      Object.values(mats).forEach((m) => m.dispose());
      tyreMats.forEach((m) => m.dispose());
      carbon.dispose();
      sidewall.dispose();
      wheel.dispose();
    },
  };
}
