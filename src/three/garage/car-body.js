import * as THREE from 'three';
import { loft, superRing, taperedTube, canvasTexture } from './geometry.js';

// The rest of the code-built car, for when you're out of it and walking round it in the garage
// (the cockpit in cockpit-fallback.js is only what the driver sees). Built to a 2026 car's look:
// narrower body, the engine cover tapering to a small crash structure, a flat floor, rear tyres on
// the same rig as the fronts, and active-aero wings (the rear flap opens on straights, X-mode).
// The halo is part of every car since 2018: it shows from outside and is hidden only from the
// driver's seat, where the view comes first. Car space: +z forward, +x the driver's left, y up.
export function addCarBody(car, mats, { tyreMats, wheels }) {
  const geos = [];
  const local = []; // materials and textures made here
  const mesh = (geo, mat, parent = car) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };

  // ---- engine cover: from the airbox over the driver's head down to the crash structure ----
  const cover = loft(
    [
      [-0.72, 0.88, 0.3, 0.24],
      [-0.9, 0.86, 0.4, 0.32],
      [-1.3, 0.76, 0.5, 0.44],
      [-1.9, 0.62, 0.44, 0.42],
      [-2.5, 0.5, 0.26, 0.28],
      [-2.95, 0.44, 0.14, 0.14],
      [-3.08, 0.43, 0.1, 0.1],
    ].map(([z, cy, w, h]) => superRing(0, cy, z, w, h, { k: 2.4, n: 28 })),
    { closeStart: true, closeEnd: true }
  );
  mesh(cover, mats.paint);
  // the airbox intake: a dark mouth above the driver's head
  const intake = mesh(new THREE.CircleGeometry(0.1, 24), mats.matte);
  intake.scale.set(1, 0.8, 1);
  intake.position.set(0, 0.92, -0.715);
  // a teal spine down the cover, the team's line
  const spine = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.005, -0.78),
    new THREE.Vector3(0, 0.99, -1.2),
    new THREE.Vector3(0, 0.84, -1.9),
    new THREE.Vector3(0, 0.65, -2.5),
    new THREE.Vector3(0, 0.51, -2.95),
  ]);
  mesh(taperedTube(spine, { segments: 60, radial: 6, radiusAt: () => 0.006, roundTip: false }), mats.teal);
  // the rain light at the tail
  const rainMat = new THREE.MeshBasicMaterial({ color: 0x5a0a0a, toneMapped: false });
  local.push(rainMat);
  const rain = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), rainMat);
  rain.position.set(0, 0.4, -3.1);

  // number and team on the cover's flanks
  const flank = canvasTexture(512, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#e8ecf1';
    c.font = 'italic 800 132px "Saira Variable", ui-sans-serif, system-ui';
    c.textBaseline = 'middle';
    c.fillText('01', 10, h / 2 + 6);
    c.fillStyle = '#00d2be';
    c.font = 'italic 800 64px "Saira Variable", ui-sans-serif, system-ui';
    c.fillText('KV', 210, h / 2 + 4);
  });
  local.push(flank);
  const flankMat = new THREE.MeshBasicMaterial({ map: flank, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  local.push(flankMat);
  for (const side of [-1, 1]) {
    const d = mesh(new THREE.PlaneGeometry(0.42, 0.16), flankMat);
    d.position.set(side * 0.235, 0.74, -1.45);
    d.rotation.y = side * (Math.PI / 2 + 0.1); // each faces out, so it reads the right way from its side
  }

  // ---- floor: the flat plate the car runs on, with the plank under it ----
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.55, 1.05);
  floorShape.lineTo(0.55, 1.05);
  floorShape.lineTo(0.78, 0.3);
  floorShape.lineTo(0.78, -1.9);
  floorShape.lineTo(0.5, -2.85);
  floorShape.lineTo(-0.5, -2.85);
  floorShape.lineTo(-0.78, -1.9);
  floorShape.lineTo(-0.78, 0.3);
  floorShape.closePath();
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 0.025, bevelEnabled: false });
  floorGeo.rotateX(Math.PI / 2); // the shape's y runs forward (+z); its depth goes down
  const floor = mesh(floorGeo, mats.carbon);
  floor.position.y = 0.07;
  // the diffuser: a ramp up behind the rear axle
  const diff = mesh(new THREE.BoxGeometry(0.9, 0.02, 0.45), mats.carbon);
  diff.position.set(0, 0.14, -3.02);
  diff.rotation.x = -0.35;

  // ---- rear tyres on the same rig: they roll with the fronts ----
  for (const side of [-1, 1]) {
    const roll = new THREE.Group();
    roll.position.set(side * 0.74, 0.36, -2.275);
    car.add(roll);
    wheels.spin.push(roll);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.4, 48, 1), tyreMats);
    geos.push(tyre.geometry);
    tyre.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.41, 32), mats.matte);
    geos.push(rim.geometry);
    rim.rotation.z = Math.PI / 2;
    roll.add(tyre, rim);
    // wishbones and the pushrod from the gearbox to the hub
    for (const [y0, y1, z0] of [[0.5, 0.52, -2.05], [0.3, 0.24, -2.1], [0.48, 0.5, -2.5]]) {
      const arm = new THREE.LineCurve3(new THREE.Vector3(side * 0.13, y0, z0), new THREE.Vector3(side * 0.56, y1, -2.275));
      mesh(taperedTube(arm, { segments: 2, radial: 8, radiusAt: () => 0.012, roundTip: false }), mats.carbon);
    }
  }

  // ---- rear wing (active aero): endplates, the main plane, a flap that opens; one pylon ----
  const wing = new THREE.Group();
  wing.position.set(0, 0, -3.05);
  car.add(wing);
  for (const side of [-1, 1]) {
    const plate = mesh(new THREE.BoxGeometry(0.02, 0.46, 0.5), mats.carbon, wing);
    plate.position.set(side * 0.5, 0.78, 0);
    const tip = mesh(new THREE.BoxGeometry(0.022, 0.03, 0.5), mats.teal, wing);
    tip.position.set(side * 0.5, 1.02, 0);
  }
  const main = mesh(new THREE.BoxGeometry(0.98, 0.02, 0.26), mats.paint, wing);
  main.position.set(0, 0.8, 0.05);
  main.rotation.x = 0.12;
  const flap = new THREE.Group(); // pivots at its leading edge
  flap.position.set(0, 0.88, -0.05);
  wing.add(flap);
  const flapPlane = mesh(new THREE.BoxGeometry(0.98, 0.015, 0.18), mats.paint, flap);
  flapPlane.position.z = -0.09;
  const flapEdge = mesh(new THREE.BoxGeometry(0.98, 0.016, 0.025), mats.teal, flap);
  flapEdge.position.z = -0.175;
  flap.rotation.x = 0.55; // closed (Z-mode, cornering)
  const pylon = mesh(new THREE.BoxGeometry(0.03, 0.42, 0.12), mats.carbon, wing);
  pylon.position.set(0, 0.6, 0.12);
  pylon.rotation.x = -0.2;

  // ---- front wing: the main plane across under the nose (the flaps are in the cockpit build) ----
  const frontMain = mesh(new THREE.BoxGeometry(1.86, 0.016, 0.34), mats.carbon);
  frontMain.position.set(0, 0.11, 2.3);

  // ---- halo: titanium, from mounts behind the driver round the head to a pillar ahead ----
  const halo = new THREE.Group();
  halo.name = 'halo';
  halo.visible = false;
  car.add(halo);
  const haloMat = new THREE.MeshPhysicalMaterial({ color: 0x15171b, roughness: 0.4, metalness: 0.3, clearcoat: 0.6 });
  local.push(haloMat);
  for (const side of [-1, 1]) {
    const hoop = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.3, 0.78, -0.5),
      new THREE.Vector3(side * 0.31, 0.93, -0.32),
      new THREE.Vector3(side * 0.26, 0.985, -0.02),
      new THREE.Vector3(side * 0.12, 0.98, 0.26),
      new THREE.Vector3(0, 0.965, 0.36),
    ]);
    mesh(taperedTube(hoop, { segments: 40, radial: 10, radiusAt: () => 0.021, roundTip: false }), haloMat, halo);
  }
  const pillar = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.97, 0.35), new THREE.Vector3(0, 0.88, 0.5), new THREE.Vector3(0, 0.76, 0.6)]);
  mesh(taperedTube(pillar, { segments: 12, radial: 10, radiusAt: (t) => 0.02 + t * 0.008, roundTip: false }), haloMat, halo);

  let open = 0;
  return {
    halo,
    // 0 = closed (Z-mode, corners), 1 = open (X-mode, straights)
    setAero(v) {
      if (v === open) return;
      open = v;
      flap.rotation.x = 0.55 - v * 0.45;
    },
    rainLight: rainMat,
    dispose() {
      geos.forEach((g) => g.dispose());
      local.forEach((x) => x.dispose());
    },
  };
}
