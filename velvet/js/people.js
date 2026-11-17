/* VELVET — people runtime.
   Reads characters/characters.js (the people data file): every character is a
   .glb model plus its own texture images, so models and faces can be swapped
   or added without touching the game. Files are read from
   characters/characters-pack.js when the game is opened as a local file
   (browsers block reading loose files there) and from the folder itself when
   it is served over http(s). Rocketbox-skeleton characters share the motion
   clips, fitted to each body; other models can bring their own animations.
   Exposes window.VelvetPeople. */
(function () {
  'use strict';
  const T = window.THREE;
  const MALE_REF = 0.8952, FEMALE_REF = 0.9194; // standing hip height of the mocap actors
  const ARMS = /(Clavicle|Shoulder|Arm|Hand|Finger|Thumb|Index|Middle|Ring|Pinky)/i;
  const ROCKETBOX = { idle: 'm_idle_neutral_01', walk: 'm_walk_neutral_01', take: 'm_documents_take', clap: 'm_claphands_01', cheer: 'm_cheer_01',
    sit_male: ['m_sit_chair_idle_neutral_01', 'm_sit_chair_idle_relaxed_01', 'm_sit_chair_breathe_01', 'm_sit_chair_idle_look_around', 'm_sit_chair_gestic_thoughtful', 'm_sit_chair_idle_neutral_02'],
    sit_female: ['f_sit_chair_idle_neutral_01', 'f_sit_chair_breathe_01', 'f_sit_chair_idle_look_around', 'f_sit_chair_idle_neutral_02'],
    // standing idles that leave the hands where they are (a player holds his cue)
    stand_male: ['m_idle_neutral_01', 'm_idle_neutral_02', 'm_idle_neutral_03', 'm_idle_neutral_04', 'm_idle_breathe_01', 'm_idle_look_around_01', 'm_idle_roll_head_01'],
    // little habits: standing (the referee) and seated (the audience)
    habit_stand_male: ['m_idle_look_around_01', 'm_idle_roll_head_01', 'm_idle_touch_face_01', 'm_idle_dust_01', 'm_idle_scratch_head_01', 'm_idle_breathe_01'],
    habit_sit_male: ['m_sit_chair_idle_scratch_head', 'm_sit_chair_idle_touch_face', 'm_sit_chair_idle_touch_hair', 'm_sit_chair_idle_waiting_01', 'm_sit_chair_idle_yawn',
      'm_sit_chair_idle_cough', 'm_sit_chair_idle_roll_head', 'm_sit_chair_idle_nervous_01', 'm_sit_chair_gestic_shrug_01', 'm_sit_chair_gestic_thoughtful', 'm_sit_chair_idle_look_around'],
    habit_sit_female: ['f_sit_chair_idle_scratch_head', 'f_sit_chair_idle_touch_face', 'f_sit_chair_idle_touch_hair', 'f_sit_chair_idle_waiting_01', 'f_sit_chair_idle_yawn',
      'f_sit_chair_idle_roll_head', 'f_sit_chair_gestic_shrug_01', 'f_sit_chair_idle_look_around'],
    clap_male: ['m_claphands_01', 'm_claphands_02'], clap_female: ['f_claphands_01', 'm_claphands_01'],
    cheer_male: ['m_cheer_01', 'm_cheer_03'], cheer_female: ['f_cheer_02'],
    // reactions a player can make with his cue in his right hand (that arm keeps still)
    react_male: { shrug: 'm_gestic_shrug_01', headshake: 'm_gestic_listen_deny_02', nodyes: 'm_gestic_listen_accept_02' } };
  const RIGHT_ARM = /R_(Clavicle|UpperArm|Forearm|Hand|Finger)|R(Clavicle|UpperArm|Forearm|Hand)/i;
  const onHttp = /^https?:$/.test(location.protocol);
  const pack = () => window.VELVET_FILES || {};
  const mimeOf = (p) => /\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : /\.(glb)$/i.test(p) ? 'model/gltf-binary' : /\.gltf$/i.test(p) ? 'model/gltf+json' : /\.bin$/i.test(p) ? 'application/octet-stream' : 'image/jpeg';
  // 'characters/models/../textures/a.jpg' -> 'characters/textures/a.jpg'
  function normPath(p) {
    const out = [];
    for (const part of String(p).replace(/\\/g, '/').split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') out.pop(); else out.push(part);
    }
    return out.join('/');
  }
  const dirOf = (p) => p.slice(0, p.lastIndexOf('/') + 1);
  const isStudio = (k) => k.startsWith('characters/studio/') || k.startsWith('characters/blender/');   // packed in characters/studio.js and characters/blender.js
  function bufferFrom(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  async function readFile(path) {
    const key = normPath(path), packed = pack()[key];
    if ((onHttp && !isStudio(key)) || !packed) {
      try { const r = await fetch(key); if (r.ok) return await r.arrayBuffer(); } catch (e) { /* fall through */ }
    }
    if (packed) return bufferFrom(packed);
    throw new Error('cannot read ' + key + (onHttp ? '' : ' (not in characters-pack.js: open "Pack Characters.html")'));
  }
  // Packed files are handed to loaders as data URLs; others load normally.
  const manager = new T.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(data|blob):/.test(url)) return url;
    const key = normPath(url.replace(location.href.slice(0, location.href.lastIndexOf('/') + 1), '')), packed = pack()[key];
    return packed && !onHttp ? 'data:' + mimeOf(key) + ';base64,' + packed : url;
  });
  const loader = new T.GLTFLoader(manager);
  loader.setMeshoptDecoder(T.MeshoptDecoder);
  const texLoader = new T.TextureLoader(manager);
  const parse = (data, path) => new Promise((resolve, reject) => loader.parse(data, dirOf(normPath(path)), resolve, reject));
  async function loadTexture(path, color) {
    const key = normPath(path), packed = pack()[key];
    let tex;
    try { tex = await texLoader.loadAsync((onHttp && !isStudio(key)) || !packed ? key : 'data:' + mimeOf(key) + ';base64,' + packed); }
    catch (e) { if (!packed) throw new Error('cannot read texture ' + key); tex = await texLoader.loadAsync('data:' + mimeOf(key) + ';base64,' + packed); }
    tex.flipY = false;                                   // glTF texture convention
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  // texture keys match materials whose name equals or ends with the key
  const matches = (matName, key) => { const n = String(matName || '').toLowerCase(), k = key.toLowerCase(); return n === k || n.endsWith('_' + k) || n.endsWith(k); };
  async function applyTextures(scene, entry) {
    const maps = Object.entries(entry.textures || {}), normals = Object.entries(entry.normals || {});
    if (!maps.length && !normals.length) return;
    const cache = {};
    const get = (p, color) => cache[p + color] || (cache[p + color] = loadTexture(p, color));
    const jobs = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const [k, p] of maps) if (matches(m.name, k)) jobs.push(get(p, true).then((t) => { m.map = t; m.color && m.color.set(0xffffff); m.needsUpdate = true; }));
        for (const [k, p] of normals) if (matches(m.name, k)) jobs.push(get(p, false).then((t) => {
          m.normalMap = t; m.normalScale = new T.Vector2(1, o.geometry.attributes.tangent ? 1 : -1); m.needsUpdate = true; }));
      }
    });
    await Promise.all(jobs);
  }
  const findBone = (root, exact, re) => root.getObjectByName(exact) || (() => { let hit = null; root.traverse((o) => { if (!hit && o.isBone && re.test(o.name)) hit = o; }); return hit; })();

  const People = { templates: {}, clips: {}, ready: false, errors: [] };

  People.loadClips = async function (anims) {
    await Promise.all(Object.entries(anims || {}).map(async ([name, path]) => {
      if (People.clips[name]) return;
      try { const g = await parse(await readFile(path), path); const clip = g.animations[0]; if (clip) { clip.name = name; People.clips[name] = clip; } }
      catch (e) { People.errors.push(name + ': ' + e.message); }
    }));
  };
  // One character from the people data file -> People.templates[entry.id].
  // MPFB people (characters/hd.js, made with the Blender add-on): the same
  // character rebuilt on an MPFB body with its own face and hair and a face
  // made of morph targets. Experimental, and off unless switched on in the
  // settings (PEOPLE · MPFB); the file is only read then. A character you
  // changed in VELVET Studio keeps your version.
  People.hdOn = function () { try { return localStorage.getItem('velvet.hdPeople') === 'on'; } catch (e) { return false; } };
  function loadHdData() {
    if (window.VELVET_HD || !People.hdOn() || typeof document === 'undefined') return Promise.resolve();
    return new Promise(done => {
      const s = document.createElement('script');
      s.src = 'characters/hd.js'; s.onload = s.onerror = () => done();
      document.head.appendChild(s);
    });
  }
  People.hdLook = function (entry) {
    const look = window.VELVET_HD && entry && window.VELVET_HD[entry.id];
    if (!look || !look.model || !People.hdOn()) return null;
    const vs = window.VelvetStudio;
    if (vs && vs.basePeople && !vs.basePeople.includes(entry)) return null;     // edited in VELVET Studio
    return look;
  };
  function hdEntry(entry) {
    const look = People.hdLook(entry);
    if (!look) return entry;
    const e = Object.assign({}, entry, { model: look.model, hd: true, face: look.face || [] });
    for (const k of ['textures', 'normals', 'roughness', 'height', 'muscle', 'belly', 'headScale']) delete e[k];
    return e;
  }
  // Rounder outlines for the people the cameras come close to (players and referees). Every triangle becomes
  // four, and each new point is lifted onto the curved surface that the vertex normals describe (Phong
  // tessellation), so heads, shoulders and arms lose their facets while textures, skinning and the look stay as
  // modelled. Copies of a point at a texture seam bend alike; sharp edges and open borders (where the head meets
  // the body) stay where they are, so nothing cracks.
  People.smoothOn = function () { try { return localStorage.getItem('velvet.smoothPeople') !== 'off'; } catch (e) { return true; } };
  People.smoothMesh = function (g, alpha = 0.75) {
    const pos = g.attributes.position, nor = g.attributes.normal, ix = g.index;
    if (!pos || !nor || !ix || pos.count > 60000 || Object.keys(g.morphAttributes || {}).length) return g;
    const n = pos.count, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    let ext = 0;
    for (let i = 0; i < n; i++) {
      P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i);
      const x = nor.getX(i), y = nor.getY(i), z = nor.getZ(i), l = Math.hypot(x, y, z) || 1;
      N[i * 3] = x / l; N[i * 3 + 1] = y / l; N[i * 3 + 2] = z / l;
      ext = Math.max(ext, Math.abs(P[i * 3]), Math.abs(P[i * 3 + 1]), Math.abs(P[i * 3 + 2]));
    }
    const q = 1e5 / (ext || 1), gid = new Int32Array(n), ids = new Map(), W = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(P[i * 3] * q) + ',' + Math.round(P[i * 3 + 1] * q) + ',' + Math.round(P[i * 3 + 2] * q);
      let id = ids.get(k);
      if (id === undefined) { id = W.length / 3; ids.set(k, id); W.push(0, 0, 0); }
      gid[i] = id; W[id * 3] += N[i * 3]; W[id * 3 + 1] += N[i * 3 + 1]; W[id * 3 + 2] += N[i * 3 + 2];
    }
    const pts = W.length / 3, crease = new Uint8Array(pts);
    for (let id = 0; id < pts; id++) { const l = Math.hypot(W[id * 3], W[id * 3 + 1], W[id * 3 + 2]) || 1; W[id * 3] /= l; W[id * 3 + 1] /= l; W[id * 3 + 2] /= l; }
    for (let i = 0; i < n; i++) { const id = gid[i]; if (N[i * 3] * W[id * 3] + N[i * 3 + 1] * W[id * 3 + 1] + N[i * 3 + 2] * W[id * 3 + 2] < 0.94) crease[id] = 1; }
    const I = ix.array, key = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a), uses = new Map();
    for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) { const e = key(gid[I[t + k]], gid[I[t + (k + 1) % 3]]); uses.set(e, (uses.get(e) || 0) + 1); }
    const mids = new Map(), extra = [];
    const mid = (i, j) => {
      const e = key(i, j); let m = mids.get(e);
      if (m !== undefined) return m;
      m = n + extra.length / 5; mids.set(e, m);
      let x = (P[i * 3] + P[j * 3]) / 2, y = (P[i * 3 + 1] + P[j * 3 + 1]) / 2, z = (P[i * 3 + 2] + P[j * 3 + 2]) / 2;
      const a = gid[i], b = gid[j];
      if (uses.get(key(a, b)) >= 2 && !crease[a] && !crease[b]) {
        let dx = 0, dy = 0, dz = 0;
        for (const [v, id] of [[i, a], [j, b]]) {
          const nx = W[id * 3], ny = W[id * 3 + 1], nz = W[id * 3 + 2];
          const d = (x - P[v * 3]) * nx + (y - P[v * 3 + 1]) * ny + (z - P[v * 3 + 2]) * nz;
          dx -= d * nx; dy -= d * ny; dz -= d * nz;
        }
        x += alpha * dx / 2; y += alpha * dy / 2; z += alpha * dz / 2;
      }
      extra.push(i, j, x, y, z);
      return m;
    };
    const tris = I.length / 3, NI = new Uint32Array(tris * 12);
    for (let t = 0; t < tris; t++) {
      const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2], ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      NI.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], t * 12);
    }
    const added = extra.length / 5, total = n + added, out = new T.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (name === 'skinIndex' || name === 'skinWeight') continue;
      const sz = attr.itemSize, get = [attr.getX, attr.getY, attr.getZ, attr.getW].slice(0, sz).map((f) => f.bind(attr)), arr = new Float32Array(total * sz);
      for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) arr[i * sz + c] = get[c](i);
      for (let e = 0; e < added; e++) {
        const i = extra[e * 5], j = extra[e * 5 + 1], o = (n + e) * sz;
        if (name === 'position') { arr[o] = extra[e * 5 + 2]; arr[o + 1] = extra[e * 5 + 3]; arr[o + 2] = extra[e * 5 + 4]; continue; }
        for (let c = 0; c < sz; c++) arr[o + c] = (arr[i * sz + c] + arr[j * sz + c]) / 2;
        if (name === 'normal') { const l = Math.hypot(arr[o], arr[o + 1], arr[o + 2]) || 1; arr[o] /= l; arr[o + 1] /= l; arr[o + 2] /= l; }
      }
      out.setAttribute(name, new T.BufferAttribute(arr, sz));
    }
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (si && sw) {
      const SI = new Uint16Array(total * 4), SW = new Float32Array(total * 4), gi = [si.getX, si.getY, si.getZ, si.getW].map((f) => f.bind(si)), gw = [sw.getX, sw.getY, sw.getZ, sw.getW].map((f) => f.bind(sw));
      for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) { SI[i * 4 + c] = gi[c](i); SW[i * 4 + c] = gw[c](i); }
      const acc = new Map();
      for (let e = 0; e < added; e++) {
        acc.clear();
        for (const v of [extra[e * 5], extra[e * 5 + 1]]) for (let c = 0; c < 4; c++) { const w = SW[v * 4 + c]; if (w > 0) acc.set(SI[v * 4 + c], (acc.get(SI[v * 4 + c]) || 0) + w); }
        const top = [...acc].sort((u, v) => v[1] - u[1]).slice(0, 4), sum = top.reduce((t, x) => t + x[1], 0) || 1, o = (n + e) * 4;
        top.forEach(([b, w], c) => { SI[o + c] = b; SW[o + c] = w / sum; });
      }
      out.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4));
      out.setAttribute('skinWeight', new T.BufferAttribute(SW, 4));
    }
    out.setIndex(new T.BufferAttribute(NI, 1));
    for (const gr of g.groups) out.addGroup(gr.start * 4, gr.count * 4, gr.materialIndex);
    out.name = g.name; out.userData = Object.assign({}, g.userData, { smoothed: true });
    out.computeBoundingBox(); out.computeBoundingSphere();
    return out;
  };
  People.loadEntry = async function (entry, order = 0, opts = {}) {
    if (!entry || !entry.id || !entry.model) throw new Error('entry needs id and model');
    entry = hdEntry(entry);
    const gltf = await parse(await readFile(entry.model), entry.model), scene = gltf.scene;
    if (!opts.noTextures) await applyTextures(scene, entry);
    if (!entry.hd && (entry.role === 'player' || entry.role === 'referee') && People.smoothOn()) {
      scene.traverse((o) => {
        if (!o.isSkinnedMesh || [].concat(o.material).some((m) => m.alphaTest > 0 || m.transparent)) return;
        const g = People.smoothMesh(o.geometry);
        if (g !== o.geometry) { o.geometry.dispose(); o.geometry = g; }
      });
    }
    const rough = Object.entries(entry.roughness || {});      // optional, by material key: 0 glossy .. 1 matte
    if (rough.length) scene.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) for (const [k, v] of rough) if (matches(m.name, k)) m.roughness = +v; });
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.map) m.map.anisotropy = 4;
        const nm = m.normalMap && m.normalMap.image;     // a 1-pixel stand-in normal map lights the model in flat, blotchy facets
        if (nm && (nm.width || 0) <= 4 && (nm.height || 0) <= 4) { m.normalMap = null; m.needsUpdate = true; }
        m.envMapIntensity = entry.role === 'referee' ? 0.55 : 0.3; // the arena is dark; only the table is bright
        if (entry.hd && m.name === 'skin') {   // the classic faces' normal maps light them flat and bright; HD skin gets a soft fill to match
          m.roughness = 0.6; m.emissive.set(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = 0.32;
        }
        if (entry.hd && m.name === 'eyes') m.roughness = Math.max(m.roughness, 0.22);        // moist, without mirroring the dark arena
        if (m.alphaTest > 0) m.side = T.DoubleSide;
      }
    });
    People.applyBody(scene, entry);
    // A generous sphere round the whole body in any pose (seated, cheering,
    // bent over the table), so people out of shot are not drawn, without
    // an arm ever vanishing at the edge of the picture.
    scene.updateMatrixWorld(true);
    const bb = new T.Box3(), wp = new T.Vector3();
    scene.traverse((o) => { if (o.isBone) bb.expandByPoint(o.getWorldPosition(wp)); });
    if (!bb.isEmpty() && !opts.noCulling) {
      const H = Math.max(bb.max.y - bb.min.y + 0.2, 0.6), ctr = bb.getCenter(new T.Vector3());
      ctr.y = bb.min.y + H * 0.5;
      scene.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        o.boundingSphere = new T.Sphere(ctr.clone().applyMatrix4(o.matrixWorld.clone().invert()), H / (o.matrixWorld.getMaxScaleOnAxis() || 1));
        o.frustumCulled = true;
      });
    }
    const hips = scene.getObjectByName('Bip01'), own = {};
    for (const a of gltf.animations) own[a.name] = a;
    const clips = entry.clips || null;
    const tpl = { name: entry.id, entry, order, scene, role: entry.role || 'audience', female: entry.gender === 'female', hd: !!entry.hd,
      rocketbox: !!hips, rootY: hips ? hips.position.y : 0, own, clipMap: clips, fitted: {}, weight: entry.weight || 1 };
    People.templates[entry.id] = tpl;
    return tpl;
  };
  People.load = async function (man) {
    const list = (man && man.people) || [];
    await Promise.all([People.loadClips(man && man.animations), loadHdData()]);
    await Promise.all(list.map(async (entry, order) => {
      try { await People.loadEntry(entry, order); }
      catch (e) { People.errors.push((entry && entry.id) + ': ' + e.message); }
    }));
    if (People.errors.length) console.warn('VELVET characters:', People.errors.join(' | '));
    People.ready = true;
  };

  // Body shape from the people data file: height (metres), headScale (1 =
  // as modelled), belly (0..1) and muscle (0..1: fuller chest, shoulders and
  // arms, a leaner waist). Safe to call again with new values.
  const SPINE = /^Bip01_(Pelvis|Spine\d?)$/;
  People.applyBody = function (scene, entry) {
    const ud = scene.userData;
    if (ud.h0 == null) {
      const s0 = scene.scale.clone(); scene.scale.set(1, 1, 1); scene.updateMatrixWorld(true);
      ud.h0 = new T.Box3().setFromObject(scene).getSize(new T.Vector3()).y; ud.s0 = s0;
    }
    const h = +entry.height || 0;
    if (h > 0.5 && ud.h0 > 0.01) scene.scale.setScalar(h / ud.h0); else scene.scale.copy(ud.s0);
    const head = scene.getObjectByName('Bip01_Head');
    if (head) head.scale.setScalar(Math.min(2.2, Math.max(0.6, +entry.headScale || 1)));
    const belly = Math.min(1, Math.max(0, +entry.belly || 0)), muscle = Math.min(1, Math.max(0, +entry.muscle || 0));
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isSkinnedMesh || !(o.geometry.userData.pos0 || belly > 0 || muscle > 0)) return;
      shapeBelly(o, belly, scene);
      if (muscle > 0) shapeMuscle(o, muscle, scene);
    });
    scene.updateMatrixWorld(true);
  };
  const _b = new T.Vector3(), _n = new T.Vector3(), _c = new T.Vector3(), _d = new T.Vector3(), _F = new T.Matrix4(), _M = new T.Matrix4(), _nm = new T.Matrix3(), _im = new T.Matrix3();
  // A rounder belly: vertices that move with the spine are pushed out along
  // their normal, most at the front of the waist. Worked out in metres in the
  // current pose, then turned back into the model's own (compressed) space,
  // so it moves with every animation.
  function shapeBelly(mesh, amount, scene) {
    const g = mesh.geometry, sk = mesh.skeleton;
    if (!g.attributes.skinIndex || !sk) return;
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    if (!g.userData.pos0) {                          // keep the modelled shape; positions become plain floats
      const p0 = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { p0[i * 3] = pos.getX(i); p0[i * 3 + 1] = pos.getY(i); p0[i * 3 + 2] = pos.getZ(i); }
      g.userData.pos0 = p0;
      g.setAttribute('position', new T.BufferAttribute(p0.slice(), 3));
    }
    const p0 = g.userData.pos0, out = g.attributes.position.array;
    out.set(p0);
    if (amount > 0 && nor) {
      scene.updateMatrixWorld(true);
      const wp = (name) => { const b = sk.bones.find((x) => x.name === name); return b ? b.getWorldPosition(new T.Vector3()) : null; };
      const sp = wp('Bip01_Spine'), sp1 = wp('Bip01_Spine1') || sp, pel = wp('Bip01_Pelvis');
      if (sp && pel) {
        const fwd = new T.Vector3(0, 0, 1).applyQuaternion(scene.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
        const torso = Math.max(0.2, sp1.distanceTo(pel) + 0.25);     // ~0.4 m on an adult
        _c.copy(sp).lerp(sp1, 0.35).addScaledVector(fwd, torso * 0.18); _c.y -= torso * 0.05;
        const rx = torso * 0.42, ry = torso * 0.38, push = amount * torso * 0.3;
        const spine = new Set(sk.bones.map((b, i) => (SPINE.test(b.name) ? i : -1)).filter((i) => i >= 0));
        const offs = sk.bones.map((b, i) => new T.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]));
        const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, E = _M.elements;
        for (let i = 0; i < n; i++) {
          let w = 0;
          for (let k = 0; k < 4; k++) if (spine.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
          if (w < 0.05) continue;
          E.fill(0);                                              // this vertex's skinning transform
          for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (!wk) continue; const o = offs[si.getComponent(i, k)].elements; for (let j = 0; j < 16; j++) E[j] += o[j] * wk; }
          _F.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(_M).multiply(mesh.bindMatrix);
          _b.set(p0[i * 3], p0[i * 3 + 1], p0[i * 3 + 2]).applyMatrix4(_F);
          const along = _d.copy(_b).sub(_c), lat = along.dot(_n.set(fwd.z, 0, -fwd.x));
          const dx = lat / rx, dy = along.y / ry, dz = along.dot(fwd) / (rx * 1.1), f = Math.exp(-(dx * dx + dy * dy + dz * dz) * 1.6);
          if (f < 0.01) continue;
          _nm.getNormalMatrix(_F); _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
          const front = Math.min(1, Math.max(0, (_n.dot(fwd) + 0.35) / 0.9));
          _d.copy(_n).multiplyScalar(push * f * front * Math.min(1, w));
          _im.setFromMatrix4(_F).invert(); _d.applyMatrix3(_im);      // metres -> the model's own units
          out[i * 3] += _d.x; out[i * 3 + 1] += _d.y; out[i * 3 + 2] += _d.z;
        }
      }
    }
    g.attributes.position.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
  }
  // An athletic build: each vertex is pushed out along its normal by the
  // bones it moves with: more over the chest (front), shoulders and upper
  // arms, less on the forearms and upper back, and the waist is drawn in a
  // little at the sides. Same method as the belly; adds to it.
  const MUSCLE = { L_UpperArm: [0.016, 0.016, 0.016], R_UpperArm: [0.016, 0.016, 0.016], L_Forearm: [0.008, 0.008, 0.008],
    R_Forearm: [0.008, 0.008, 0.008], L_Clavicle: [0.012, 0.012, 0.008], R_Clavicle: [0.012, 0.012, 0.008],
    Spine2: [0.015, 0.008, 0.006], Neck: [0.004, 0.004, 0.004], Spine: [0, -0.007, 0] };   // [front, side, back], metres
  function shapeMuscle(mesh, amount, scene) {
    const g = mesh.geometry, sk = mesh.skeleton, nor = g.attributes.normal;
    if (!g.attributes.skinIndex || !sk || !nor || !g.userData.pos0) return;
    const p0 = g.userData.pos0, out = g.attributes.position.array, n = g.attributes.position.count;
    scene.updateMatrixWorld(true);
    const fwd = new T.Vector3(0, 0, 1).applyQuaternion(scene.getWorldQuaternion(new T.Quaternion())).setY(0).normalize();
    const push = sk.bones.map((b) => MUSCLE[b.name.replace(/^Bip01_/, '')] || null);
    const offs = sk.bones.map((b, i) => new T.Matrix4().multiplyMatrices(b.matrixWorld, sk.boneInverses[i]));
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, E = _M.elements;
    for (let i = 0; i < n; i++) {
      let any = false;
      for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.02 && push[si.getComponent(i, k)]) any = true;
      if (!any) continue;
      E.fill(0);
      for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (!wk) continue; const o = offs[si.getComponent(i, k)].elements; for (let j = 0; j < 16; j++) E[j] += o[j] * wk; }
      _F.copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(_M).multiply(mesh.bindMatrix);
      _nm.getNormalMatrix(_F); _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize();
      const f = _n.dot(fwd), front = Math.max(0, f), back = Math.max(0, -f), side = 1 - Math.abs(f);
      let d = 0;
      for (let k = 0; k < 4; k++) {
        const wk = sw.getComponent(i, k), m = push[si.getComponent(i, k)];
        if (wk && m) d += wk * (m[0] * front + m[1] * side + m[2] * back);
      }
      if (!d) continue;
      _d.copy(_n).multiplyScalar(d * amount);
      _im.setFromMatrix4(_F).invert(); _d.applyMatrix3(_im);      // metres -> the model's own units
      out[i * 3] += _d.x; out[i * 3 + 1] += _d.y; out[i * 3 + 2] += _d.z;
    }
    g.attributes.position.needsUpdate = true;
    g.computeBoundingBox(); g.computeBoundingSphere();
  }
  People.io = { readFile, parse, loadTexture, normPath, mimeOf, pack, onHttp };

  // The clip name a template uses for a role ('idle','walk','take','clap','sit').
  People.clipFor = function (tpl, role, k = 0) {
    if (tpl.clipMap && tpl.clipMap[role] && tpl.own[tpl.clipMap[role]]) return tpl.clipMap[role];
    if (tpl.own[role]) return role;
    if (!tpl.rocketbox) return null;
    if (role === 'sit') { const l = tpl.female ? ROCKETBOX.sit_female : ROCKETBOX.sit_male; return l[k % l.length]; }
    return ROCKETBOX[role] || null;
  };
  People.canSit = (tpl) => !!People.clipFor(tpl, 'sit');
  People.list = (role) => Object.values(People.templates).filter((t) => t.role === role).sort((a, b) => a.order - b.order);

  // A shared clip fitted to one Rocketbox body: rotations are shared; the hip
  // track is scaled to this body's height; other bones' offsets ride on this
  // body's own bones. A model's own clips are used as they are.
  People.fit = function (tpl, clipName) {
    if (tpl.own[clipName]) return tpl.own[clipName];
    if (tpl.fitted[clipName]) return tpl.fitted[clipName];
    const raw = People.clips[clipName];
    if (!raw || !tpl.rocketbox) return null;
    const s = tpl.rootY / (clipName.startsWith('f_') ? FEMALE_REF : MALE_REF);
    const tracks = [];
    for (const t of raw.tracks) {
      if (!t.name.endsWith('.position')) { tracks.push(t); continue; }
      const boneName = t.name.slice(0, -9);
      const bone = tpl.scene.getObjectByName(boneName);
      if (!bone) continue;
      const v = Float32Array.from(t.values);
      if (boneName === 'Bip01') {
        for (let i = 0; i < v.length; i++) v[i] *= s;
      } else {
        const b = bone.position;
        for (let i = 0; i < v.length; i += 3) { v[i] += b.x; v[i + 1] += b.y; v[i + 2] += b.z; }
      }
      tracks.push(new T.VectorKeyframeTrack(t.name, t.times, v));
    }
    const clip = new T.AnimationClip(clipName, raw.duration, tracks);
    tpl.fitted[clipName] = clip;
    return clip;
  };
  // A clip without the right arm (for a player holding his cue in that hand).
  People.noRight = function (clip) {
    People._noRight = People._noRight || new Map();
    let sub = People._noRight.get(clip);
    if (!sub) { sub = new T.AnimationClip(clip.name + '|noRight', clip.duration, clip.tracks.filter((t) => !RIGHT_ARM.test(t.name.split('.')[0]))); People._noRight.set(clip, sub); }
    return sub;
  };
  People.motions = ROCKETBOX;
  People.arms = function (clip, keepArms) {
    const key = clip.name + (keepArms ? '|arms' : '|body');
    People._subsets = People._subsets || new Map();
    const bag = People._subsets.get(clip) || {};
    if (bag[key]) return bag[key];
    const sub = new T.AnimationClip(key, clip.duration, clip.tracks.filter((t) => ARMS.test(t.name.split('.')[0]) === keepArms));
    bag[key] = sub; People._subsets.set(clip, bag);
    return sub;
  };

  People.spawn = function (id) {
    const tpl = People.templates[id];
    const obj = T.SkeletonUtils.clone(tpl.scene);
    const mixer = new T.AnimationMixer(obj);
    const person = { tpl, obj, mixer, actions: {},
      head: findBone(obj, 'Bip01_Head', /head$/i), neck: findBone(obj, 'Bip01_Neck', /neck\d?$/i) };
    person.clip = (role, k) => People.clipFor(tpl, role, k);
    // play(clipName or role, options) — returns a harmless stand-in when the
    // model has no such motion, so the game never breaks on a custom model.
    person.play = function (name, { weight = 1, time = 0, timeScale = 1, part = null } = {}) {
      const clipName = People.clips[name] || tpl.own[name] ? name : People.clipFor(tpl, name, 0);
      let clip = clipName ? People.fit(tpl, clipName) : null;
      if (!clip) return { setEffectiveWeight() {}, setEffectiveTimeScale() {}, setLoop() {}, reset() { return this; }, play() { return this; }, stop() { return this; }, isRunning: () => false, time: 0, clampWhenFinished: false };
      if (part === 'arms') clip = People.arms(clip, true);
      if (part === 'body') clip = People.arms(clip, false);
      if (part === 'noRight') clip = People.noRight(clip);
      const key = clipName + (part ? '|' + part : '');
      let a = person.actions[key];
      if (!a) { a = mixer.clipAction(clip); person.actions[key] = a; }
      a.enabled = true; a.setEffectiveTimeScale(timeScale); a.setEffectiveWeight(weight);
      if (!a.isRunning()) { a.play(); a.time = time % clip.duration; }
      return a;
    };
    return person;
  };

  window.VelvetPeople = People;
})();
