import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const f of ['m_walk_neutral_01','m_sit_chair_idle_neutral_01','m_claphands_01']) {
  const d = await io.read(`/home/claude/work/rb/raw_anim/${f}.glb`); const a = d.getRoot().listAnimations()[0];
  const devs = [];
  const rot = [];
  for (const c of a.listChannels()) { const nm=c.getTargetNode().getName(); const out=c.getSampler().getOutput();
    if (c.getTargetPath()==='rotation') rot.push(nm.replace('Bip01 ',''));
    if (c.getTargetPath()!=='translation'||nm==='Bip01') continue; const a0=out.getElement(0,[]); let m=0; for (let i=1;i<out.getCount();i++){const e=out.getElement(i,[]); m=Math.max(m,Math.hypot(e[0]-a0[0],e[1]-a0[1],e[2]-a0[2]));} if (m>1e-3) devs.push(nm+':'+(m*1000).toFixed(1)+'mm'); }
  console.log(f, '\n  varying translations:', devs.join(', ') || 'none', '\n  rotation tracks ('+rot.length+'):', rot.join(','));
}
