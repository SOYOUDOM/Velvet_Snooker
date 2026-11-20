// One Rocketbox person's head (face, face shapes, hair) on another's body: for pros whose own clothes (a hoodie,
// a track jacket, shorts) do not make a snooker outfit, the head goes onto a suit body that does (VELVET 7.2).
// All the Rocketbox men share one skeleton, so the body's points are carried over into the head's model as they
// are: moved into its space (the two skins' bind matrices), their bones looked up by name.
// Both files as written by full_avatar.mjs (each part a skinned mesh of its own).
// usage: node swap_body.mjs head.glb body.glb out.glb
import fs from 'node:fs';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

const [headSrc, bodySrc, dst] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const A = await io.read(headSrc), B = await io.read(bodySrc);
for (const d of [A, B]) { d.setLogger(new Logger(Logger.Verbosity.WARN)); await d.transform(dequantize()); }
const worldOf = (n) => { const m = new THREE.Matrix4().fromArray(n.getMatrix()); for (let p = n.getParentNode(); p; p = p.getParentNode()) m.premultiply(new THREE.Matrix4().fromArray(p.getMatrix())); return m; };
const bodyNode = (d) => d.getRoot().listNodes().find((n) => n.getMesh() && /_body$/.test(n.getMesh().listPrimitives()[0].getMaterial().getName()));
const nA = bodyNode(A), nB = bodyNode(B);
if (!nA || !nB) throw new Error('no body part');
const sA = nA.getSkin(), sB = nB.getSkin(), jA = sA.listJoints(), jB = sB.listJoints();
const byName = new Map(jA.map((j, i) => [j.getName(), i]));
// the same skeleton, standing the same way
let worst = 0;
for (const j of jB) { const i = byName.get(j.getName()); if (i == null) throw new Error('bone missing on the head model: ' + j.getName());
  const a = worldOf(jA[i]).elements, b = worldOf(j).elements; for (let k = 0; k < 16; k++) worst = Math.max(worst, Math.abs(a[k] - b[k])); }
if (worst > 2e-3) throw new Error('the two skeletons do not stand alike: ' + worst);
const ibm = (s, i) => new THREE.Matrix4().fromArray(s.getInverseBindMatrices().getArray().slice(i * 16, i * 16 + 16));
const jn0 = jB[0].getName(), MA = worldOf(jA[byName.get(jn0)]).multiply(ibm(sA, byName.get(jn0))), MB = worldOf(jB[0]).multiply(ibm(sB, 0));
const M = MA.clone().invert().multiply(MB), Nm = new THREE.Matrix3().getNormalMatrix(M);
const pB = nB.getMesh().listPrimitives()[0], pA = nA.getMesh().listPrimitives()[0];
const pos = pB.getAttribute('POSITION').getArray(), nor = pB.getAttribute('NORMAL').getArray(), n = pos.length / 3;
const P = new Float32Array(n * 3), N = new Float32Array(n * 3), v = new THREE.Vector3();
for (let i = 0; i < n; i++) { v.fromArray(pos, i * 3).applyMatrix4(M).toArray(P, i * 3); v.fromArray(nor, i * 3).applyMatrix3(Nm).normalize().toArray(N, i * 3); }
const jt = pB.getAttribute('JOINTS_0').getArray(), J = new Uint16Array(jt.length);
for (let k = 0; k < jt.length; k++) J[k] = byName.get(jB[jt[k]].getName());
const acc = (arr, type) => A.createAccessor().setArray(arr).setType(type).setBuffer(A.getRoot().listBuffers()[0]);
const wt = pB.getAttribute('WEIGHTS_0').getArray(), uv = pB.getAttribute('TEXCOORD_0').getArray();
for (const s of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) pA.setAttribute(s, null);
pA.setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(N, 'VEC3')).setAttribute('TEXCOORD_0', acc(new Float32Array(uv), 'VEC2'))
  .setAttribute('JOINTS_0', acc(J, 'VEC4')).setAttribute('WEIGHTS_0', acc(new Float32Array(wt), 'VEC4'));
pA.setIndices(acc(new Uint32Array(pB.getIndices().getArray()), 'SCALAR'));
// the head goes no lower than the suit's own head: a head from a t-shirt reaches down to the chest, which would show
// through the open shirt round the bow tie (triangles wholly below that line go; the face shapes are untouched)
const headOf = (d) => d.getRoot().listNodes().find((n) => n.getMesh() && /_head$/.test(n.getMesh().listPrimitives()[0].getMaterial().getName()));
const worldY = (node) => { const s = node.getSkin(), j = s.listJoints()[0], Mw = worldOf(j).multiply(ibm(s, 0)), a = node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray(), y = new Float32Array(a.length / 3);
  for (let i = 0; i < y.length; i++) y[i] = v.fromArray(a, i * 3).applyMatrix4(Mw).y; return y; };
const hA = headOf(A), hB = headOf(B);
let cut = 0;
if (hA && hB) {
  const yB = worldY(hB); let low = Infinity; for (const y of yB) low = Math.min(low, y);
  const yA = worldY(hA), prim = hA.getMesh().listPrimitives()[0], ix = prim.getIndices().getArray(), keep = [];
  for (let t = 0; t < ix.length; t += 3) { if (yA[ix[t]] < low && yA[ix[t + 1]] < low && yA[ix[t + 2]] < low) { cut++; continue; } keep.push(ix[t], ix[t + 1], ix[t + 2]); }
  if (cut) prim.setIndices(acc(new Uint32Array(keep), 'SCALAR'));
}
await A.transform(prune({ keepAttributes: true }), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, A);
console.log(JSON.stringify({ file: dst.split('/').pop(), bodyVerts: n, neckTrianglesCut: cut, skeletonDiff: +worst.toExponential(2), bytes: fs.statSync(dst).size }));
