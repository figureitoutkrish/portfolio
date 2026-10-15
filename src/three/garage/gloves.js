import * as THREE from 'three';
import { taperedTube, fabricTexture } from './geometry.js';

// Racing gloves, generated in code: palm, four fingers wrapped round the grip, thumb resting on the
// front face, then the cuff and forearm heading back toward the driver.
//
// Each hand is built in a "grip frame": x points away from the wheel's centre, y up the grip, z to
// the back of the wheel (away from the driver), origin at the grip's centre. placeGlove() maps that
// frame onto the real grip; the right hand is the same mesh with x flipped (three.js handles the
// mirrored winding).
const TEAL = 0x00d2be;

let shared;
function materials() {
  if (shared) return shared;
  const bump = fabricTexture();
  shared = {
    fabric: new THREE.MeshPhysicalMaterial({
      color: 0x08090b,
      roughness: 0.9,
      sheen: 0.22,
      sheenColor: new THREE.Color(0x24272d),
      sheenRoughness: 0.5,
      bumpMap: bump,
      bumpScale: 0.6,
    }),
    // silicone grip patches on the fingers and palm
    grip: new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.55, metalness: 0 }),
    stripe: new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.4, emissive: TEAL, emissiveIntensity: 0.12 }),
    cuff: new THREE.MeshPhysicalMaterial({ color: 0x17191c, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0x30343a) }),
  };
  return shared;
}

// point at angle phi (degrees, 0 = outward, 90 = back of the grip, -90 = facing the driver)
const around = (phi, y, R) => {
  const a = THREE.MathUtils.degToRad(phi);
  return new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
};

function buildHand(r, shoulder) {
  const m = materials();
  const hand = new THREE.Group();
  hand.name = 'glove';

  // fingers, index (top) to little finger
  const FINGERS = [
    { y: 0.024, w: 0.0089, reach: 205 },
    { y: 0.002, w: 0.0092, reach: 210 },
    { y: -0.02, w: 0.0087, reach: 204 },
    { y: -0.04, w: 0.0076, reach: 188 },
  ];
  for (const f of FINGERS) {
    const pts = [
      around(-8, f.y + 0.004, r + 0.027),
      around(40, f.y + 0.001, r + f.w + 0.004),
      around(105, f.y - 0.001, r + f.w + 0.002),
      around(160, f.y - 0.003, r + f.w + 0.001),
      around(f.reach, f.y - 0.004, r + f.w),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const knuckle = (t) => 1 + 0.12 * Math.exp(-(((t - 0.25) / 0.06) ** 2)) + 0.08 * Math.exp(-(((t - 0.58) / 0.05) ** 2));
    const geo = taperedTube(curve, { segments: 28, radial: 10, radiusAt: (t) => f.w * (1.08 - 0.22 * t) * knuckle(t) });
    hand.add(new THREE.Mesh(geo, m.fabric));
    // a grip patch on the pad of the last joint
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m.grip);
    pad.scale.set(f.w * 0.75, f.w * 0.95, f.w * 0.75);
    pad.position.copy(around(f.reach - 18, f.y - 0.004, r + f.w * 0.55));
    hand.add(pad);
  }

  // palm and back of the hand: one soft volume on the outer-front side of the grip
  const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), m.fabric);
  palm.scale.set(0.024, 0.05, 0.041);
  palm.position.copy(around(-42, -0.008, r + 0.026));
  palm.rotation.y = THREE.MathUtils.degToRad(42);
  hand.add(palm);
  // the heel of the hand bulges a little lower
  const heel = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m.fabric);
  heel.scale.set(0.022, 0.026, 0.03);
  heel.position.copy(around(-60, -0.04, r + 0.024));
  hand.add(heel);

  // thumb: from the base of the palm across the front face, tip pointing at the buttons
  const thumb = new THREE.CatmullRomCurve3(
    [around(-70, -0.022, r + 0.026), around(-92, 0.006, r + 0.016), around(-122, 0.026, r + 0.012), around(-150, 0.034, r + 0.01)],
    false,
    'centripetal'
  );
  hand.add(new THREE.Mesh(taperedTube(thumb, { segments: 22, radial: 10, radiusAt: (t) => 0.0112 * (1.05 - 0.25 * t) }), m.fabric));

  // wrist → cuff → forearm → elbow → upper arm into the shoulder
  const w0 = around(-52, -0.032, r + 0.03);
  const w1 = w0.clone().add(new THREE.Vector3(0.025, -0.03, -0.055));
  const elbow = w1.clone().lerp(shoulder, 0.5).add(new THREE.Vector3(0.1, -0.17, 0.02));
  const arm = new THREE.CatmullRomCurve3([w0, w1, elbow, shoulder], false, 'centripetal');
  const armRadius = (t) => (t < 0.06 ? 0.026 + t * 0.18 : t < 0.11 ? 0.037 : 0.04 + (t - 0.11) * 0.022);
  hand.add(new THREE.Mesh(taperedTube(arm, { segments: 48, radial: 16, radiusAt: armRadius }), m.fabric));
  // the cuff's elastic edge and the teal stripe
  const ringAt = (t, radius, tube, mat) => {
    const p = arm.getPointAt(t);
    const tan = arm.getTangentAt(t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 28), mat);
    ring.position.copy(p);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    hand.add(ring);
  };
  ringAt(0.075, 0.036, 0.0045, m.cuff);
  ringAt(0.095, 0.0375, 0.0028, m.stripe);

  hand.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return hand;
}

// Put a glove on a grip. center/up/out/back and the shoulder are in the parent's space (the
// steering group), so the gloves turn with the wheel. out points away from the wheel's centre.
export function placeGlove(parent, { center, up, out, back, radius = 0.017, shoulder }) {
  const basis = new THREE.Matrix4().makeBasis(out.clone().normalize(), up.clone().normalize(), back.clone().normalize());
  // the shoulder in the grip frame (the basis is orthonormal, so its inverse is its transpose)
  const s = shoulder.clone().sub(center).applyMatrix4(basis.clone().transpose());
  const hand = buildHand(radius, s);
  hand.matrixAutoUpdate = false;
  hand.matrix.copy(basis).setPosition(center);
  parent.add(hand);
  return hand;
}

export function disposeGloves() {
  if (!shared) return;
  Object.values(shared).forEach((mat) => {
    mat.bumpMap?.dispose();
    mat.dispose();
  });
  shared = null;
}
