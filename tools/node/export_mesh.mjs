// Dump the bind-pose body/head mesh of a character (positions, uvs, triangles,
// skin joints/weights + joint names) so Python can paint textures in 3D space.
import { NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
const [src, dst] = process.argv.slice(2);
const doc = await new NodeIO().read(src);
const root = doc.getRoot();
const skin = root.listSkins()[0];
const jointNames = skin.listJoints().map(j => j.getName());
const out = { jointNames, prims: {} };
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const key = p.getMaterial().getName().split('_').pop();
  const g = (s) => Array.from(p.getAttribute(s).getArray());
  out.prims[key] = { pos: g('POSITION'), uv: g('TEXCOORD_0'), joints: g('JOINTS_0'), weights: g('WEIGHTS_0'), idx: Array.from(p.getIndices().getArray()) };
}
fs.writeFileSync(dst, JSON.stringify(out));
console.log('joints', jointNames.length, Object.keys(out.prims), jointNames.filter(n => /Hand|Finger|Spine|Pelvis|Neck|Clavicle|UpperArm/.test(n)).slice(0, 40).join(', '));
