import * as THREE from 'three';

// The concept car's livery, painted per pixel from where a point sits on the car (car space:
// metres, +z forward, +x the driver's left, y up) rather than from textures: the model is one CAD
// mesh with no UVs. Krish's brief was the black Mercedes cars (W11 2020, W14 2023): gloss black,
// carbon underneath, thin teal lines that sweep along the sides, down the nose and along the wing
// endplates, and a three-pointed star pattern on the engine cover that fades toward the cockpit. No
// team logos or sponsor names: it's the look, in KV teal, not their car.
//   bodyMaterial(rel)   the body and halo; rel = the mesh's matrix relative to the car
//   wheelMaterial(geo)  tyres and rims, told apart by radius (yellow sidewall ring, teal rim lip)
const TEAL = new THREE.Color(0x00d2be);

const LIVERY = /* glsl */ `
uniform mat4 uRel;
varying vec3 vCar;
varying vec3 vCarN;
float band(float v, float c, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + fwidth(v) * 1.5, abs(v - c)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// a three-pointed star (the Y of three blades) in a cell, local coords q in [-0.5, 0.5]
float star(vec2 q, float r) {
  float a = atan(q.y, q.x) + 1.5708;
  float k = abs(fract(a / 2.0944 + 0.5) - 0.5) * 2.0944; // angle to the nearest blade
  float d = length(q);
  float blade = d * sin(k) - 0.03 * (1.0 - d / r);
  return (1.0 - smoothstep(0.0, 0.02, blade)) * step(d, r) * step(k, 0.5);
}
`;

export function bodyMaterial(rel) {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x08090a, roughness: 0.4, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 });
  m.userData.uRel = { value: rel.clone() };
  m.onBeforeCompile = (s) => {
    s.uniforms.uRel = m.userData.uRel;
    s.uniforms.uTeal = { value: TEAL };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>\nuniform mat4 uRel;\nvarying vec3 vCar;\nvarying vec3 vCarN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCar = (uRel * vec4(position, 1.0)).xyz;\nvCarN = normalize(mat3(uRel) * normal);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uTeal;\n${LIVERY}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vCar;
        vec3 n = normalize(vCarN);
        float side = abs(n.x);
        // carbon: everything facing down, the floor and the suspension arms' undersides
        float carbon = max(step(n.y, -0.35), step(p.y, 0.085));
        // carbon also on the wings (front: ahead of the front axle and low; rear: high at the back)
        carbon = max(carbon, step(1.75, p.z) * step(p.y, 0.33) * step(0.2, abs(p.x)));
        carbon = max(carbon, step(p.z, -2.15) * step(0.62, p.y));
        float weave = 0.5 + 0.5 * sign(sin((p.x + p.z) * 900.0) * sin((p.x - p.z) * 900.0 + p.y * 900.0));
        vec3 carbonCol = mix(vec3(0.035), vec3(0.06), weave);
        diffuseColor.rgb = mix(diffuseColor.rgb, carbonCol, carbon);

        // the stars: on the engine cover (behind the airbox), dense at the back, fading forward
        float cover = step(p.z, -0.45) * step(-2.3, p.z) * step(0.42, p.y) * (1.0 - carbon);
        vec2 sp = side > 0.6 ? vec2(p.z, p.y) : vec2(p.z, p.x);
        vec2 cell = floor(sp / 0.028);
        vec2 q = fract(sp / 0.028) - 0.5;
        float fade = smoothstep(-0.55, -1.7, p.z);
        float pick = step(hash(cell), fade * 0.85);
        float stars = star(q, 0.36) * pick * cover;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.27, 0.29), stars);

        // teal lines
        float teal = 0.0;
        // the sweep along each side: from the nose, dipping over the sidepod, rising to the rear
        float sweepY = p.z > 0.0 ? mix(0.36, 0.58, smoothstep(0.0, 1.6, p.z)) : mix(0.36, 0.52, smoothstep(0.0, -1.6, p.z));
        teal = max(teal, band(p.y, sweepY, 0.022) * step(0.45, side) * step(-1.7, p.z) * step(p.z, 1.9) * (1.0 - carbon));
        // two lines down the top of the nose
        teal = max(teal, band(abs(p.x), 0.048, 0.012) * step(0.6, n.y) * step(0.75, p.z) * step(p.z, 2.45) * step(p.y, 0.7));
        // the endplates' top edges and the rear wing's
        teal = max(teal, step(0.83, abs(p.x)) * step(1.9, p.z) * band(p.y, 0.29, 0.03));
        teal = max(teal, step(p.z, -2.2) * step(0.52, side) * band(p.y, 0.98, 0.035));
        // the halo's top
        teal = max(teal, step(0.77, p.y) * step(-0.3, p.z) * step(p.z, 0.55) * step(0.85, n.y) * band(abs(p.x), 0.0, 0.03));
        diffuseColor.rgb = mix(diffuseColor.rgb, uTeal, teal);
        `
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, max(step(vCarN.y, -0.35), step(vCar.y, 0.085)));`);
  };
  m.customProgramCacheKey = () => 'kv-livery';
  return m;
}

export function wheelMaterial(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const c = b.getCenter(new THREE.Vector3());
  const r = (b.max.y - b.min.y) / 2;
  const m = new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.9 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uC = { value: c };
    s.uniforms.uR = { value: r };
    s.uniforms.uTeal = { value: TEAL };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position;\nvWN = normal;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uC;\nuniform float uR;\nuniform vec3 uTeal;\nvarying vec3 vW;\nvarying vec3 vWN;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rn = length(vW.yz - uC.yz) / uR;
        float face = step(0.55, abs(normalize(vWN).x));
        float rim = step(rn, 0.7);
        vec3 col = mix(vec3(0.022), vec3(0.018), rim); // rubber, the satin black rim
        float aa = fwidth(rn) * 1.5;
        col = mix(col, vec3(0.93, 0.78, 0.0), face * (smoothstep(0.80 - aa, 0.80, rn) - smoothstep(0.84, 0.84 + aa, rn))); // the compound ring
        col = mix(col, uTeal, face * (smoothstep(0.64 - aa, 0.64, rn) - smoothstep(0.69, 0.69 + aa, rn))); // the rim lip
        diffuseColor.rgb = col;
        `
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = length(vW.yz - uC.yz) / uR < 0.7 ? 0.35 : 0.97;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = length(vW.yz - uC.yz) / uR < 0.7 ? 0.6 : 0.0;');
  };
  m.customProgramCacheKey = () => 'kv-wheel';
  return m;
}
