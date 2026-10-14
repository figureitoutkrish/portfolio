import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildFallbackCar } from './cockpit-fallback.js';
import { placeGlove, disposeGloves } from './gloves.js';
import { carbonTexture } from './geometry.js';
import { buildDriver } from './driver.js';

// The car. A real model is used when one sits in src/assets/local/ (kept out of git: the W11 there
// is unlicensed, so it only ever runs on Krish's Mac). Without it, the cockpit built in code
// (cockpit-fallback.js) is used, which is what the published site shows. Either way the rest of
// the scene gets the same handles: the steering pivot, 15 shift lights, the display mesh, the
// grips for the gloves and the driver's eye point.
const LOCAL = import.meta.glob('../../assets/local/w11/*.{glb,png}', { query: '?url', import: 'default', eager: true });
const local = (name) => LOCAL[`../../assets/local/w11/${name}`];

export async function loadCar({ manager, lcdTexture }) {
  let car = null;
  const forceCode = new URLSearchParams(location.search).get('car') === 'code'; // preview the published cockpit
  if (local('w11.glb') && !forceCode) {
    try {
      car = await loadW11(manager);
    } catch (err) {
      console.warn('[garage] local model failed, using the built-in cockpit', err);
    }
  }
  if (!car) car = buildFallbackCar();

  // display + gloves are shared by both cars
  car.lcdMesh.material = new THREE.MeshBasicMaterial({ map: lcdTexture, toneMapped: false });
  // the driver: body in the seat, arms from the shoulders to the gloves on the grips
  const driver = buildDriver();
  car.group.add(driver.group);
  car.group.updateMatrixWorld(true);
  car.gloves = car.grips.map((grip) => {
    const side = Math.sign(grip.out.x);
    const shoulder = car.steer.worldToLocal(new THREE.Vector3(side * 0.2, 0.64, -0.64));
    return placeGlove(car.steer, { ...grip, shoulder });
  });
  const dispose = car.dispose;
  car.dispose = () => {
    dispose();
    car.lcdMesh.material.dispose();
    driver.dispose();
    disposeGloves();
  };
  return car;
}

// ---------- the W11 (local only) ----------
async function loadW11(manager) {
  const gltf = await new GLTFLoader(manager).loadAsync(local('w11.glb'));
  const root = gltf.scene;
  const tex = new THREE.TextureLoader(manager);
  const textures = [];
  const map = (name, { srgb = true, repeat } = {}) => {
    const url = local(name);
    if (!url) return null;
    const t = tex.load(url);
    // the converter keeps three.js's UV convention (it doesn't flip like a native glTF), so keep flipY
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    t.anisotropy = 8;
    textures.push(t);
    return t;
  };
  const carbon = carbonTexture();
  textures.push(carbon);

  // materials by name (the export keeps names only; textures are assigned here)
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const decal = (file) => phys({ map: map(file), transparent: true, alphaTest: 0.35, roughness: 0.35, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const M = {
    mercedes_paint: phys({ map: map('mercedes_paint_d.png'), roughness: 0.35, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.22 }),
    decals: decal('mercedes_decal_da.png'),
    EXT_Decals: decal('ext_decals.png'),
    SW_DECALS: decal('mercedes_steering_wheel_decal_da.png'),
    number: decal('mercedes_driver_44.png'),
    mercedes_carbon1: phys({ color: 0x24262b, map: carbon, roughness: 0.4, metalness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
    mercedes_detail: phys({ map: map('mercedes_detail_d.png'), roughness: 0.4, metalness: 0.3, clearcoat: 0.6 }),
    // the seat and cockpit internals: the atlas they point at doesn't line up, so plain dark trim
    generics: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.7, metalness: 0.2 }),
    color: new THREE.MeshStandardMaterial({ map: map('driver_color.png'), roughness: 0.5 }),
    mercedes_steeringwheel: phys({ map: map('mercedes_steering_wheel_d.png'), roughness: 0.45, metalness: 0.2, clearcoat: 0.5 }),
    indicator_lights: new THREE.MeshStandardMaterial({ color: 0x111111 }),
    vehicle_revs_type3a: new THREE.MeshStandardMaterial({ color: 0x050505 }),
    LCD: new THREE.MeshStandardMaterial({ color: 0x050505 }),
    Seatbelt: new THREE.MeshStandardMaterial({ map: map('cockpit_belt.png'), roughness: 0.8 }),
    'Seatbelt Details': new THREE.MeshStandardMaterial({ map: map('seat_belt_details_d.png'), transparent: true, alphaTest: 0.3, roughness: 0.5 }),
    INT_Details_Alu: new THREE.MeshStandardMaterial({ color: 0x5c6168, map: map('int_details.png'), roughness: 0.6, metalness: 0.4, envMapIntensity: 0.25 }),
    sidewall: new THREE.MeshStandardMaterial({ map: map('tyre.png'), normalMap: map('tyre_nm.png', { srgb: false }), roughness: 0.85 }),
    mercedes_wheel_hub: new THREE.MeshStandardMaterial({ map: map('mercedes_wheel_d.png'), roughness: 0.45, metalness: 0.6 }),
    discs: new THREE.MeshStandardMaterial({ map: map('disc_d.png'), roughness: 0.7 }),
    driver: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.8 }),
    rear_light: new THREE.MeshStandardMaterial({ map: map('rear_light_d.png'), emissive: 0x330000 }),
    mercedes_mirror_left: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 1 }),
    glass: phys({ color: 0x223, transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0 }),
  };
  M.mercedes_carbon2 = M.mercedes_carbon3 = M.mercedes_carbon4 = M.mercedes_carbon1;
  M['mercedes_detail.001'] = M.mercedes_detail;
  M.mercedes_mirror_right = M.mercedes_mirror_left;
  M.generic_lcd = M.LCD;

  root.traverse((o) => {
    if (!o.isMesh) return;
    const pick = (m) => M[m.name] || m;
    o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material);
  });
  // the model carries both seat-belt states; keep them done up
  root.getObjectByName('CINTURE_OFF')?.removeFromParent();

  // steering: wrap STEER_HR in a pivot at the wheel's centre, turning about the column (≈ car −z)
  root.updateMatrixWorld(true);
  const steerNode = root.getObjectByName('STEER_HR');
  const box = new THREE.Box3().setFromObject(steerNode);
  const centre = box.getCenter(new THREE.Vector3());
  centre.z = 0.33;
  const pivot = new THREE.Group();
  pivot.name = 'steer';
  pivot.position.copy(centre);
  root.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(steerNode);

  // shift lights, numbered left (+x) to right
  const leds = [];
  for (let i = 0; i < 15; i++) {
    const led = root.getObjectByName(`LED_RPM_${i}`);
    if (!led) continue;
    led.material = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000 });
    leds.push(led);
  }
  leds.sort((a, b) => worldX(b) - worldX(a));

  // the display quad: give it 0…1 UVs (in the export it points into a texture atlas)
  const lcdMesh = root.getObjectByName('steering_wheel_SUB4') || findByMaterial(root, 'generic_lcd');
  if (lcdMesh) {
    const g = lcdMesh.geometry;
    g.computeBoundingBox();
    const { min, max } = g.boundingBox;
    const p = g.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (max.x - p.getX(i)) / (max.x - min.x || 1);
      uv[i * 2 + 1] = (p.getY(i) - min.y) / (max.y - min.y || 1);
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  // grips, in the pivot's space: the wheel's outer edges, half-way up
  const gripY = box.min.y + (box.max.y - box.min.y) * 0.42 - centre.y;
  const gripX = (box.max.x - box.min.x) / 2 - 0.016;
  const grips = [1, -1].map((s) => ({
    center: new THREE.Vector3(s * gripX, gripY, 0.03),
    up: new THREE.Vector3(0, 1, 0),
    out: new THREE.Vector3(s, 0, 0),
    back: new THREE.Vector3(0, 0, 1),
    radius: 0.017,
  }));

  return {
    group: root,
    steer: pivot,
    leds,
    lcdMesh,
    grips,
    eye: new THREE.Vector3(0, 0.99, -0.48), // just behind the helmet, like an onboard shot
    dispose() {
      root.traverse((o) => o.geometry?.dispose());
      new Set(Object.values(M)).forEach((m) => m.dispose());
      leds.forEach((l) => l.material.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

const worldX = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).x;
function findByMaterial(root, name) {
  let hit = null;
  root.traverse((o) => {
    if (!hit && o.isMesh && o.material?.name === name) hit = o;
  });
  return hit;
}
