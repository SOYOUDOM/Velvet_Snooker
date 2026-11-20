// A person's own build, baked into their own model file (VELVET 7.2).
// The Rocketbox people all share one skeleton and one slim-to-average body. This reshapes a model
// to a build - a waist (as a waist-to-height ratio), how much of it is belly, and the chest, seat,
// arms, legs, neck and face that go with it - and writes it as a new .glb. The skeleton, the
// skin weights, the face shapes (ARKit and speech) and the textures' layout stay exactly as they
// are, so every animation, the cue stance, the faces and the lip-sync work as before.
//
// How: every point is moved in the bind pose, in metres, by a smooth field worked out from the
// skeleton: out from the spine for the waist, belly, seat, chest and back (most at the front for a
// belly, which also settles a little over the belt), out from each bone for the arms, legs and neck,
// and a fuller jaw line and chin. Points on a seam (head and collar, texture seams) move together;
// the field is smoothed over the surface; hands, feet, eyes and the top of the head do not move.
// Normals turn with the surface. The waist is measured (round the body, like a tape) and the
// amount is solved to reach the ratio asked for.
//
// usage: node body_shape.mjs in.glb out.glb '{"whtr":0.58,"belly":0.8,"limbs":1,"face":1}'
//   whtr   waist (at the belly, clothed) / standing height of the model; omit to keep the waist
//   fat    or the amount itself (-0.6 slim .. 1.6 very heavy) instead of whtr
//   belly  0..1, how much the build carries at the front (a round belly) rather than all round
//   limbs, chest, seat, neck, face   0..1.5, scale those parts of the build (default 1)
// prints a report (base and new measurements, in cm)
import fs from 'node:fs';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';

const [src, dst, json] = process.argv.slice(2);
const opt = Object.assign({ belly: 0.6, limbs: 1, chest: 1, seat: 1, neck: 1, face: 1 }, JSON.parse(json || '{}'));
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src), root = doc.getRoot();
doc.setLogger(new Logger(Logger.Verbosity.WARN));
await doc.transform(dequantize());

// ---- the skeleton in the bind pose ----
// (each mesh has its own skin: quantizing folds each mesh's own scale into its skin's inverse bind matrices)
const worldOf = (n) => { const m = new THREE.Matrix4().fromArray(n.getMatrix()); for (let p = n.getParentNode(); p; p = p.getParentNode()) m.premultiply(new THREE.Matrix4().fromArray(p.getMatrix())); return m; };
const short = (j) => j.getName().replace(/^Bip01[ _]/, '');
const J = {}; for (const j of root.listSkins()[0].listJoints()) J[short(j)] = new THREE.Vector3().setFromMatrixPosition(worldOf(j));
for (const k of ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L UpperArm', 'L Forearm', 'L Hand', 'L Thigh', 'L Calf', 'L Foot', 'MBottomLip', 'MNose', 'REye'])
  if (!J[k]) throw new Error('not a Rocketbox skeleton: no ' + k);
const FWD = Math.sign((J['L Toe0'] || J['L Foot']).z - J['L Foot'].z + 1e-9) || 1;   // the way the model faces (+Z)

// ---- the parts, in metres ----
const BODY_RX = /^(Pelvis|Spine\d?|Neck|Head|[LR] (Clavicle|UpperArm|Forearm|Hand|Thigh|Calf|Foot|Toe0|Finger\d+))$/;
const GROUPS = { torso: /^(Pelvis|Spine\d?|[LR] Clavicle)$/, ua: /^[LR] UpperArm$/, fa: /^[LR] Forearm$/, hand: /^[LR] (Hand|Finger\d+)$/,
  th: /^[LR] Thigh$/, ca: /^[LR] Calf$/, foot: /^[LR] (Foot|Toe0)$/, neck: /^Neck$/, head: null };
const parts = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh || !node.getSkin()) continue;
  const sk = node.getSkin(), sj = sk.listJoints(), sibm = sk.getInverseBindMatrices().getArray(), names = sj.map(short);
  const jointM = sj.map((j, i) => worldOf(j).multiply(new THREE.Matrix4().fromArray(sibm.slice(i * 16, i * 16 + 16))));
  const G = {}; for (const g in GROUPS) G[g] = names.map((n) => (GROUPS[g] ? GROUPS[g].test(n) : n === 'Head' || !BODY_RX.test(n)));
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL'), jn = prim.getAttribute('JOINTS_0'), wt = prim.getAttribute('WEIGHTS_0');
    const n = pos.getCount(), P = new Float64Array(n * 3), N = new Float64Array(n * 3), S = [], R = {};
    for (const k in G) R[k] = new Float32Array(n);
    const v = new THREE.Vector3(), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      jn.getElement(i, jj); wt.getElement(i, ww);
      const sum = ww[0] + ww[1] + ww[2] + ww[3] || 1; m.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      for (let k = 0; k < 4; k++) { const w = ww[k] / sum; if (!w) continue; const e = jointM[jj[k]].elements; for (let q = 0; q < 16; q++) m.elements[q] += e[q] * w;
        for (const g in G) if (G[g][jj[k]]) R[g][i] += w; }
      S.push(m.clone());
      v.fromArray(pos.getElement(i, [0, 0, 0])).applyMatrix4(m); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      nm.getNormalMatrix(m); v.fromArray(nor.getElement(i, [0, 0, 0])).applyMatrix3(nm).normalize(); N[i * 3] = v.x; N[i * 3 + 1] = v.y; N[i * 3 + 2] = v.z;
    }
    parts.push({ prim, name: prim.getMaterial()?.getName() || mesh.getName(), n, P, N, S, R, idx: prim.getIndices().getArray() });
  }
}

// ---- welding: one id for every point that sits on another (seams, the head on the collar) ----
const all = []; parts.forEach((p, pi) => { for (let i = 0; i < p.n; i++) all.push([pi, i]); });
const gid = parts.map((p) => new Int32Array(p.n));
{ const grid = new Map(), tol = 2e-4, key = (x, y, z) => `${Math.round(x / tol)},${Math.round(y / tol)},${Math.round(z / tol)}`; let next = 0;
  parts.forEach((p, pi) => { for (let i = 0; i < p.n; i++) { const x = p.P[i * 3], y = p.P[i * 3 + 1], z = p.P[i * 3 + 2];
    let id = -1;
    for (let dx = -1; dx <= 1 && id < 0; dx++) for (let dy = -1; dy <= 1 && id < 0; dy++) for (let dz = -1; dz <= 1 && id < 0; dz++) {
      const c = grid.get(key(x + dx * tol, y + dy * tol, z + dz * tol)); if (c) for (const [qi, qj, qid] of c) { const q = parts[qi]; if (Math.hypot(q.P[qj * 3] - x, q.P[qj * 3 + 1] - y, q.P[qj * 3 + 2] - z) < tol) { id = qid; break; } } }
    if (id < 0) id = next++;
    gid[pi][i] = id; const k = key(x, y, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([pi, i, id]); } });
  var NG = next; }
// neighbours of each welded point (from the triangles)
const nb = Array.from({ length: NG }, () => new Set());
parts.forEach((p, pi) => { const g = gid[pi], ix = p.idx; for (let t = 0; t < ix.length; t += 3) { const a = g[ix[t]], b = g[ix[t + 1]], c = g[ix[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); } });
const nbArr = nb.map((s) => Int32Array.from(s));

// ---- the field ----
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (u, a, b, c, d) => sm(a, b, u) * (1 - sm(c, d, u));
const spineAxis = [J.Pelvis, J.Spine, J.Spine1, J.Spine2, J.Neck];
function axisAt(y) {
  if (y <= spineAxis[0].y) return spineAxis[0];
  for (let k = 1; k < spineAxis.length; k++) if (y <= spineAxis[k].y) { const a = spineAxis[k - 1], b = spineAxis[k]; return new THREE.Vector3().lerpVectors(a, b, (y - a.y) / (b.y - a.y)); }
  return spineAxis[spineAxis.length - 1];
}
const yP = J.Pelvis.y, yC = J.Spine2.y, yN = J.Neck.y;
const seg = (a, b) => ({ a: J[a], b: J[b] });
const LIMBS = [['ua', seg('L UpperArm', 'L Forearm'), seg('R UpperArm', 'R Forearm'), 0],
  ['fa', seg('L Forearm', 'L Hand'), seg('R Forearm', 'R Hand'), 1], ['th', seg('L Thigh', 'L Calf'), seg('R Thigh', 'R Calf'), 0],
  ['ca', seg('L Calf', 'L Foot'), seg('R Calf', 'R Foot'), 1]];
const yLip = J.MBottomLip.y, yNose = J.MNose.y, yEye = J.REye.y, headAxis = new THREE.Vector3(J.Head.x, 0, J.Head.z + 0.03 * FWD);
const yChin = yLip - 0.042;

// D (metres, world) for a fatness F: >0 heavier, <0 slimmer
function field(F) {
  const heavy = Math.max(0, F), slim = Math.min(0, F), b = Math.min(1, Math.max(0, opt.belly));
  const A = {   // at F = 1: a heavy build (about 30 cm more round the waist)
    belly: (0.035 + 0.075 * b) * heavy + 0.045 * slim * (0.4 + 0.6 * b), waist: (0.045 - 0.015 * b) * heavy + 0.022 * slim,
    seat: 0.026 * heavy * opt.seat + 0.012 * slim * opt.seat, chest: 0.022 * heavy * opt.chest + 0.008 * slim * opt.chest, back: 0.024 * heavy * opt.chest + 0.006 * slim,
    face: 0.014 * heavy * opt.face + 0.003 * slim * opt.face, chin: 0.016 * heavy * opt.face,
  };
  const K = { ua: 0.22 * heavy + 0.07 * slim, fa: 0.09 * heavy + 0.03 * slim, th: 0.2 * heavy + 0.06 * slim, ca: 0.06 * heavy + 0.025 * slim, neck: 0.18 * heavy + 0.04 * slim };
  for (const k of ['ua', 'fa', 'th', 'ca']) K[k] *= opt.limbs; K.neck *= opt.neck;
  return parts.map((p) => {
    const D = new Float64Array(p.n * 3), R = p.R;
    for (let i = 0; i < p.n; i++) {
      const x = p.P[i * 3], y = p.P[i * 3 + 1], z = p.P[i * 3 + 2];
      let dx = 0, dy = 0, dz = 0;
      // the trunk: out from the spine
      const mt = Math.min(1, R.torso[i] + R.th[i] * sm(0.70, 0.86, y)) * (1 - sm(yN - 0.06, yN + 0.01, y));
      if (mt > 1e-3) {
        const ax = axisAt(y), rx = x - ax.x, rz = z - ax.z, rl = Math.hypot(rx, rz) || 1, ux = rx / rl, uz = rz / rl;
        const c = uz * FWD, s = Math.abs(ux), front = Math.pow(Math.max(0, c), 1.3), back = Math.pow(Math.max(0, -c), 1.3), side = Math.pow(s, 1.2);
        const u = (y - yP) / (yC - yP);
        const fB = A.belly * bump(u, 0.02, 0.36, 0.55, 1.08) * front;
        let mag = fB + A.waist * bump(u, -0.2, 0.25, 0.6, 1.15) * (0.3 * front + 0.7 * side + 0.35 * back)
          + A.seat * bump(u, -0.75, -0.3, -0.05, 0.3) * (0.75 * back + 0.55 * side + 0.1 * front)
          + A.chest * bump(u, 0.75, 1.0, 1.15, 1.45) * (0.8 * front + 0.5 * side)
          + A.back * bump(u, 0.55, 0.9, 1.2, 1.55) * back * (1 - 0.4 * s);
        mag *= mt;
        dx += ux * mag; dz += uz * mag;
        dy -= 0.3 * Math.max(0, fB) * mt * (1 - sm(0.12, 0.42, u));     // a belly settles a little over the belt
      }
      // arms and legs: thicker (or thinner) round their bones, less towards the wrists and ankles
      for (const [g, L, Rt, taper] of LIMBS) {
        const w = R[g][i]; if (w < 1e-3 || !K[g]) continue;
        const sg = (x >= 0) === (L.a.x >= 0) ? L : Rt;      // this side's bone
        const ab = new THREE.Vector3().subVectors(sg.b, sg.a), ap = new THREE.Vector3(x - sg.a.x, y - sg.a.y, z - sg.a.z);
        const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq())), q = ap.addScaledVector(ab, -t);
        const k = K[g] * w * (taper ? 1 - sm(0.65, 1.0, t) : 1) * (g === 'ua' ? sm(0.0, 0.25, t) * 0.5 + 0.5 : 1);
        dx += q.x * k; dy += q.y * k; dz += q.z * k;
      }
      // the neck and the collar round it, together (by where they are, so the collar stays round the neck)
      if (K.neck) { const rx = x - J.Neck.x, rz = z - J.Neck.z, rr = Math.hypot(rx, rz);
        const k = K.neck * bump(y, yN - 0.085, yN - 0.03, yN + 0.04, J.Head.y + 0.035) * (1 - sm(0.085, 0.12, rr)) * (1 - Math.min(1, R.ua[i] + R.hand[i]));
        if (k > 1e-4) { dx += rx * k; dz += rz * k; } }
      // a fuller jaw line and the beginnings of a double chin (never the lips, the eyes or above)
      const wh = R.head[i] + 0.5 * R.neck[i];
      if (wh > 1e-3 && (A.face || A.chin) && y < yNose + 0.01) {
        const rx = x - headAxis.x, rz = z - headAxis.z, rl = Math.hypot(rx, rz) || 1, ux = rx / rl, uz = rz / rl, c = uz * FWD, s = Math.abs(ux);
        const jowl = A.face * bump(y, yChin - 0.035, yLip - 0.012, yLip + 0.008, yNose) * (0.25 + 0.75 * Math.pow(s, 1.2)) * sm(-0.35, 0.15, c) * Math.min(1, wh);
        dx += ux * jowl; dz += uz * jowl;
        const under = A.chin * bump(y, yChin - 0.07, yChin - 0.03, yChin - 0.005, yChin + 0.012) * sm(0.15, 0.6, c) * Math.min(1, wh);
        dz += FWD * under * 0.75; dy -= under * 0.55;
      }
      // still: hands, feet, eyes and up
      const pin = Math.max(R.hand[i], R.foot[i]);
      const keep = (1 - sm(0.3, 0.8, pin)) * (1 - sm(yEye - 0.03, yEye - 0.005, y) * (R.head[i] > 0.5 ? 1 : 0));
      D[i * 3] = dx * keep; D[i * 3 + 1] = dy * keep; D[i * 3 + 2] = dz * keep;
    }
    return D;
  });
}
// one move per welded point (their average), smoothed over the surface; pinned points stay
function weldSmooth(Ds, iters = 5) {
  const acc = new Float64Array(NG * 3), cnt = new Float64Array(NG), pinned = new Uint8Array(NG);
  parts.forEach((p, pi) => { for (let i = 0; i < p.n; i++) { const g = gid[pi][i]; for (let k = 0; k < 3; k++) acc[g * 3 + k] += Ds[pi][i * 3 + k]; cnt[g]++;
    if (Math.max(p.R.hand[i], p.R.foot[i]) > 0.8 || (p.R.head[i] > 0.5 && p.P[i * 3 + 1] > yEye - 0.005)) pinned[g] = 1; } });
  let cur = acc.map((v, k) => v / cnt[(k / 3) | 0]);
  for (let it = 0; it < iters; it++) {
    const nx = new Float64Array(NG * 3);
    for (let g = 0; g < NG; g++) {
      const ns = nbArr[g];
      if (pinned[g] || !ns.length) { nx[g * 3] = cur[g * 3]; nx[g * 3 + 1] = cur[g * 3 + 1]; nx[g * 3 + 2] = cur[g * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0; for (const q of ns) { sx += cur[q * 3]; sy += cur[q * 3 + 1]; sz += cur[q * 3 + 2]; }
      const L = ns.length;
      nx[g * 3] = cur[g * 3] * 0.5 + sx / L * 0.5; nx[g * 3 + 1] = cur[g * 3 + 1] * 0.5 + sy / L * 0.5; nx[g * 3 + 2] = cur[g * 3 + 2] * 0.5 + sz / L * 0.5;
    }
    cur = nx;
  }
  return cur;
}
// ---- measuring: round the trunk at a height, like a tape (the hull of the cross-section) ----
function girthAt(Dg, y, half = 0.26) {
  const pts = [];
  parts.forEach((p, pi) => { if (!/body|head/.test(p.name)) return; const g = gid[pi], ix = p.idx;
    const X = (i) => p.P[i * 3] + Dg[g[i] * 3], Y = (i) => p.P[i * 3 + 1] + Dg[g[i] * 3 + 1], Z = (i) => p.P[i * 3 + 2] + Dg[g[i] * 3 + 2];
    for (let t = 0; t < ix.length; t += 3) for (let e = 0; e < 3; e++) { const a = ix[t + e], b = ix[t + (e + 1) % 3], ya = Y(a), yb = Y(b);
      if ((ya - y) * (yb - y) >= 0 || ya === yb) continue; const f = (y - ya) / (yb - ya), x = X(a) + (X(b) - X(a)) * f, z = Z(a) + (Z(b) - Z(a)) * f;
      if (Math.abs(x) < half && Math.abs(z) < 0.4) pts.push([x, z]); } });
  if (pts.length < 3) return { g: 0, depth: 0, width: 0, front: 0 };
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const q of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of pts.slice().reverse()) { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)); let L = 0; for (let k = 0; k < h.length; k++) { const a = h[k], b = h[(k + 1) % h.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const zs = h.map((q) => q[1] * FWD), xs = h.map((q) => q[0]);
  return { g: L, depth: Math.max(...zs) - Math.min(...zs), width: Math.max(...xs) - Math.min(...xs), front: Math.max(...zs) };
}
let topY = 0; parts.forEach((p) => { for (let i = 0; i < p.n; i++) topY = Math.max(topY, p.P[i * 3 + 1]); });
function measure(Dg) {
  // the waist where a belly is: round the navel (a little above the lower spine joint; 1.08 m on these skeletons)
  const waist = Object.assign(girthAt(Dg, J.Spine.y + 0.065), { y: J.Spine.y + 0.065 });
  const chest = girthAt(Dg, yC + 0.02, 0.21), hips = girthAt(Dg, yP - 0.03, 0.3), neck = girthAt(Dg, J.Neck.y + 0.005, 0.1);
  const cm = (v) => +(v * 100).toFixed(1);
  return { height: cm(topY), waist: cm(waist.g), waistAt: cm(waist.y || 0), bellyFront: cm(waist.front || 0), chest: cm(chest.g), hips: cm(hips.g), neck: cm(neck.g), whtr: +(waist.g / topY).toFixed(3) };
}
const zero = new Float64Array(NG * 3), base = measure(zero);
let F = opt.fat ?? 0;
if (opt.whtr != null) {   // solve for the amount that gives the waist asked for
  const want = opt.whtr * topY, g = (f) => girthAt(weldSmooth(field(f)), base.waistAt / 100).g;
  let f0 = 0, g0 = base.waist / 100, f1 = (want - g0) / 0.3, g1 = g(f1);
  for (let it = 0; it < 6 && Math.abs(g1 - want) > 0.004; it++) { const f2 = f1 + (want - g1) * (f1 - f0) / ((g1 - g0) || 1e-6); f0 = f1; g0 = g1; f1 = Math.max(-1.0, Math.min(1.8, f2)); g1 = g(f1); }
  F = f1;
}
const Dg = weldSmooth(field(F)), after = measure(Dg);

// ---- write the new shape: positions and normals back into the model's own space ----
function vertexNormals(Dg) {   // area-weighted, per welded point
  const nn = new Float64Array(NG * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  parts.forEach((p, pi) => { const g = gid[pi], ix = p.idx; const at = (i, v) => v.set(p.P[i * 3] + Dg[g[i] * 3], p.P[i * 3 + 1] + Dg[g[i] * 3 + 1], p.P[i * 3 + 2] + Dg[g[i] * 3 + 2]);
    for (let t = 0; t < ix.length; t += 3) { at(ix[t], a); at(ix[t + 1], b); at(ix[t + 2], c); e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
      for (let k = 0; k < 3; k++) { const q = g[ix[t + k]]; nn[q * 3] += e1.x; nn[q * 3 + 1] += e1.y; nn[q * 3 + 2] += e1.z; } } });
  return nn;
}
const n0 = vertexNormals(zero), n1 = vertexNormals(Dg);
const qv = new THREE.Quaternion(), va = new THREE.Vector3(), vb = new THREE.Vector3(), v = new THREE.Vector3(), inv = new THREE.Matrix4(), m3 = new THREE.Matrix3();
let worstTurn = 0, worstAt = null;
parts.forEach((p, pi) => {
  const pos = p.prim.getAttribute('POSITION'), nor = p.prim.getAttribute('NORMAL'), g = gid[pi];
  const PA = new Float32Array(p.n * 3), NA = new Float32Array(p.n * 3);
  for (let i = 0; i < p.n; i++) {
    const q = g[i];
    va.set(n0[q * 3], n0[q * 3 + 1], n0[q * 3 + 2]); vb.set(n1[q * 3], n1[q * 3 + 1], n1[q * 3 + 2]);
    if (va.lengthSq() > 1e-20 && vb.lengthSq() > 1e-20) { va.normalize(); vb.normalize(); qv.setFromUnitVectors(va, vb);
      if (va.angleTo(vb) > 0.6) qv.identity();     // a sliver's normal flips; a smooth reshape never turns a surface that much
      const an = va.angleTo(vb); if (an > worstTurn) { worstTurn = an; worstAt = { part: p.name, y: +p.P[i * 3 + 1].toFixed(3), x: +p.P[i * 3].toFixed(3), z: +p.P[i * 3 + 2].toFixed(3), nb: nbArr[q].length }; } } else qv.identity();
    inv.copy(p.S[i]).invert();
    v.set(p.P[i * 3] + Dg[q * 3], p.P[i * 3 + 1] + Dg[q * 3 + 1], p.P[i * 3 + 2] + Dg[q * 3 + 2]).applyMatrix4(inv); PA[i * 3] = v.x; PA[i * 3 + 1] = v.y; PA[i * 3 + 2] = v.z;
    // world normal turned with the surface, then back: n_local ~ S^T n_world
    v.set(p.N[i * 3], p.N[i * 3 + 1], p.N[i * 3 + 2]).applyQuaternion(qv); m3.setFromMatrix4(p.S[i]).transpose(); v.applyMatrix3(m3).normalize();
    NA[i * 3] = v.x; NA[i * 3 + 1] = v.y; NA[i * 3 + 2] = v.z;
  }
  pos.setArray(PA); nor.setArray(NA);
});
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
let maxMove = 0; for (let k = 0; k < NG; k++) maxMove = Math.max(maxMove, Math.hypot(Dg[k * 3], Dg[k * 3 + 1], Dg[k * 3 + 2]));
console.log(JSON.stringify({ file: dst.split('/').pop(), fat: +F.toFixed(3), base, after, maxMoveCm: +(maxMove * 100).toFixed(1), worstNormalTurnDeg: +(worstTurn * 180 / Math.PI).toFixed(1), worstAt, bytes: fs.statSync(dst).size }));
