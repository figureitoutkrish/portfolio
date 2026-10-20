// Which mesh a body triangle of the concept car goes to, for scripts/concept-to-glb.mjs, from its
// centre c = [x, y, z] and normal n (car space, metres: +z forward, +x the driver's left, y up).
// The livery itself is painted per pixel at runtime (src/three/garage/car-livery.js). Cut out here,
// into the 'halo' mesh the cockpit hides while you're in the seat:
//   the halo     it would sit right across the driver's view
//   the lid      the CAD model closes the cockpit with a flat lid at 0.576 m, over the steering
//                wheel's lower half; from outside it reads as the cockpit, from inside it's gone
export function zoneOf([x, y, z], n) {
  const hoop = y > 0.74 && z > -0.36 && z < 0.62;
  const pillar = Math.abs(x) < 0.05 && y > 0.68 && z > 0.4 && z < 0.8;
  const lid = Math.abs(x) < 0.3 && y > 0.5 && y < 0.6 && z > -0.34 && z < 0.37 && n[1] > 0.85;
  return hoop || pillar || lid ? 'halo' : 'paint';
}
