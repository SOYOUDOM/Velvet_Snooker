// The names of a Rocketbox character's face shapes, read from its _facial.fbx with three.js (FBX2glTF keeps
// the shapes but drops their names), with how far each shape moves the face, so full_avatar.mjs can check the
// two lists are in the same order. usage: node shape_names.mjs <Name>_facial.fbx out.json
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };   // the textures are not needed here
const [src, dst] = process.argv.slice(2);
const b = fs.readFileSync(src);
const obj = new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
let best = null;
obj.traverse((o) => { if (o.isMesh && o.morphTargetDictionary && (!best || Object.keys(o.morphTargetDictionary).length > Object.keys(best.morphTargetDictionary).length)) best = o; });
if (!best) throw new Error('no face shapes in ' + src);
const names = Object.keys(best.morphTargetDictionary).sort((a, c) => best.morphTargetDictionary[a] - best.morphTargetDictionary[c]).map((n) => n.replace(/^[^.]*\./, ''));
const maxDisp = (best.geometry.morphAttributes.position || []).map((a) => { let m = 0; for (let i = 0; i < a.count; i++) m = Math.max(m, Math.hypot(a.getX(i), a.getY(i), a.getZ(i))); return m; });
fs.writeFileSync(dst, JSON.stringify({ names, maxDisp }));
console.log(src.split('/').pop(), names.length, 'shapes');
