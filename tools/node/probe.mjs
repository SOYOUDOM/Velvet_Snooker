import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
const av = await io.read('/home/claude/work/rb/raw/Business_Male_06.glb');
for (const n of av.getRoot().listNodes().slice(0, 6)) console.log('avatar node', JSON.stringify(n.getName()), 'T', n.getTranslation().map(v=>+v.toFixed(3)), 'R', n.getRotation().map(v=>+v.toFixed(3)), 'S', n.getScale().map(v=>+v.toFixed(3)), 'children', n.listChildren().length);
const scene = av.getRoot().listScenes()[0]; console.log('scene roots', scene.listChildren().map(n=>n.getName()));
for (const f of ['m_walk_neutral_01','m_sit_chair_idle_neutral_01','m_idle_neutral_01']) {
  const d = await io.read(`/home/claude/work/rb/raw_anim/${f}.glb`); const a = d.getRoot().listAnimations()[0];
  const ch = a.listChannels(); const names = new Set(ch.map(c=>c.getTargetNode().getName()));
  console.log(f, 'channels', ch.length, 'nodes', names.size, 'roots', d.getRoot().listScenes()[0].listChildren().map(n=>n.getName()+' R'+n.getRotation().map(v=>+v.toFixed(3))));
  for (const c of ch) { const nm = c.getTargetNode().getName(); if ((nm==='Bip01'||nm==='Bip01 Pelvis') && c.getTargetPath()==='translation') { const out = c.getSampler().getOutput(); const n = out.getCount(); const e0 = out.getElement(0,[]), e1 = out.getElement(n-1,[]), em = out.getElement(n>>1,[]); console.log('  ', nm, 'T first', e0.map(v=>+v.toFixed(3)), 'mid', em.map(v=>+v.toFixed(3)), 'last', e1.map(v=>+v.toFixed(3)), 'keys', n, 'dur', c.getSampler().getInput().getMax([])[0].toFixed(2)); } }
  // are non-root translations constant?
  let varying = 0; for (const c of ch) { if (c.getTargetPath()!=='translation') continue; const nm=c.getTargetNode().getName(); if (nm==='Bip01') continue; const out=c.getSampler().getOutput(); const a0=out.getElement(0,[]); for (let i=1;i<out.getCount();i++){ const e=out.getElement(i,[]); if (Math.hypot(e[0]-a0[0],e[1]-a0[1],e[2]-a0[2])>1e-4){varying++;break;} } }
  console.log('   non-root translation tracks that vary:', varying);
}
