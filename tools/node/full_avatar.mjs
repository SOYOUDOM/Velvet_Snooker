// Package a Rocketbox character at full quality, with its face shapes, for VELVET 7.0.
//   - the face shapes get their names, and only the ones the game uses stay: the 52 ARKit shapes and the 15
//     speech shapes (visemes); the two name lists are checked to be in the same order
//   - parts the shapes never move (the body, mostly the hair cards) become meshes of their own, without shapes
//   - materials as the game's other characters (roughness: cloth .82, skin .62, hair .7; hair cut out at .42),
//     no textures inside: the game adds them from characters/textures (characters.js)
//   - quantized and meshopt-compressed like process_avatar.mjs; bone names untouched (the clips bind by name)
// usage: node full_avatar.mjs raw.glb shapes.json out.glb [--no-hair]
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [src, shapesFile, dst, ...flags] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src), root = doc.getRoot();
const { names: all, maxDisp } = JSON.parse(fs.readFileSync(shapesFile, 'utf8'));
const report = { file: dst.split('/').pop() };

// the face mesh: the one with the most shapes
const mesh = root.listMeshes().reduce((a, m) => (m.listPrimitives()[0].listTargets().length > (a ? a.listPrimitives()[0].listTargets().length : -1) ? m : a), null);
const T0 = mesh.listPrimitives()[0].listTargets().length;
if (T0 !== all.length) throw new Error(`shape count differs: glb ${T0}, fbx ${all.length}`);
// same order? each shape's largest movement, over all parts, against three.js's reading of the FBX (cm -> m)
const mx = new Array(T0).fill(0);
for (const prim of mesh.listPrimitives()) prim.listTargets().forEach((t, i) => { const a = t.getAttribute('POSITION').getArray(); for (let k = 0; k < a.length; k += 3) mx[i] = Math.max(mx[i], Math.hypot(a[k], a[k + 1], a[k + 2])); });
const ratios = mx.map((m, i) => (maxDisp[i] > 1e-6 ? m / maxDisp[i] : null)).filter((r) => r !== null), med = ratios.slice().sort((a, b) => a - b)[ratios.length >> 1];
const off = ratios.filter((r) => Math.abs(r / med - 1) > 0.03).length;
if (off) throw new Error(`${off} shapes out of order`);
report.orderCheck = { shapes: ratios.length, scale: +med.toFixed(4) };

const keep = [], names = [];
all.forEach((n, i) => {
  if (/^AA_VI_\d+_/.test(n)) { keep.push(i); names.push('VI_' + n.replace(/^AA_VI_\d+_/, '')); }
  else if (/^AK_\d+_/.test(n)) { keep.push(i); names.push(n.replace(/^AK_\d+_/, '')); }
});
if (names.length !== 67) throw new Error('expected 67 ARKit and speech shapes, found ' + names.length);

const ROUGH = { body: 0.82, head: 0.62, opacity: 0.7 };
const noHair = flags.includes('--no-hair');
for (const m of root.listMaterials()) {
  const kind = m.getName().split('_').pop();
  m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
  m.setMetallicFactor(0).setRoughnessFactor(ROUGH[kind] ?? 0.8).setBaseColorFactor([1, 1, 1, 1]).setEmissiveFactor([0, 0, 0]);
  if (kind === 'opacity') m.setAlphaMode('MASK').setAlphaCutoff(0.42).setDoubleSided(true);
}
for (const t of root.listTextures()) t.dispose();
for (const me of root.listMeshes()) for (const p of me.listPrimitives()) if (p.getAttribute('COLOR_0')) p.setAttribute('COLOR_0', null);

const node = root.listNodes().find((n) => n.getMesh() === mesh), parts = [];
for (const prim of mesh.listPrimitives().slice()) {
  const kind = prim.getMaterial().getName().split('_').pop();
  prim.listTargets().forEach((t, i) => { if (!keep.includes(i)) { prim.removeTarget(t); t.dispose(); } });
  let m = 0;
  for (const t of prim.listTargets()) { const a = t.getAttribute('POSITION').getArray(); for (let k = 0; k < a.length; k++) m = Math.max(m, Math.abs(a[k])); }
  parts.push({ kind, verts: prim.getAttribute('POSITION').getCount(), moves: +m.toFixed(4) });
  if (kind === 'opacity' && noHair) { mesh.removePrimitive(prim); prim.dispose(); parts[parts.length - 1].dropped = true; continue; }
  if (m >= 1e-4) continue;                       // the face: keeps its shapes
  for (const t of prim.listTargets()) { prim.removeTarget(t); t.dispose(); }
  mesh.removePrimitive(prim);
  const m2 = doc.createMesh(prim.getMaterial().getName()).addPrimitive(prim), n2 = doc.createNode(prim.getMaterial().getName()).setMesh(m2).setSkin(node.getSkin());
  (node.getParentNode() || root.listScenes()[0]).addChild(n2);
}
if (noHair) for (const m of root.listMaterials()) if (m.getName().endsWith('_opacity')) m.dispose();
// the shapes move the head, and on some people (long lashes) the hair-card part as well; never the body
const faceParts = mesh.listPrimitives(), kinds = faceParts.map((p) => p.getMaterial().getName().split('_').pop());
if (!kinds.includes('head') || kinds.some((k) => k !== 'head' && k !== 'opacity')) throw new Error('the face shapes should be on the head (and lashes): ' + JSON.stringify(parts));
mesh.setName(faceParts.find((p) => /_head$/.test(p.getMaterial().getName())).getMaterial().getName());
mesh.setWeights(new Array(keep.length).fill(0)).setExtras({ targetNames: names });
for (const prim of faceParts) prim.listTargets().forEach((t, i) => t.setName(names[i]));   // written out as extras.targetNames
report.parts = parts;

await doc.transform(prune({ keepAttributes: true }), dedup(),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
report.joints = root.listSkins()[0].listJoints().length;
report.bytes = fs.statSync(dst).size;
console.log(JSON.stringify(report));
