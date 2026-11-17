// Package a converted Rocketbox character for the browser: attach JPEG/PNG
// textures, set cloth/skin material values, drop unused data, then quantize and
// meshopt-compress. usage: node process_avatar.mjs in.glb out.glb body.jpg head.jpg [opacity.png|-] [bodyN.jpg|-] [headN.jpg|-]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const [src, dst, bodyJ, headJ, opac, bodyN, headN] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
const tex = (file, mime) => doc.createTexture(file.split('/').pop()).setImage(fs.readFileSync(file)).setMimeType(mime);
const has = (f) => f && f !== '-' && fs.existsSync(f);
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  if (p.getAttribute('COLOR_0')) p.setAttribute('COLOR_0', null);
}
for (const m of root.listMaterials()) {
  const kind = m.getName().split('_').pop();
  m.setMetallicFactor(0).setBaseColorFactor([1, 1, 1, 1]).setEmissiveFactor([0, 0, 0]);
  if (kind === 'body') { m.setBaseColorTexture(tex(bodyJ, 'image/jpeg')).setRoughnessFactor(0.82); if (has(bodyN)) m.setNormalTexture(tex(bodyN, 'image/jpeg')); }
  else if (kind === 'head') { m.setBaseColorTexture(tex(headJ, 'image/jpeg')).setRoughnessFactor(0.62); if (has(headN)) m.setNormalTexture(tex(headN, 'image/jpeg')); }
  else if (kind === 'opacity') {
    if (has(opac)) m.setBaseColorTexture(tex(opac, 'image/png')).setAlphaMode('MASK').setAlphaCutoff(0.42).setDoubleSided(true).setRoughnessFactor(0.7);
    else m.dispose();
  }
}
// Keep the skeleton names untouched (animation clips bind to them by name).
await doc.transform(prune(), dedup(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
console.log(dst.split('/').pop(), fs.statSync(dst).size);
