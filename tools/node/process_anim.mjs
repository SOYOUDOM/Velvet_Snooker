// Slim a Rocketbox clip for the browser: rotations for every bone, translation
// only for the root (Bip01), optional in-place walking, frame-rate reduction,
// redundant-key removal and meshopt compression of the keyframe data.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { resample, prune, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const [src, dst, name, stepArg, ...flags] = process.argv.slice(2);
const step = Number(stepArg || 2), inplace = flags.includes('inplace'), noface = flags.includes('noface');
const FACE = /(Eye|Lip|Mouth|Masseter|Caninus|Cheek|Eyebrow|Jaw|Tongue|Nose)/;
const doc = await io.read(src);
const root = doc.getRoot();
const anim = root.listAnimations()[0];
anim.setName(name);
let refY = null, kept = 0, dropped = 0;
const restOf = (node) => node.getTranslation();
for (const ch of anim.listChannels()) {
  const node = ch.getTargetNode(), nm = node.getName(), path = ch.getTargetPath(), sampler = ch.getSampler();
  const out = sampler.getOutput(), n = out.getCount();
  if (path === 'scale' || nm === 'Bip01 Footsteps' || nm === 'MotionExtractionHelper' || (noface && FACE.test(nm))) { ch.dispose(); dropped++; continue; }
  if (path !== 'translation') continue;
  if (nm === 'Bip01') {
    refY = restOf(node)[1];
    if (inplace) { const f = out.getElement(0, []); for (let i = 0; i < n; i++) { const e = out.getElement(i, []); e[0] = f[0]; e[2] = f[2]; out.setElement(i, e); } }
    continue; // the root stays absolute; the game rescales it per character
  }
  // Every other bone: store the motion as an offset from this clip's rest pose,
  // so each character keeps its own bone lengths (shoulder width, face shape).
  const rest = restOf(node); let m = 0;
  for (let i = 0; i < n; i++) { const e = out.getElement(i, []); e[0] -= rest[0]; e[1] -= rest[1]; e[2] -= rest[2]; m = Math.max(m, Math.hypot(...e)); out.setElement(i, e); }
  if (m < 0.0005) { ch.dispose(); dropped++; } else kept++;
}
// Frame-rate reduction: keep every `step`-th key (always keep the last for a clean loop).
if (step > 1) {
  const seen = new Map();
  for (const ch of anim.listChannels()) {
    const s = ch.getSampler(); if (seen.has(s)) continue; seen.set(s, true);
    const input = s.getInput(), output = s.getOutput(), n = input.getCount(), size = output.getElementSize();
    const keep = []; for (let i = 0; i < n; i += step) keep.push(i); if (keep[keep.length-1] !== n-1) keep.push(n-1);
    const ti = new Float32Array(keep.length), to = new Float32Array(keep.length * size);
    keep.forEach((k, j) => { ti[j] = input.getElement(k, [])[0]; const e = output.getElement(k, []); for (let c = 0; c < size; c++) to[j*size+c] = e[c]; });
    const newIn = doc.createAccessor().setType('SCALAR').setArray(ti).setBuffer(input.getBuffer());
    const newOut = doc.createAccessor().setType(output.getType()).setArray(to).setBuffer(output.getBuffer());
    s.setInput(newIn).setOutput(newOut);
  }
}
// Drop the stray mesh-less helper nodes' meshes etc.; keep the skeleton for names.
for (const m of root.listMeshes()) m.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(dst, doc);
const dur = anim.listChannels()[0].getSampler().getInput().getMax([])[0];
console.log(JSON.stringify({ name, dur: +dur.toFixed(3), refY: refY && +refY.toFixed(4), channels: anim.listChannels().length, offsetTracks: kept, dropped }));
