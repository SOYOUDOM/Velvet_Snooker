/* VELVET Studio — texture engine.
   A character's texture images are edited through its 3D surface: every texel
   is tied to the triangle it belongs to, so a click on the body, a brush
   stroke, a face photo or a sticker lands on the right place of the image.
   Layers, from the bottom: the original image, skin tone, hair colour, outfit
   colours, the face photo, touch-up paint, and a sticker being placed.
   Everything runs on the CPU in typed arrays. Exposes window.StudioTex. */
(function () {
  'use strict';
  const T = window.THREE;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // colour distance 0..~1 (weighted so it follows the eye a little better than plain RGB)
  function cdist(r1, g1, b1, r2, g2, b2) {
    const rm = (r1 + r2) / 510, dr = (r1 - r2) / 255, dg = (g1 - g2) / 255, db = (b1 - b2) / 255;
    return Math.sqrt((2 + rm) * dr * dr + 4 * dg * dg + (3 - rm) * db * db) / 3;
  }
  // body part of a bone: 1 head, 2 torso, 3 arms, 4 hands, 5 legs, 6 feet, 7 eyeballs
  function groupOf(name) {
    if (/[LR]Eye$/.test(name)) return 7;
    if (/Head|Eye|Jaw|Lip|Mouth|Cheek|Tongue|brow|Nose|Blink/i.test(name)) return 1;
    if (/Spine|Clavicle|Neck/i.test(name)) return 2;
    if (/UpperArm|Forearm/i.test(name)) return 3;
    if (/Hand|Finger/i.test(name)) return 4;
    if (/Pelvis|Thigh|Calf/i.test(name)) return 5;
    if (/Foot|Toe/i.test(name)) return 6;
    return 0;
  }
  const _v = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3(), _e1 = new T.Vector3(), _e2 = new T.Vector3(), _p = new T.Vector3(), _q = new T.Vector3();

  // ---------------------------------------------------------------------------
  // A part = one texture image of the character (head, body, opacity/hair)
  // and the triangles painted with it.
  function buildPart(key, meshes, image, opts = {}) {
    const W = image.naturalWidth || image.width, H = image.naturalHeight || image.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(image, 0, 0);
    const base = cx.getImageData(0, 0, W, H);
    const out = cx.createImageData(W, H);
    const tex = new T.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 4;
    const P = { key, meshes, W, H, base, out, canvas: cv, ctx: cx, tex, alpha: !!opts.alpha,
      skin: null, hair: null, regions: [], face: null, keep: null, paint: null, temp: null, gain: [1, 1, 1], hairColor: null };
    gatherTriangles(P);
    rasterUV(P);
    buildGrid(P);
    composite(P);
    return P;
  }

  // Triangles with their world positions in the current pose, welded
  // neighbours (so a selection can cross the seams of the image), the body
  // part they move with and their colour in the original image.
  function gatherTriangles(P) {
    const corners = [], uvs = [], grp = [], meshOf = [], vsrc = [];
    for (let mi = 0; mi < P.meshes.length; mi++) {
      const m = P.meshes[mi], g = m.geometry, pos = g.attributes.position, uv = g.attributes.uv;
      if (!uv) continue;
      m.updateMatrixWorld(true);
      if (m.skeleton) m.skeleton.update();
      const nv = pos.count, wp = new Float32Array(nv * 3);
      for (let i = 0; i < nv; i++) {
        if (m.isSkinnedMesh) m.getVertexPosition(i, _v); else _v.fromBufferAttribute(pos, i);
        _v.applyMatrix4(m.matrixWorld); wp[i * 3] = _v.x; wp[i * 3 + 1] = _v.y; wp[i * 3 + 2] = _v.z;
      }
      const vg = new Uint8Array(nv);
      if (g.attributes.skinIndex && m.skeleton) {
        const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = m.skeleton.bones, acc = new Float32Array(8);
        for (let i = 0; i < nv; i++) {
          acc.fill(0);
          for (let k = 0; k < 4; k++) { const b = bones[si.getComponent(i, k)]; if (b) acc[groupOf(b.name)] += sw.getComponent(i, k); }
          let best = 0; for (let k = 1; k < 8; k++) if (acc[k] > acc[best]) best = k; vg[i] = best;
        }
      }
      const idx = g.index ? g.index.array : null, nt = (idx ? idx.length : nv) / 3;
      for (let t = 0; t < nt; t++) {
        const a = idx ? idx[t * 3] : t * 3, b = idx ? idx[t * 3 + 1] : t * 3 + 1, c = idx ? idx[t * 3 + 2] : t * 3 + 2;
        for (const v of [a, b, c]) { corners.push(wp[v * 3], wp[v * 3 + 1], wp[v * 3 + 2]); uvs.push(uv.getX(v), uv.getY(v)); vsrc.push(v); }
        grp.push(vg[a] === vg[b] || vg[a] === vg[c] ? vg[a] : vg[b] === vg[c] ? vg[b] : vg[a]);
        meshOf.push(mi);
      }
    }
    const n = grp.length;
    P.n = n; P.vsrc = Int32Array.from(vsrc); P.pos = Float32Array.from(corners); P.uv = Float32Array.from(uvs); P.grp = Uint8Array.from(grp); P.meshOf = Uint8Array.from(meshOf);
    // weld corners by position (the image seams split vertices)
    const weld = new Int32Array(n * 3), ids = new Map(); let nw = 0;
    for (let i = 0; i < n * 3; i++) {
      const k = Math.round(P.pos[i * 3] * 2e4) + ',' + Math.round(P.pos[i * 3 + 1] * 2e4) + ',' + Math.round(P.pos[i * 3 + 2] * 2e4);
      let id = ids.get(k); if (id === undefined) { id = nw++; ids.set(k, id); } weld[i] = id;
    }
    // smooth normals per welded vertex
    const acc = new Float32Array(nw * 3);
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      _a.fromArray(P.pos, o); _e1.fromArray(P.pos, o + 3).sub(_a); _e2.fromArray(P.pos, o + 6).sub(_a); _e1.cross(_e2);
      for (let k = 0; k < 3; k++) { const w = weld[t * 3 + k] * 3; acc[w] += _e1.x; acc[w + 1] += _e1.y; acc[w + 2] += _e1.z; }
    }
    P.nrm = new Float32Array(n * 9);
    for (let i = 0; i < n * 3; i++) {
      const w = weld[i] * 3; _v.set(acc[w], acc[w + 1], acc[w + 2]).normalize();
      P.nrm[i * 3] = _v.x; P.nrm[i * 3 + 1] = _v.y; P.nrm[i * 3 + 2] = _v.z;
    }
    // neighbours across shared edges
    const edges = new Map(), adj = Array.from({ length: n }, () => []);
    for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) {
      const a = weld[t * 3 + k], b = weld[t * 3 + (k + 1) % 3], key = a < b ? a * 1048576 + b : b * 1048576 + a;
      const o = edges.get(key); if (o === undefined) edges.set(key, t); else if (o !== t) { adj[t].push(o); adj[o].push(t); }
    }
    P.adj = adj; P.weld = weld; P.nweld = nw;
    // colour of each triangle in the original image (centre and towards the corners)
    P.tcol = new Float32Array(n * 3);
    const d = P.base.data;
    for (let t = 0; t < n; t++) {
      let r = 0, g = 0, b = 0;
      for (const [w0, w1] of [[1 / 3, 1 / 3], [2 / 3, 1 / 6], [1 / 6, 2 / 3], [1 / 6, 1 / 6]]) {
        const u = P.uv[t * 6] * w0 + P.uv[t * 6 + 2] * w1 + P.uv[t * 6 + 4] * (1 - w0 - w1), v = P.uv[t * 6 + 1] * w0 + P.uv[t * 6 + 3] * w1 + P.uv[t * 6 + 5] * (1 - w0 - w1);
        const x = clamp(Math.floor((u - Math.floor(u)) * P.W), 0, P.W - 1), y = clamp(Math.floor((v - Math.floor(v)) * P.H), 0, P.H - 1), i = (y * P.W + x) * 4;
        r += d[i]; g += d[i + 1]; b += d[i + 2];
      }
      P.tcol[t * 3] = r / 4; P.tcol[t * 3 + 1] = g / 4; P.tcol[t * 3 + 2] = b / 4;
    }
  }

  // After the body changes shape (height, head size, belly): new positions,
  // same image layout.
  function refreshPositions(P) {
    const wpOf = P.meshes.map((m) => {
      m.updateMatrixWorld(true); if (m.skeleton) m.skeleton.update();
      const pos = m.geometry.attributes.position, wp = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { if (m.isSkinnedMesh) m.getVertexPosition(i, _v); else _v.fromBufferAttribute(pos, i); _v.applyMatrix4(m.matrixWorld); wp[i * 3] = _v.x; wp[i * 3 + 1] = _v.y; wp[i * 3 + 2] = _v.z; }
      return wp;
    });
    for (let c = 0; c < P.n * 3; c++) { const wp = wpOf[P.meshOf[(c / 3) | 0]], v = P.vsrc[c]; P.pos[c * 3] = wp[v * 3]; P.pos[c * 3 + 1] = wp[v * 3 + 1]; P.pos[c * 3 + 2] = wp[v * 3 + 2]; }
    const acc = new Float32Array(P.nweld * 3);
    for (let t = 0; t < P.n; t++) {
      const o = t * 9; _a.fromArray(P.pos, o); _e1.fromArray(P.pos, o + 3).sub(_a); _e2.fromArray(P.pos, o + 6).sub(_a); _e1.cross(_e2);
      for (let k = 0; k < 3; k++) { const w = P.weld[t * 3 + k] * 3; acc[w] += _e1.x; acc[w + 1] += _e1.y; acc[w + 2] += _e1.z; }
    }
    for (let i = 0; i < P.n * 3; i++) { const w = P.weld[i] * 3; _v.set(acc[w], acc[w + 1], acc[w + 2]).normalize(); P.nrm[i * 3] = _v.x; P.nrm[i * 3 + 1] = _v.y; P.nrm[i * 3 + 2] = _v.z; }
    buildGrid(P);
  }
  // Which triangle every texel belongs to (with a 2-texel margin past the
  // edges, as images are padded), and where inside it.
  function rasterUV(P) {
    const W = P.W, H = P.H, tri = new Int32Array(W * H).fill(-1), bary = new Float32Array(W * H * 2), dist = new Float32Array(W * H).fill(1e9), PAD = 2;
    for (let t = 0; t < P.n; t++) {
      let x0 = P.uv[t * 6] * W, y0 = P.uv[t * 6 + 1] * H, x1 = P.uv[t * 6 + 2] * W, y1 = P.uv[t * 6 + 3] * H, x2 = P.uv[t * 6 + 4] * W, y2 = P.uv[t * 6 + 5] * H;
      const sx = Math.floor(Math.min(x0, x1, x2) / W) * W, sy = Math.floor(Math.min(y0, y1, y2) / H) * H;   // images repeat
      x0 -= sx; x1 -= sx; x2 -= sx; y0 -= sy; y1 -= sy; y2 -= sy;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-8) continue;
      const h0 = Math.abs(area) / (Math.hypot(x2 - x1, y2 - y1) || 1), h1 = Math.abs(area) / (Math.hypot(x0 - x2, y0 - y2) || 1), h2 = Math.abs(area) / (Math.hypot(x1 - x0, y1 - y0) || 1);
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2) - PAD)), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2) + PAD));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2) - PAD)), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2) + PAD));
      for (let py = minY; py <= maxY; py++) {
        const cy = py + 0.5;
        for (let px = minX; px <= maxX; px++) {
          const cx = px + 0.5;
          let w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) / area, w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) / area, w2 = 1 - w0 - w1;
          const d = Math.max(0, -w0 * h0, -w1 * h1, -w2 * h2), i = py * W + px;
          if (d > PAD || d >= dist[i]) continue;
          if (d > 0) { w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const s = w0 + w1 + w2 || 1; w0 /= s; w1 /= s; }
          dist[i] = d; tri[i] = t; bary[i * 2] = w0; bary[i * 2 + 1] = w1;
        }
      }
    }
    P.tri = tri; P.bary = bary;
  }
  // where texel i is on the body (world, current pose) / which way it faces
  function texelPos(P, i, out) {
    const t = P.tri[i], w0 = P.bary[i * 2], w1 = P.bary[i * 2 + 1], w2 = 1 - w0 - w1, o = t * 9, p = P.pos;
    return out.set(p[o] * w0 + p[o + 3] * w1 + p[o + 6] * w2, p[o + 1] * w0 + p[o + 4] * w1 + p[o + 7] * w2, p[o + 2] * w0 + p[o + 5] * w1 + p[o + 8] * w2);
  }
  function texelNrm(P, i, out) {
    const t = P.tri[i], w0 = P.bary[i * 2], w1 = P.bary[i * 2 + 1], w2 = 1 - w0 - w1, o = t * 9, p = P.nrm;
    return out.set(p[o] * w0 + p[o + 3] * w1 + p[o + 6] * w2, p[o + 1] * w0 + p[o + 4] * w1 + p[o + 7] * w2, p[o + 2] * w0 + p[o + 5] * w1 + p[o + 8] * w2).normalize();
  }
  // Texels bucketed by position, for brushes and stickers.
  const CELL = 0.012, HASH = 1 << 18;
  const cellKey = (ix, iy, iz) => (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) >>> 0) & (HASH - 1);
  function buildGrid(P) {
    const N = P.W * P.H, key = new Int32Array(N).fill(-1), start = new Int32Array(HASH + 1);
    for (let i = 0; i < N; i++) {
      if (P.tri[i] < 0) continue;
      texelPos(P, i, _v);
      const k = cellKey(Math.floor(_v.x / CELL), Math.floor(_v.y / CELL), Math.floor(_v.z / CELL)); key[i] = k; start[k + 1]++;
    }
    for (let k = 0; k < HASH; k++) start[k + 1] += start[k];
    const fill = start.slice(0, HASH), items = new Int32Array(start[HASH]);
    for (let i = 0; i < N; i++) if (key[i] >= 0) items[fill[key[i]]++] = i;
    P.grid = { start, items };
  }
  // fn(texel, distance) for texels within r metres of point c
  function near(P, c, r, fn) {
    const { start, items } = P.grid, seen = new Set();
    const x0 = Math.floor((c.x - r) / CELL), x1 = Math.floor((c.x + r) / CELL), y0 = Math.floor((c.y - r) / CELL), y1 = Math.floor((c.y + r) / CELL), z0 = Math.floor((c.z - r) / CELL), z1 = Math.floor((c.z + r) / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) {
      const k = cellKey(ix, iy, iz); if (seen.has(k)) continue; seen.add(k);
      for (let j = start[k]; j < start[k + 1]; j++) {
        const i = items[j]; texelPos(P, i, _q);
        const d = _q.distanceTo(c); if (d <= r) fn(i, d);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Picking: the nearest triangle under a ray (see-through hair is skipped).
  function raycast(parts, ray) {
    let best = null;
    for (const P of parts) {
      if (!P) continue;
      const o = ray.origin, d = ray.direction, p = P.pos;
      for (let t = 0; t < P.n; t++) {
        const k = t * 9;
        const ax = p[k], ay = p[k + 1], az = p[k + 2];
        const e1x = p[k + 3] - ax, e1y = p[k + 4] - ay, e1z = p[k + 5] - az, e2x = p[k + 6] - ax, e2y = p[k + 7] - ay, e2z = p[k + 8] - az;
        const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = o.x - ax, ty = o.y - ay, tz = o.z - az, u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (d.x * qx + d.y * qy + d.z * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (dist <= 1e-4 || (best && dist >= best.dist)) continue;
        const w0 = 1 - u - v, uu = P.uv[t * 6] * w0 + P.uv[t * 6 + 2] * u + P.uv[t * 6 + 4] * v, vv = P.uv[t * 6 + 1] * w0 + P.uv[t * 6 + 3] * u + P.uv[t * 6 + 5] * v;
        if (P.alpha) {                                  // hair cards: only where the image is not see-through
          const x = clamp(Math.floor((uu - Math.floor(uu)) * P.W), 0, P.W - 1), y = clamp(Math.floor((vv - Math.floor(vv)) * P.H), 0, P.H - 1);
          if (P.base.data[(y * P.W + x) * 4 + 3] < 90) continue;
        }
        best = { part: P, tri: t, dist, uv: [uu, vv], point: new T.Vector3().copy(o).addScaledVector(d, dist) };
      }
    }
    if (best) { const P = best.part, t = best.tri; best.normal = new T.Vector3(P.nrm[t * 9] + P.nrm[t * 9 + 3] + P.nrm[t * 9 + 6], P.nrm[t * 9 + 1] + P.nrm[t * 9 + 4] + P.nrm[t * 9 + 7], P.nrm[t * 9 + 2] + P.nrm[t * 9 + 5] + P.nrm[t * 9 + 8]).normalize(); }
    return best;
  }
  function nearestTri(P, point, groups) {
    let best = -1, bd = 1e9;
    for (let t = 0; t < P.n; t++) {
      if (groups && !groups.includes(P.grp[t])) continue;
      const k = t * 9, x = (P.pos[k] + P.pos[k + 3] + P.pos[k + 6]) / 3 - point.x, y = (P.pos[k + 1] + P.pos[k + 4] + P.pos[k + 7]) / 3 - point.y, z = (P.pos[k + 2] + P.pos[k + 5] + P.pos[k + 8]) / 3 - point.z;
      const d = x * x + y * y + z * z; if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Selections: triangles connected to the seeds and close in colour, then
  // texel by texel, softly, by colour (so buttons, logos and seams stay).
  function floodTris(P, seeds, tol, opt = {}) {
    const sel = new Uint8Array(P.n); if (!seeds.length) return { sel, ref: null };
    const s = seeds[0], sr = P.tcol[s * 3], sg = P.tcol[s * 3 + 1], sb = P.tcol[s * 3 + 2];
    const ok = (t) => cdist(P.tcol[t * 3], P.tcol[t * 3 + 1], P.tcol[t * 3 + 2], sr, sg, sb) < tol && (!opt.groups || opt.groups.includes(P.grp[t]));
    if (opt.everywhere) { for (let t = 0; t < P.n; t++) if (ok(t)) sel[t] = 1; for (const t of seeds) sel[t] = 1; return { sel, ref: [sr, sg, sb] }; }
    const stack = [];
    for (const t of seeds) if (t >= 0 && !sel[t]) { sel[t] = 1; stack.push(t); }
    while (stack.length) { const t = stack.pop(); for (const u of P.adj[t]) if (!sel[u] && ok(u)) { sel[u] = 1; stack.push(u); } }
    return { sel, ref: [sr, sg, sb] };
  }
  function maskFrom(P, flood, tol) {
    const sel = flood.sel, ref = flood.ref, N = P.W * P.H, m = new Uint8Array(N), d = P.base.data;
    for (let i = 0; i < N; i++) {
      const t = P.tri[i]; if (t < 0 || !sel[t]) continue;
      const w = ref ? 1 - smooth(tol * 0.9, tol * 1.6, cdist(d[i * 4], d[i * 4 + 1], d[i * 4 + 2], ref[0], ref[1], ref[2])) : 1;
      m[i] = Math.round(255 * w);
    }
    return m;
  }
  // A clicked part of the outfit -> mask (0..255 per texel).
  function selectAt(P, tri, opt = {}) {
    const tol = opt.tol || 0.13, g = P.grp[tri];
    const groups = opt.everywhere ? null : g === 5 || g === 6 ? [g] : [g === 4 ? 4 : g, ...(g === 2 ? [3] : g === 3 ? [2] : [])];
    return maskFrom(P, floodTris(P, [tri], tol, { groups, everywhere: opt.everywhere }), tol);
  }
  function regionMean(P, mask) {
    const d = P.base.data; let s = 0, w = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]) { const k = mask[i] / 255; s += k * lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); w += k; }
    return w ? s / w : 128;
  }
  // Skin: from seeds on the cheeks / hands; hair on the scalp from the top of the head.
  function skinMask(P, seedPoints, opt = {}) {
    const seeds = seedPoints.map((p) => nearestTri(P, p, opt.groups)).filter((t) => t >= 0);
    if (!seeds.length) return null;
    const tol = opt.tol || 0.16, f = floodTris(P, seeds, tol, { groups: opt.groups });
    const m = maskFrom(P, f, tol), w = new Float32Array(m.length);
    for (let i = 0; i < m.length; i++) w[i] = m[i] / 255;
    w.ref = f.ref; return w;
  }
  // median colour of an image's texels where weight(i) >= minW
  function medianColor(data, N, weight, minW = 0.6) {
    const h = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]; let n = 0;
    for (let i = 0; i < N; i++) if (weight(i) >= minW) { h[0][data[i * 4]]++; h[1][data[i * 4 + 1]]++; h[2][data[i * 4 + 2]]++; n++; }
    if (!n) return null;
    return h.map((hist) => { let c = 0; for (let k = 0; k < 256; k++) { c += hist[k]; if (c >= n / 2) return k; } return 255; });
  }

  // ---------------------------------------------------------------------------
  // Compose the layers into the image the model wears.
  function composite(P) {
    const b = P.base.data, o = P.out.data, N = P.W * P.H, g = P.gain, skin = P.skin, hair = P.hair;
    const regs = P.regions.filter((r) => r.color && r.mask).map((r) => ({ m: r.mask, c: hexRGB(r.color), mean: r.mean || (r.mean = regionMean(P, r.mask)) }));
    const hc = P.hairColor ? hexRGB(P.hairColor) : null, hmean = hc && hair ? (P.hairMean || (P.hairMean = meanOf(P, hair))) : 0;
    const face = P.face, keep = P.keep, paint = P.paint, temp = P.temp, gs = g[0] !== 1 || g[1] !== 1 || g[2] !== 1;
    const hl = P.highlight;
    for (let i = 0; i < N; i++) {
      const k = i * 4;
      let r = b[k], gg = b[k + 1], bb = b[k + 2];
      if (gs && skin) { const w = skin[i]; if (w > 0) { r += (Math.min(255, r * g[0]) - r) * w; gg += (Math.min(255, gg * g[1]) - gg) * w; bb += (Math.min(255, bb * g[2]) - bb) * w; } }
      if (hc && hair) { const w = hair[i]; if (w > 0) { const f = tone(lum(b[k], b[k + 1], b[k + 2]) / (hmean || 1)); r += (Math.min(255, hc[0] * f) - r) * w; gg += (Math.min(255, hc[1] * f) - gg) * w; bb += (Math.min(255, hc[2] * f) - bb) * w; } }
      for (const R of regs) { const m = R.m[i]; if (m) { const w = m / 255, f = tone(lum(b[k], b[k + 1], b[k + 2]) / (R.mean || 1)); r += (Math.min(255, R.c[0] * f) - r) * w; gg += (Math.min(255, R.c[1] * f) - gg) * w; bb += (Math.min(255, R.c[2] * f) - bb) * w; } }
      if (face) { let a = face[k + 3]; if (a) { if (keep) a = a * keep[i] / 255; const w = a / 255; r += (face[k] - r) * w; gg += (face[k + 1] - gg) * w; bb += (face[k + 2] - bb) * w; } }
      if (paint) { const a = paint[k + 3]; if (a) { const w = a / 255; r += (paint[k] - r) * w; gg += (paint[k + 1] - gg) * w; bb += (paint[k + 2] - bb) * w; } }
      if (hl) { const m = hl[i]; if (m) { const w = 0.55 * m / 255; r += (255 - r) * w; gg += (196 - gg) * w; bb += (72 - bb) * w; } }
      o[k] = r; o[k + 1] = gg; o[k + 2] = bb; o[k + 3] = b[k + 3];
    }
    if (temp) for (let j = 0; j < temp.idx.length; j++) {
      const k = temp.idx[j] * 4, a = temp.rgba[j * 4 + 3] / 255;
      o[k] += (temp.rgba[j * 4] - o[k]) * a; o[k + 1] += (temp.rgba[j * 4 + 1] - o[k + 1]) * a; o[k + 2] += (temp.rgba[j * 4 + 2] - o[k + 2]) * a;
    }
    P.ctx.putImageData(P.out, 0, 0);
    P.tex.needsUpdate = true;
  }
  const tone = (x) => { const k = clamp(x, 0.3, 1.8); return 1 + (k - 1) * 0.85; };
  function meanOf(P, w) { const d = P.base.data; let s = 0, n = 0; for (let i = 0; i < w.length; i++) if (w[i] > 0.5) { s += lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); n++; } return n ? s / n : 80; }
  function hexRGB(h) { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(c) { return '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join(''); }

  // ---------------------------------------------------------------------------
  // Projection: an image laid onto the surface from the front, like a slide
  // projector, onto the parts that face it and are not hidden behind others.
  function frame(F, Up) {                                  // F towards the viewer, Up roughly up
    const f = F.clone().normalize(), x = new T.Vector3().crossVectors(Up, f).normalize(), u = new T.Vector3().crossVectors(f, x).normalize();
    return { X: x, U: u, F: f };
  }
  // highest surface towards the viewer at each point of a small grid
  function depthGrid(P, fr, origin, x0, x1, y0, y1, res) {
    const db = new Float32Array(res * res).fill(-1e9), sx = res / (x1 - x0), sy = res / (y1 - y0), p = P.pos;
    const pr = (k, out) => { const dx = p[k] - origin.x, dy = p[k + 1] - origin.y, dz = p[k + 2] - origin.z;
      out[0] = ((dx * fr.X.x + dy * fr.X.y + dz * fr.X.z) - x0) * sx; out[1] = ((dx * fr.U.x + dy * fr.U.y + dz * fr.U.z) - y0) * sy; out[2] = dx * fr.F.x + dy * fr.F.y + dz * fr.F.z; };
    const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
    for (let t = 0; t < P.n; t++) {
      pr(t * 9, A); pr(t * 9 + 3, B); pr(t * 9 + 6, C);
      const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), maxX = Math.min(res - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), maxY = Math.min(res - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      if (minX > maxX || minY > maxY) continue;
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]); if (Math.abs(area) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const w0 = ((B[0] - cx) * (C[1] - cy) - (C[0] - cx) * (B[1] - cy)) / area, w1 = ((C[0] - cx) * (A[1] - cy) - (A[0] - cx) * (C[1] - cy)) / area, w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const z = A[2] * w0 + B[2] * w1 + C[2] * w2, i = y * res + x; if (z > db[i]) db[i] = z;
      }
    }
    return (x, y) => { const ix = Math.floor((x - x0) * sx), iy = Math.floor((y - y0) * sy); return ix < 0 || iy < 0 || ix >= res || iy >= res ? -1e9 : db[iy * res + ix]; };
  }
  function sampler(img) {                                   // img: {data, width, height}
    const d = img.data, w = img.width, h = img.height;
    return (x, y, out) => {
      if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return false;
      const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
      for (let c = 0; c < 4; c++) {
        const a = d[(y0 * w + x0) * 4 + c], b = d[(y0 * w + x1) * 4 + c], e = d[(y1 * w + x0) * 4 + c], f = d[(y1 * w + x1) * 4 + c];
        out[c] = (a + (b - a) * fx) * (1 - fy) + (e + (f - e) * fx) * fy;
      }
      return true;
    };
  }
  // Solve the affine map taking three points of the projection plane to three points of the photo.
  function affine3(src, dst) {
    const [a, b, c] = src, det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(det) < 1e-12) return null;
    const m = [];
    for (const k of [0, 1]) {
      const da = dst[0][k], db = dst[1][k] - da, dc = dst[2][k] - da;
      const p = (db * (c[1] - a[1]) - dc * (b[1] - a[1])) / det, q = (dc * (b[0] - a[0]) - db * (c[0] - a[0])) / det;
      m.push(p, q, da - p * a[0] - q * a[1]);
    }
    return (x, y, out) => { out[0] = m[0] * x + m[1] * y + m[2]; out[1] = m[3] * x + m[4] * y + m[5]; return out; };
  }
  // The face: photo points (eyes, mouth) meet the model's eyes and mouth.
  // lm: {eyeR, eyeL, mouth} world points of the model (subject's right eye
  // shows on the left of a photo). photo: ImageData-like. pts: [[x,y] x3]
  // (any order of the two eyes; the third is the mouth).
  function bakeFace(P, photo, pts, lm, opt = {}) {
    const mid = lm.eyeR.clone().add(lm.eyeL).multiplyScalar(0.5);
    const fr = frame(new T.Vector3().crossVectors(lm.eyeL.clone().sub(lm.eyeR), mid.clone().sub(lm.mouth)), mid.clone().sub(lm.mouth));
    const to2 = (p) => { const d = p.clone().sub(mid); return [d.dot(fr.X), d.dot(fr.U)]; };
    const eR = to2(lm.eyeR), eL = to2(lm.eyeL), mo = to2(lm.mouth);
    const eyes = [pts[0], pts[1]].sort((a, b) => a[0] - b[0]);
    const map = affine3([eR, eL, mo], [eyes[0], eyes[1], pts[2]]);
    if (!map) return null;
    // an egg-shaped area: forehead to chin, cheek to cheek, narrower at the chin
    const em = Math.max(0.02, -mo[1]), ed = Math.max(0.02, eL[0] - eR[0]), hk = opt.height || 1;
    const cy = -em * 0.25, top = em * 0.95 * hk, bottom = mo[1] - em * 0.8 * hk, rTop = top - cy, rBot = cy - bottom;
    const ra = ed * 1.08 * (opt.width || 1), soft = clamp(opt.soft == null ? 0.35 : opt.soft, 0.04, 0.8);
    const depth = depthGrid(P, fr, mid, -ra * 1.6, ra * 1.6, bottom - rBot * 0.6, top + rTop * 0.6, 320);
    const N = P.W * P.H, out = new Uint8ClampedArray(N * 4), smp = sampler(photo), c = [0, 0, 0, 0], q = [0, 0];
    for (let i = 0; i < N; i++) {
      if (P.tri[i] < 0 || (!opt.eyes && P.grp[P.tri[i]] === 7)) continue;
      texelPos(P, i, _p); texelNrm(P, i, _a);
      const wf = smooth(0.12, 0.45, _a.dot(fr.F)); if (wf <= 0) continue;
      _p.sub(mid);
      const x = _p.dot(fr.X), y = _p.dot(fr.U), z = _p.dot(fr.F);
      const v = y > cy ? (y - cy) / rTop : (cy - y) / rBot, wy = y > cy ? ra : ra * (1 - 0.3 * Math.min(1, v));
      const r = Math.hypot(x / wy, v), we = 1 - smooth(1 - soft, 1, r); if (we <= 0) continue;
      if (z < depth(x, y) - 0.005) continue;               // hidden (teeth behind the lips, the inside of the mouth)
      map(x, y, q); if (!smp(q[0], q[1], c)) continue;
      const k = i * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = 255 * wf * we;
    }
    return out;
  }
  // Even out the light of a photo (soft shadows on one side of the face).
  function evenLight(img, amount, bright = 1) {
    if (!(amount > 0) && bright === 1) return img;
    const w = img.width, h = img.height, d = img.data, sw = 48, sh = Math.max(8, Math.round(48 * h / w));
    const small = new Float32Array(sw * sh), cnt = new Float32Array(sw * sh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = Math.floor(y * sh / h) * sw + Math.floor(x * sw / w), k = (y * w + x) * 4; small[j] += lum(d[k], d[k + 1], d[k + 2]); cnt[j]++; }
    for (let j = 0; j < small.length; j++) small[j] /= cnt[j] || 1;
    for (let it = 0; it < 3; it++) {                       // blur the small copy
      const t = small.slice();
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let s = 0, n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < sh && xx < sw) { s += t[yy * sw + xx]; n++; } } small[y * sw + x] = s / n; }
    }
    let mean = 0; for (const v of small) mean += v; mean /= small.length;
    const o = new ImageData(w, h), od = o.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = clamp(x * sw / w - 0.5, 0, sw - 1), fy = clamp(y * sh / h - 0.5, 0, sh - 1), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
      const L = (small[y0 * sw + x0] * (1 - ax) + small[y0 * sw + x1] * ax) * (1 - ay) + (small[y1 * sw + x0] * (1 - ax) + small[y1 * sw + x1] * ax) * ay;
      const k = (y * w + x) * 4, f = (1 + (clamp(mean / Math.max(L, 8), 0.5, 2.2) - 1) * amount) * bright;
      od[k] = d[k] * f; od[k + 1] = d[k + 1] * f; od[k + 2] = d[k + 2] * f; od[k + 3] = d[k + 3];
    }
    return o;
  }
  // A sticker laid on the surface around a point, as seen from the camera.
  function bakeSticker(P, img, at, size, angle) {
    const Up = at.up.clone().applyAxisAngle(at.F, -angle || 0), fr = frame(at.F, Up), half = size / 2;
    const depth = depthGrid(P, fr, at.point, -half * 1.2, half * 1.2, -half * 1.2, half * 1.2, 160);
    const smp = sampler(img), c = [0, 0, 0, 0], idx = [], rgba = [];
    near(P, at.point, half * 1.45, (i) => {
      texelPos(P, i, _p); texelNrm(P, i, _a);
      const wf = smooth(0.05, 0.3, _a.dot(fr.F)); if (wf <= 0) return;
      _p.sub(at.point);
      const x = _p.dot(fr.X), y = _p.dot(fr.U), z = _p.dot(fr.F);
      if (Math.abs(x) > half || Math.abs(y) > half) return;
      if (z < depth(x, y) - 0.006) return;
      if (!smp((x / size + 0.5) * (img.width - 1), (0.5 - y / size) * (img.height - 1), c) || c[3] < 2) return;
      idx.push(i); rgba.push(c[0], c[1], c[2], c[3] * wf);
    });
    return { idx: Int32Array.from(idx), rgba: Uint8ClampedArray.from(rgba) };
  }
  // ---------------------------------------------------------------------------
  // Brushes on the surface. mode: paint | restore | blur | add | remove
  function brush(P, point, radius, strength, mode, color, region) {
    const N = P.W * P.H, col = color ? hexRGB(color) : [0, 0, 0];
    if ((mode === 'paint' || mode === 'blur') && !P.paint) P.paint = new Uint8ClampedArray(N * 4);
    if (mode === 'restore' && P.face && !P.keep) P.keep = new Uint8Array(N).fill(255);
    const o = P.out.data;
    near(P, point, radius, (i, d) => {
      const f = 1 - (d / radius) ** 2, w = clamp(f * f * strength, 0, 1), k = i * 4;
      if (w <= 0) return;
      if (mode === 'paint') {
        const pa = P.paint[k + 3] / 255, na = pa + w * (1 - pa);
        for (let c = 0; c < 3; c++) P.paint[k + c] = (P.paint[k + c] * pa * (1 - w) + col[c] * w) / (na || 1);
        P.paint[k + 3] = na * 255;
      } else if (mode === 'restore') {
        if (P.paint) P.paint[k + 3] *= 1 - w;
        if (P.keep) P.keep[i] *= 1 - w;
        for (const r of P.regions) if (r.mask) r.mask[i] *= 1 - w;
      } else if (mode === 'blur') {
        const x = i % P.W, y = (i / P.W) | 0; let s0 = 0, s1 = 0, s2 = 0, n = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= P.W || yy >= P.H) continue;
          const j = yy * P.W + xx; if (P.tri[j] < 0) continue; s0 += o[j * 4]; s1 += o[j * 4 + 1]; s2 += o[j * 4 + 2]; n++;
        }
        if (!n) return;
        const pa = P.paint[k + 3] / 255, ww = w * 0.6, na = pa + ww * (1 - pa), base = pa > 0 ? P.paint : o;
        P.paint[k] = (base[k] * (1 - ww) + s0 / n * ww); P.paint[k + 1] = (base[k + 1] * (1 - ww) + s1 / n * ww); P.paint[k + 2] = (base[k + 2] * (1 - ww) + s2 / n * ww);
        P.paint[k + 3] = Math.max(na, ww) * 255;
      } else if ((mode === 'add' || mode === 'remove') && region) {
        const m = region.mask; m[i] = mode === 'add' ? Math.max(m[i], 255 * Math.min(1, w * 2)) : m[i] * (1 - w);
        region.mean = 0;
      }
    });
  }
  function mergeTemp(P) {                                  // a placed sticker becomes paint
    const t = P.temp; if (!t) return; if (!P.paint) P.paint = new Uint8ClampedArray(P.W * P.H * 4);
    for (let j = 0; j < t.idx.length; j++) {
      const k = t.idx[j] * 4, w = t.rgba[j * 4 + 3] / 255, pa = P.paint[k + 3] / 255, na = pa + w * (1 - pa);
      for (let c = 0; c < 3; c++) P.paint[k + c] = (P.paint[k + c] * pa * (1 - w) + t.rgba[j * 4 + c] * w) / (na || 1);
      P.paint[k + 3] = na * 255;
    }
    P.temp = null;
  }
  // ---------------------------------------------------------------------------
  // Images in and out (data URLs; masks keep their value in the red channel).
  function encode(P, kind, q = 0.9) {
    if (kind === 'final') {
      if (P.alpha) { const w = P.canvas.toDataURL('image/webp', 0.92); return w.startsWith('data:image/webp') ? w : P.canvas.toDataURL('image/png'); }
      return P.canvas.toDataURL('image/jpeg', q);
    }
    const cv = document.createElement('canvas'); cv.width = P.W; cv.height = P.H;
    const cx = cv.getContext('2d'), im = cx.createImageData(P.W, P.H), d = im.data;
    const src = kind === 'paint' ? P.paint : kind === 'keep' ? P.keep : kind.mask;
    if (kind === 'paint') d.set(src);
    else for (let i = 0; i < src.length; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = src[i]; d[i * 4 + 3] = 255; }
    cx.putImageData(im, 0, 0);
    return cv.toDataURL('image/png');
  }
  function loadImage(url) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('cannot read image')); im.src = url; });
  }
  function pixelsOf(img, W, H) {
    const cv = document.createElement('canvas'); cv.width = W || img.naturalWidth || img.width; cv.height = H || img.naturalHeight || img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, cv.width, cv.height);
    return cx.getImageData(0, 0, cv.width, cv.height);
  }
  async function decodeLayer(url, P, kind) {
    const d = pixelsOf(await loadImage(url), P.W, P.H).data;
    if (kind === 'paint') return new Uint8ClampedArray(d);
    const m = new Uint8Array(P.W * P.H); for (let i = 0; i < m.length; i++) m[i] = d[i * 4]; return m;
  }
  function isEmptyPaint(a) { if (!a) return true; for (let i = 3; i < a.length; i += 4) if (a[i] > 1) return false; return true; }
  function isFullKeep(a) { if (!a) return true; for (let i = 0; i < a.length; i++) if (a[i] < 254) return false; return true; }

  window.StudioTex = { buildPart, refreshPositions, raycast, nearestTri, selectAt, skinMask, medianColor, composite, bakeFace, evenLight, bakeSticker, brush, mergeTemp,
    encode, loadImage, pixelsOf, decodeLayer, isEmptyPaint, isFullKeep, hexRGB, rgbHex, texelPos, regionMean, cdist };
})();
