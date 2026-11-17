// Split the embedded people (people-data.js) into a characters/ folder:
// models/*.glb without textures, textures/*.jpg|png, animations/*.glb.
// usage: node split_characters.mjs <people-data.js> <out characters dir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const [dataJs, out] = process.argv.slice(2);
for (const d of ['models', 'textures', 'animations']) fs.mkdirSync(`${out}/${d}`, { recursive: true });
const src = fs.readFileSync(dataJs, 'utf8');
const people = [], animations = {};
for (const [, name, b64] of src.matchAll(/"([A-Za-z0-9_]+)":"([A-Za-z0-9+/=]+)"/g)) {
  const buf = Buffer.from(b64, 'base64');
  if (/^(m|f)_/.test(name)) { fs.writeFileSync(`${out}/animations/${name}.glb`, buf); animations[name] = `characters/animations/${name}.glb`; continue; }
  const doc = await io.readBinary(new Uint8Array(buf));
  const id = name === 'Business_Male_06' ? 'referee' : name.toLowerCase();
  const textures = {}, normals = {};
  const save = (tex, suffix) => {
    const img = tex.getImage(); if (!img || img.byteLength < 1500) return null;      // skip flat placeholders
    const ext = tex.getMimeType() === 'image/png' ? 'png' : 'jpg', file = `${id}_${suffix}.${ext}`;
    fs.writeFileSync(`${out}/textures/${file}`, img); return `characters/textures/${file}`;
  };
  for (const m of doc.getRoot().listMaterials()) {
    const kind = m.getName().split('_').pop();
    const bc = m.getBaseColorTexture(), nt = m.getNormalTexture();
    if (bc) { const p = save(bc, kind); if (p) textures[kind] = p; m.setBaseColorTexture(null); }
    if (nt) { const p = save(nt, kind + '_normal'); if (p) normals[kind] = p; m.setNormalTexture(null); }
  }
  await doc.transform(prune({ keepAttributes: true, keepLeaves: true }));
  fs.writeFileSync(`${out}/models/${id}.glb`, await io.writeBinary(doc));
  people.push({ id, role: id === 'referee' ? 'referee' : 'audience', gender: /Female/.test(name) ? 'female' : 'male', source: name,
    model: `characters/models/${id}.glb`, textures, normals });
}
fs.writeFileSync(`${out}/_split.json`, JSON.stringify({ animations, people }, null, 1));
console.log('people', people.length, 'animations', Object.keys(animations).length);
