/* VELVET Studio — the app.
   Edit the people of the game: players (with an opponent profile each),
   your own body and name, the referee and the audience. Look (outfit
   colours, skin, hair, cue), shape (height, head, belly) and the face (a
   photo laid onto the head, touch-up brushes and stickers).
   Everything you change is saved into characters/studio.js; the game's own
   files stay as they are. */
(function () {
  'use strict';
  const T = window.THREE, P = window.VelvetPeople, X = window.StudioTex, VS = window.VelvetStudio || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  if (!T || !P || !X) { document.body.innerHTML = '<p style="padding:30px">VELVET Studio could not start: open it from the game folder (next to index.html).</p>'; return; }

  // ===========================================================================
  // DATA
  // BASE / BASE_O: the game's own characters and opponents (never changed).
  // D: your edits, saved as window.VELVET_STUDIO in characters/studio.js.
  // FILES: images written by the studio (characters/studio/<id>/...), base64.
  const BASE = (VS.basePeople || (window.VELVET_CHARACTERS || {}).people || []).map(clone);
  const BASE_O = (VS.baseOpps || window.VELVET_OPPONENTS || []).map(clone);
  const ANIMS = (window.VELVET_CHARACTERS || {}).animations || {};
  const emptyData = () => ({ version: 1, people: [], hidden: [], opponents: [], you: {}, two: {}, referee: null });
  function normalize(d) {
    const o = Object.assign(emptyData(), d && typeof d === 'object' ? clone(d) : {});
    for (const k of ['people', 'hidden', 'opponents']) if (!Array.isArray(o[k])) o[k] = [];
    o.you = o.you || {}; o.two = o.two || {};
    return o;
  }
  let D = normalize(window.VELVET_STUDIO);
  const FILES = {};
  for (const [k, v] of Object.entries(window.VELVET_FILES || {})) if (k.startsWith('characters/studio/')) FILES[k] = v;
  let dirty = false;

  const BODY_WORDS = { business_male: 'Man in a suit', business_female: 'Woman in a suit', male_adult: 'Man', female_adult: 'Woman', player: 'Snooker player', referee: 'Referee' };
  function bodyLabel(id) {
    const own = BASE.find((e) => e.id === id && e.name);       // characters made in Blender carry their own name
    if (own) return own.name;
    const m = /^([a-z_]+?)_?(\d+)?$/.exec(id || '');
    if (m && BODY_WORDS[m[1]]) return BODY_WORDS[m[1]] + (m[2] ? ' ' + (+m[2]) : '');
    return String(id || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }
  const baseOf = (id) => BASE.find((e) => e.id === id);
  const custom = (id) => D.people.find((e) => e.id === id);
  const entryOf = (id) => custom(id) || baseOf(id);
  const bodyOf = (e) => baseOf((e && (e.base || e.id)) || '') || baseOf('player_01') || BASE[0];
  const nameOf = (e) => (e && e.name) || bodyLabel(e && e.id);
  const isHidden = (id) => D.hidden.includes(id);
  function allPeople() {
    const list = BASE.map((b) => custom(b.id) || b);
    for (const e of D.people) if (!baseOf(e.id)) list.push(e);
    return list;
  }
  const visiblePeople = () => allPeople().filter((e) => !isHidden(e.id));
  function allOpps() {
    const l = BASE_O.map((b) => D.opponents.find((o) => o.id === b.id) || b);
    for (const o of D.opponents) if (!BASE_O.some((b) => b.id === o.id)) l.push(o);
    return l;
  }
  const oppOf = (id) => allOpps().find((o) => o.id === id);
  // an editable copy (your changes to one of the game's own characters live in D)
  function ensureCustom(id) { let e = custom(id); if (!e) { e = clone(baseOf(id)); D.people.push(e); } return e; }
  function ensureOpp(id) { let o = D.opponents.find((x) => x.id === id); if (!o) { o = clone(BASE_O.find((x) => x.id === id)); D.opponents.push(o); } return o; }
  function slug(s) { return String(s || 'player').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'player'; }
  function uniqueId(name, taken) {
    const base = 'my_' + slug(name);
    for (let i = 0; i < 999; i++) { const id = i ? base + '_' + (i + 1) : base; if (!taken(id)) return id; }
    return base + '_' + Date.now().toString(36);
  }
  const takenPerson = (id) => !!entryOf(id);
  const takenOpp = (id) => !!oppOf(id);
  const defaultOppBody = () => { const pl = visiblePeople().filter((e) => e.role === 'player'); const you = D.you.character; return (pl.find((e) => e.id === 'player_02' && e.id !== you) || pl.find((e) => e.id !== you) || pl[0] || {}).id; };
  const youBody = () => D.you.character || (visiblePeople().find((e) => e.role === 'player') || {}).id;
  const dataURL = (path) => FILES[path] ? 'data:' + (/\.png$/i.test(path) ? 'image/png' : /\.webp$/i.test(path) ? 'image/webp' : 'image/jpeg') + ';base64,' + FILES[path] : null;

  // ===========================================================================
  // UNDO
  const undo = [], redo = [];
  let lastSnap = { label: '', at: 0 };
  function snapshot() {
    const s = { D: JSON.stringify(D), sel: clone(sel), cur: cur.id, layers: null, photo: cur.photo };
    if (cur.parts) {
      s.layers = {};
      for (const [k, Pt] of Object.entries(cur.parts)) s.layers[k] = { paint: Pt.paint && Pt.paint.slice(), keep: Pt.keep && Pt.keep.slice(), face: Pt.face && Pt.face.slice(),
        regions: Pt.regions.map((r) => ({ mask: r.mask && r.mask.slice(), color: r.color, seed: r.seed })), gain: Pt.gain.slice(), hairColor: Pt.hairColor };
    }
    return s;
  }
  // call before a change; repeated calls with the same label within a moment are one step (a slider drag)
  function edit(label) {
    const now = performance.now();
    if (label && label === lastSnap.label && now - lastSnap.at < 900) { lastSnap.at = now; markDirty(); return; }
    undo.push(snapshot()); if (undo.length > 12) undo.shift(); redo.length = 0;
    lastSnap = { label: label || '', at: now };
    markDirty(); updateUndoUI();
  }
  async function applySnap(s) {
    D = JSON.parse(s.D);
    if (s.cur === cur.id && s.layers && cur.parts) {
      for (const [k, L] of Object.entries(s.layers)) {
        const Pt = cur.parts[k]; if (!Pt) continue;
        Pt.paint = L.paint && L.paint.slice(); Pt.keep = L.keep && L.keep.slice(); Pt.face = L.face && L.face.slice();
        Pt.regions = L.regions.map((r) => ({ mask: r.mask && r.mask.slice(), color: r.color, seed: r.seed })); Pt.gain = L.gain.slice(); Pt.hairColor = L.hairColor; Pt.highlight = null;
      }
      cur.photo = s.photo; cur.entry = entryOf(cur.id); cur.texDirty = true; cur.activeRegion = null;
      applyShape(); compositeAll(); styleCue();
    }
    sel = s.sel; renderList(); renderPanel();
    if (s.cur !== cur.id) await showSelection();
  }
  async function doUndo() { if (!undo.length) return; redo.push(snapshot()); await applySnap(undo.pop()); markDirty(); updateUndoUI(); }
  async function doRedo() { if (!redo.length) return; undo.push(snapshot()); await applySnap(redo.pop()); markDirty(); updateUndoUI(); }
  function updateUndoUI() { $('undo-btn').disabled = !undo.length; $('redo-btn').disabled = !redo.length; }
  function markDirty() { dirty = true; setStatus('Unsaved changes', true); }
  function setStatus(t, unsaved) { const s = $('status'); s.textContent = t; s.classList.toggle('unsaved', !!unsaved); }
  let toastTimer = 0;
  function toast(t, bad) { const el = $('toast'); el.textContent = t; el.className = bad ? 'bad' : ''; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), bad ? 6000 : 3200); }

  // ===========================================================================
  // 3D VIEW
  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(35, 1, 0.03, 80);
  const floor = new T.Mesh(new T.CircleGeometry(1.5, 64).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: '#16211f', roughness: 0.92 }));
  floor.receiveShadow = true; scene.add(floor);
  const ringFloor = new T.Mesh(new T.RingGeometry(1.48, 1.5, 96).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#8a7247' })); ringFloor.position.y = 0.002; scene.add(ringFloor);
  const L = {
    hemi: new T.HemisphereLight(0xf3ecdf, 0x1a1410, 1.1),
    key: new T.DirectionalLight(0xfff1dc, 2.4), rim: new T.DirectionalLight(0xa9c9ff, 1.1), fill: new T.DirectionalLight(0xffffff, 0.45),
    spot: new T.SpotLight(0xfff0d8, 0, 9, 0.62, 0.55, 1.2)
  };
  L.key.position.set(1.6, 3.2, 2.6); L.key.castShadow = true; L.key.shadow.mapSize.set(2048, 2048); L.key.shadow.bias = -0.0004;
  Object.assign(L.key.shadow.camera, { left: -1.5, right: 1.5, top: 2.4, bottom: -0.3, near: 0.5, far: 8 });
  L.rim.position.set(-2.2, 2.6, -2.6); L.fill.position.set(-2.4, 1.2, 1.6); L.spot.position.set(0, 4.2, 0.9); L.spot.castShadow = true; L.spot.target.position.set(0, 0.9, 0);
  for (const l of Object.values(L)) scene.add(l);
  scene.add(L.spot.target);
  function setLight(kind) {
    const arena = kind === 'arena';
    L.hemi.intensity = arena ? 0.22 : 1.1; L.key.intensity = arena ? 0.25 : 2.4; L.fill.intensity = arena ? 0.08 : 0.45; L.rim.intensity = arena ? 0.55 : 1.1;
    L.spot.intensity = arena ? 70 : 0; L.key.castShadow = !arena;
    floor.material.color.set(arena ? '#0c1211' : '#16211f');
  }
  // the cue, standing beside the character
  const cueGroup = new T.Group(); scene.add(cueGroup);
  (() => {
    const mat = (c, o) => new T.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }, o || {}));
    const seg = (r0, r1, len, y0, m) => { const s = new T.Mesh(new T.CylinderGeometry(r0, r1, len, 28), m); s.position.y = y0 + len / 2; s.castShadow = true; cueGroup.add(s); };
    const brass = new T.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.28, metalness: 0.85 }), ebony = mat('#1a100b', { roughness: 0.32, clearcoat: 0.7 });
    seg(0.0048, 0.0048, 0.006, 0, new T.MeshStandardMaterial({ color: '#3a6f8a', roughness: 0.9 })); seg(0.0049, 0.0049, 0.022, 0.006, brass);
    seg(0.0050, 0.0098, 0.84, 0.028, mat('#e2c59a')); seg(0.0098, 0.0128, 0.30, 0.868, ebony); seg(0.0128, 0.0148, 0.27, 1.168, ebony.clone()); seg(0.0149, 0.0149, 0.012, 1.438, brass.clone());
    cueGroup.rotation.z = Math.PI; cueGroup.position.set(0.52, 1.452, 0.05); cueGroup.rotation.x = -0.06;
  })();
  const CUE_METAL = { brass: ['#c9a45c', 0.85, 0.28], silver: ['#d6d9dc', 0.9, 0.22], gold: ['#e6bc52', 0.95, 0.2], black: ['#1c1c1f', 0.4, 0.38] };
  const WOODS = { '#e2c59a': 'Ash', '#efdcb4': 'Maple', '#c99a62': 'Golden ash', '#8a5a36': 'Walnut', '#5b2f1c': 'Rosewood', '#2a1a12': 'Ebony' };
  function styleCue() {
    const c = (cur.entry && cur.entry.cue) || {}, k = cueGroup.children;
    k[0].material.color.set(c.tip || '#3a6f8a'); k[2].material.color.set(c.shaft || '#e2c59a'); k[3].material.color.set(c.butt || '#1a100b'); k[4].material.color.set(c.butt || '#1a100b');
    const mt = CUE_METAL[c.metal] || CUE_METAL.brass;
    for (const j of [1, 5]) { k[j].material.color.set(mt[0]); k[j].material.metalness = mt[1]; k[j].material.roughness = mt[2]; }
    cueGroup.visible = !!cur.entry && cur.entry.role === 'player' && pose !== 'sit';
  }
  // a chair for the sitting pose
  const chair = new T.Group(); scene.add(chair); chair.visible = false;
  (() => {
    const wood = new T.MeshStandardMaterial({ color: '#3b2416', roughness: 0.6 }), seat = new T.MeshStandardMaterial({ color: '#5b1d22', roughness: 0.8 });
    const box = (w, h, d, x, y, z, m) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; chair.add(b); };
    box(0.48, 0.07, 0.46, 0, -0.035, 0, seat); box(0.48, 0.5, 0.05, 0, 0.25, -0.22, seat);
    for (const sx of [-0.21, 0.21]) for (const sz of [-0.2, 0.2]) box(0.04, 0.46, 0.04, sx, -0.3, sz, wood);
  })();

  // camera: orbit around a target
  const orbit = { target: new T.Vector3(0, 0.95, 0), theta: 0, phi: 1.42, r: 3.1, to: null };
  function applyOrbit() {
    const s = Math.sin(orbit.phi);
    camera.position.set(orbit.target.x + orbit.r * s * Math.sin(orbit.theta), orbit.target.y + orbit.r * Math.cos(orbit.phi), orbit.target.z + orbit.r * s * Math.cos(orbit.theta));
    camera.lookAt(orbit.target);
  }
  let camMode = 'front';
  function camPreset(mode, instant) {
    camMode = mode;
    document.querySelectorAll('#cam-seg button').forEach((b) => b.classList.toggle('on', b.dataset.cam === mode));
    const h = cur.height || 1.8, head = cur.lm ? cur.lm.mid.clone() : new T.Vector3(0, h * 0.93, 0.08);
    const far = h * 2.25 * Math.max(1, 1.25 / Math.max(0.6, camera.aspect));
    const to = mode === 'front' ? { t: new T.Vector3(0, h * 0.5, 0), theta: 0, phi: 1.45, r: far, fov: 35 }
      : mode === 'side' ? { t: new T.Vector3(0, h * 0.5, 0), theta: Math.PI / 2, phi: 1.45, r: far, fov: 35 }
      : mode === 'back' ? { t: new T.Vector3(0, h * 0.5, 0), theta: Math.PI, phi: 1.45, r: far, fov: 35 }
      : mode === 'face' ? { t: head.add(new T.Vector3(0, -0.035, 0)), theta: 0.18, phi: 1.5, r: 0.62, fov: 30 }
      : { t: new T.Vector3(0, h * 0.5, 0), theta: 0.75, phi: 1.02, r: 6.4, fov: 32 };
    if (pose === 'sit' && mode !== 'face' && mode !== 'game') to.t.y = h * 0.36;
    if (instant) { orbit.target.copy(to.t); orbit.theta = to.theta; orbit.phi = to.phi; orbit.r = to.r; camera.fov = to.fov; camera.updateProjectionMatrix(); orbit.to = null; applyOrbit(); }
    else orbit.to = { ...to, from: { t: orbit.target.clone(), theta: orbit.theta, phi: orbit.phi, r: orbit.r, fov: camera.fov }, k: 0 };
  }
  let spin = false, lastT = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (orbit.to) {
      const o = orbit.to; o.k = Math.min(1, o.k + dt / 0.45); const e = o.k * o.k * (3 - 2 * o.k);
      orbit.target.lerpVectors(o.from.t, o.t, e); orbit.theta = o.from.theta + (o.theta - o.from.theta) * e; orbit.phi = o.from.phi + (o.phi - o.from.phi) * e; orbit.r = o.from.r + (o.r - o.from.r) * e;
      camera.fov = o.from.fov + (o.fov - o.from.fov) * e; camera.updateProjectionMatrix(); if (o.k >= 1) orbit.to = null;
    }
    if (spin && cur.scene) cur.scene.rotation.y += dt * 0.5;
    if (cur.mixer && pose !== 'still') {
      cur.mixer.update(dt);
      const root = cur.scene && cur.scene.getObjectByName('Bip01');
      if (root && pose === 'walk') { root.position.x = cur.root0.x; root.position.z = cur.root0.z; }
      if (pose === 'sit') placeChair();
    }
    applyOrbit();
    resize();
    renderer.render(scene, camera);
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }
  }

  // ===========================================================================
  // THE OPEN CHARACTER
  const cur = { id: null, entry: null, tpl: null, scene: null, mixer: null, parts: null, lm: null, photo: null, height: 1.8, token: 0, texDirty: false, activeRegion: null, root0: new T.Vector3(), skinRef: [200, 160, 140], hairRef: [60, 45, 35] };
  let pose = 'still';
  const matches = (matName, key) => { const n = String(matName || '').toLowerCase(), k = key.toLowerCase(); return n === k || n.endsWith('_' + k) || n.endsWith(k); };
  const matsOf = (o) => (Array.isArray(o.material) ? o.material : [o.material]);
  function busy(on, text) { $('busy').hidden = !on; if (text) $('busy').querySelector('span').textContent = text; }
  let clipsReady = null;
  async function openChar(id) {
    const token = ++cur.token;
    commitCur();
    const e = entryOf(id);
    if (!e) { closeChar(); return; }
    busy(true, 'LOADING ' + nameOf(e).toUpperCase() + '…');
    try {
      await (clipsReady || (clipsReady = P.loadClips(ANIMS)));
      const body = bodyOf(e);
      const loadE = Object.assign(clone(e), { id: '__studio_' + token, textures: clone(body.textures || {}), normals: clone(body.normals || {}), shine: clone(body.shine || {}), model: e.model || body.model });
      const tpl = await P.loadEntry(loadE, 0, { noCulling: true });
      if (token !== cur.token) return;
      const want = pose, prev = cur.id;
      closeChar();
      if (prev !== id) { undo.length = 0; redo.length = 0; updateUndoUI(); }
      Object.assign(cur, { id, entry: e, tpl, scene: tpl.scene, mixer: new T.AnimationMixer(tpl.scene), parts: {}, lm: null, photo: null, texDirty: false, activeRegion: null });
      scene.add(tpl.scene);
      const root = tpl.scene.getObjectByName('Bip01'); if (root) cur.root0.copy(root.position);
      setPoseNow('still');
      cur.lm = landmarks();
      // one editable image per texture of the body
      for (const key of Object.keys(body.textures || {})) {
        const meshes = new Set(), mats = [];
        tpl.scene.traverse((o) => { if (o.isMesh) for (const m of matsOf(o)) if (matches(m.name, key)) { meshes.add(o); mats.push(m); } });
        const img = mats[0] && mats[0].map && mats[0].map.image;
        if (!img) continue;
        const part = X.buildPart(key, [...meshes], img, { alpha: key === 'opacity' || mats[0].alphaTest > 0 || mats[0].transparent });
        for (const m of mats) { m.map = part.tex; m.needsUpdate = true; }
        cur.parts[key] = part;
      }
      measure();
      findMasks();
      await loadEdits(e);
      if (token !== cur.token) return;
      compositeAll(); styleCue();
      if (want !== 'still') setPoseNow(want);
      camPreset(camMode, true);
    } catch (err) {
      console.error(err); toast('Could not load this character: ' + (err.message || err), true);
    } finally { if (token === cur.token) busy(false); }
  }
  function closeChar() {
    if (cur.scene) { scene.remove(cur.scene); cur.scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); for (const m of matsOf(o)) { if (m.map) m.map.dispose(); m.dispose(); } } }); }
    if (cur.tpl) delete P.templates[cur.tpl.name];
    Object.assign(cur, { id: null, entry: null, tpl: null, scene: null, mixer: null, parts: null, lm: null, photo: null, texDirty: false, activeRegion: null });
    stopSticker(true); setTool(null);
  }
  function measure() {
    const b = new T.Box3(), v = new T.Vector3();
    cur.scene.updateMatrixWorld(true);
    cur.scene.traverse((o) => { if (o.isBone) b.expandByPoint(o.getWorldPosition(v)); });
    cur.height = b.isEmpty() ? 1.8 : b.max.y + 0.1;
  }
  function landmarks() {
    const s = cur.scene; if (!s) return null; s.updateMatrixWorld(true);
    const w = (n) => { const b = s.getObjectByName('Bip01_' + n); return b ? b.getWorldPosition(new T.Vector3()) : null; };
    const eyeR = w('REye'), eyeL = w('LEye'), mr = w('RMouthCorner'), ml = w('LMouthCorner'), up = w('MUpperLip'), lo = w('MBottomLip');
    const mouth = mr && ml ? mr.add(ml).multiplyScalar(0.5) : up && lo ? up.add(lo).multiplyScalar(0.5) : null;
    if (!eyeR || !eyeL || !mouth) return null;
    const mid = eyeR.clone().add(eyeL).multiplyScalar(0.5), Xa = eyeL.clone().sub(eyeR).normalize(), Up = mid.clone().sub(mouth).normalize(), F = new T.Vector3().crossVectors(Xa, Up).normalize();
    const head = w('Head');
    return { eyeR, eyeL, mouth, mid, X: Xa, up: Up, F, head, rh: w('R_Hand'), lh: w('L_Hand') };
  }
  // where a ray from outside first meets the parts
  function surfaceAt(parts, p, dir) {
    const ray = new T.Ray(p.clone().addScaledVector(dir, 0.3), dir.clone().negate());
    const h = X.raycast(parts.filter(Boolean), ray); return h ? h.point : null;
  }
  // skin of the face and hands, hair on the scalp and the hair cards
  function findMasks() {
    const head = cur.parts.head, body = cur.parts.body, hair = cur.parts.opacity, lm = cur.lm;
    if (head && lm) {
      const cheeks = [lm.eyeR, lm.eyeL].map((eye, k) => surfaceAt([head], eye.clone().lerp(lm.mouth, 0.5).addScaledVector(lm.X, k ? 0.012 : -0.012), lm.F)).filter(Boolean);
      head.skin = cheeks.length ? X.skinMask(head, cheeks, { groups: [1], tol: 0.17 }) : null;
      const top = surfaceAt([head], lm.mid.clone().addScaledVector(lm.up, 0.09).addScaledVector(lm.F, -0.04), new T.Vector3(0, 1, 0));
      head.hair = top ? X.skinMask(head, [top], { groups: [1], tol: 0.15 }) : null;
      if (head.hair && head.skin) for (let i = 0; i < head.hair.length; i++) if (head.skin[i] > 0.5) head.hair[i] = 0;   // a bald model: the scalp is skin
      if (head.skin) { const m = X.medianColor(head.base.data, head.W * head.H, (i) => head.skin[i], 0.6); if (m) cur.skinRef = m; }
    }
    if (body && lm && lm.rh && lm.lh) body.skin = X.skinMask(body, [lm.rh, lm.lh], { groups: [4, 3], tol: 0.17 });
    if (hair) {
      const w = new Float32Array(hair.W * hair.H), d = hair.base.data;
      for (let i = 0; i < w.length; i++) w[i] = d[i * 4 + 3] > 20 ? 1 : 0;
      hair.hair = w;
      const m = X.medianColor(d, w.length, (i) => (d[i * 4 + 3] > 200 ? 1 : 0), 0.5); if (m) cur.hairRef = m;
    } else if (head && head.hair) { const m = X.medianColor(head.base.data, head.W * head.H, (i) => head.hair[i], 0.6); if (m) cur.hairRef = m; }
  }
  async function loadEdits(e) {
    const s = e.studio || {}, parts = cur.parts;
    if (Array.isArray(s.skin)) for (const k of ['head', 'body']) if (parts[k]) parts[k].gain = s.skin.slice();
    if (s.hair && s.hair.color) for (const k of ['head', 'opacity']) if (parts[k]) parts[k].hairColor = s.hair.color;
    for (const r of s.regions || []) { const Pt = parts[r.part], url = dataURL(r.mask); if (Pt && url) Pt.regions.push({ mask: await X.decodeLayer(url, Pt, 'mask'), color: r.color }); }
    for (const [k, path] of Object.entries(s.paint || {})) { const url = dataURL(path); if (parts[k] && url) parts[k].paint = await X.decodeLayer(url, parts[k], 'paint'); }
    for (const [k, path] of Object.entries(s.keep || {})) { const url = dataURL(path); if (parts[k] && url) parts[k].keep = await X.decodeLayer(url, parts[k], 'mask'); }
    if (s.face && s.face.photo && dataURL(s.face.photo)) { await setPhoto(await X.loadImage(dataURL(s.face.photo)), true); bakeFace(false); }
  }
  function compositeAll() { if (cur.parts) for (const Pt of Object.values(cur.parts)) X.composite(Pt); }
  const partEdited = (Pt) => !!((Pt.skin && Pt.gain.some((g) => Math.abs(g - 1) > 1e-3)) || (Pt.hair && Pt.hairColor) || Pt.regions.some((r) => r.color && r.mask) || Pt.face || !X.isEmptyPaint(Pt.paint));
  // the open character's images -> FILES, and its entry points at them
  function commitCur() {
    if (!cur.parts || !cur.texDirty || !cur.id) return;
    const e = ensureCustom(cur.id), body = bodyOf(e), dir = 'characters/studio/' + e.id + '/', used = new Set();
    cur.entry = e;
    const put = (name, url) => { const path = dir + name; FILES[path] = url.slice(url.indexOf(',') + 1); used.add(path); return path; };
    e.textures = clone(body.textures || {}); e.normals = clone(body.normals || {}); e.shine = clone(body.shine || {});
    const st = e.studio = Object.assign({}, e.studio || {}); st.paint = {}; st.keep = {}; st.regions = [];
    for (const [k, Pt] of Object.entries(cur.parts)) {
      if (partEdited(Pt)) { const url = X.encode(Pt, 'final'); e.textures[k] = put(k + (url.startsWith('data:image/webp') ? '.webp' : url.startsWith('data:image/png') ? '.png' : '.jpg'), url); }
      if (!X.isEmptyPaint(Pt.paint)) st.paint[k] = put('src_' + k + '_paint.png', X.encode(Pt, 'paint'));
      if (Pt.face && Pt.keep && !X.isFullKeep(Pt.keep)) st.keep[k] = put('src_' + k + '_keep.png', X.encode(Pt, 'keep'));
      Pt.regions.forEach((r, n) => { if (r.color && r.mask) st.regions.push({ part: k, color: r.color, mask: put('src_' + k + '_r' + n + '.png', X.encode(Pt, r)) }); });
    }
    const g = (cur.parts.head || cur.parts.body || { gain: [1, 1, 1] }).gain;
    st.skin = g.some((v) => Math.abs(v - 1) > 1e-3) ? g.map((v) => +v.toFixed(4)) : null;
    const hc = (cur.parts.opacity || cur.parts.head || {}).hairColor; st.hair = hc ? { color: hc } : null;
    if (st.face && cur.photo) st.face.photo = put('src_photo.jpg', cur.photo.url); else if (st.face) delete st.face;
    for (const k of Object.keys(FILES)) if (k.startsWith(dir) && !used.has(k)) delete FILES[k];
    cur.texDirty = false;
  }
  function texChanged() { cur.texDirty = true; if (cur.id) { cur.entry = ensureCustom(cur.id); } markDirty(); }

  // ---- poses
  const POSE_CLIP = { still: 'idle', idle: 'idle', walk: 'walk', sit: 'sit', cheer: 'cheer', clap: 'clap' };
  function setPoseNow(p) {
    pose = p; if (!cur.mixer) return;
    cur.mixer.stopAllAction();
    const tpl = cur.tpl, role = POSE_CLIP[p], name = P.clipFor(tpl, role, 0), clip = name && P.fit(tpl, name);
    const root = cur.scene.getObjectByName('Bip01');
    if (root) root.position.copy(cur.root0);
    if (clip) { const a = cur.mixer.clipAction(clip); a.reset().play(); if (p === 'still') { a.time = Math.min(0.6, clip.duration * 0.3); a.paused = true; } }
    cur.mixer.update(0);
    if (root && p === 'walk') { root.position.x = cur.root0.x; root.position.z = cur.root0.z; }
    chair.visible = p === 'sit'; if (p === 'sit') placeChair();
    cur.scene.updateMatrixWorld(true);
    cueGroup.visible = !!cur.entry && cur.entry.role === 'player' && p !== 'sit';
    $('pose-sel').value = p;
    const editable = p === 'still';
    if (!editable && tool) setTool(null);
    if (editable && cur.parts) { cur.scene.rotation.y = 0; for (const Pt of Object.values(cur.parts)) X.refreshPositions(Pt); cur.lm = landmarks(); }
  }
  function placeChair() {
    const pel = cur.scene && cur.scene.getObjectByName('Bip01_Pelvis'); if (!pel) return;
    const v = pel.getWorldPosition(new T.Vector3()); chair.position.set(v.x, Math.max(0.3, v.y - 0.1), v.z - 0.06); chair.rotation.y = cur.scene.rotation.y;
  }
  // body shape sliders (height, head size, belly) on the open character
  function applyShape() {
    if (!cur.scene || !cur.entry) return;
    P.applyBody(cur.scene, cur.entry);
    if (pose === 'still') { cur.mixer.update(0); cur.scene.updateMatrixWorld(true); }
    shapeStale = true; clearTimeout(shapeTimer); shapeTimer = setTimeout(refreshShape, 250);
  }
  let shapeStale = false, shapeTimer = 0;
  function refreshShape() {
    if (!shapeStale || !cur.parts || pose !== 'still') return; shapeStale = false;
    cur.scene.updateMatrixWorld(true);
    for (const Pt of Object.values(cur.parts)) X.refreshPositions(Pt);
    cur.lm = landmarks(); measure();
  }

  // ===========================================================================
  // TOOLS ON THE MODEL: pick a part of the outfit, region brushes, paint /
  // restore / blur, stickers.
  let tool = null;
  const toolOpt = { size: 2.5, strength: 0.7, color: '#c2453c', tol: 13, everywhere: false, regionSize: 5 };
  const cursorRing = new T.Mesh(new T.RingGeometry(0.92, 1, 40), new T.MeshBasicMaterial({ color: 0xf0d7a1, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
  cursorRing.renderOrder = 10; cursorRing.visible = false; scene.add(cursorRing);
  const TOOL_HINT = { pick: 'Click the clothes on the model to pick that part · Shift+click adds to it', add: 'Paint to add to the picked part', remove: 'Paint to take away from the picked part',
    paint: 'Paint on the model', restore: 'Paint to bring back the original', blur: 'Paint to soften', sticker: 'Click on the model to place the sticker · drag to move it' };
  function setTool(t) {
    if (t && pose !== 'still') { setPoseNow('still'); }
    if (t && spin) { spin = false; $('spin-btn').classList.remove('on'); if (cur.scene) { cur.scene.rotation.y = 0; cur.scene.updateMatrixWorld(true); shapeStale = true; } }
    if (t && (!cur.parts || !Object.keys(cur.parts).length)) { toast('Open a character first'); t = null; }
    tool = t;
    $('tool-hint').hidden = !t; if (t) $('tool-hint').textContent = TOOL_HINT[t] || '';
    canvas.style.cursor = t ? 'crosshair' : 'grab';
    cursorRing.visible = false;
    document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    highlightActive();
  }
  const ndc = new T.Vector2(), raycaster = new T.Raycaster();
  function hitAt(ev) {
    if (!cur.parts) return null;
    if (shapeStale) refreshShape();
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const parts = Object.values(cur.parts);
    return X.raycast(parts, raycaster.ray);
  }
  const brushRadius = () => (tool === 'add' || tool === 'remove' ? toolOpt.regionSize : toolOpt.size) / 100;
  function showRing(hit) {
    if (!hit || !tool || tool === 'pick' || tool === 'sticker') { cursorRing.visible = false; return; }
    cursorRing.visible = true; cursorRing.position.copy(hit.point).addScaledVector(hit.normal, 0.002);
    cursorRing.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), hit.normal); cursorRing.scale.setScalar(brushRadius());
  }
  let stroke = null;
  function toolDown(hit, ev) {
    if (tool === 'pick') return pickRegion(hit, ev.shiftKey);
    if (tool === 'sticker') { placeSticker(hit); stroke = { sticker: true }; return; }
    if ((tool === 'add' || tool === 'remove') && !activeRegion()) { toast('Pick a part first'); return; }
    edit('brush'); lastSnap.label = '';                       // each stroke is one undo step
    stroke = { last: null };
    brushAt(hit);
  }
  function brushAt(hit) {
    const Pt = hit.part, r = brushRadius();
    if (stroke.last && stroke.last.distanceTo(hit.point) < r * 0.3) return;
    stroke.last = hit.point.clone();
    if (tool === 'add' || tool === 'remove') {
      const ar = activeRegion(); if (!ar || ar.part !== Pt) return;
      X.brush(Pt, hit.point, r, 1, tool, null, ar.region); Pt.highlight = ar.region.color ? null : ar.region.mask;
    } else X.brush(Pt, hit.point, r, toolOpt.strength, tool, toolOpt.color);
    X.composite(Pt); texChanged();
  }
  function toolMove(hit) {
    if (!stroke) return;
    if (stroke.sticker) { if (hit) moveSticker(hit); return; }
    if (hit) brushAt(hit);
  }
  function toolUp() { if (stroke && !stroke.sticker && tool !== 'add' && tool !== 'remove') renderPanelSoon(); stroke = null; }

  // outfit regions
  function activeRegion() { const a = cur.activeRegion; if (!a || !cur.parts) return null; const Pt = cur.parts[a.part]; const region = Pt && Pt.regions[a.i]; return region ? { part: Pt, region } : null; }
  function highlightActive() {
    if (!cur.parts) return;
    const a = activeRegion();
    for (const Pt of Object.values(cur.parts)) { const was = !!Pt.highlight; Pt.highlight = a && a.part === Pt && (!a.region.color || tool === 'pick') ? a.region.mask : null; if (was || Pt.highlight) X.composite(Pt); }
  }
  function pickRegion(hit, add) {
    const Pt = hit.part;
    edit('pick');
    const mask = X.selectAt(Pt, hit.tri, { tol: toolOpt.tol / 100, everywhere: toolOpt.everywhere });
    const a = activeRegion();
    const d = Pt.base.data, i = (Math.floor((hit.uv[1] - Math.floor(hit.uv[1])) * Pt.H) * Pt.W + Math.floor((hit.uv[0] - Math.floor(hit.uv[0])) * Pt.W)) * 4;
    if (add && a && a.part === Pt) { for (let k = 0; k < mask.length; k++) a.region.mask[k] = Math.max(a.region.mask[k], mask[k]); a.region.mean = 0; }
    else if (a && a.part === Pt && !a.region.color) { a.region.mask = mask; a.region.mean = 0; a.region.seed = X.rgbHex([d[i], d[i + 1], d[i + 2]]); }
    else { Pt.regions.push({ mask, color: null, seed: X.rgbHex([d[i], d[i + 1], d[i + 2]]) }); cur.activeRegion = { part: Pt.key, i: Pt.regions.length - 1 }; }
    highlightActive(); texChanged(); renderPanel();
  }

  // ---- face photo
  function faceSet() {
    const e = cur.entry || {};
    return (e.studio && e.studio.face) || null;
  }
  async function setPhoto(img, keepSettings) {
    const s = Math.min(1, 1024 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(16, Math.round((img.naturalWidth || img.width) * s)), h = Math.max(16, Math.round((img.naturalHeight || img.height) * s));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
    cur.photo = { canvas: cv, w, h, data: cx.getImageData(0, 0, w, h), url: cv.toDataURL('image/jpeg', 0.92), even: {} };
    if (!keepSettings) {
      const e = ensureCustom(cur.id); cur.entry = e; e.studio = e.studio || {};
      e.studio.face = { pts: [[w * 0.37, h * 0.42], [w * 0.63, h * 0.42], [w * 0.5, h * 0.68]], width: 1, height: 1, soft: 0.35, even: 0.35, bright: 1, match: true };
    }
  }
  function evenPhoto(amount, bright) {
    const ph = cur.photo, k = Math.round((amount || 0) * 20) + ':' + Math.round((bright || 1) * 50);
    for (const key of Object.keys(ph.even)) if (key !== k) delete ph.even[key];   // keep one processed copy
    return ph.even[k] || (ph.even[k] = X.evenLight(ph.data, Math.round((amount || 0) * 20) / 20, Math.round((bright || 1) * 50) / 50));
  }
  function bakeFace(match = true) {
    const head = cur.parts && cur.parts.head, f = faceSet();
    if (!head || !cur.photo || !f) return;
    if (shapeStale) refreshShape();
    if (!cur.lm) { toast('This model has no face bones, so a photo cannot be placed', true); return; }
    head.face = X.bakeFace(head, evenPhoto(f.even, f.bright), f.pts, cur.lm, { width: f.width, height: f.height, soft: f.soft });
    if (match && f.match && head.face) matchSkin();
    compositeAll();
  }
  function matchSkin() {
    const head = cur.parts.head, face = head.face, N = head.W * head.H, wgt = (i) => face[i * 4 + 3] / 255;
    const pm = X.medianColor(face, N, wgt, 0.92), bm = X.medianColor(head.base.data, N, wgt, 0.92);
    if (!pm || !bm) return;
    const g = pm.map((v, k) => clamp(v / Math.max(8, bm[k]), 0.35, 2.6));
    for (const k of ['head', 'body']) if (cur.parts[k]) cur.parts[k].gain = g.slice();
  }

  // ---- stickers (drawn here, laid onto the model like a transfer)
  const STICKERS = {
    moustache: { label: 'MOUSTACHE', size: 0.075, color: '#2a1d16', draw(c, col) {
      c.fillStyle = col; c.beginPath(); c.moveTo(128, 120);
      c.bezierCurveTo(104, 96, 64, 104, 46, 128); c.bezierCurveTo(32, 146, 18, 140, 10, 124); c.bezierCurveTo(12, 158, 46, 166, 74, 150); c.bezierCurveTo(98, 138, 116, 140, 128, 146);
      c.bezierCurveTo(140, 140, 158, 138, 182, 150); c.bezierCurveTo(210, 166, 244, 158, 246, 124); c.bezierCurveTo(238, 140, 224, 146, 210, 128); c.bezierCurveTo(192, 104, 152, 96, 128, 120); c.fill(); } },
    glasses: { label: 'GLASSES', size: 0.15, color: '#1b1b1b', draw(c, col) {
      c.strokeStyle = col; c.lineWidth = 9; c.fillStyle = 'rgba(200,225,235,.18)';
      for (const x of [74, 182]) { c.beginPath(); c.arc(x, 128, 46, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.beginPath(); c.moveTo(118, 122); c.quadraticCurveTo(128, 112, 138, 122); c.stroke(); c.beginPath(); c.moveTo(28, 122); c.lineTo(4, 114); c.moveTo(228, 122); c.lineTo(252, 114); c.stroke(); } },
    shades: { label: 'SUNGLASSES', size: 0.15, color: '#111111', draw(c, col) {
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 8;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(128 + s * 10, 104); c.lineTo(128 + s * 104, 100); c.quadraticCurveTo(128 + s * 106, 150, 128 + s * 66, 160); c.quadraticCurveTo(128 + s * 20, 160, 128 + s * 10, 112); c.fill(); }
      c.beginPath(); c.moveTo(118, 108); c.lineTo(138, 108); c.stroke(); } },
    nose: { label: 'CLOWN NOSE', size: 0.04, color: '#d8231f', draw(c, col) {
      const g = c.createRadialGradient(108, 108, 6, 128, 128, 110); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, col); g.addColorStop(1, shade(col, 0.55));
      c.fillStyle = g; c.beginPath(); c.arc(128, 128, 110, 0, Math.PI * 2); c.fill(); } },
    blush: { label: 'BLUSH', size: 0.05, color: '#e3546b', draw(c, col) {
      const g = c.createRadialGradient(128, 128, 0, 128, 128, 120); g.addColorStop(0, hexA(col, 0.6)); g.addColorStop(1, hexA(col, 0)); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } },
    heart: { label: 'HEART', size: 0.04, color: '#d82a3c', draw(c, col) {
      c.fillStyle = col; c.beginPath(); c.moveTo(128, 222); c.bezierCurveTo(30, 150, 14, 96, 50, 60); c.bezierCurveTo(82, 30, 118, 46, 128, 78); c.bezierCurveTo(138, 46, 174, 30, 206, 60); c.bezierCurveTo(242, 96, 226, 150, 128, 222); c.fill(); } },
    star: { label: 'STAR', size: 0.04, color: '#f2c32e', draw(c, col) {
      c.fillStyle = col; c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 48 : 118, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(128 + r * Math.cos(a), 132 + r * Math.sin(a)); } c.closePath(); c.fill(); } },
    stripes: { label: 'WAR PAINT', size: 0.06, color: '#1e3f9a', draw(c, col) {
      c.fillStyle = col; for (const y of [86, 150]) { c.beginPath(); c.moveTo(8, y); c.lineTo(248, y - 10); c.lineTo(248, y + 26); c.lineTo(8, y + 32); c.closePath(); c.fill(); } } },
    scar: { label: 'SCAR', size: 0.05, color: '#9c3b35', draw(c, col) {
      c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 12; c.beginPath(); c.moveTo(40, 210); c.quadraticCurveTo(120, 140, 216, 46); c.stroke();
      c.lineWidth = 6; for (let k = 0; k < 5; k++) { const t = 0.15 + k * 0.17, x = 40 + 176 * t, y = 210 - 164 * t; c.beginPath(); c.moveTo(x - 18, y - 16); c.lineTo(x + 18, y + 16); c.stroke(); } } },
    patch: { label: 'SPONSOR', size: 0.12, color: '#1d4e8f', text: 'VELVET', draw(c, col, text) {
      round(c, 10, 66, 236, 124, 22); c.fillStyle = col; c.fill(); c.lineWidth = 8; c.strokeStyle = '#f2e6c8'; c.stroke();
      fitText(c, text || 'VELVET', 128, 130, 200, 70, '#f7efd8'); } },
    text: { label: 'TEXT', size: 0.12, color: '#111111', text: 'CHAMP', draw(c, col, text) { fitText(c, text || 'CHAMP', 128, 130, 236, 90, col); } }
  };
  function round(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fitText(c, t, x, y, maxW, maxH, col) { let s = maxH; c.font = '900 ' + s + 'px Arial'; while (s > 10 && c.measureText(t).width > maxW) { s -= 2; c.font = '900 ' + s + 'px Arial'; } c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y); }
  function shade(hex, k) { return X.rgbHex(X.hexRGB(hex).map((v) => v * k)); }
  function hexA(hex, a) { const c = X.hexRGB(hex); return 'rgba(' + c.join(',') + ',' + a + ')'; }
  function stickerImage(kind, col, text) { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); STICKERS[kind].draw(c, col, text); return c.getImageData(0, 0, 256, 256); }
  let sticker = null;   // {kind, color, size, angle, text, at, part}
  function startSticker(kind) {
    const S = STICKERS[kind]; stopSticker(true);
    sticker = { kind, color: S.color, size: S.size, angle: 0, text: S.text || '', at: null, part: null };
    setTool('sticker'); if (camMode !== 'face' && ['moustache', 'glasses', 'shades', 'nose', 'blush'].includes(kind)) camPreset('face');
    renderPanel();
  }
  function placeSticker(hit) {
    if (!sticker) return;
    const toCam = camera.position.clone().sub(hit.point).normalize(), F = toCam.clone().multiplyScalar(0.55).addScaledVector(hit.normal, 0.45).normalize();
    const up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    if (sticker.part && sticker.part !== hit.part) { sticker.part.temp = null; X.composite(sticker.part); }
    const first = !sticker.at;
    sticker.at = { point: hit.point.clone(), F, up }; sticker.part = hit.part;
    updateSticker(); if (first) renderPanelSoon();
  }
  function moveSticker(hit) { if (sticker && sticker.at) placeSticker(hit); }
  function updateSticker() {
    if (!sticker || !sticker.at) return;
    const img = stickerImage(sticker.kind, sticker.color, sticker.text);
    sticker.part.temp = X.bakeSticker(sticker.part, img, sticker.at, sticker.size, sticker.angle);
    X.composite(sticker.part);
    const b = $('sticker-done'); if (b) b.disabled = false;
  }
  function stopSticker(cancel) {
    if (!sticker) return;
    if (sticker.part) { if (cancel) sticker.part.temp = null; else { edit('sticker'); lastSnap.label = ''; X.mergeTemp(sticker.part); texChanged(); } X.composite(sticker.part); }
    sticker = null; if (tool === 'sticker') setTool(null);
  }

  // ---- pointer on the 3D view
  let drag = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId); orbit.to = null;
    if (ev.button === 0 && tool && cur.parts) { const hit = hitAt(ev); if (hit) { toolDown(hit, ev); drag = { tool: true }; return; } }
    drag = { x: ev.clientX, y: ev.clientY, pan: ev.button === 2 || ev.button === 1 || ev.shiftKey };
    if (!tool) canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (drag && drag.tool) { const hit = hitAt(ev); showRing(hit); toolMove(hit); return; }
    if (drag) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
      if (drag.pan) {
        const k = orbit.r * 0.0016, right = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        orbit.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      } else { orbit.theta -= dx * 0.008; orbit.phi = clamp(orbit.phi - dy * 0.006, 0.25, 2.6); }
      return;
    }
    if (tool && tool !== 'pick' && tool !== 'sticker') showRing(hitAt(ev));
  });
  const endDrag = () => { if (drag && drag.tool) toolUp(); drag = null; canvas.style.cursor = tool ? 'crosshair' : 'grab'; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (!drag) cursorRing.visible = false; });
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); orbit.to = null; orbit.r = clamp(orbit.r * Math.exp(ev.deltaY * 0.0012), 0.25, 14); }, { passive: false });

  // ===========================================================================
  // LIST
  let sel = { kind: 'you', id: null };
  let tab = 'character';
  const ROLE_LABEL = { player: 'Player body', referee: 'Referee', audience: 'Audience' };
  function initials(s) { const w = String(s || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
  function renderList() {
    const q = $('search').value.trim().toLowerCase(), G = [];
    const item = (kind, id, name, sub, tag, extra) => {
      if (q && !(name + ' ' + sub).toLowerCase().includes(q)) return '';
      const on = sel.kind === kind && (sel.id || null) === (id || null);
      return '<button class="item' + (on ? ' sel' : '') + (extra || '') + '" data-kind="' + kind + '" data-id="' + esc(id || '') + '"><span class="av">' + esc(initials(name)) + '</span><span class="tx"><span class="nm">' + esc(name) + '</span><span class="sub">' + esc(sub) + '</span></span>' + (tag ? '<span class="tag' + (tag === 'NEW' ? ' new' : '') + '">' + tag + '</span>' : '') + '</button>';
    };
    const people = allPeople(), linked = (id) => allOpps().filter((o) => o.character === id).map((o) => o.name);
    const tagOf = (e) => (!baseOf(e.id) ? 'NEW' : custom(e.id) ? 'EDITED' : isHidden(e.id) ? 'HIDDEN' : '');
    G.push('<div class="group-title">YOU &amp; PLAYER TWO</div>' + item('you', null, D.you.name || 'You', 'Body: ' + nameOf(entryOf(youBody()) || {}), '') + item('two', null, D.two.name || 'Player two', '2-player games · body: ' + nameOf(entryOf(D.two.character || defaultOppBody()) || {}), ''));
    const opps = allOpps();
    G.push('<div class="group-title">OPPONENTS <small>' + opps.length + '</small></div>' + opps.map((o) => item('opp', o.id, o.name, (o.character ? 'Body: ' + nameOf(entryOf(o.character) || {}) : 'Default body') + (o.tour ? ' · tournaments' : ''), !BASE_O.some((b) => b.id === o.id) ? 'NEW' : D.opponents.some((x) => x.id === o.id) ? 'EDITED' : '')).join(''));
    for (const role of ['player', 'referee', 'audience']) {
      const list = people.filter((e) => e.role === role);
      const title = role === 'player' ? 'PLAYER BODIES' : role === 'referee' ? 'REFEREES' : 'AUDIENCE';
      G.push('<div class="group-title">' + title + ' <small>' + list.length + '</small></div>' + list.map((e) => {
        const l = role === 'player' ? linked(e.id) : [];
        const sub = role === 'player' ? (l.length ? 'Plays as ' + l.join(', ') : D.you.character === e.id || (!D.you.character && youBody() === e.id) ? 'Your body' : bodyLabel(bodyOf(e).id))
          : role === 'referee' ? ((D.referee || (people.find((x) => x.role === 'referee' && !isHidden(x.id)) || {}).id) === e.id ? 'Match referee' : bodyLabel(bodyOf(e).id))
            : (e.gender === 'female' ? 'Woman' : 'Man') + ' · in the crowd ×' + (e.weight == null ? 1 : e.weight);
        return item('char', e.id, nameOf(e), sub, tagOf(e), isHidden(e.id) ? ' hidden-item' : '');
      }).join(''));
    }
    $('groups').innerHTML = G.join('');
    const delBtn = $('del-btn'), copyBtn = $('copy-btn');
    delBtn.disabled = !(sel.kind === 'char' || (sel.kind === 'opp' && !BASE_O.some((b) => b.id === sel.id)));
    delBtn.textContent = sel.kind === 'char' && baseOf(sel.id) ? (isHidden(sel.id) ? 'UNHIDE' : 'HIDE') : 'DELETE';
    copyBtn.disabled = !(sel.kind === 'char' || sel.kind === 'opp');
  }
  $('groups').addEventListener('click', (ev) => { const b = ev.target.closest('.item'); if (!b) return; select(b.dataset.kind, b.dataset.id || null); });
  $('search').addEventListener('input', renderList);
  async function select(kind, id) {
    if (sticker) stopSticker(true);
    sel = { kind, id }; renderList(); renderPanel(); await showSelection();
  }
  function bodyForSelection() {
    if (sel.kind === 'char') return sel.id;
    if (sel.kind === 'you') return youBody();
    if (sel.kind === 'two') return D.two.character || defaultOppBody();
    if (sel.kind === 'opp') { const o = oppOf(sel.id); return (o && o.character) || defaultOppBody(); }
    return null;
  }
  async function showSelection() { const id = bodyForSelection(); if (id && id !== cur.id) await openChar(id); else if (!id) closeChar(); renderPanel(); }

  // ===========================================================================
  // PANELS
  const pct = (v) => Math.round(v * 100) + '%';
  function slider(id, label, min, max, step, value, fmt) {
    return '<div class="row"><label for="' + id + '">' + label + '</label><input class="grow" type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"><span class="val" id="' + id + '-v">' + fmt(value) + '</span></div>';
  }
  function bindSlider(id, fmt, fn) { const el = $(id); if (!el) return; el.addEventListener('input', () => { $(id + '-v').textContent = fmt(+el.value); fn(+el.value, false); }); el.addEventListener('change', () => fn(+el.value, true)); }
  function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); }
  let panelTimer = 0;
  function renderPanelSoon() { clearTimeout(panelTimer); panelTimer = setTimeout(renderPanel, 60); }
  function renderPanel() {
    const tabs = $('tabs'), body = $('panel-body');
    tabs.hidden = sel.kind !== 'char';
    tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (sel.kind === 'you' || sel.kind === 'two') body.innerHTML = panelYou(sel.kind);
    else if (sel.kind === 'opp') body.innerHTML = panelOpp();
    else if (sel.kind === 'char') body.innerHTML = tab === 'look' ? panelLook() : tab === 'face' ? panelFace() : panelChar();
    else body.innerHTML = '';
    bindPanel();
  }
  $('tabs').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; if (tab !== 'face' && sticker) stopSticker(true); if (tool && !(tab === 'look' ? ['pick', 'add', 'remove'] : ['paint', 'restore', 'blur', 'sticker']).includes(tool)) setTool(null); renderPanel(); if (tab === 'face' && cur.lm) camPreset('face'); });
  function bodySelect(id, value, withDefault) {
    const list = visiblePeople().filter((e) => e.role === 'player');
    return '<select id="' + id + '">' + (withDefault ? '<option value="">Default body</option>' : '') + list.map((e) => '<option value="' + esc(e.id) + '"' + (e.id === value ? ' selected' : '') + '>' + esc(nameOf(e)) + '</option>').join('') + '</select>';
  }
  // You / Player two
  function panelYou(kind) {
    const y = kind === 'you' ? D.you : D.two, two = kind === 'two';
    return '<div class="sec"><h2>' + esc(y.name || (two ? 'Player two' : 'You')) + '</h2><p class="lead">' + (two ? 'The second player in 2-player games.' : 'Your name and body at the table.') + '</p></div>'
      + '<div class="sec"><h3>NAME</h3><div class="field"><label>Full name (walk-on)</label><input type="text" id="y-name" maxlength="40" value="' + esc(y.name || '') + '" placeholder="' + (two ? 'Player two' : 'You') + '"></div>'
      + '<div class="field"><label>Short name (scoreboard)</label><input type="text" id="y-short" maxlength="14" value="' + esc(y.short || '') + '" placeholder="' + (two ? 'PLAYER TWO' : 'YOU') + '"></div>'
      + '<div class="field"><label>Nickname (walk-on)</label><input type="text" id="y-nick" maxlength="24" value="' + esc(y.nick || '') + '" placeholder="The Rocket"></div></div>'
      + '<div class="sec"><h3>BODY</h3><div class="row"><label>Body</label><div class="grow">' + bodySelect('y-body', two ? (D.two.character || '') : (D.you.character || ''), true) + '</div></div>'
      + '<div class="btns"><button id="y-edit">EDIT THIS BODY</button><button id="y-new" class="ghost">+ NEW BODY</button></div><p class="note">Your messages still say “YOU”; the name shows on the scoreboard and the walk-on.</p></div>';
  }
  // Opponent profile
  const STYLE = [
    ['pot', 'Potting', (v) => 1.4 - 0.8 * v, (x) => (1.4 - x) / 0.8, 1],
    ['long', 'Long pots', (v) => 1.4 - 0.8 * v, (x) => (1.4 - x) / 0.8, 1],
    ['attack', 'Attacking', (v) => +(0.2 - 0.4 * v).toFixed(3), (x) => (0.2 - x) / 0.4, 0],
    ['position', 'Positional play', (v) => +(0.6 + v).toFixed(3), (x) => x - 0.6, 1],
    ['safety', 'Safety play', (v) => +(0.6 + v).toFixed(3), (x) => x - 0.6, 1],
    ['speed', 'Plays quickly', (v) => +(1.6 - 1.2 * v).toFixed(3), (x) => (1.6 - x) / 1.2, 1]
  ];
  function panelOpp() {
    const o = oppOf(sel.id); if (!o) return '';
    const st = o.style || {}, builtIn = BASE_O.some((b) => b.id === o.id), edited = builtIn && D.opponents.some((x) => x.id === o.id);
    return '<div class="sec"><h2>' + esc(o.name) + '</h2><p class="lead">' + (builtIn ? 'Built-in opponent' : 'Your opponent') + (o.nick ? ' · “' + esc(o.nick) + '”' : '') + '</p></div>'
      + '<div class="sec"><h3>NAME</h3><div class="field"><label>Full name</label><input type="text" id="o-name" maxlength="40" value="' + esc(o.name) + '"></div>'
      + '<div class="field"><label>Short name (scoreboard)</label><input type="text" id="o-short" maxlength="14" value="' + esc(o.short || '') + '"></div>'
      + '<div class="field"><label>Nickname (walk-on)</label><input type="text" id="o-nick" maxlength="24" value="' + esc(o.nick || '') + '" placeholder="The Rocket"></div></div>'
      + '<div class="sec"><h3>BODY</h3><div class="row"><label>Body</label><div class="grow">' + bodySelect('o-body', o.character || '', true) + '</div></div><div class="btns"><button id="o-edit">EDIT THIS BODY</button><button id="o-new" class="ghost">+ NEW BODY</button></div></div>'
      + '<div class="sec"><h3>PLAYING STYLE</h3><p class="note">On top of the level you pick in the game.</p>'
      + STYLE.map(([k, label, , inv, def]) => slider('o-' + k, label, 0, 1, 0.01, clamp(inv(st[k] == null ? def : st[k]), 0, 1).toFixed(2), (v) => Math.round(v * 100))).join('') + '</div>'
      + (o.id === 'club' ? '' : '<div class="sec"><h3>TOURNAMENTS</h3><label class="check"><input type="checkbox" id="o-tour"' + (o.tour || builtIn ? ' checked' : '') + (builtIn ? ' disabled' : '') + '> Plays in tournaments</label>'
        + slider('o-rating', 'Rating', 70, 99, 1, o.rating != null ? o.rating : (builtIn ? ({ trump: 92, osullivan: 92, zhao: 89, selby: 89, wilson: 88, higgins: 87, williams: 86, murphy: 86, allen: 86, robertson: 86, ding: 85, brecel: 85, hawkins: 83, bingham: 82, lisowski: 81 })[o.id] || 84 : 84), (v) => v)
        + '<p class="note">The 15 best-rated players make the 16-player draw with you; higher ratings are seeded.</p></div>')
      + '<div class="sec"><div class="btns"><button id="o-test">▶ TEST IN GAME</button>' + (builtIn ? (edited ? '<button id="o-restore" class="ghost">RESTORE ORIGINAL</button>' : '') : '<button id="o-del" class="ghost danger">DELETE</button>') + '</div></div>';
  }
  // Character tab
  function panelChar() {
    const e = entryOf(sel.id); if (!e) return '';
    const body = bodyOf(e), base = !!baseOf(e.id), hidden = isHidden(e.id), role = e.role || 'audience';
    const opp = allOpps().find((o) => o.character === e.id);
    const h0 = cur.id === e.id && cur.scene ? (cur.scene.userData.h0 || 1.75) * ((cur.scene.userData.s0 && cur.scene.userData.s0.y) || 1) : 1.75;
    let html = '<div class="sec"><h2>' + esc(nameOf(e)) + '</h2><p class="lead">' + ROLE_LABEL[role] + ' · ' + esc(bodyLabel(body.id)) + (base ? ' · one of the game’s own' : ' · yours') + (hidden ? ' · hidden' : '') + '</p></div>'
      + '<div class="sec"><h3>NAME &amp; ROLE</h3><div class="field"><label>Name</label><input type="text" id="c-name" maxlength="40" value="' + esc(e.name || '') + '" placeholder="' + esc(nameOf(e)) + '"></div>'
      + '<div class="row"><label>Role</label><select class="grow" id="c-role">' + Object.entries(ROLE_LABEL).map(([k, v]) => '<option value="' + k + '"' + (k === role ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>'
      + '<div class="row"><label>Body</label><select class="grow" id="c-body">' + BASE.map((b) => '<option value="' + b.id + '"' + (b.id === body.id ? ' selected' : '') + '>' + esc(bodyLabel(b.id)) + '</option>').join('') + '</select></div>'
      + '<div class="row"><label>Seated as</label><select class="grow" id="c-gender"><option value="male"' + (e.gender !== 'female' ? ' selected' : '') + '>Man</option><option value="female"' + (e.gender === 'female' ? ' selected' : '') + '>Woman</option></select></div></div>'
      + '<div class="sec"><h3>SHAPE</h3>'
      + slider('c-height', 'Height', 150, 212, 1, Math.round((e.height || h0) * 100), (v) => v + ' cm')
      + slider('c-head', 'Head size', 0.6, 2, 0.01, e.headScale || 1, pct)
      + slider('c-belly', 'Belly', 0, 1, 0.01, e.belly || 0, pct)
      + '<div class="btns"><button id="c-shape-reset" class="ghost">AS MODELLED</button></div></div>';
    if (role === 'player') {
      const isYou = D.you.character === e.id, isTwo = D.two.character === e.id;
      html += '<div class="sec"><h3>WHO PLAYS WITH THIS BODY</h3><label class="check"><input type="checkbox" id="c-you"' + (isYou ? ' checked' : '') + '> You (player one)</label>'
        + '<label class="check"><input type="checkbox" id="c-two"' + (isTwo ? ' checked' : '') + '> Player two (2-player games)</label>'
        + '<div class="row"><label>Opponent</label><select class="grow" id="c-opp"><option value="">— none —</option>' + allOpps().map((o) => '<option value="' + esc(o.id) + '"' + (opp && opp.id === o.id ? ' selected' : '') + '>' + esc(o.name) + (o.character && o.character !== e.id ? ' (has a body)' : '') + '</option>').join('') + '<option value="__new">+ New opponent…</option></select></div>'
        + (opp ? '<div class="btns"><button id="c-goto-opp" class="ghost">EDIT ' + esc(opp.name.toUpperCase()) + '’S PROFILE</button></div>' : '') + '</div>';
    } else if (role === 'referee') {
      const match = (D.referee || (visiblePeople().find((x) => x.role === 'referee') || {}).id) === e.id;
      html += '<div class="sec"><h3>REFEREE</h3><label class="check"><input type="checkbox" id="c-ref"' + (match ? ' checked' : '') + '> Referees the matches</label></div>';
    } else {
      html += '<div class="sec"><h3>CROWD</h3>' + slider('c-weight', 'How often', 0, 5, 0.5, e.weight == null ? 1 : e.weight, (v) => '×' + v) + '<p class="note">How often this person is picked for a seat (×0 = never).</p></div>';
    }
    html += '<div class="sec"><div class="btns"><button id="c-test">▶ TEST IN GAME</button>' + (base && custom(e.id) ? '<button id="c-restore" class="ghost">RESTORE ORIGINAL</button>' : '') + '</div></div>';
    return html;
  }
  // Look tab
  const PALETTE = ['#111111', '#f2f2ee', '#1d2f5e', '#7d1520', '#c62a2a', '#1f6f3f', '#4a2a73', '#c8a14a', '#8c8f94', '#d76fa0', '#2f7fd0', '#e08a2a'];
  // A body without separate texture images (made in Blender) is styled in Blender.
  const madeInBlender = (e) => { const b = bodyOf(e); return !!b && (b.source === 'blender' || !Object.keys(b.textures || {}).length); };
  const BLENDER_NOTE = '<div class="sec"><h3>MADE IN BLENDER</h3><p class="note">This character was made in Blender with the VELVET Character Maker add-on. Change his face, hair and clothes there and press “Export again”; here you can set his name, role, profile, shape and cue.</p></div>';
  function panelLook() {
    const e = entryOf(sel.id); if (!e) return '';
    if (madeInBlender(e)) return BLENDER_NOTE + cueSection(e);
    const c = e.cue || {}, parts = cur.parts || {}, ready = cur.id === e.id;
    const regions = [];
    for (const [k, Pt] of Object.entries(parts)) Pt.regions.forEach((r, i) => regions.push({ k, i, r }));
    const a = cur.activeRegion, skin = parts.head || parts.body, skinCol = X.rgbHex(cur.skinRef.map((v, k) => v * ((skin && skin.gain[k]) || 1)));
    const hairCol = (parts.opacity || parts.head || {}).hairColor || X.rgbHex(cur.hairRef);
    let html = '<div class="sec"><h3>OUTFIT COLOURS</h3><p class="note">Pick a part, then click the clothes on the model. Shift+click adds more of the same.</p>'
      + '<div class="btns"><button data-tool="pick" class="' + (tool === 'pick' ? 'on' : '') + '"' + (ready ? '' : ' disabled') + '>✚ PICK A PART</button></div>'
      + '<div class="row"><label>Picks</label><select class="grow" id="l-every"><option value="0"' + (toolOpt.everywhere ? '' : ' selected') + '>The clicked garment</option><option value="1"' + (toolOpt.everywhere ? ' selected' : '') + '>That colour everywhere</option></select></div>'
      + slider('l-tol', 'Tolerance', 4, 40, 1, toolOpt.tol, (v) => v);
    html += regions.length ? regions.map(({ k, i, r }) => {
      const act = a && a.part === k && a.i === i;
      return '<div class="region' + (act ? ' active' : '') + '" data-part="' + k + '" data-i="' + i + '"><input type="color" class="r-col" value="' + (r.color || r.seed || '#888888') + '"><span class="grow">' + (k === 'head' ? 'Head' : k === 'opacity' ? 'Hair' : 'Clothes') + ' ' + (i + 1) + (r.color ? '' : ' · <b style="color:var(--gold-strong)">pick a colour</b>') + '</span>'
        + '<button class="r-add" title="Brush: add to this part">＋</button><button class="r-rem" title="Brush: take away">−</button><button class="r-del" title="Remove">✕</button></div>'
        + (act ? '<div class="chips" style="margin:4px 0 10px">' + PALETTE.map((p) => '<button class="chip" data-chip="' + p + '" style="background:' + p + '" title="' + p + '"></button>').join('') + '</div>' : '');
    }).join('') : '<p class="note">No colour changes yet.</p>';
    if (tool === 'add' || tool === 'remove') html += slider('l-rsize', 'Brush size', 1, 15, 0.5, toolOpt.regionSize, (v) => v + ' cm');
    html += '</div>'
      + '<div class="sec"><h3>SKIN</h3><div class="row"><label>Skin colour</label><input type="color" id="l-skin" value="' + skinCol + '"' + (ready ? '' : ' disabled') + '><button id="l-skin-reset" class="ghost">RESET</button></div><p class="note">Face, ears, neck and hands.</p></div>'
      + '<div class="sec"><h3>HAIR</h3><div class="row"><label>Hair colour</label><input type="color" id="l-hair" value="' + hairCol + '"' + (ready ? '' : ' disabled') + '><button id="l-hair-reset" class="ghost">RESET</button></div></div>';
    html += cueSection(e);
    return html;
  }
  function cueSection(e) {
    const c = e.cue || {};
    if ((e.role || 'audience') !== 'player') return '';
    return '<div class="sec"><h3>CUE</h3><div class="row"><label>Shaft</label><select class="grow" id="l-shaft">' + Object.entries(WOODS).map(([v, n]) => '<option value="' + v + '"' + ((c.shaft || '#e2c59a') === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>'
      + '<div class="row"><label>Butt</label><input type="color" id="l-butt" value="' + (c.butt || '#1a100b') + '"><div class="chips">' + ['#1a100b', '#5b1d14', '#7a4a26', '#0d2a52', '#7d1520', '#1f4f2f', '#d9d4c8', '#b08a3a'].map((p) => '<button class="chip" data-butt="' + p + '" style="background:' + p + '"></button>').join('') + '</div></div>'
      + '<div class="row"><label>Fittings</label><select class="grow" id="l-metal">' + Object.keys(CUE_METAL).map((m) => '<option value="' + m + '"' + ((c.metal || 'brass') === m ? ' selected' : '') + '>' + m[0].toUpperCase() + m.slice(1) + '</option>').join('') + '</select></div>'
      + '<div class="row"><label>Tip</label><input type="color" id="l-tip" value="' + (c.tip || '#3a6f8a') + '"></div></div>';
  }
  // Face tab
  function panelFace() {
    const e = entryOf(sel.id); if (!e) return '';
    if (madeInBlender(e)) return BLENDER_NOTE;
    const f = (e.studio && e.studio.face) || null, ready = cur.id === e.id && cur.parts && cur.parts.head, hasFace = !!(ready && cur.lm);
    let html = '<div class="sec"><h3>FACE FROM A PHOTO</h3>'
      + (hasFace ? '<p class="note">A straight-on photo with even light, a neutral face and no glasses works best.</p>' : '<p class="note warn">This model has no face to place a photo on.</p>')
      + '<div class="btns"><button id="f-load"' + (hasFace ? '' : ' disabled') + '>LOAD PHOTO…</button>' + (f ? '<button id="f-remove" class="ghost">REMOVE PHOTO</button>' : '') + '</div><input type="file" id="f-input" accept="image/*" hidden>'
      + '<div id="photo-wrap">' + (cur.photo && f ? '<canvas id="photo-cv"></canvas><canvas id="loupe" width="96" height="96" hidden></canvas>' : '<div class="empty">Drop a photo here<br>or press “Load photo”</div>') + '</div>';
    if (f && cur.photo) {
      html += '<div class="legend"><span><i style="background:#f0d7a1"></i>Eyes</span><span><i style="background:#e0655a"></i>Mouth</span><span>Drag the dots onto the eyes and mouth</span></div>'
        + slider('f-width', 'Face width', 0.7, 1.45, 0.01, f.width, pct) + slider('f-height', 'Face height', 0.7, 1.45, 0.01, f.height, pct)
        + slider('f-soft', 'Soft edge', 0.05, 0.6, 0.01, f.soft, pct) + slider('f-even', 'Even out light', 0, 1, 0.05, f.even, pct) + slider('f-bright', 'Photo brightness', 0.5, 1.6, 0.02, f.bright || 1, pct)
        + '<label class="check"><input type="checkbox" id="f-match"' + (f.match ? ' checked' : '') + '> Match ears, neck and hands to the photo’s skin</label>';
    }
    html += '</div><div class="sec"><h3>TOUCH-UP</h3><div class="tools"><button data-tool="paint">PAINT</button><button data-tool="restore">RESTORE</button><button data-tool="blur">BLUR</button></div>'
      + slider('t-size', 'Brush size', 0.4, 12, 0.1, toolOpt.size, (v) => v.toFixed(1) + ' cm') + slider('t-str', 'Strength', 0.05, 1, 0.05, toolOpt.strength, pct)
      + '<div class="row"><label>Paint colour</label><input type="color" id="t-col" value="' + toolOpt.color + '"><div class="chips">' + ['#2a1d16', '#f2d0b4', '#c2453c', '#ffffff', '#111111', '#2f7fd0'].map((p) => '<button class="chip" data-paint="' + p + '" style="background:' + p + '"></button>').join('') + '</div></div>'
      + '<p class="note">Restore brings back the original under the brush (photo, paint and outfit colours).</p><div class="btns"><button id="t-clear" class="ghost">CLEAR ALL TOUCH-UPS</button></div></div>';
    html += '<div class="sec"><h3>STICKERS</h3>';
    if (sticker) {
      const S = STICKERS[sticker.kind];
      html += '<p class="note">' + (sticker.at ? 'Drag on the model to move it.' : 'Click on the model where it goes.') + '</p>'
        + '<div class="row"><label>' + S.label.charAt(0) + S.label.slice(1).toLowerCase() + '</label><input type="color" id="s-col" value="' + sticker.color + '"></div>'
        + (S.text != null ? '<div class="field"><label>Text</label><input type="text" id="s-text" maxlength="16" value="' + esc(sticker.text) + '"></div>' : '')
        + slider('s-size', 'Size', 0.015, 0.3, 0.005, sticker.size, (v) => (v * 100).toFixed(1) + ' cm') + slider('s-turn', 'Turn', -180, 180, 1, Math.round(sticker.angle * 180 / Math.PI), (v) => v + '°')
        + '<div class="btns"><button id="sticker-done" class="primary"' + (sticker.at ? '' : ' disabled') + '>DONE</button><button id="sticker-cancel" class="ghost">CANCEL</button></div>';
    } else html += '<div class="stickers">' + Object.entries(STICKERS).map(([k, S]) => '<button data-sticker="' + k + '"' + (ready ? '' : ' disabled') + '><canvas width="64" height="64" data-thumb="' + k + '"></canvas>' + S.label + '</button>').join('') + '</div>';
    return html + '</div>';
  }

  // ---- panel events
  function bindPanel() {
    document.querySelectorAll('#panel-body [data-tool]').forEach((b) => { b.classList.toggle('on', b.dataset.tool === tool); b.onclick = () => setTool(tool === b.dataset.tool ? null : b.dataset.tool); });
    if (sel.kind === 'you' || sel.kind === 'two') bindYou();
    else if (sel.kind === 'opp') bindOpp();
    else if (sel.kind === 'char') { if (tab === 'look') bindLook(); else if (tab === 'face') bindFace(); else bindChar(); }
  }
  function textField(id, fn) { on(id, 'input', (ev) => { edit(id); fn(ev.target.value); renderListSoon(); }); }
  let listTimer = 0; const renderListSoon = () => { clearTimeout(listTimer); listTimer = setTimeout(renderList, 150); };
  function bindYou() {
    const k = sel.kind, y = () => D[k];
    textField('y-name', (v) => { y().name = v.trim(); });
    textField('y-short', (v) => { y().short = v.trim().toUpperCase(); });
    textField('y-nick', (v) => { y().nick = v.trim(); });
    on('y-body', 'change', async (ev) => { edit(); y().character = ev.target.value || undefined; renderList(); await showSelection(); });
    on('y-edit', 'click', () => select('char', bodyForSelection()));
    on('y-new', 'click', () => newDialog('player', (id) => { D[k].character = id; }));
  }
  function bindOpp() {
    const id = sel.id, o = () => ensureOpp(id);
    const isBuiltIn = BASE_O.some((b) => b.id === id);
    const mut = (fn) => { if (isBuiltIn) ensureOpp(id); fn(isBuiltIn ? ensureOpp(id) : D.opponents.find((x) => x.id === id)); };
    textField('o-name', (v) => mut((x) => { x.name = v.trim() || x.name; }));
    textField('o-short', (v) => mut((x) => { x.short = v.trim().toUpperCase(); }));
    textField('o-nick', (v) => mut((x) => { x.nick = v.trim(); }));
    on('o-body', 'change', async (ev) => { edit(); mut((x) => { x.character = ev.target.value || undefined; }); renderList(); await showSelection(); });
    on('o-edit', 'click', () => select('char', bodyForSelection()));
    on('o-new', 'click', () => newDialog('player', (cid) => mut((x) => { x.character = cid; }), oppOf(id).name));
    for (const [k, , fwd] of STYLE) bindSlider('o-' + k, (v) => Math.round(v * 100), (v) => { edit('style-' + k); mut((x) => { x.style = Object.assign({}, x.style || {}); x.style[k] = +fwd(v).toFixed(3); }); });
    on('o-tour', 'change', (ev) => { edit(); mut((x) => { x.tour = ev.target.checked; }); renderList(); });
    bindSlider('o-rating', (v) => v, (v) => { edit('rating'); mut((x) => { x.rating = v; }); });
    on('o-test', 'click', testInGame);
    on('o-restore', 'click', () => { edit(); D.opponents = D.opponents.filter((x) => x.id !== id); renderList(); renderPanel(); showSelection(); });
    on('o-del', 'click', () => deleteSelected());
  }
  function bindChar() {
    const id = sel.id, E = () => { const e = ensureCustom(id); if (cur.id === id) cur.entry = e; return e; };
    textField('c-name', (v) => { E().name = v.trim() || undefined; });
    on('c-role', 'change', (ev) => {
      const r = ev.target.value, e = entryOf(id);
      if (!canLeaveRole(e, r)) { ev.target.value = e.role; return; }
      edit(); E().role = r; if (r === 'audience' && E().weight == null) E().weight = 1;
      if (r !== 'player') { for (const o of D.opponents) if (o.character === id) delete o.character; if (D.you.character === id) delete D.you.character; if (D.two.character === id) delete D.two.character; }
      if (r !== 'referee' && D.referee === id) D.referee = null;
      styleCue(); renderList(); renderPanel();
    });
    on('c-body', 'change', async (ev) => {
      const b = baseOf(ev.target.value); if (!b) return;
      const e = entryOf(id), had = e.studio && (e.studio.face || (e.studio.regions || []).length || Object.keys(e.studio.paint || {}).length || e.studio.skin || e.studio.hair);
      if (had && !confirm('A new body starts with a clean look: outfit colours, face photo and touch-ups are cleared. Change the body?')) { ev.target.value = bodyOf(e).id; return; }
      edit(); const x = E(); x.base = b.id; x.model = b.model; x.textures = clone(b.textures || {}); x.normals = clone(b.normals || {}); x.shine = clone(b.shine || {}); x.gender = b.gender; x.studio = {};
      cur.id = null; renderList(); await openChar(id); renderPanel();
    });
    on('c-gender', 'change', (ev) => { edit(); E().gender = ev.target.value; renderList(); });
    bindSlider('c-height', (v) => v + ' cm', (v) => { edit('height'); E().height = v / 100; applyShape(); });
    bindSlider('c-head', pct, (v) => { edit('head'); E().headScale = v; applyShape(); });
    bindSlider('c-belly', pct, (v) => { edit('belly'); E().belly = v; applyShape(); });
    on('c-shape-reset', 'click', () => { edit(); const x = E(); delete x.height; delete x.headScale; delete x.belly; applyShape(); renderPanel(); });
    on('c-you', 'change', (ev) => { edit(); if (ev.target.checked) D.you.character = id; else if (D.you.character === id) delete D.you.character; renderList(); });
    on('c-two', 'change', (ev) => { edit(); if (ev.target.checked) D.two.character = id; else if (D.two.character === id) delete D.two.character; renderList(); });
    on('c-opp', 'change', (ev) => {
      const v = ev.target.value;
      if (v === '__new') { edit(); const name = nameOf(entryOf(id)), oid = uniqueId(name, takenOpp); D.opponents.push({ id: oid, name, short: String(name).toUpperCase().slice(0, 14), nick: '', style: {}, character: id, tour: true, rating: 84 }); renderList(); renderPanel(); toast('New opponent “' + name + '” uses this body'); return; }
      edit();
      for (const o of allOpps()) if (o.character === id && o.id !== v) delete ensureOpp(o.id).character;
      if (v) ensureOpp(v).character = id;
      renderList(); renderPanel();
    });
    on('c-goto-opp', 'click', () => { const o = allOpps().find((x) => x.character === id); if (o) select('opp', o.id); });
    on('c-ref', 'change', (ev) => { edit(); D.referee = ev.target.checked ? id : null; renderList(); });
    bindSlider('c-weight', (v) => '×' + v, (v) => { edit('weight'); E().weight = v; renderListSoon(); });
    on('c-test', 'click', testInGame);
    on('c-restore', 'click', async () => { if (!confirm('Go back to the original ' + bodyLabel(id) + '? Your changes to this character are removed.')) return; edit(); D.people = D.people.filter((x) => x.id !== id); cur.id = null; renderList(); await openChar(id); renderPanel(); });
  }
  function canLeaveRole(e, r) {
    if (e.role === r) return true;
    const left = visiblePeople().filter((x) => x.role === e.role && x.id !== e.id).length;
    if ((e.role === 'player' || e.role === 'referee') && !left) { toast('The game needs at least one ' + (e.role === 'player' ? 'player body' : 'referee') + '. Add another first.', true); return false; }
    return true;
  }
  function bindLook() {
    const id = sel.id, E = () => { const e = ensureCustom(id); if (cur.id === id) cur.entry = e; return e; };
    on('l-every', 'change', (ev) => { toolOpt.everywhere = ev.target.value === '1'; });
    bindSlider('l-tol', (v) => v, (v) => { toolOpt.tol = v; });
    bindSlider('l-rsize', (v) => v + ' cm', (v) => { toolOpt.regionSize = v; });
    document.querySelectorAll('#panel-body .region').forEach((row) => {
      const k = row.dataset.part, i = +row.dataset.i, Pt = cur.parts && cur.parts[k]; if (!Pt) return;
      const activate = () => { cur.activeRegion = { part: k, i }; highlightActive(); };
      row.querySelector('.r-col').addEventListener('input', (ev) => { edit('rcol' + k + i); Pt.regions[i].color = ev.target.value; activate(); Pt.highlight = null; X.composite(Pt); texChanged(); });
      row.querySelector('.r-col').addEventListener('change', () => renderPanel());
      row.querySelector('.r-add').onclick = () => { activate(); setTool('add'); renderPanel(); };
      row.querySelector('.r-rem').onclick = () => { activate(); setTool('remove'); renderPanel(); };
      row.querySelector('.r-del').onclick = () => { edit(); Pt.regions.splice(i, 1); cur.activeRegion = null; if (tool === 'add' || tool === 'remove') setTool(null); highlightActive(); X.composite(Pt); texChanged(); renderPanel(); };
      row.addEventListener('click', (ev) => { if (ev.target === row || ev.target.classList.contains('grow')) { activate(); renderPanel(); } });
    });
    document.querySelectorAll('#panel-body [data-chip]').forEach((b) => b.onclick = () => {
      const a = activeRegion(); if (!a) return; edit(); a.region.color = b.dataset.chip; a.part.highlight = null; X.composite(a.part); texChanged(); renderPanel();
    });
    on('l-skin', 'input', (ev) => { edit('skin'); const c = X.hexRGB(ev.target.value), g = c.map((v, k) => clamp(v / Math.max(8, cur.skinRef[k]), 0.25, 3)); for (const k of ['head', 'body']) if (cur.parts[k]) { cur.parts[k].gain = g.slice(); X.composite(cur.parts[k]); } texChanged(); });
    on('l-skin-reset', 'click', () => { edit(); for (const k of ['head', 'body']) if (cur.parts && cur.parts[k]) { cur.parts[k].gain = [1, 1, 1]; X.composite(cur.parts[k]); } texChanged(); renderPanel(); });
    on('l-hair', 'input', (ev) => { edit('hair'); for (const k of ['head', 'opacity']) if (cur.parts[k]) { cur.parts[k].hairColor = ev.target.value; X.composite(cur.parts[k]); } texChanged(); });
    on('l-hair-reset', 'click', () => { edit(); for (const k of ['head', 'opacity']) if (cur.parts && cur.parts[k]) { cur.parts[k].hairColor = null; X.composite(cur.parts[k]); } texChanged(); renderPanel(); });
    const cueSet = (k, v) => { edit('cue-' + k); const x = E(); x.cue = Object.assign({}, x.cue || {}); x.cue[k] = v; styleCue(); };
    on('l-shaft', 'change', (ev) => cueSet('shaft', ev.target.value));
    on('l-butt', 'input', (ev) => cueSet('butt', ev.target.value));
    document.querySelectorAll('#panel-body [data-butt]').forEach((b) => b.onclick = () => { cueSet('butt', b.dataset.butt); $('l-butt').value = b.dataset.butt; });
    on('l-metal', 'change', (ev) => cueSet('metal', ev.target.value));
    on('l-tip', 'input', (ev) => cueSet('tip', ev.target.value));
  }
  function bindFace() {
    on('f-load', 'click', () => $('f-input').click());
    on('f-input', 'change', async (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) await loadPhotoFile(f); });
    const wrap = $('photo-wrap');
    if (wrap) {
      wrap.addEventListener('dragover', (ev) => { ev.preventDefault(); wrap.classList.add('drag'); });
      wrap.addEventListener('dragleave', () => wrap.classList.remove('drag'));
      wrap.addEventListener('drop', async (ev) => { ev.preventDefault(); wrap.classList.remove('drag'); const f = [...ev.dataTransfer.files].find((x) => /^image\//.test(x.type)); if (f) await loadPhotoFile(f); });
    }
    on('f-remove', 'click', () => { edit(); const e = ensureCustom(sel.id); if (e.studio) delete e.studio.face; cur.photo = null; if (cur.parts.head) { cur.parts.head.face = null; cur.parts.head.keep = null; } compositeAll(); texChanged(); renderPanel(); });
    const F = () => faceSet();
    let bakeTimer = 0; const bakeSoon = (final) => { clearTimeout(bakeTimer); bakeTimer = setTimeout(() => { bakeFace(true); texChanged(); }, final ? 0 : 160); };
    bindSlider('f-width', pct, (v, fin) => { edit('fw'); F().width = v; bakeSoon(fin); });
    bindSlider('f-height', pct, (v, fin) => { edit('fh'); F().height = v; bakeSoon(fin); });
    bindSlider('f-soft', pct, (v, fin) => { edit('fs'); F().soft = v; bakeSoon(fin); });
    bindSlider('f-even', pct, (v, fin) => { edit('fe'); F().even = v; bakeSoon(fin); });
    bindSlider('f-bright', pct, (v, fin) => { edit('fb'); F().bright = v; bakeSoon(fin); });
    on('f-match', 'change', (ev) => { edit(); F().match = ev.target.checked; if (!ev.target.checked) for (const k of ['head', 'body']) if (cur.parts[k]) cur.parts[k].gain = [1, 1, 1]; bakeFace(true); texChanged(); });
    if ($('photo-cv')) photoCanvas();
    bindSlider('t-size', (v) => v.toFixed(1) + ' cm', (v) => { toolOpt.size = v; });
    bindSlider('t-str', pct, (v) => { toolOpt.strength = v; });
    on('t-col', 'input', (ev) => { toolOpt.color = ev.target.value; });
    document.querySelectorAll('#panel-body [data-paint]').forEach((b) => b.onclick = () => { toolOpt.color = b.dataset.paint; $('t-col').value = b.dataset.paint; if (tool !== 'paint') setTool('paint'); });
    on('t-clear', 'click', () => { if (!cur.parts) return; edit(); for (const Pt of Object.values(cur.parts)) { Pt.paint = null; Pt.keep = null; } compositeAll(); texChanged(); });
    document.querySelectorAll('#panel-body [data-sticker]').forEach((b) => b.onclick = () => startSticker(b.dataset.sticker));
    document.querySelectorAll('#panel-body [data-thumb]').forEach((cv) => { const S = STICKERS[cv.dataset.thumb], c = cv.getContext('2d'); c.scale(0.25, 0.25); S.draw(c, S.color, S.text); });
    if (sticker) {
      on('s-col', 'input', (ev) => { sticker.color = ev.target.value; updateSticker(); });
      on('s-text', 'input', (ev) => { sticker.text = ev.target.value; updateSticker(); });
      bindSlider('s-size', (v) => (v * 100).toFixed(1) + ' cm', (v) => { sticker.size = v; updateSticker(); });
      bindSlider('s-turn', (v) => v + '°', (v) => { sticker.angle = v * Math.PI / 180; updateSticker(); });
      on('sticker-done', 'click', () => { stopSticker(false); renderPanel(); });
      on('sticker-cancel', 'click', () => { stopSticker(true); renderPanel(); });
    }
  }
  async function loadPhotoFile(file) {
    if (!cur.parts || !cur.parts.head || !cur.lm) { toast('Open a character with a face first', true); return; }
    busy(true, 'READING THE PHOTO…');
    try {
      const url = URL.createObjectURL(file), img = await X.loadImage(url); URL.revokeObjectURL(url);
      edit(); await setPhoto(img, false); bakeFace(true); texChanged(); renderPanel(); camPreset('face');
    } catch (err) { toast('That file could not be read as a photo', true); }
    finally { busy(false); }
  }
  // the photo with the three dots (eyes, mouth)
  function photoCanvas() {
    const cv = $('photo-cv'), ph = cur.photo, f = faceSet(); if (!cv || !ph || !f) return;
    const maxW = Math.max(200, $('photo-wrap').clientWidth - 2), s = Math.min(maxW / ph.w, 420 / ph.h);
    cv.width = Math.round(ph.w * s); cv.height = Math.round(ph.h * s);
    const c = cv.getContext('2d');
    const draw = () => {
      c.drawImage(ph.canvas, 0, 0, cv.width, cv.height);
      const p = f.pts.map(([x, y]) => [x * s, y * s]);
      c.strokeStyle = 'rgba(240,215,161,.65)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p[0][0], p[0][1]); c.lineTo(p[1][0], p[1][1]); c.moveTo((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2); c.lineTo(p[2][0], p[2][1]); c.stroke();
      p.forEach(([x, y], k) => { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fillStyle = k === 2 ? 'rgba(224,101,90,.35)' : 'rgba(240,215,161,.3)'; c.fill(); c.lineWidth = 2; c.strokeStyle = k === 2 ? '#e0655a' : '#f0d7a1'; c.stroke();
        c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x, y - 3); c.lineTo(x, y + 3); c.stroke(); });
    };
    draw();
    const loupe = $('loupe'), lc = loupe.getContext('2d');
    const pos = (ev) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * cv.width / r.width / s, (ev.clientY - r.top) * cv.height / r.height / s]; };
    let k = -1, timer = 0;
    cv.onpointerdown = (ev) => {
      const [x, y] = pos(ev); let best = 1e9;
      f.pts.forEach((p, i) => { const d = Math.hypot((p[0] - x) * s, (p[1] - y) * s); if (d < best) { best = d; k = i; } });
      if (best > 22) { k = -1; return; }
      cv.setPointerCapture(ev.pointerId); edit('dots');
    };
    cv.onpointermove = (ev) => {
      if (k < 0) return;
      const [x, y] = pos(ev); f.pts[k] = [clamp(x, 0, ph.w - 1), clamp(y, 0, ph.h - 1)]; draw();
      loupe.hidden = false; lc.imageSmoothingEnabled = false; const z = 4, half = 48 / z;
      lc.drawImage(ph.canvas, f.pts[k][0] - half, f.pts[k][1] - half, half * 2, half * 2, 0, 0, 96, 96);
      lc.strokeStyle = k === 2 ? '#e0655a' : '#f0d7a1'; lc.beginPath(); lc.moveTo(40, 48); lc.lineTo(56, 48); lc.moveTo(48, 40); lc.lineTo(48, 56); lc.stroke();
      clearTimeout(timer); timer = setTimeout(() => { bakeFace(true); texChanged(); }, 220);
    };
    cv.onpointerup = () => { if (k >= 0) { clearTimeout(timer); bakeFace(true); texChanged(); } k = -1; loupe.hidden = true; };
  }

  // ===========================================================================
  // NEW / COPY / DELETE
  function modal(html, bind) { $('modal-card').innerHTML = html; $('modal').hidden = false; bind && bind(); }
  function closeModal() { $('modal').hidden = true; $('modal-card').innerHTML = ''; }
  $('modal').addEventListener('pointerdown', (ev) => { if (ev.target === $('modal')) closeModal(); });
  function newDialog(kind, after, name) {
    const kinds = [['opponent', 'Opponent', 'Someone to play against: a body and a player profile.'], ['player', 'Player body', 'For you, player two, or to give an opponent later.'], ['referee', 'Referee', 'Can referee your matches.'], ['audience', 'Audience member', 'Sits in the stands.']];
    const pick = kind || 'opponent';
    modal('<h2>New character</h2><p>Every character starts from one of the game’s bodies; you can then change the look, the shape and the face.</p>'
      + '<div class="radio-list">' + kinds.map(([k, t, d]) => '<label class="radio-card"><input type="radio" name="nk" value="' + k + '"' + (k === pick ? ' checked' : '') + '><span><b>' + t + '</b><small>' + d + '</small></span></label>').join('') + '</div>'
      + '<div class="field"><label>Name</label><input type="text" id="n-name" maxlength="40" value="' + esc(name || '') + '" placeholder="e.g. Sam Lee"></div>'
      + '<div class="field"><label>Start from body</label><div class="bodies">' + BASE.map((b, i) => '<label><input type="radio" name="nb" value="' + b.id + '"' + ((pick === 'referee' ? b.id === 'referee' : pick === 'audience' ? i === 3 : b.id === 'player_01') ? ' checked' : '') + '>' + esc(bodyLabel(b.id)) + '</label>').join('') + '</div></div>'
      + '<div class="btns"><button id="n-cancel" class="ghost">CANCEL</button><button id="n-ok" class="primary">CREATE</button></div>', () => {
      $('n-name').focus();
      $('n-cancel').onclick = closeModal;
      $('n-ok').onclick = async () => {
        const k = document.querySelector('input[name=nk]:checked').value, bid = document.querySelector('input[name=nb]:checked').value, b = baseOf(bid);
        const nm = $('n-name').value.trim() || (k === 'opponent' ? 'New opponent' : bodyLabel(bid));
        edit();
        const id = uniqueId(nm, takenPerson), role = k === 'opponent' ? 'player' : k;
        D.people.push({ id, name: nm, role, gender: b.gender || 'male', base: b.id, model: b.model, textures: clone(b.textures || {}), normals: clone(b.normals || {}), shine: clone(b.shine || {}), weight: role === 'audience' ? 1 : undefined, studio: {} });
        if (k === 'opponent') { const oid = uniqueId(nm, takenOpp); D.opponents.push({ id: oid, name: nm, short: nm.split(' ').pop().toUpperCase().slice(0, 14), nick: '', style: {}, character: id, tour: true, rating: 84 }); }
        if (after) after(id);
        closeModal(); tab = 'character'; await select('char', id);
        toast(k === 'opponent' ? nm + ' is ready: try the Face tab to add a photo' : nm + ' created');
      };
    });
  }
  async function copySelected() {
    if (sel.kind === 'opp') {
      const o = oppOf(sel.id); if (!o) return; edit();
      const c = clone(o); c.id = uniqueId(o.name + ' copy', takenOpp); c.name = o.name + ' (copy)'; D.opponents.push(c); await select('opp', c.id); return;
    }
    if (sel.kind !== 'char') return;
    commitCur();
    const e = entryOf(sel.id); edit();
    const c = clone(e), nm = nameOf(e) + ' (copy)', id = uniqueId(nm, takenPerson), from = 'characters/studio/' + e.id + '/', to = 'characters/studio/' + id + '/';
    c.id = id; c.name = nm; c.base = bodyOf(e).id;
    const re = (s) => (typeof s === 'string' && s.startsWith(from) ? to + s.slice(from.length) : s);
    c.textures = Object.fromEntries(Object.entries(c.textures || {}).map(([k, v]) => [k, re(v)]));
    const st = c.studio || {};
    if (st.paint) st.paint = Object.fromEntries(Object.entries(st.paint).map(([k, v]) => [k, re(v)]));
    if (st.keep) st.keep = Object.fromEntries(Object.entries(st.keep).map(([k, v]) => [k, re(v)]));
    (st.regions || []).forEach((r) => { r.mask = re(r.mask); });
    if (st.face && st.face.photo) st.face.photo = re(st.face.photo);
    for (const k of Object.keys(FILES)) if (k.startsWith(from)) FILES[re(k)] = FILES[k];
    D.people.push(c); await select('char', id);
  }
  async function deleteSelected() {
    if (sel.kind === 'opp') {
      const o = oppOf(sel.id); if (!o || BASE_O.some((b) => b.id === o.id)) return;
      if (!confirm('Delete the opponent “' + o.name + '”? His body stays in the list.')) return;
      edit(); D.opponents = D.opponents.filter((x) => x.id !== o.id); await select('you', null); return;
    }
    if (sel.kind !== 'char') return;
    const e = entryOf(sel.id), id = e.id;
    if (baseOf(id)) {
      if (isHidden(id)) { edit(); D.hidden = D.hidden.filter((x) => x !== id); renderList(); renderPanel(); return; }
      if (!canLeaveRole(e, '__none')) return;
      edit(); D.hidden.push(id); if (D.referee === id) D.referee = null;
      for (const o of D.opponents) if (o.character === id) delete o.character;
      if (D.you.character === id) delete D.you.character; if (D.two.character === id) delete D.two.character;
      renderList(); renderPanel(); toast(nameOf(e) + ' is hidden from the game (press UNHIDE to bring him back)'); return;
    }
    if (!canLeaveRole(e, '__none')) return;
    if (!confirm('Delete “' + nameOf(e) + '” and his face, look and photos?')) return;
    edit();
    D.people = D.people.filter((x) => x.id !== id);
    for (const o of D.opponents) if (o.character === id) delete o.character;
    if (D.you.character === id) delete D.you.character; if (D.two.character === id) delete D.two.character; if (D.referee === id) D.referee = null;
    if (cur.id === id) { cur.texDirty = false; closeChar(); }
    await select('you', null);
  }
  $('new-btn').onclick = () => newDialog();
  $('copy-btn').onclick = copySelected;
  $('del-btn').onclick = deleteSelected;

  // ===========================================================================
  // SAVE / EXPORT / IMPORT / TEST
  function referencedFiles() {
    const refs = new Set(), out = {};
    for (const e of D.people) {
      for (const p of Object.values(e.textures || {})) refs.add(p);
      const st = e.studio || {};
      for (const p of [...Object.values(st.paint || {}), ...Object.values(st.keep || {}), ...(st.regions || []).map((r) => r.mask), st.face && st.face.photo]) if (p) refs.add(p);
    }
    for (const p of refs) if (FILES[p]) out[p] = FILES[p];
    return out;
  }
  function cleanData() {
    const d = clone(D);
    d.people = d.people.filter((e) => e && e.id && e.model);
    for (const e of d.people) { for (const k of Object.keys(e)) if (e[k] === undefined || e[k] === null) delete e[k]; }
    d.savedAt = new Date().toISOString();
    return d;
  }
  function studioText() {
    commitCur();
    const files = referencedFiles(), data = cleanData(), n = data.people.length, o = data.opponents.length;
    let t = '/* VELVET Studio - your characters (' + n + ' character' + (n === 1 ? '' : 's') + ', ' + o + ' opponent profile' + (o === 1 ? '' : 's') + ').\n'
      + '   Written by "VELVET Studio.html" on ' + new Date().toLocaleString() + '. Delete this file (or press "Reset all"\n'
      + '   in the studio) to go back to the original characters. */\n';
    const keys = Object.keys(files);
    if (keys.length) t += 'window.VELVET_FILES=Object.assign(window.VELVET_FILES||{},{\n' + keys.map((k) => JSON.stringify(k) + ':"' + files[k] + '"').join(',\n') + '});\n';
    return t + 'window.VELVET_STUDIO=' + JSON.stringify(data, null, 1) + ';\n';
  }
  // folder handle kept between visits (Chrome / Edge)
  const idb = (mode, fn) => new Promise((res, rej) => { const r = indexedDB.open('velvet-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onerror = () => rej(r.error); r.onsuccess = () => { const tx = r.result.transaction('kv', mode), q = fn(tx.objectStore('kv')); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }; });
  let dirHandle = null;
  async function gameFolder(pick) {
    if (!window.showDirectoryPicker) return null;
    if (!pick) {
      if (!dirHandle) dirHandle = await idb('readonly', (s) => s.get('dir')).catch(() => null);
      if (dirHandle) {
        let perm = await dirHandle.queryPermission({ mode: 'readwrite' }).catch(() => 'denied');
        if (perm !== 'granted') perm = await dirHandle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
        if (perm === 'granted') return dirHandle;
      }
    }
    const d = await window.showDirectoryPicker({ id: 'velvet-game', mode: 'readwrite' });
    if (!(await charsDir(d))) throw new Error('That is not the game folder. Choose the folder with index.html and the characters folder in it.');
    dirHandle = d; idb('readwrite', (s) => s.put(d, 'dir')).catch(() => {});
    return d;
  }
  async function charsDir(d) {
    try { const c = await d.getDirectoryHandle('characters'); await c.getFileHandle('characters.js'); return c; } catch (e) { /* maybe the characters folder itself */ }
    try { await d.getFileHandle('characters.js'); return d; } catch (e) { return null; }
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function saved(where) { dirty = false; setStatus('Saved ' + where + ' · ' + new Date().toLocaleTimeString()); }
  async function save(how) {
    let text;
    try { busy(true, 'SAVING…'); text = studioText(); } catch (err) { busy(false); toast('Could not prepare the file: ' + err.message, true); return; }
    try {
      if (how !== 'download' && window.showDirectoryPicker) {
        const d = await gameFolder(how === 'folder'); const c = await charsDir(d);
        const fh = await c.getFileHandle('studio.js', { create: true }), w = await fh.createWritable(); await w.write(text); await w.close();
        saved('to characters/studio.js'); toast('Saved. Reload the game to see your characters.');
        return;
      }
      download('studio.js', text, 'text/javascript'); saved('as a download');
      modal('<h2>One more step</h2><p>Your browser saved <b>studio.js</b> to your downloads. Move it into the game’s <b>characters</b> folder (replace the old one), then reload the game.</p><p class="note">In Chrome or Edge the studio can save straight into the game folder.</p><div class="btns"><button class="primary" id="m-ok">GOT IT</button></div>', () => { $('m-ok').onclick = closeModal; });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      toast((err && err.message) || String(err), true);
    } finally { busy(false); }
  }
  $('save-btn').onclick = () => save();
  $('save-more').onclick = (ev) => { ev.stopPropagation(); $('save-menu').hidden = !$('save-menu').hidden; };
  document.addEventListener('click', () => { $('save-menu').hidden = true; });
  $('save-menu').addEventListener('click', async (ev) => {
    const a = ev.target.closest('button'); if (!a) return; $('save-menu').hidden = true;
    if (a.dataset.act === 'folder') save('folder');
    else if (a.dataset.act === 'download') save('download');
    else if (a.dataset.act === 'reset') {
      if (!confirm('Remove all your characters, faces, opponents and names? (Nothing changes in the game until you save.)')) return;
      edit(); D = emptyData(); cur.texDirty = false; cur.id = null; await select('you', null); toast('Everything is back to the original. Save to apply it to the game.');
    }
  });
  window.addEventListener('beforeunload', (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } });

  // Test in game: the game page opens with #studio-test and asks for the data.
  let pendingTest = null;
  function testTarget() {
    if (sel.kind === 'char') { const e = entryOf(sel.id); return e && { id: e.id, role: e.role || 'audience', name: nameOf(e) }; }
    if (sel.kind === 'opp') { const o = oppOf(sel.id); return o && { id: o.character || defaultOppBody(), role: 'player', opp: o.id, name: o.name }; }
    if (sel.kind === 'you') return { id: youBody(), role: 'player', asYou: true, name: D.you.name || 'You' };
    if (sel.kind === 'two') return { id: D.two.character || defaultOppBody(), role: 'player', name: D.two.name || 'Player two' };
    return null;
  }
  function testInGame() {
    const t = testTarget(); if (!t) { toast('Choose a character or a player first'); return; }
    commitCur();
    const payload = { type: 'velvet-studio-test', studio: cleanData(), files: referencedFiles(), test: t };
    const w = window.open('index.html#studio-test', 'velvet-studio-test');
    if (!w) { toast('The browser blocked the game window: allow pop-ups for this page and try again', true); return; }
    pendingTest = { w, payload };
    toast('Opening the game with ' + t.name + '…');
  }
  window.addEventListener('message', (ev) => {
    if (!ev.data || ev.data.type !== 'velvet-studio-ready' || !pendingTest) return;
    if (ev.source !== pendingTest.w) return;
    pendingTest.w.postMessage(pendingTest.payload, '*'); pendingTest = null;
  });
  $('test-btn').onclick = testInGame;

  // Export / import one character as a single file
  $('export-btn').onclick = () => {
    if (sel.kind !== 'char' && !bodyForSelection()) { toast('Choose a character first'); return; }
    commitCur();
    const id = sel.kind === 'char' ? sel.id : bodyForSelection(), e = entryOf(id); if (!e) return;
    const prefix = 'characters/studio/' + e.id + '/', files = {};
    for (const k of Object.keys(FILES)) if (k.startsWith(prefix)) files[k] = FILES[k];
    const prof = sel.kind === 'opp' ? oppOf(sel.id) : allOpps().find((o) => o.character === e.id);
    const out = { format: 'velvet-character', version: 1, exported: new Date().toISOString(), person: Object.assign(clone(e), { base: bodyOf(e).id }), profile: prof ? clone(prof) : null, files };
    download(slug(nameOf(e)) + '.velvetchar', JSON.stringify(out), 'application/json');
    toast('Exported ' + nameOf(e) + ': send the .velvetchar file to a friend, who can IMPORT it');
  };
  $('import-btn').onclick = () => $('import-input').click();
  $('import-input').onchange = async (ev) => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try { await importChar(JSON.parse(await f.text())); } catch (err) { toast('Could not import: ' + (err.message || err), true); }
  };
  async function importChar(j) {
    if (!j || j.format !== 'velvet-character' || !j.person) throw new Error('not a VELVET character file');
    const p = clone(j.person), b = baseOf(p.base) || baseOf(p.id);
    if (!b) throw new Error('it was made from a body this game does not have');
    commitCur(); edit();
    const oldId = p.id, id = uniqueId(p.name || bodyLabel(b.id), takenPerson), from = 'characters/studio/' + oldId + '/', to = 'characters/studio/' + id + '/';
    const re = (s) => (typeof s === 'string' && s.startsWith(from) ? to + s.slice(from.length) : s);
    Object.assign(p, { id, base: b.id, model: b.model, normals: clone(b.normals || {}), shine: clone(b.shine || {}), name: p.name || bodyLabel(b.id) });
    p.textures = Object.fromEntries(Object.entries(b.textures || {}).map(([k, v]) => [k, re((p.textures || {})[k]) && String(re(p.textures[k])).startsWith(to) ? re(p.textures[k]) : v]));
    const st = p.studio = p.studio || {};
    if (st.paint) st.paint = Object.fromEntries(Object.entries(st.paint).map(([k, v]) => [k, re(v)]));
    if (st.keep) st.keep = Object.fromEntries(Object.entries(st.keep).map(([k, v]) => [k, re(v)]));
    (st.regions || []).forEach((r) => { r.mask = re(r.mask); });
    if (st.face && st.face.photo) st.face.photo = re(st.face.photo);
    for (const [k, v] of Object.entries(j.files || {})) if (typeof v === 'string' && k.startsWith(from)) FILES[re(k)] = v;
    D.people.push(p);
    if (j.profile && j.profile.name) { const o = clone(j.profile); o.id = takenOpp(o.id) ? uniqueId(o.name, takenOpp) : o.id; o.character = id; D.opponents.push(o); }
    await select('char', id); toast('Imported ' + p.name + (j.profile ? ' and his player profile' : ''));
  }

  // ===========================================================================
  // VIEW TOOLBAR, KEYS, START
  document.querySelectorAll('#cam-seg button').forEach((b) => b.onclick = () => camPreset(b.dataset.cam));
  $('pose-sel').onchange = (ev) => { setPoseNow(ev.target.value); if (camMode !== 'face' && camMode !== 'game') camPreset(camMode); };
  $('light-sel').onchange = (ev) => setLight(ev.target.value);
  $('spin-btn').onclick = () => { spin = !spin; $('spin-btn').classList.toggle('on', spin); if (!spin && cur.scene) cur.scene.rotation.y = 0; if (spin && tool) setTool(null); };
  $('undo-btn').onclick = doUndo; $('redo-btn').onclick = doRedo;
  document.addEventListener('keydown', (ev) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target && ev.target.tagName) || '') && ev.target.type !== 'range' && ev.target.type !== 'checkbox';
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); save(); return; }
    if (ev.key === 'Escape' && !$('modal').hidden) { closeModal(); return; }
    if (ev.key === 'Enter' && !$('modal').hidden && $('n-ok')) { $('n-ok').click(); return; }
    if (typing) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey) { ev.preventDefault(); doUndo(); }
    else if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.key.toLowerCase() === 'z' && ev.shiftKey))) { ev.preventDefault(); doRedo(); }
    else if (ev.key === 'Escape') { if (!$('modal').hidden) closeModal(); else if (sticker) { stopSticker(true); renderPanel(); } else setTool(null); }
    else if (ev.key === '[' || ev.key === ']') { const k = ev.key === ']' ? 1.15 : 1 / 1.15; if (tool === 'add' || tool === 'remove') toolOpt.regionSize = clamp(toolOpt.regionSize * k, 1, 15); else toolOpt.size = clamp(toolOpt.size * k, 0.4, 12); }
  });
  window.addEventListener('dragover', (ev) => ev.preventDefault());
  window.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    const f = [...(ev.dataTransfer && ev.dataTransfer.files || [])][0]; if (!f) return;
    if (/\.velvetchar$|\.json$/i.test(f.name)) { try { await importChar(JSON.parse(await f.text())); } catch (err) { toast('Could not import: ' + err.message, true); } }
    else if (/^image\//.test(f.type) && sel.kind === 'char') { tab = 'face'; renderPanel(); await loadPhotoFile(f); }
  });

  setLight('studio'); camPreset('front', true); requestAnimationFrame(frame);
  renderList(); renderPanel(); updateUndoUI();
  setStatus(D.savedAt ? 'Loaded your characters (saved ' + new Date(D.savedAt).toLocaleString() + ')' : 'No saved characters yet');
  select('you', null);
  // for automated checks
  window.__studio = { get D() { return D; }, FILES, cur, select, openChar, setTool, setPoseNow, studioText, importChar, commitCur, bakeFace, setPhoto, camPreset, renderer, scene, camera, X, get tab() { return tab; }, set tab(v) { tab = v; renderPanel(); },
    pickRegion, hitAt, brushAt: (hit) => { stroke = { last: null }; brushAt(hit); stroke = null; }, startSticker, placeSticker, stopSticker, get sticker() { return sticker; }, edit, applyShape, newDialog, testInGame, faceSet, matchSkin, renderPanel, renderList, doUndo, doRedo, toolOpt };
})();
