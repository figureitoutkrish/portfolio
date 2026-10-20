// Convert Qvist_designs' "F1 2026 concept (polygon model)" (CC BY 4.0, see the credit in
// src/three/garage/car.js) into the data page's car: public/assets/models/car-2026.glb.
//   node scripts/concept-to-glb.mjs content/models/f1_2026_concept_polygon_model.glb public/assets/models/car-2026.glb
// The download is one CAD mesh (an STL, one material, cut into arbitrary chunks), so this script:
//   1. moves it into car space: metres, +z forward, +x the driver's left, y up, ground at 0, the
//      front axle at z = 1.44 (where the code car's is, so the pit box marks line up);
//   2. finds its pieces (connected triangles): the body, four wheels (measured, not kept), mirrors;
//   3. cuts the halo out of the body into its own mesh (shown from outside, hidden in the cockpit;
//      see concept-zones.mjs); the livery is painted per pixel at runtime (car-livery.js);
//   4. simplifies everything (1.16M triangles → about 140k) and compresses it (meshopt).
// Materials are named slots only; car.js makes the real materials at runtime.
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { weld, meshopt, quantize, simplifyPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/concept-to-glb.mjs <in.glb> <out.glb>');
  process.exit(1);
}
const FRONT_AXLE = 1.44;
const RATIO = { body: 0.12, halo: 0.5 };

// ---------- 1. read, into car space ----------
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]);
const src = await io.read(input);
const P = [];
const I = [];
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    const base = P.length / 3;
    const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      const x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12];
      const y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13];
      const z = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14];
      // model: mm, nose toward −x, +z = the driver's left  →  car: m, nose toward +z, +x = left
      P.push(z / 1000, y / 1000, -x / 1000);
    }
    for (let i = 0; i < idx.getCount(); i++) I.push(base + idx.getScalar(i));
  }
}
const nV = P.length / 3;
let minY = Infinity;
for (let i = 1; i < P.length; i += 3) minY = Math.min(minY, P[i]);

// ---------- 2. pieces ----------
const q = 1e-4;
const keyOf = new Map();
const vid = new Int32Array(nV);
let n = 0;
for (let i = 0; i < nV; i++) {
  const k = `${Math.round(P[i * 3] / q)},${Math.round(P[i * 3 + 1] / q)},${Math.round(P[i * 3 + 2] / q)}`;
  let j = keyOf.get(k);
  if (j === undefined) keyOf.set(k, (j = n++));
  vid[i] = j;
}
const parent = Int32Array.from({ length: n }, (_, i) => i);
const find = (x) => {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]];
  return x;
};
for (let t = 0; t < I.length; t += 3) {
  const a = find(vid[I[t]]);
  parent[find(vid[I[t + 1]])] = a;
  parent[find(vid[I[t + 2]])] = a;
}
const pieces = new Map();
for (let t = 0; t < I.length; t += 3) {
  const r = find(vid[I[t]]);
  let c = pieces.get(r);
  if (!c) pieces.set(r, (c = { tris: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
  c.tris.push(t);
  for (let k = 0; k < 3; k++) {
    const vi = I[t + k];
    for (let a = 0; a < 3; a++) {
      c.min[a] = Math.min(c.min[a], P[vi * 3 + a]);
      c.max[a] = Math.max(c.max[a], P[vi * 3 + a]);
    }
  }
}
// the STL's triangles face either way at random; make each piece's winding agree across shared
// edges (a walk from triangle to neighbour), then turn the piece outward (positive volume)
{
  const edges = new Map();
  const key = (a, b) => (a < b ? a * n + b : b * n + a);
  for (let t = 0; t < I.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const e = key(vid[I[t + k]], vid[I[t + ((k + 1) % 3)]]);
      const l = edges.get(e);
      if (l) l.push(t);
      else edges.set(e, [t]);
    }
  }
  const flip = new Uint8Array(I.length / 3);
  const seen = new Uint8Array(I.length / 3);
  // does triangle t (as it will be wound) run u → v?
  const runs = (t, u, v) => {
    const w = [vid[I[t]], vid[I[t + 1]], vid[I[t + 2]]];
    if (flip[t / 3]) w.reverse();
    for (let k = 0; k < 3; k++) if (w[k] === u && w[(k + 1) % 3] === v) return true;
    return false;
  };
  let flipped = 0;
  for (const piece of pieces.values()) {
    for (const start of piece.tris) {
      if (seen[start / 3]) continue;
      seen[start / 3] = 1;
      const stack = [start];
      while (stack.length) {
        const t = stack.pop();
        const w = [vid[I[t]], vid[I[t + 1]], vid[I[t + 2]]];
        if (flip[t / 3]) w.reverse();
        for (let k = 0; k < 3; k++) {
          const u = w[k];
          const v = w[(k + 1) % 3];
          const l = edges.get(key(u, v));
          if (l.length !== 2) continue; // open or non-manifold edges don't decide anything
          const m = l[0] === t ? l[1] : l[0];
          if (seen[m / 3]) continue;
          seen[m / 3] = 1;
          if (runs(m, u, v)) flip[m / 3] = 1; // a neighbour runs the shared edge the other way
          stack.push(m);
        }
      }
    }
    let vol = 0;
    for (const t of piece.tris) {
      let [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
      if (flip[t / 3]) [b, c] = [c, b];
      vol += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    if (vol < 0) for (const t of piece.tris) flip[t / 3] ^= 1;
  }
  for (let t = 0; t < I.length; t += 3) {
    if (!flip[t / 3]) continue;
    [I[t + 1], I[t + 2]] = [I[t + 2], I[t + 1]];
    flipped++;
  }
  console.log(`re-wound ${flipped} of ${I.length / 3} triangles`);
}
const list = [...pieces.values()].sort((a, b) => b.tris.length - a.tris.length);
const body = list[0];
// wheels: the four pieces that touch the ground, named by corner (L = +x, F = front)
const wheels = list
  .slice(1)
  .filter((c) => c.min[1] < minY + 0.01 && c.max[1] - c.min[1] > 0.5)
  .map((c) => {
    const centre = c.min.map((m, a) => (m + c.max[a]) / 2);
    return { ...c, centre, name: `WHEEL_${centre[0] > 0 ? 'L' : 'R'}${centre[2] > 0 ? 'F' : 'R'}` };
  });
if (wheels.length !== 4) throw new Error(`expected 4 wheels, found ${wheels.length}`);
// the front axle at FRONT_AXLE, the ground at 0
const front = wheels.filter((w) => w.name.endsWith('F'));
const dz = FRONT_AXLE - (front[0].centre[2] + front[1].centre[2]) / 2;
for (let i = 0; i < nV; i++) {
  P[i * 3 + 1] -= minY;
  P[i * 3 + 2] += dz;
}
for (const w of wheels) {
  w.centre[1] -= minY;
  w.centre[2] += dz;
}
const others = list.slice(1).filter((c) => !wheels.includes(c));
const rear = wheels.filter((w) => w.name.endsWith('R'));
console.log(`front axle z ${FRONT_AXLE}, rear axle z ${((rear[0].centre[2] + rear[1].centre[2]) / 2).toFixed(3)}, wheel radius ${(front[0].max[1] - front[0].min[1]) / 2}`);

// ---------- 3. the halo ----------
const ZONES = ['paint', 'mirror'];
const tmp = { c: [0, 0, 0], n: [0, 0, 0] };
function triInfo(t) {
  const a = I[t] * 3;
  const b = I[t + 1] * 3;
  const c = I[t + 2] * 3;
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
  const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  tmp.n = [nx / l, ny / l, nz / l];
  tmp.c = [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3];
  return tmp;
}
const zoneOf = (await import('./concept-zones.mjs')).zoneOf;

// ---------- 4. build the new document ----------
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('car');
const mats = Object.fromEntries(ZONES.map((z) => [z, doc.createMaterial(z)]));
const halo = doc.createMaterial('halo');

function addMesh(name, groups, origin = [0, 0, 0]) {
  const mesh = doc.createMesh(name);
  for (const [zone, tris] of Object.entries(groups)) {
    if (!tris.length) continue;
    const remap = new Map();
    const pos = [];
    const idx = [];
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const vi = I[t + k];
        let j = remap.get(vi);
        if (j === undefined) {
          remap.set(vi, (j = pos.length / 3));
          pos.push(P[vi * 3] - origin[0], P[vi * 3 + 1] - origin[1], P[vi * 3 + 2] - origin[2]);
        }
        idx.push(j);
      }
    }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer))
      .setMaterial(zone === 'halo' ? halo : mats[zone]);
    mesh.addPrimitive(prim);
  }
  const node = doc.createNode(name).setMesh(mesh).setTranslation(origin);
  scene.addChild(node);
  return node;
}

// body (+ halo cut out of it)
const bodyGroups = Object.fromEntries([...ZONES, 'halo'].map((z) => [z, []]));
for (const t of body.tris) {
  const { c, n: nrm } = triInfo(t);
  bodyGroups[zoneOf(c, nrm, 'body')].push(t);
}
const haloTris = bodyGroups.halo;
delete bodyGroups.halo;
addMesh('body', bodyGroups);
if (haloTris.length) addMesh('halo', { halo: haloTris });
// wheels: not shipped as meshes (the CAD tyres are doubled surfaces that flicker against each
// other); car.js builds clean ones from these measurements instead
scene.setExtras({
  wheels: wheels.map((w) => ({ name: w.name, centre: w.centre.map((v) => +v.toFixed(4)), radius: +((w.max[1] - w.min[1]) / 2).toFixed(4), width: +(w.max[0] - w.min[0]).toFixed(4) })),
});
// the rest: mirrors (two small pieces up by the cockpit) and small body parts
const small = { paint: [], mirror: [] };
for (const c of others) for (const t of c.tris) small[c.tris.length < 200 ? 'mirror' : 'paint'].push(t);
addMesh('parts', small);

console.log(`zones: ${Object.entries(bodyGroups).map(([k, v]) => `${k} ${v.length}`).join(', ')}, halo ${haloTris.length}`);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
await doc.transform(weld());
// simplify per mesh, at each mesh's own ratio
for (const mesh of doc.getRoot().listMeshes()) {
  const ratio = mesh.getName() === 'halo' ? RATIO.halo : RATIO.body;
  for (const prim of mesh.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.0008 });
}
// (no normals: car.js computes creased ones on load, which keeps the CAD edges sharp)
await doc.transform(quantize({ quantizePosition: 14 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
let tris = 0;
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += p.getIndices().getCount() / 3;
await io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).write(output, doc);
console.log(`wrote ${output}: ${tris} triangles`);
