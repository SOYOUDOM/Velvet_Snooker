// The bind-pose box (metres) of every skinned part of one or more .glb characters, where three.js draws them
// (skinned, in the scene). full_people.py uses it to check a rebuilt model has the same body as the one it replaces.
// usage: node bind_boxes.mjs a.glb [b.glb ...]   ->   one JSON object per file: {material: [min, max, vertices]}
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
globalThis.self = globalThis;                                    // three.js expects a browser; textures are not needed
THREE.TextureLoader.prototype.load = function (url, onLoad) { const t = new THREE.Texture(); setTimeout(() => onLoad && onLoad(t)); return t; };
await MeshoptDecoder.ready;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const out = [];
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f), g = await loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  const o = {}, v = new THREE.Vector3();
  g.scene.updateMatrixWorld(true);
  g.scene.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    const p = m.geometry.attributes.position, bx = new THREE.Box3();
    m.skeleton.update();
    for (let i = 0; i < p.count; i++) bx.expandByPoint(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld));
    o[m.material.name] = [bx.min.toArray(), bx.max.toArray(), p.count, m.morphTargetInfluences ? m.morphTargetInfluences.length : 0];
  });
  out.push(o);
}
console.log(JSON.stringify(out));
