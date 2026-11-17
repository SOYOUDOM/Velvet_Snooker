import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f); const root = doc.getRoot();
  console.log('==', f);
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const pos = p.getAttribute('POSITION'); const idx = p.getIndices();
    console.log(' mesh', m.getName(), 'verts', pos.getCount(), 'tris', idx ? idx.getCount()/3 : '-', 'attrs', p.listSemantics().join(','), 'mat', p.getMaterial()?.getName());
    const mn = pos.getMin([]), mx = pos.getMax([]); console.log('   bbox', mn.map(v=>v.toFixed(2)), mx.map(v=>v.toFixed(2)));
  }
  for (const s of root.listSkins()) console.log(' skin joints', s.listJoints().length, s.listJoints().slice(0,6).map(j=>j.getName()).join(' | '), '...');
  for (const mat of root.listMaterials()) console.log(' material', mat.getName(), 'baseTex', mat.getBaseColorTexture()?.getURI());
  for (const a of root.listAnimations()) { const ch = a.listChannels(); const s0 = ch[0]?.getSampler(); console.log(' anim', a.getName(), 'channels', ch.length, 'keys', s0?.getInput().getCount(), 'dur', s0?.getInput().getMax([])[0]); console.log('   paths', [...new Set(ch.map(c=>c.getTargetPath()))].join(','), 'targets', ch.slice(0,4).map(c=>c.getTargetNode()?.getName()+'.'+c.getTargetPath()).join(' ')); }
  const nodes = root.listNodes(); console.log(' nodes', nodes.length, nodes.slice(0,8).map(n=>n.getName()+(n.getScale().some(v=>Math.abs(v-1)>1e-3)?'(s'+n.getScale().map(v=>v.toFixed(3))+')':'')).join(' | '));
}
