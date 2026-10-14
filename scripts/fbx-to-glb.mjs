// Convert an FBX car model to a geometry-only GLB for the data page's garage scene.
//   node scripts/fbx-to-glb.mjs <in.fbx> <out.glb>
// Textures are not embedded: src/three/garage/car.js assigns materials by name at runtime, so a
// model can be restyled (livery, decals) without re-exporting. Mesh names and the hierarchy are
// kept, since the steering wheel, paddles and shift lights are animated by name.
import fs from 'node:fs';

// Node lacks the few browser APIs the loader/exporter touch.
globalThis.self = globalThis;
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((r) => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); }); }
};

const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/fbx-to-glb.mjs <in.fbx> <out.glb>');
  process.exit(1);
}
const buf = fs.readFileSync(input);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');

// one plain material per name (shared), no textures
const mats = new Map();
const plain = (m) => {
  if (!mats.has(m.name)) mats.set(m.name, new THREE.MeshStandardMaterial({ name: m.name, color: 0x808080, roughness: 0.6 }));
  return mats.get(m.name);
};
// lights and cameras exported with the model don't belong in our scene
const extras = [];
root.traverse((o) => (o.isLight || o.isCamera) && extras.push(o));
extras.forEach((o) => o.removeFromParent());
let tris = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  o.material = Array.isArray(o.material) ? o.material.map(plain) : plain(o.material);
  const g = o.geometry;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  o.geometry = mergeVertices(g, 1e-5); // FBX comes in unindexed: share vertices (about a third of the size)
  tris += o.geometry.index.count / 3;
});

const glb = await new GLTFExporter().parseAsync(root, { binary: true });
fs.writeFileSync(output, Buffer.from(glb));
console.log(`${output}: ${(glb.byteLength / 1e6).toFixed(2)} MB, ${Math.round(tris)} tris, ${mats.size} materials`);
console.log([...mats.keys()].join(', '));
