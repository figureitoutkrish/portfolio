import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildFallbackCar } from './cockpit-fallback.js';
import { bodyMaterial, wheelMaterial } from './car-livery.js';

// The published car: "F1 2026 concept (polygon model)" by Qvist_designs
// (https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42),
// CC BY 4.0, credited on the car's panel in the garage (roam-ui.js). Converted by
// scripts/concept-to-glb.mjs: body and halo as meshes, the wheels as measurements only.
// It keeps the code car's cockpit (its steering wheel, display, shift lights and controls, so the
// wheel interface is the same) and swaps everything else: the body painted by car-livery.js, the
// halo (hidden from the driver's seat), and tyres built here from the model's own sizes.
export const CONCEPT_URL = '/assets/models/car-2026.glb';
export const CREDIT = { title: 'F1 2026 concept (polygon model)', author: 'Qvist_designs', url: 'https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };

export async function loadConcept(manager) {
  const gltf = await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).loadAsync(CONCEPT_URL);
  const model = gltf.scene;
  model.name = 'concept';
  model.updateMatrixWorld(true);
  const mats = [];
  const mirror = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1 });
  mats.push(mirror);
  model.traverse((o) => {
    if (!o.isMesh) return;
    const old = o.geometry;
    o.geometry = toCreasedNormals(old, 0.6); // (the export has no normals: sharp CAD edges stay sharp)
    old.dispose();
    const slot = o.material.name;
    o.material.dispose();
    if (slot === 'mirror') o.material = mirror;
    else mats.push((o.material = bodyMaterial(o.matrixWorld)));
  });
  const halo = model.getObjectByName('halo');
  if (halo) halo.visible = false; // you start in the seat

  // the cockpit from the code car: only its steering wheel stays (with the display, lights and
  // grips the rest of the scene drives); its tub, nose, wings and tyres make way for the model
  const base = buildFallbackCar();
  for (const child of [...base.group.children]) {
    if (child === base.steer) continue;
    child.removeFromParent();
    child.traverse((o) => o.geometry?.dispose());
  }
  base.group.add(model);
  // the inside of the tub, under the lid the seat hides: a dark box seen from within
  const tubMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.8, side: THREE.BackSide });
  mats.push(tubMat);
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.45, 0.72), tubMat);
  tub.position.set(0, 0.36, 0.02);
  base.group.add(tub);

  // tyres and rims, lathed to the measured size; each wheel rolls about its axle, the fronts also
  // steer about a kingpin just inboard of the tyre
  const wheels = { steer: [], spin: [] };
  for (const w of model.userData.wheels || []) {
    const geo = wheelGeometry(w.radius, w.width);
    const mat = wheelMaterial(geo);
    mats.push(mat);
    const roll = new THREE.Group();
    roll.name = w.name;
    roll.add(new THREE.Mesh(geo, mat));
    const [x, y, z] = w.centre;
    if (w.name.endsWith('F')) {
      const kingpin = new THREE.Group();
      const inboard = Math.sign(x) * 0.09;
      kingpin.position.set(x - inboard, y, z);
      roll.position.set(inboard, 0, 0);
      kingpin.add(roll);
      base.group.add(kingpin);
      wheels.steer.push(kingpin);
    } else {
      roll.position.set(x, y, z);
      base.group.add(roll);
    }
    wheels.spin.push(roll);
  }

  const dispose = base.dispose;
  return {
    ...base,
    wheels,
    halo,
    setAero: undefined, // (the model's rear flap is part of its wing)
    credit: CREDIT,
    dispose() {
      dispose(); // (disposes every geometry under the group, the model's included)
      mats.forEach((m) => m.dispose());
    },
  };
}

// A tyre and rim in one lathe about the axle (x): rounded shoulders, a flat tread, and a dished
// rim with a small hub, the same both sides
function wheelGeometry(R, width) {
  const h = width / 2;
  const half = [
    [0, 0.6],
    [0.12, 0.62],
    [0.26, 0.54],
    [0.62, 0.7],
    [0.69, 0.9],
    [0.74, 0.98],
    [0.86, 1],
    [0.95, 0.95],
    [0.99, 0.86],
    [1, 0.7],
  ];
  const pts = [...half, ...half.slice().reverse().map(([r, a]) => [r, -a])].map(([r, a]) => new THREE.Vector2(r * R, a * h));
  const geo = new THREE.LatheGeometry(pts, 72);
  geo.rotateZ(-Math.PI / 2); // the lathe's axis (y) becomes the axle (x)
  const creased = toCreasedNormals(geo, 0.5);
  geo.dispose();
  return creased;
}
