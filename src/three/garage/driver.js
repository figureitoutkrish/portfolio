import * as THREE from 'three';
import { taperedTube, fabricTexture } from './geometry.js';

// The driver's body below the camera: lap and thighs running up under the wheel, the torso
// reclined into the seat, in a black race suit with a teal line. The arms belong to the gloves
// (gloves.js) so they turn with the wheel; this is everything that stays put. Car space.
export function buildDriver() {
  const group = new THREE.Group();
  group.name = 'driver';
  const bump = fabricTexture();
  const suit = new THREE.MeshPhysicalMaterial({
    color: 0x0d0e11,
    roughness: 0.85,
    sheen: 0.4,
    sheenColor: new THREE.Color(0x2a2e35),
    bumpMap: bump,
    bumpScale: 0.4,
  });
  const teal = new THREE.MeshStandardMaterial({ color: 0x00d2be, roughness: 0.5, emissive: 0x00d2be, emissiveIntensity: 0.1 });
  const geos = [];
  const tube = (pts, r0, r1, mat = suit) => {
    const g = taperedTube(new THREE.CatmullRomCurve3(pts), { segments: 24, radial: 16, radiusAt: (t) => r0 + (r1 - r0) * t, roundTip: true });
    geos.push(g);
    const m = new THREE.Mesh(g, mat);
    group.add(m);
    return m;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // thighs: from the hips (low, behind) up to the knees just under the wheel, then shins forward
  for (const s of [-1, 1]) {
    tube([V(s * 0.1, 0.17, -0.3), V(s * 0.095, 0.3, 0.1), V(s * 0.085, 0.43, 0.48)], 0.085, 0.062);
    tube([V(s * 0.085, 0.43, 0.48), V(s * 0.08, 0.36, 0.85), V(s * 0.075, 0.3, 1.15)], 0.058, 0.045);
    // the suit's side stripe along each thigh
    tube([V(s * 0.183, 0.18, -0.28), V(s * 0.178, 0.3, 0.08), V(s * 0.146, 0.42, 0.44)], 0.006, 0.006, teal);
  }
  // pelvis and the torso reclining back to the shoulders
  tube([V(0, 0.2, -0.32), V(0, 0.42, -0.5), V(0, 0.63, -0.66)], 0.17, 0.2);

  return {
    group,
    dispose() {
      geos.forEach((g) => g.dispose());
      suit.dispose();
      teal.dispose();
      bump.dispose();
    },
  };
}
