# VELVET Character Maker - HD people
#
# An HD person is an MPFB body (a dense mesh you can still reshape with
# MPFB's sliders) that wears the face, hair and eye colour of one of the
# game's own characters. A player keeps his looks and gains a smooth
# head, real hands, eyes that turn and a face that moves.
#
# How the face is carried over
#   1. Both heads are measured in their own frame (eye line and mouth):
#      the eyes, the mouth corners, the tip of the nose, the chin, the
#      forehead, the brows, the cheeks and a ring of points round the skull.
#   2. The game head is laid onto the MPFB head: scale and turn first,
#      then a smooth bend that puts every measured point on its partner.
#   3. Cycles bakes the game head's picture onto the MPFB skin (selected
#      to active); the rest of the skin takes the same tone.
#   4. Hair cards keep their height above the scalp; the eyes take the
#      game character's iris colour.
#   5. MPFB's expression shapes (FACS-like units) become morph targets.
#
# MPFB's base mesh carries hidden helper geometry for the eyelashes, the
# teeth and the tongue, and MPFB's expression shapes move those helpers
# too; at export they become the lashes, teeth and tongue, so they blink
# and open with the face.

import json
import math
import os
import re

import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from . import core, mpfb_link

PREFIX = "velvet:"
# morph target: expression units (MPFB data/targets/expression/units/<ethnicity>/<unit>.target.gz) and how much of each
MORPHS = (
    ("blink", {"eye-left-closure": 1.0, "eye-right-closure": 1.0}),
    ("squint", {"eye-left-slit": 1.0, "eye-right-slit": 1.0}),
    ("wide", {"eye-left-opened-up": 1.0, "eye-right-opened-up": 1.0}),
    ("browsUp", {"eyebrows-left-up": 1.0, "eyebrows-right-up": 1.0}),
    ("browsDown", {"eyebrows-left-down": 1.0, "eyebrows-right-down": 1.0}),
    ("browsWorry", {"eyebrows-left-inner-up": 1.0, "eyebrows-right-inner-up": 1.0}),
    ("smile", {"mouth-corner-puller": 1.0}),
    ("frown", {"mouth-depression": 1.0}),
    ("press", {"mouth-compression": 1.0}),
    ("open", {"mouth-open": 1.0}),
    ("pucker", {"mouth-pursing": 1.0}),
    ("sneer", {"nose-left-elevation": 0.7, "nose-right-elevation": 0.7, "mouth-upward-retraction": 0.35}),
)
HELPERS = (("lashes", ("helper-l-eyelashes-1", "helper-l-eyelashes-2", "helper-r-eyelashes-1", "helper-r-eyelashes-2")),
           ("teeth", ("helper-upper-teeth", "helper-lower-teeth")),
           ("tongue", ("helper-tongue",)))
TEETH = (0.86, 0.82, 0.74, 1.0)
TONGUE = (0.42, 0.13, 0.13, 1.0)
LASH = (0.025, 0.02, 0.018)
SKIN_SIZE = 2048


# ---------------------------------------------------------------- the game's people
def read_people(game_root):
    """The entries of characters/characters.js as dicts, by id."""
    path = os.path.join(game_root, "characters", "characters.js")
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    out = {}
    for m in re.finditer(r"\{\s*id:\s*'([^']+)'", txt):
        i, depth, k = m.start(), 0, m.start()
        for k in range(i, len(txt)):
            if txt[k] == "{":
                depth += 1
            elif txt[k] == "}":
                depth -= 1
                if depth == 0:
                    break
        try:
            out[m.group(1)] = _js_obj(txt[i:k + 1])
        except Exception as e:
            print("VELVET: could not read the entry", m.group(1), e)
    return out


def _js_obj(s):
    s = re.sub(r"//[^\n]*", "", s)
    s = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: json.dumps(m.group(1).replace("\\'", "'")), s)
    s = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', s)
    s = re.sub(r'([:\[,]\s*)(-?)\.(\d)', r'\1\g<2>0.\3', s)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return json.loads(s)


def game_path(game_root, rel):
    return os.path.join(game_root, *rel.split("/"))


# ---------------------------------------------------------------- small helpers
def _pixels(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def _set_pixels(img, a):
    img.pixels.foreach_set(np.ascontiguousarray(a, np.float32).ravel())
    img.update()


def _load_image(path, size=None, linear=False):
    img = bpy.data.images.load(path, check_existing=False)
    if linear:
        img.colorspace_settings.name = "Non-Color"
    if size and tuple(img.size) != (size, size):
        img.scale(size, size)
    return img


def _blur(a, r):
    """Three box passes (close to a gaussian) along both axes; edges clamp."""
    if r < 1:
        return a
    out = a.astype(np.float32)
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=axis, dtype=np.float64)
            n = out.shape[axis]
            hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
            lo = np.take(c, np.arange(0, n), axis=axis)
            out = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return out


def _noise(h, w, cells, seed):
    """Smooth value noise in -1..1."""
    rng = np.random.default_rng(seed)
    g = rng.uniform(-1, 1, (cells + 3, cells + 3)).astype(np.float32)
    y = np.linspace(0, cells, h, dtype=np.float32)
    x = np.linspace(0, cells, w, dtype=np.float32)
    yi, xi = y.astype(int), x.astype(int)
    fy, fx = (y - yi)[:, None], (x - xi)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a = g[yi][:, xi]
    b = g[yi][:, xi + 1]
    c = g[yi + 1][:, xi]
    d = g[yi + 1][:, xi + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def _smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def all_groups(ob, min_w=0.5):
    names = {g.index: g.name for g in ob.vertex_groups}
    out = {}
    for v in ob.data.vertices:
        for e in v.groups:
            if e.weight >= min_w:
                out.setdefault(names[e.group], []).append(v.index)
    return {k: np.array(v, int) for k, v in out.items()}


def shaped_positions(ob):
    """World positions of every vertex: shape keys applied, no modifiers (MPFB's helpers included)."""
    states = [(md, md.show_viewport) for md in ob.modifiers]
    for md, _s in states:
        md.show_viewport = False
    try:
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        ev.to_mesh_clear()
    finally:
        for md, s in states:
            md.show_viewport = s
    M = np.array(ob.matrix_world)
    return co.reshape(-1, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3]


def _hit(bvh, origin, direction, dist=1.0):
    loc, _n, _i, _d = bvh.ray_cast(Vector(origin), Vector(direction), dist)
    return None if loc is None else np.array(loc)


def _nearest(bvh, p):
    loc, nor, _i, _d = bvh.find_nearest(Vector(p))
    return (None, None) if loc is None else (np.array(loc), np.array(nor))


class Frame:
    """A face's own frame: origin between the eyes, x to its left eye, up away from the mouth, f out of the face."""

    def __init__(self, eye_r, eye_l, mouth_r, mouth_l, up=None):
        self.o = (eye_r + eye_l) / 2
        x = eye_l - eye_r
        self.e = float(np.linalg.norm(x))
        self.x = x / self.e
        mouth = (mouth_r + mouth_l) / 2
        up = np.array([0.0, 0.0, 1.0]) if up is None else np.asarray(up, np.float64)   # from the skeleton: some game models lie down at rest
        up = up - self.x * up.dot(self.x)
        self.up = up / np.linalg.norm(up)
        self.m = float((self.o - mouth).dot(self.up))
        self.f = np.cross(self.x, self.up)
        self.c = self.o - self.f * (1.3 * self.e)          # about the middle of the skull

    def at(self, side, height, fwd=0.0):
        return self.o + self.x * side + self.up * height + self.f * fwd


RING = [(phi, th) for phi in (-10, 5, 20, 35, 50, 65, 80) for th in range(0, 360, 30)] + [(90, 0)]


def measure(bvh, eye_r, eye_l, mouth_r, mouth_l, up=None):
    """Named points on a head: the face's landmarks and a ring round the skull (keys are tuples)."""
    F = Frame(eye_r, eye_l, mouth_r, mouth_l, up)
    P = {"REye": eye_r, "LEye": eye_l}
    for k, p in (("RMouthCorner", mouth_r), ("LMouthCorner", mouth_l)):
        q, _n = _nearest(bvh, p)
        P[k] = q if q is not None else p

    def front(h, side=0.0):
        return _hit(bvh, F.at(side, h, 0.35), -F.f, 0.7)

    def most_forward(t0, t1, n):
        best = None
        for t in np.linspace(t0, t1, n):
            p = front(-t * F.m)
            if p is not None and (best is None or (p - F.o).dot(F.f) > (best - F.o).dot(F.f)):
                best = p
        return best
    P["nose"] = most_forward(0.15, 0.85, 36)
    P["chin"] = most_forward(1.35, 2.0, 27)
    P["forehead"] = front(0.95 * F.m)
    P["glabella"] = front(0.42 * F.m)
    P["upper_lip"] = front(-0.86 * F.m)
    P["lower_lip"] = front(-1.14 * F.m)
    for s, k in ((-1, "R"), (1, "L")):
        P["cheek" + k] = front(-0.55 * F.m, s * 0.8 * F.e)
        P["brow" + k] = front(0.36 * F.m, s * 0.5 * F.e)
        P["jaw" + k] = front(-1.45 * F.m, s * 0.75 * F.e)
    for phi, th in RING:
        if (th <= 45 or th >= 315) and phi < 30:
            continue                                            # the face: the landmarks do that
        a, b = math.radians(th), math.radians(phi)
        d = math.cos(b) * (math.cos(a) * F.f + math.sin(a) * F.x) + math.sin(b) * F.up
        p = _hit(bvh, F.c + d * 0.45, -d, 0.6)
        if p is not None:
            P[(phi, th)] = p
    return {k: v for k, v in P.items() if v is not None}, F


def similarity(A, B):
    """s, R, t with B ~ s R A + t (Umeyama)."""
    ma, mb = A.mean(0), B.mean(0)
    A0, B0 = A - ma, B - mb
    U, S, Vt = np.linalg.svd(B0.T @ A0 / len(A))
    D = np.eye(3)
    D[2, 2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt
    s = float(np.trace(np.diag(S) @ D) / ((A0 ** 2).sum() / len(A)))
    return s, R, mb - s * R @ ma


class Bend:
    """A smooth 3D bend (biharmonic RBF with a linear part) through point pairs; lam > 0 lets a pair miss a little."""

    def __init__(self, X, Y, lam):
        n = len(X)
        K = np.linalg.norm(X[:, None] - X[None], axis=2) + np.diag(lam)
        P = np.hstack([np.ones((n, 1)), X])
        M = np.zeros((n + 4, n + 4))
        M[:n, :n], M[:n, n:], M[n:, :n] = K, P, P.T
        rhs = np.zeros((n + 4, 3))
        rhs[:n] = Y - X
        sol = np.linalg.solve(M, rhs)
        self.X, self.W, self.a = X, sol[:n], sol[n:]

    def __call__(self, Q):
        out = np.empty_like(Q)
        for i in range(0, len(Q), 4096):
            q = Q[i:i + 4096]
            K = np.linalg.norm(q[:, None] - self.X[None], axis=2)
            out[i:i + 4096] = q + K @ self.W + np.hstack([np.ones((len(q), 1)), q]) @ self.a
        return out


# ---------------------------------------------------------------- the game character
class GameHead:
    """The game character's head, hair and eyes, read from its model and pictures."""

    def __init__(self, game_root, entry, model_path=None, coll=None):
        self.entry = entry
        self.coll = coll or bpy.context.scene.collection
        path = model_path or game_path(game_root, entry["model"])
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        self.imported = [o for o in bpy.data.objects if o not in before]
        arm = next((o for o in self.imported if o.type == "ARMATURE"), None)
        if arm is None:
            raise RuntimeError("The game model has no skeleton")
        self.bones = {b.name.replace("_", " "): np.array(arm.matrix_world @ b.head_local) for b in arm.data.bones}
        up = self.bones.get("Bip01 Head", np.zeros(3)) - self.bones.get("Bip01 Pelvis", np.array([0.0, 0.0, -1.0]))
        self.up = up / max(1e-6, np.linalg.norm(up))
        skinned = [o for o in self.imported if o.type == "MESH" and len(o.data.vertices) and (o.parent is arm or any(m.type == "ARMATURE" for m in o.modifiers))]
        ups = [np.array([o.matrix_world @ v.co for v in o.data.vertices]) @ self.up for o in skinned]   # not the importer's bone-display sphere
        self.height = float(max(u.max() for u in ups) - min(u.min() for u in ups)) if ups else 1.75
        need = ("Bip01 REye", "Bip01 LEye", "Bip01 RMouthCorner", "Bip01 LMouthCorner")
        if not all(n in self.bones for n in need):
            raise RuntimeError("The game model has no face bones (it is not a Rocketbox person)")
        meshes = [o for o in self.imported if o.type == "MESH"]
        self.head = self._part(meshes, "head")
        self.hair = self._part(meshes, "opacity")
        self.outer = self._outer(self.head)
        self.eyes, self.eye_radius = self._eyeballs()
        tex = entry.get("textures") or {}
        self.head_img = self._image(game_root, tex.get("head"), "head")
        self.hair_img = self._image(game_root, tex.get("opacity"), "opacity") if self.hair is not None else None
        for o in self.imported:
            if o not in (self.head, self.hair):
                bpy.data.objects.remove(o, do_unlink=True)
        self.imported = [o for o in (self.head, self.hair, self.outer) if o is not None]

    def _outer(self, head):
        """The head's outer skin: Rocketbox keeps the mouth, teeth and eyeballs in the lower part of the head picture."""
        bm = bmesh.new()
        bm.from_mesh(head.data)
        uv = bm.loops.layers.uv.active
        inner = [f for f in bm.faces if sum(l[uv].uv.y for l in f.loops) / len(f.loops) < 0.42]
        bmesh.ops.delete(bm, geom=inner, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        me = bpy.data.meshes.new("VELVET game face")
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new("VELVET game face", me)
        self.coll.objects.link(ob)
        return ob

    def _eyeballs(self):
        """Centres of the game character's eyeballs: spheres fitted to the faces that show the eye picture."""
        me = self.head.data
        uvl = me.uv_layers.active.data
        co = np.array([v.co for v in me.vertices])
        lower = np.zeros(len(co), bool)
        for poly in me.polygons:
            if sum(uvl[li].uv[1] for li in poly.loop_indices) / poly.loop_total < 0.42:
                lower[list(poly.vertices)] = True
        out, radii = [], []
        for name in ("Bip01 REye", "Bip01 LEye"):
            e = self.bones[name]
            pts = co[lower & (np.linalg.norm(co - e, axis=1) < 0.03)]
            if len(pts) < 8:
                out.append(e)
                continue
            A = np.hstack([2 * pts, np.ones((len(pts), 1))])
            sol = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
            c = sol[:3]
            r = math.sqrt(max(1e-8, sol[3] + c.dot(c)))
            if not (0.007 < r < 0.02) or np.linalg.norm(c - e) > 0.025:
                c, r = pts.mean(0), 0.012
            out.append(c)
            radii.append(r)
        return out, (float(np.mean(radii)) if radii else 0.012)

    def tone_near(self, points, r=0.02):
        """The skin colour round some points of the face (sRGB 0..1), from the head picture."""
        me = self.outer.data
        uvl = me.uv_layers.active.data
        px = _pixels(self.head_img)
        h, w = px.shape[:2]
        co = np.array([v.co for v in me.vertices])
        near = np.zeros(len(co), bool)
        for p in points:
            near |= np.linalg.norm(co - p, axis=1) < r
        out = []
        for poly in me.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                if near[vi]:
                    u, v = uvl[li].uv
                    out.append(px[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w))), :3])
        if len(out) < 5:
            return None
        out = np.array(out)
        lum = out.mean(1)
        return np.median(out[lum >= np.percentile(lum, 35)], axis=0)

    def _part(self, meshes, key):
        bm = bmesh.new()
        for o in meshes:
            slots = [i for i, m in enumerate(o.data.materials) if m and m.name.split(".")[0].lower().endswith("_" + key)]
            if not slots:
                continue
            tmp = bmesh.new()
            tmp.from_mesh(o.data)
            tmp.transform(o.matrix_world)
            bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if f.material_index not in slots], context="FACES")
            bmesh.ops.delete(tmp, geom=[v for v in tmp.verts if not v.link_faces], context="VERTS")
            me = bpy.data.meshes.new("tmp")
            tmp.to_mesh(me)
            tmp.free()
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        if not bm.faces:
            bm.free()
            return None
        me = bpy.data.meshes.new("VELVET game " + key)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.material_index = 0
        ob = bpy.data.objects.new("VELVET game " + key, me)
        self.coll.objects.link(ob)
        return ob

    def _image(self, game_root, rel, key):
        if rel:
            p = game_path(game_root, rel)
            if os.path.isfile(p):
                return bpy.data.images.load(p, check_existing=True)
        for o in self.imported:                                   # a picture inside the model
            if o.type != "MESH":
                continue
            for m in o.data.materials:
                if m and m.name.split(".")[0].lower().endswith("_" + key) and m.node_tree:
                    for n in m.node_tree.nodes:
                        if n.type == "TEX_IMAGE" and n.image is not None:
                            return n.image
        raise RuntimeError("No %s picture for %s" % (key, self.entry.get("id")))

    def bvh(self, ob=None):
        ob = ob or self.outer
        me = ob.data
        return BVHTree.FromPolygons([v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])

    def points(self):
        b = self.bones
        return measure(self.bvh(), self.eyes[0], self.eyes[1], b["Bip01 RMouthCorner"], b["Bip01 LMouthCorner"], self.up)

    def iris_color(self):
        """The iris colour of the game character's eyes (sRGB 0..1). The front of each eyeball shows where the
        iris is in the picture; round it, the pupil is dark, the white is bright and grey, the iris is the rest."""
        b = self.bones
        F = Frame(self.eyes[0], self.eyes[1], b["Bip01 RMouthCorner"], b["Bip01 LMouthCorner"], self.up)
        me = self.head.data
        uvl = me.uv_layers.active.data
        px = _pixels(self.head_img)
        h, w = px.shape[:2]
        out = []
        for e in self.eyes:
            best, uv = 9.0, None
            for poly in me.polygons:
                c = np.array(poly.center)
                if abs(np.linalg.norm(c - e) - self.eye_radius) > 0.004:
                    continue
                ang = math.acos(max(-1.0, min(1.0, float(np.dot((c - e) / np.linalg.norm(c - e), F.f)))))
                if ang < best:
                    best = ang
                    uv = np.mean([tuple(uvl[li].uv) for li in poly.loop_indices], axis=0)
            if uv is None or uv[1] > 0.42:
                continue
            cx, cy = int(uv[0] * w), int(uv[1] * h)
            r = max(4, int(0.022 * w))
            win = px[max(0, cy - r):cy + r, max(0, cx - r):cx + r, :3].reshape(-1, 3)
            lum = win.mean(1)
            sat = (win.max(1) - win.min(1)) / np.maximum(win.max(1), 1e-4)
            iris = (lum > 0.1) & ~((lum > 0.5) & (sat < 0.3)) & (sat > 0.12)
            if iris.sum() >= 4:
                out.append(np.median(win[iris], axis=0))
        return np.mean(out, axis=0) if out else None

    def remove(self):
        for o in self.imported:
            if o.name in bpy.data.objects:
                me = o.data
                bpy.data.objects.remove(o, do_unlink=True)
                if me.users == 0:
                    bpy.data.meshes.remove(me)


# ---------------------------------------------------------------- the MPFB side
def mpfb_points(body):
    P = shaped_positions(body)
    G = all_groups(body)
    eye_r, eye_l = P[G["helper-r-eye"]].mean(0), P[G["helper-l-eye"]].mean(0)
    lips = P[G["lips"]]
    mid = lips[:, 2].mean()
    near = lips[np.abs(lips[:, 2] - mid) < 0.012]
    if len(near) < 2:
        near = lips
    m_r, m_l = near[near[:, 0].argmin()], near[near[:, 0].argmax()]
    bvh, keep = head_bvh(body, P, G, eye_r[2])
    pts, F = measure(bvh, eye_r, eye_l, m_r, m_l)
    return pts, F, bvh, P, G


def head_bvh(body, P, G, eye_z, below=0.22):
    """The skin of the head and neck (no helpers), in world space."""
    skin = np.zeros(len(P), bool)
    skin[G["body"]] = True
    keep = [tuple(p.vertices) for p in body.data.polygons
            if all(skin[i] and P[i][2] > eye_z - below for i in p.vertices)]
    return BVHTree.FromPolygons([Vector(p) for p in P], keep), keep


# ---------------------------------------------------------------- carrying the face over
def head_bend(game_pts, mp_pts):
    keys = [k for k in game_pts if k in mp_pts]
    feat = [k for k in keys if not isinstance(k, tuple)]
    A = np.array([game_pts[k] for k in feat])
    B = np.array([mp_pts[k] for k in feat])
    s, R, t = similarity(A, B)
    X = np.array([game_pts[k] for k in keys]) @ (s * R).T + t
    Y = np.array([mp_pts[k] for k in keys])
    lam = np.array([0.0 if not isinstance(k, tuple) else 2e-3 for k in keys])
    bend = Bend(X, Y, lam)
    return (lambda Q: bend(np.asarray(Q, np.float64) @ (s * R).T + t)), s


def _move_object(ob, fn):
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = fn(co.reshape(-1, 3).astype(np.float64))
    me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    me.update()


def _emit_material(name, image=None, color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    if image is not None:
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = image
        nt.links.new(tx.outputs["Color"], em.inputs["Color"])
    else:
        em.inputs["Color"].default_value = color
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def _premul_material(name, image, alpha_only=False):
    """Emission of a picture's colour times its alpha (or just its alpha): hair cards, baked onto the scalp."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = image
    if alpha_only:
        nt.links.new(tx.outputs["Alpha"], em.inputs["Color"])
    else:
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        nt.links.new(tx.outputs["Color"], mul.inputs[6])
        nt.links.new(tx.outputs["Alpha"], mul.inputs[7])
        nt.links.new(mul.outputs[2], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return m


def _bake_onto(target, source, image, extrusion=0.02, distance=0.045):
    core._ensure_cycles()
    m = bpy.data.materials.new("VELVET bake target")
    m.use_nodes = True
    n = m.node_tree.nodes.new("ShaderNodeTexImage")
    n.image = image
    m.node_tree.nodes.active = n
    target.data.materials.clear()
    target.data.materials.append(m)
    sc = bpy.context.scene
    saved = (sc.render.engine, sc.cycles.samples, sc.cycles.device)
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 1
    sc.cycles.device = "CPU"
    bk = sc.render.bake
    bk.margin = 4
    bk.target = "IMAGE_TEXTURES"
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    try:
        with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target, source],
                                       selected_editable_objects=[target, source]):
            bpy.ops.object.bake(type="EMIT", use_selected_to_active=True, cage_extrusion=extrusion,
                                max_ray_distance=distance, margin=4, use_clear=True)
    finally:
        sc.render.engine, sc.cycles.samples, sc.cycles.device = saved
        target.data.materials.clear()
        bpy.data.materials.remove(m)
        source.select_set(False)
        target.select_set(False)


def _bake_target(body, P, G, eye_z):
    """A scratch copy of the head and neck skin (MPFB's UVs) to bake onto."""
    skin = np.zeros(len(P), bool)
    skin[G["body"]] = True
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co = Vector(P[v.index])
    gone = [f for f in bm.faces if not all(skin[v.index] and P[v.index][2] > eye_z - 0.3 for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    me = bpy.data.meshes.new("VELVET bake head")
    bm.to_mesh(me)
    bm.free()
    if me.shape_keys:
        pass
    ob = bpy.data.objects.new("VELVET bake head", me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mpfb_masks(size):
    """MPFB's region pictures (face, lips, eyelids, nails, inside of the mouth) at the skin's size, 0..1."""
    root = os.path.join(os.path.dirname(mpfb_link.module("services").__file__), "..", "data", "textures")
    out = {}
    for key in ("face", "lips", "eyelids", "fingernails", "toenails", "inside-mouth", "ears"):
        p = os.path.normpath(os.path.join(root, "mpfb_" + key + ".jpg"))
        if os.path.isfile(p):
            img = _load_image(p, size, linear=True)
            out[key] = _pixels(img)[:, :, 0].copy()
            bpy.data.images.remove(img)
    return out


def carry_face(body, game, report=print):
    """Bake the game character's face onto the MPFB skin; returns the skin picture."""
    report("measuring both heads")
    mp_pts, F, mp_bvh, P, G = mpfb_points(body)
    g_pts, _gF = game.points()
    tone = game.tone_near([g_pts[k] for k in ("cheekR", "cheekL", "forehead") if k in g_pts])
    bend, scale = head_bend(g_pts, mp_pts)
    report("laying the game head onto the new one (scale %.3f)" % scale)
    _move_object(game.head, bend)
    _move_object(game.outer, bend)
    if game.hair is not None:
        _move_object(game.hair, bend)
    size = SKIN_SIZE
    tgt = _bake_target(body, P, G, F.o[2])
    name = "VELVET skin " + (game.entry.get("id") or "")
    col = bpy.data.images.new(name + " (face)", size, size, alpha=True)
    cov = bpy.data.images.new(name + " (cover)", size, size, alpha=True)
    try:
        report("baking the face")
        src = game.outer
        src.data.materials.clear()
        src.data.materials.append(_emit_material("VELVET face", image=game.head_img))
        _bake_onto(tgt, src, col)
        src.data.materials.clear()
        src.data.materials.append(_emit_material("VELVET cover", color=(1, 1, 1, 1)))
        _bake_onto(tgt, src, cov)
    finally:
        me = tgt.data
        bpy.data.objects.remove(tgt, do_unlink=True)
        bpy.data.meshes.remove(me)
    face, cover = _pixels(col), _pixels(cov)[:, :, 0]
    if game.hair is not None and game.hair_img is not None:
        # the hair cards, painted onto the scalp with their see-through parts (they would not sit right on a new head)
        report("painting the hair onto the scalp")
        tgt = _bake_target(body, P, G, F.o[2])
        hcol = bpy.data.images.new(name + " (hair)", size, size, alpha=True, float_buffer=True)
        halp = bpy.data.images.new(name + " (hair alpha)", size, size, alpha=True, float_buffer=True)
        hcol.colorspace_settings.name = "Non-Color"                # linear values: blended in linear light below
        halp.colorspace_settings.name = "Non-Color"
        try:
            hair = game.hair
            hair.data.materials.clear()
            hair.data.materials.append(_premul_material("VELVET hair colour", game.hair_img))
            _bake_onto(tgt, hair, hcol, extrusion=0.035, distance=0.06)
            hair.data.materials.clear()
            hair.data.materials.append(_premul_material("VELVET hair alpha", game.hair_img, alpha_only=True))
            _bake_onto(tgt, hair, halp, extrusion=0.035, distance=0.06)
        finally:
            me = tgt.data
            bpy.data.objects.remove(tgt, do_unlink=True)
            bpy.data.meshes.remove(me)
        hc, ha = np.clip(_pixels(hcol)[:, :, :3], 0, 1), np.clip(_pixels(halp)[:, :, 0], 0, 1)
        bpy.data.images.remove(hcol)
        bpy.data.images.remove(halp)
        lin = np.where(face[:, :, :3] <= 0.04045, face[:, :, :3] / 12.92, ((face[:, :, :3] + 0.055) / 1.055) ** 2.4)
        ears = _blur(uv_mask(body, G.get("ears", np.zeros(0, int)), size), 3)
        face_m = _smooth(_mask("face"), 0.3, 0.8) if _mask("face") is not None else 0.0
        keep = np.clip(ears + face_m, 0, 1)                      # no card hair on the ears or across the face
        hc *= (1 - keep)[:, :, None]
        ha *= (1 - keep)
        t = np.asarray(tone if tone is not None else (0.78, 0.6, 0.5), np.float64)
        tone_lin = np.where(t <= 0.04045, t / 12.92, ((t + 0.055) / 1.055) ** 2.4)
        if os.environ.get("VELVET_HD_DEBUG"):
            np.save(os.path.join(os.environ["VELVET_HD_DEBUG"], "hair_%s.npy" % game.entry.get("id")), np.dstack([hc, ha[:, :, None], lin]).astype(np.float16))
        hc, ha = fill_hair(hc, ha, lin, tone_lin, keep)
        # the back of the head above the nape is hair for anyone with hair (the UV seam runs down the middle
        # of it, so the closing above cannot bridge it)
        if (ha > 0.9).sum() > 200 and "ears" in G:
            ear = P[G["ears"]].mean(0)
            head = np.zeros(len(P), bool)
            head[G["body"]] = True
            zone_v = np.where(head & (P[:, 1] > ear[1] + 0.005) & (P[:, 2] > ear[2] - 0.05))[0]
            zone = np.clip(_blur(uv_mask(body, zone_v, size), 3) * 2.0, 0, 1)   # full strength right up to the UV seam
            sel = ha > 0.9
            hair_col = np.median(hc[sel] / ha[sel][:, None], axis=0)
            n = _noise(size, size, 160, 5)[:, :, None] * 0.12 + 1.0
            lum = lin @ np.array([0.3, 0.55, 0.15])
            skinlike = _smooth(lum / max(1e-4, float(tone_lin @ np.array([0.3, 0.55, 0.15]))), 0.45, 0.7)   # painted hair is darker: kept
            bare = 1 - _smooth(cover, 0.5, 0.95)                    # texels the game head never reached: nothing to keep
            fz = (zone * (1 - ha) * (1 - ears) * np.maximum(skinlike, bare))[:, :, None]
            hc = hc + fz * hair_col[None, None, :] * n
            ha = np.clip(ha + fz[:, :, 0], 0, 1)
        a = ha[:, :, None]
        lin = np.clip(hc, 0, 1) + (1 - a) * lin                  # the hair's colour is already multiplied by its alpha
        face[:, :, :3] = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, 1), 1 / 2.4) - 0.055)
        cover = np.maximum(cover, ha)
    bpy.data.images.remove(col)
    bpy.data.images.remove(cov)
    report("painting the rest of the skin")
    lid_line = lid_margins(body, P, G, size)
    skin = compose_skin(face, cover, mpfb_masks(size), tone=tone, lid_line=lid_line, seed=sum(map(ord, game.entry.get("id", "x"))))
    skin = bleed(skin, uv_mask(body, np.arange(len(body.data.vertices)), size))
    img = bpy.data.images.new(name, size, size, alpha=False)
    _set_pixels(img, skin)
    img.pack()
    return img, F, mp_bvh


def uv_mask(body, verts, size):
    """A picture (0..1) of the faces whose corners are all in `verts`, drawn at their UVs."""
    inside = np.zeros(len(body.data.vertices), bool)
    inside[np.asarray(verts, int)] = True
    uvl = body.data.uv_layers.active.data
    img = np.zeros((size, size), np.float32)
    for poly in body.data.polygons:
        if not all(inside[i] for i in poly.vertices):
            continue
        uv = np.array([uvl[li].uv for li in poly.loop_indices]) * size
        for k in range(1, len(uv) - 1):
            a, b, c = uv[0], uv[k], uv[k + 1]
            x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
            x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(size - 1, x1), min(size - 1, y1)
            if x1 < x0 or y1 < y0:
                continue
            ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1] + 0.5
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-9:
                continue
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
            hit = (l1 >= -0.02) & (l2 >= -0.02) & (l1 + l2 <= 1.02)
            img[y0:y1 + 1, x0:x1 + 1][hit] = 1.0
    return img


def bleed(rgba, inside, passes=3, r=3):
    """Colours of the UV islands spread a few texels outward (texture filtering then never mixes in the padding)."""
    m = (inside > 0.5).astype(np.float32)
    out = rgba.copy()
    for _ in range(passes):
        wm = _blur(m, r)
        wc = _blur(out[:, :, :3] * m[:, :, None], r) / np.maximum(wm, 1e-4)[:, :, None]
        grow = (wm > 0.02) & (m < 0.5)
        out[:, :, :3][grow] = wc[grow]
        m = np.maximum(m, grow.astype(np.float32))
    return out


def fill_hair(hc, ha, face_lin, tone_lin, keep_out, r=48):
    """Close the gaps between hair cards (the scalp under them is often bare skin in the game's picture):
    a morphological closing of where the hair is (grow, then shrink back: gaps narrower than about 2r fill,
    the outline - the hairline - stays where it was); the filled texels take the hair colour around them."""
    m = (ha > 0.5).astype(np.float32)
    if m.sum() < 100:
        return hc, ha
    grown = (_blur(m, r) > 0.02).astype(np.float32)
    closed = (_blur(grown, r) > 0.98).astype(np.float32)
    add = closed * (1 - m) * (1 - keep_out)
    add = _blur(add, 2) * closed                                # soft edges inside the closed area only
    wa = _blur(ha, 2 * r)
    col = _blur(hc, 2 * r) / np.maximum(wa, 1e-4)[:, :, None]   # the hair colour nearby
    hc = hc * (1 - add[:, :, None]) + col * add[:, :, None]
    ha = np.maximum(ha, add)
    return hc, np.clip(ha, 0, 1)


def lid_margins(body, P, G, size):
    """A picture (0..1) of the eyelids' edges round the eye holes, for a soft lash line."""
    me = body.data
    uvl = me.uv_layers.active.data
    skin = np.zeros(len(P), bool)
    skin[G["body"]] = True
    eyes = [P[G["helper-r-eye"]].mean(0), P[G["helper-l-eye"]].mean(0)]
    count = {}
    for poly in me.polygons:
        if not all(skin[i] for i in poly.vertices):
            continue
        for k in poly.edge_keys:
            count[k] = count.get(k, 0) + 1
    rim = {k for k, n in count.items() if n == 1 and min(np.linalg.norm(P[k[0]] - e) for e in eyes) < 0.022}
    pts = []
    for poly in me.polygons:
        vs = list(poly.vertices)
        for j, li in enumerate(poly.loop_indices):
            a, b = vs[j], vs[(j + 1) % len(vs)]
            if (min(a, b), max(a, b)) in rim:
                ua = np.array(uvl[li].uv)
                ub = np.array(uvl[poly.loop_indices[(j + 1) % len(vs)]].uv)
                for t in np.linspace(0, 1, 12):
                    pts.append(ua * (1 - t) + ub * t)
    img = np.zeros((size, size), np.float32)
    if pts:
        pts = np.array(pts)
        x = np.clip((pts[:, 0] * size).astype(int), 0, size - 1)
        y = np.clip((pts[:, 1] * size).astype(int), 0, size - 1)
        img[y, x] = 1.0
        img = np.clip(_blur(img, 2) * 6.0, 0, 1)
    return img


def compose_skin(face, cover, masks, tone=None, lid_line=None, seed=1):
    """The skin picture: the baked face over a body skin of the same tone."""
    h, w = cover.shape
    rgb = face[:, :, :3]
    if tone is None:
        fm = masks.get("face", np.ones((h, w), np.float32))
        calm = (cover > 0.99) & (fm > 0.5)
        lum = rgb.mean(2)
        calm &= lum > np.percentile(lum[calm], 50) if calm.sum() > 100 else calm
        tone = np.median(rgb[calm], axis=0) if calm.sum() > 100 else np.array([0.78, 0.6, 0.5])
    tone = np.asarray(tone, np.float32)
    n1 = _noise(h, w, 24, seed)
    n2 = _noise(h, w, 90, seed + 1)
    n3 = _noise(h, w, 260, seed + 2)
    body = np.empty((h, w, 3), np.float32)
    for c in range(3):
        body[:, :, c] = tone[c] * (1 + 0.035 * n1 + 0.02 * n2 + 0.012 * n3 + (0.012 * n1 if c == 0 else 0))
    for key, tint in (("fingernails", (1.08, 0.98, 0.98)), ("toenails", (1.05, 0.98, 0.98))):
        if key in masks:
            m = masks[key][:, :, None]
            nail = np.clip(tone * np.array(tint) * 0.85 + 0.12, 0, 1)
            body = body * (1 - m) + nail * m
    wgt = _smooth(_blur(cover, 5), 0.55, 0.95)[:, :, None]
    out = body * (1 - wgt) + rgb * wgt
    if "lips" in masks:                                         # lip parts the game face does not reach: the lips' own colour
        lm = masks["lips"]
        ok = (lm > 0.5) & (cover > 0.99)
        if ok.sum() > 50:
            lip = np.median(rgb[ok], axis=0)
            m = (_smooth(lm, 0.3, 0.7) * (1 - wgt[:, :, 0]))[:, :, None]
            out = out * (1 - m) + lip * m
    if "eyelids" in masks:                                      # eyelids: skin (the game's eye holes are painted dark)
        m = _smooth(masks["eyelids"], 0.25, 0.7)[:, :, None]
        lid = tone * np.array([0.96, 0.9, 0.88], np.float32)
        out = out * (1 - 0.9 * m) + lid * (0.9 * m)
    if lid_line is not None:
        m = lid_line[:, :, None]
        out = out * (1 - 0.75 * m) + np.array([0.13, 0.09, 0.08]) * (0.75 * m)
    if "inside-mouth" in masks:
        m = _smooth(masks["inside-mouth"], 0.2, 0.6)[:, :, None]
        out = out * (1 - m) + np.array([0.32, 0.1, 0.1]) * m
    a = np.ones((h, w, 4), np.float32)
    a[:, :, :3] = np.clip(out, 0, 1)
    return a


def carry_hair(body, game, F, mp_bvh):
    """The game character's hair cards, kept at the same height above the new scalp. None if it has none."""
    if game.hair is None:
        return None
    me = game.hair.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    # islands; the game's eyelashes are dropped (the lashes come from MPFB's helpers and blink with the lids)
    seen, islands = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        islands.append(isl)
    eye_r, eye_l = F.o - F.x * F.e / 2, F.o + F.x * F.e / 2
    drop = []
    for isl in islands:
        c = np.mean([np.array(v.co) for g in isl for v in g.verts], axis=0)
        if min(np.linalg.norm(c - eye_r), np.linalg.norm(c - eye_l)) < 0.03 and (c - F.o).dot(F.up) < 0.025:
            drop += isl
    if drop:
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    if not bm.faces:
        bm.free()
        return None
    bm.verts.ensure_lookup_table()
    # the same height above the scalp: move each card point by how far its nearest scalp point moved
    gb = game.bvh()
    disp = np.zeros((len(bm.verts), 3))
    for v in bm.verts:
        q, _n = _nearest(gb, v.co)
        if q is None:
            continue
        q2, _n2 = _nearest(mp_bvh, q)
        if q2 is not None:
            disp[v.index] = q2 - q
    bm.faces.ensure_lookup_table()
    seen, drop = set(), []                                      # each card moves as one piece: no shards
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        vs = {v.index for g in isl for v in g.verts}
        d = disp[list(vs)].mean(0)
        if np.linalg.norm(d) > 0.025 or np.linalg.norm(disp[list(vs)] - d, axis=1).max() > 0.03:
            drop += isl                                         # a card the new head has no place for
            continue
        for i in vs:
            disp[i] = d
    if drop:
        bmesh.ops.delete(bm, geom=drop, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co = Vector(np.array(v.co) + disp[v.index])
        q, n = _nearest(mp_bvh, v.co)                           # never under the new scalp
        if q is not None:
            s_ = float(np.dot(np.array(v.co) - q, n))
            if s_ < 0.0008:
                v.co = Vector(np.array(v.co) + n * (0.0008 - s_))
    me2 = bpy.data.meshes.new("Hair")
    bm.to_mesh(me2)
    bm.free()
    ob = bpy.data.objects.new(body.name + " Hair", me2)
    for c in body.users_collection:
        c.objects.link(ob)
    mat = bpy.data.materials.new("VELVET hair")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = game.hair_img
    nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tx.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.6
    for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
        try:
            setattr(mat, attr, val)
        except Exception:
            pass
    me2.materials.append(mat)
    ob["velvet_part"] = "hair"
    g = ob.vertex_groups.new(name="head")                      # hair cards move with the head
    g.add(list(range(len(me2.vertices))), 1.0, "REPLACE")
    rig = core.person_rig(body)
    if rig is not None:
        ob.parent = rig
        ob.matrix_parent_inverse = rig.matrix_world.inverted()
        md = ob.modifiers.new("Armature", "ARMATURE")
        md.object = rig
    return ob


def tint_eyes(body, srgb):
    """Give the MPFB eyes the game character's iris colour."""
    if srgb is None:
        return
    rig = core.person_rig(body)
    eyes = [o for o in (rig.children if rig else body.children) if core.mpfb_type(o) == "Eyes"]
    for ob in eyes:
        for m in ob.data.materials:
            if not m or not m.node_tree:
                continue
            for n in m.node_tree.nodes:
                if n.type != "TEX_IMAGE" or n.image is None or n.image.get("velvet_tinted"):
                    continue
                img = n.image.copy()
                img.name = n.image.name + " (VELVET iris)"
                px = _pixels(img)
                rgb = px[:, :, :3]
                mx, mn = rgb.max(2), rgb.min(2)
                sat = (mx - mn) / np.maximum(mx, 1e-4)
                iris = (sat > 0.18) & (mx < 0.85) & (mx > 0.03)
                if iris.sum() < 50:
                    continue
                lum = rgb @ np.array([0.3, 0.55, 0.15], np.float32)
                cur = float(np.median(lum[iris]))
                ratio = np.clip(lum / max(cur, 1e-3), 0.25, 1.6) ** 0.6       # the iris's own light and dark (softened), the game's colour
                tinted = np.array(srgb, np.float32)[None, None, :] * ratio[:, :, None]
                m3 = _blur(iris.astype(np.float32), 1)[:, :, None]
                px[:, :, :3] = np.clip(rgb * (1 - m3) + tinted * m3, 0, 1)
                _set_pixels(img, px)
                img["velvet_tinted"] = True
                img.pack()
                n.image = img


def skin_material(body, img):
    m = bpy.data.materials.new("VELVET skin")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = img
    nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.5
    m["velvet_hd"] = True
    body.data.materials.clear()
    body.data.materials.append(m)
    for p in body.data.polygons:
        p.material_index = 0
    return m


# ---------------------------------------------------------------- the face's movements
def units_dir():
    return os.path.normpath(os.path.join(os.path.dirname(mpfb_link.module("services").__file__), "..", "data",
                                         "targets", "expression", "units"))


def add_expressions(body):
    """MPFB's expression units, mixed by the person's ethnicity, as shape keys named velvet:<morph>."""
    TS = mpfb_link.module("services.targetservice").TargetService
    macro = TS.get_macro_info_dict_from_basemesh(body)
    race = macro.get("race") or {"caucasian": 1.0}
    tot = sum(race.values()) or 1.0
    race = {k: v / tot for k, v in race.items() if v > 0.01}
    if body.data.shape_keys is None:
        body.shape_key_add(name="Basis", from_mix=False)
    keys = body.data.shape_keys.key_blocks
    for kb in [kb for kb in keys if kb.name.startswith(PREFIX)]:
        body.shape_key_remove(kb)
    n = len(body.data.vertices)
    base = np.empty(n * 3, np.float32)
    body.data.shape_keys.reference_key.data.foreach_get("co", base)
    cache, root = {}, units_dir()

    def unit(name):
        if name not in cache:
            d = np.zeros(n * 3, np.float32)
            for eth, w in race.items():
                p = os.path.join(root, eth, name + ".target.gz")
                if not os.path.isfile(p):
                    p = os.path.join(root, "caucasian", name + ".target.gz")
                kb = TS.load_target(body, p, weight=0.0, name="velvet_tmp")
                co = np.empty(n * 3, np.float32)
                kb.data.foreach_get("co", co)
                body.shape_key_remove(kb)
                d += w * (co - base)
            cache[name] = d
        return cache[name]
    made = []
    for morph, mix in MORPHS:
        d = np.zeros(n * 3, np.float32)
        for u, k in mix.items():
            try:
                d += k * unit(u)
            except Exception as e:
                print("VELVET: expression unit", u, "not found:", e)
        if np.abs(d).max() < 1e-6:
            continue
        kb = body.shape_key_add(name=PREFIX + morph, from_mix=False)
        kb.data.foreach_set("co", base + d)
        kb.value = 0.0
        made.append(morph)
    return made


# ---------------------------------------------------------------- at export
def helper_parts(body_c, rig_c, coll, skip=()):
    """Lashes, teeth and tongue from MPFB's helper geometry (they keep the expression shape keys); kinds the
    person already has (MakeHuman's own eyelashes, teeth...) are skipped."""
    G = all_groups(body_c)
    out = []
    for kind, groups in HELPERS:
        if kind in skip:
            continue
        keep = set()
        for g in groups:
            keep.update(G.get(g, np.zeros(0, int)).tolist())
        if not keep:
            continue
        c = body_c.copy()
        c.data = body_c.data.copy()
        coll.objects.link(c)
        c.parent = rig_c
        c.matrix_world = body_c.matrix_world.copy()
        for md in list(c.modifiers):
            if md.type != "ARMATURE":
                c.modifiers.remove(md)
        bm = bmesh.new()
        bm.from_mesh(c.data)
        gone = [f for f in bm.faces if not all(v.index in keep for v in f.verts)]
        bmesh.ops.delete(bm, geom=gone, context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(c.data)
        bm.free()
        c.data.materials.clear()
        if kind == "lashes":
            lash_uvs(c)
            c.data.materials.append(lash_material())
        else:
            m = core.simple_material(kind, kind, color=TEETH if kind == "teeth" else TONGUE)
            c.data.materials.append(m)
        c.name = kind
        c["velvet_part"] = kind
        out.append((c, kind))
    return out


def lash_uvs(ob):
    """u along each lash strip, v from the root (at the lid, further back) to the tip (further forward)."""
    me = ob.data
    co = np.array([v.co for v in me.vertices])
    uvl = me.uv_layers.active or me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    comp = -np.ones(len(co), int)
    k = 0
    for v in bm.verts:
        if comp[v.index] >= 0:
            continue
        stack = [v]
        comp[v.index] = k
        while stack:
            a = stack.pop()
            for e in a.link_edges:
                b = e.other_vert(a)
                if comp[b.index] < 0:
                    comp[b.index] = k
                    stack.append(b)
        k += 1
    bm.free()
    u = np.zeros(len(co))
    v = np.zeros(len(co))
    for c in range(k):
        ix = np.where(comp == c)[0]
        p = co[ix]
        x = p[:, 0]
        u[ix] = (x - x.min()) / max(1e-6, x.max() - x.min())
        fwd = -p[:, 1]                                          # MPFB people face -Y
        bins = np.clip((u[ix] * 10).astype(int), 0, 9)
        for bi in range(10):
            s = bins == bi
            if s.sum() < 2:
                v[ix[s]] = 0.5
                continue
            lo, hi = fwd[s].min(), fwd[s].max()
            v[ix[s]] = (fwd[s] - lo) / max(1e-6, hi - lo)
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uvl.data[li].uv = (0.02 + 0.96 * u[vi], 0.03 + 0.94 * v[vi])


def lash_image(w=512, h=128, seed=7):
    """Lashes: many thin curved hairs from the root (bottom) to the tip (top), on a clear background."""
    name = "VELVET lashes"
    if name in bpy.data.images:
        return bpy.data.images[name]
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w), np.float32)
    ys, xs = np.mgrid[0:h, 0:w]
    for _ in range(110):
        x0 = rng.uniform(0.02, 0.98) * w
        length = rng.uniform(0.55, 0.97) * h
        curl = rng.uniform(0.05, 0.22) * w * (1 if x0 > w / 2 else -1) * rng.uniform(0.6, 1.0)
        for t in np.linspace(0, 1, 40):
            x = x0 + curl * t * t
            y = t * length
            r = 1.6 * (1 - 0.75 * t)
            sl = (slice(max(0, int(y - 3)), min(h, int(y + 4))), slice(max(0, int(x - 3)), min(w, int(x + 4))))
            d = np.hypot(xs[sl] - x, ys[sl] - y)
            a[sl] = np.maximum(a[sl], np.clip(1.2 - d / max(r, 0.4), 0, 1) * (1 - 0.35 * t))
    img = bpy.data.images.new(name, w, h, alpha=True)
    px = np.zeros((h, w, 4), np.float32)
    px[:, :, 0], px[:, :, 1], px[:, :, 2] = LASH
    px[:, :, 3] = a
    _set_pixels(img, px)
    img.pack()
    return img


def lash_material():
    m = bpy.data.materials.new("VELVET lashes")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tx = nt.nodes.new("ShaderNodeTexImage")
    tx.image = lash_image()
    nt.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tx.outputs["Alpha"], bsdf.inputs["Alpha"])
    for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
        try:
            setattr(m, attr, val)
        except Exception:
            pass
    m["velvet_kind"] = "lashes"
    return m


def _eval_world(c, only=("ARMATURE",)):
    states = [(md, md.show_viewport) for md in c.modifiers]
    for md, s in states:
        md.show_viewport = bool(s and md.type in only)
    try:
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        ev = c.evaluated_get(dg)
        me = ev.to_mesh()
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        ev.to_mesh_clear()
    finally:
        for md, s in states:
            md.show_viewport = s
    M = np.array(c.matrix_world)
    return co.reshape(-1, 3).astype(np.float64) @ M[:3, :3].T + M[:3, 3]


def capture_morphs(copies):
    """Before the pose is baked: how far each vertex moves for each velvet: shape key (world space).
    The keys are then removed; restore_morphs puts them back on the finished meshes."""
    out = {}
    for c, _kind in copies:
        keys = c.data.shape_keys
        if keys is None:
            continue
        names = [k.name for k in keys.key_blocks if k.name.startswith(PREFIX)]
        if not names:
            continue
        n = len(c.data.vertices)
        a = c.data.attributes.get("velvet_vid") or c.data.attributes.new("velvet_vid", "INT", "POINT")
        a.data.foreach_set("value", np.arange(n, dtype=np.int32))
        for nm in names:
            keys.key_blocks[nm].value = 0.0
        base = _eval_world(c)
        d = {}
        for nm in names:
            kb = keys.key_blocks[nm]
            kb.value = 1.0
            p = _eval_world(c)
            kb.value = 0.0
            dd = (p - base).astype(np.float32)
            if np.abs(dd).max() > 2e-5:
                d[nm[len(PREFIX):]] = dd
        for nm in names:
            c.shape_key_remove(c.data.shape_keys.key_blocks[nm])
        if d:
            out[c.as_pointer()] = d
            if _kind == "skin":
                skin_base, skin_d = base, d
    # parts without the shapes (MakeHuman's eyebrows, eyelashes, beards...) follow the skin they sit on
    if out and "skin_d" in locals():
        from mathutils.kdtree import KDTree
        moving = np.where(np.max([np.abs(v).max(1) for v in skin_d.values()], axis=0) > 1e-5)[0]
        if len(moving):
            kd = KDTree(len(moving))
            for j, i in enumerate(moving):
                kd.insert(Vector(skin_base[i]), j)
            kd.balance()
            for c, kind in copies:
                if c.as_pointer() in out or kind not in ("brows", "lashes", "hair", "teeth", "tongue"):
                    continue
                P = _eval_world(c)
                W = np.zeros((len(P), 4))
                I = np.zeros((len(P), 4), int)
                for vi, p in enumerate(P):
                    for k, (_co, j, dist) in enumerate(kd.find_n(Vector(p), 4)):
                        if dist < 0.015:
                            W[vi, k], I[vi, k] = 1.0 / max(dist, 1e-4), moving[j]
                if not W.any():
                    continue
                Wn = W / np.maximum(W.sum(1, keepdims=True), 1e-9)
                dd = {m: (Wn[:, :, None] * v[I]).sum(1).astype(np.float32) for m, v in skin_d.items()}
                a = c.data.attributes.get("velvet_vid") or c.data.attributes.new("velvet_vid", "INT", "POINT")
                a.data.foreach_set("value", np.arange(len(P), dtype=np.int32))
                out[c.as_pointer()] = dd
    return out


def restore_morphs(copies, morphs):
    """The captured movements as shape keys (glTF morph targets) on the finished meshes."""
    made = set()
    for c, _kind in copies:
        d = morphs.get(c.as_pointer())
        a = c.data.attributes.get("velvet_vid")
        if not d or a is None:
            if a is not None:
                c.data.attributes.remove(a)
            continue
        n = len(c.data.vertices)
        vid = np.empty(n, np.int32)
        a.data.foreach_get("value", vid)
        co = np.empty(n * 3, np.float32)
        c.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        c.shape_key_add(name="Basis", from_mix=False)
        for morph, _mix in MORPHS:
            if morph not in d:
                continue
            kb = c.shape_key_add(name=morph, from_mix=False)
            kb.data.foreach_set("co", (co + d[morph][vid]).ravel())
            kb.slider_min, kb.slider_max, kb.value = 0.0, 1.0, 0.0   # glTF default weight 0: the face at rest
            made.add(morph)
        c.data.attributes.remove(c.data.attributes["velvet_vid"])
    return sorted(made)


_MASKS = {}


def _mask(key):
    """One of MPFB's region pictures as an array (rows bottom-up, like UVs), cached."""
    if key not in _MASKS:
        root = os.path.join(os.path.dirname(mpfb_link.module("services").__file__), "..", "data", "textures")
        p = os.path.normpath(os.path.join(root, "mpfb_" + key + ".jpg"))
        if not os.path.isfile(p):
            return None
        img = _load_image(p, linear=True)
        _MASKS[key] = _pixels(img)[:, :, 0].copy()
        bpy.data.images.remove(img)
    return _MASKS[key]


def tuck_mouth(c, depth=0.002):
    """MPFB's mouth bag comes within a hair of the skin above the upper lip (and through it when the mouth
    opens wide); keep it a little under the skin, at rest and in every shape key."""
    m = _mask("inside-mouth")
    me = c.data
    if m is None or me.uv_layers.active is None:
        return 0
    h, w = m.shape
    uvl = me.uv_layers.active.data
    bag, out = [], []
    for p in me.polygons:
        u = sum(uvl[li].uv[0] for li in p.loop_indices) / p.loop_total
        v = sum(uvl[li].uv[1] for li in p.loop_indices) / p.loop_total
        (bag if m[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w)))] > 0.2 else out).append(tuple(p.vertices))
    if not bag:
        return 0
    inner = sorted({i for f in bag for i in f} - {i for f in out for i in f})

    def tuck(co):
        bvh = BVHTree.FromPolygons([Vector(x) for x in co], out)
        n = 0
        for i in inner:
            loc, nor, _i, _d = bvh.find_nearest(Vector(co[i]), 0.03)
            if loc is None:
                continue
            nor = np.array(nor)
            s_ = float(np.dot(co[i] - np.array(loc), nor))
            if s_ > -depth:
                co[i] -= nor * (s_ + depth)
                n += 1
        return n
    blocks = list(me.shape_keys.key_blocks) if me.shape_keys else []
    moved = 0
    if blocks:
        for kb in blocks:
            co = np.empty(len(me.vertices) * 3, np.float32)
            kb.data.foreach_get("co", co)
            co = co.reshape(-1, 3).astype(np.float64)
            moved += tuck(co)
            kb.data.foreach_set("co", co.astype(np.float32).ravel())
            if kb == me.shape_keys.reference_key:
                me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    else:
        co = np.empty(len(me.vertices) * 3, np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3).astype(np.float64)
        moved = tuck(co)
        me.vertices.foreach_set("co", co.astype(np.float32).ravel())
    me.update()
    return moved


def unhide_under_collar(body_c, copies, reach=0.012):
    """The outfit hides the skin under the clothes, cut along the body's triangles. Right under the collar band
    and the cuffs that cut shows as a zigzag of gaps; the skin there stays (the band covers it)."""
    from . import outfit
    from mathutils.kdtree import KDTree
    g = body_c.vertex_groups.get(outfit.HIDE_GROUP)
    collar = [c for c, k in copies if k == "cloth" and "collar" in c.name.lower()]
    if g is None or not collar:
        return 0
    pts = np.vstack([_eval_world(c) for c in collar])
    kd = KDTree(len(pts))
    for i, q in enumerate(pts):
        kd.insert(Vector(q), i)
    kd.balance()
    P = _eval_world(body_c)
    gi = g.index
    rm = [v.index for v in body_c.data.vertices if any(e.group == gi for e in v.groups) and kd.find(Vector(P[v.index]))[2] < reach]
    if rm:
        g.remove(rm)
    return len(rm)


def lift_cloth(copies, clear=0.003):
    """Keep the collar and cuffs (and the shirt round the neck) a little off the skin, so no skin cuts through
    their edges in a zigzag. Works on the finished meshes, in the game's rest pose."""
    skin = next((c for c, k in copies if k == "skin"), None)
    if skin is None or not len(skin.data.polygons):
        return 0
    cs = np.empty(len(skin.data.vertices) * 3, np.float32)
    skin.data.vertices.foreach_get("co", cs)
    cs = cs.reshape(-1, 3)
    bvh = BVHTree.FromPolygons([Vector(x) for x in cs], [tuple(p.vertices) for p in skin.data.polygons])
    moved = 0
    for c, kind in copies:
        name = c.name.lower()
        if kind != "cloth" or not ("collar" in name or ("shirt" in name and "button" not in name)):
            continue
        co = np.empty(len(c.data.vertices) * 3, np.float32)
        c.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3).astype(np.float64)
        top = co[:, 2].max()
        # open edges (collar band, cuffs, the shirt's neckline) are cut along the body's triangles: a sawtooth.
        # Each edge point moves towards its two neighbours along the edge, so the edge runs straight.
        count = {}
        for poly in c.data.polygons:
            for k in poly.edge_keys:
                count[k] = count.get(k, 0) + 1
        nb = {}
        for (a, b), n in count.items():
            if n == 1:
                nb.setdefault(a, []).append(b)
                nb.setdefault(b, []).append(a)
        if "collar" in name:                                     # the band's fold zigzags too: smooth the whole collar a little
            adj = {}
            for (a, b) in count:
                adj.setdefault(a, []).append(b)
                adj.setdefault(b, []).append(a)
            idx = np.array(sorted(adj))
            for _ in range(4):
                mean = np.array([co[adj[v]].mean(0) for v in idx])
                co[idx] = 0.5 * co[idx] + 0.5 * mean
        ring = [v for v, l in nb.items() if len(l) == 2] if "collar" in name else []
        if ring:
            ring = np.array(ring)
            nbs = np.array([nb[v] for v in ring])
            for _ in range(8):
                co[ring] = 0.5 * co[ring] + 0.25 * (co[nbs[:, 0]] + co[nbs[:, 1]])
        for i in range(len(co)):
            if "collar" not in name and co[i, 2] < top - 0.12:   # the shirt: only round the neck
                continue
            loc, nor, _i, _d = bvh.find_nearest(Vector(co[i]), 0.012)
            if loc is None:
                continue
            nor = np.array(nor)
            s_ = float(np.dot(co[i] - np.array(loc), nor))
            if s_ < clear:
                co[i] += nor * (clear - s_)
                moved += 1
        c.data.vertices.foreach_set("co", co.astype(np.float32).ravel())
        c.data.update()
    return moved


# ---------------------------------------------------------------- gloves (referees)
HAND_BONES = ("hand_", "thumb_", "index_", "middle_", "ring_", "pinky_")


def add_gloves(body, color=(0.82, 0.82, 0.8, 1.0)):
    """White gloves: the hands' skin, a little thicker, as a garment; the skin under them is hidden."""
    from . import outfit
    rig = core.person_rig(body)
    names = {g.index: g.name for g in body.vertex_groups}
    hand = set()
    for v in body.data.vertices:
        w = sum(e.weight for e in v.groups if names.get(e.group, "").startswith(HAND_BONES))
        if w > 0.5:
            hand.add(v.index)
    old = bpy.data.objects.get(body.name + " Gloves")
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    P = shaped_positions(body)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    for v in bm.verts:
        v.co = Vector(P[v.index])
    for layer in list(bm.verts.layers.shape):
        bm.verts.layers.shape.remove(layer)
    gone = [f for f in bm.faces if not all(v.index in hand for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.0016
    me = bpy.data.meshes.new("Gloves")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(body.name + " Gloves", me)
    for c in body.users_collection:
        c.objects.link(ob)
    for g in sorted(body.vertex_groups, key=lambda g: g.index):  # the weights keep their bone names
        ob.vertex_groups.new(name=g.name)
    me.materials.append(outfit._material("VELVET Gloves", color, 0.8, {}))
    ob["velvet_outfit_of"] = body.name
    if rig is not None:
        mw = ob.matrix_world.copy()
        ob.parent = rig
        ob.matrix_world = mw
        md = ob.modifiers.new("Armature", "ARMATURE")
        md.object = rig
    g = body.vertex_groups.get(outfit.HIDE_GROUP) or body.vertex_groups.new(name=outfit.HIDE_GROUP)
    g.add(sorted(hand), 1.0, "REPLACE")
    return ob


# ---------------------------------------------------------------- the face's shape
FIT_DIRS = ("head", "forehead", "eyebrows", "eyes", "nose", "mouth", "chin", "cheek")
FIT_SKIP = re.compile(r"^head-(age|trans|angle)|^[lr]-eye-(?!trans|scale)")   # eyes: where and how big only (the game's lids are too rough)
FIT_MAX = 0.7


def face_targets():
    """MPFB's face shape targets, the two sides of a face together: {name: [files]}."""
    root = os.path.normpath(os.path.join(os.path.dirname(mpfb_link.module("services").__file__), "..", "data", "targets"))
    groups = {}
    for d in FIT_DIRS:
        folder = os.path.join(root, d)
        if not os.path.isdir(folder):
            continue
        for f in sorted(os.listdir(folder)):
            if not f.endswith(".target.gz"):
                continue
            stem = f[:-len(".target.gz")]
            if FIT_SKIP.match(stem):
                continue
            groups.setdefault(d + "/" + re.sub(r"^[lr]-", "", stem), []).append(os.path.join(folder, f))
    return groups


def _box_lsq(A, b, lam, iters=600, hi=1.0):
    """min |A w - b|^2 + lam |w|^2 with 0 <= w <= hi (accelerated projected gradient)."""
    Q = A.T @ A
    Q = Q + lam * float(np.median(np.diag(Q))) * np.eye(A.shape[1])   # lam relative to how much a shape can do
    c = A.T @ b
    L = float(np.linalg.eigvalsh(Q).max())
    w = np.zeros(A.shape[1])
    y, t = w.copy(), 1.0
    for _ in range(iters):
        w2 = np.clip(y - (Q @ y - c) / L, 0.0, hi)
        t2 = (1 + math.sqrt(1 + 4 * t * t)) / 2
        y = w2 + (t - 1) / t2 * (w2 - w)
        w, t = w2, t2
    return w


def fit_face(body, game, report=print, rounds=3, lam=0.08):
    """Set MPFB's face sliders so the new face takes the game character's shape (eyes, nose, mouth, jaw...)."""
    TS = mpfb_link.module("services.targetservice").TargetService
    P0 = shaped_positions(body)
    G = all_groups(body)
    n = len(P0)
    er, el = G["helper-r-eye"], G["helper-l-eye"]
    eye_z = P0[er].mean(0)[2]
    skin = np.zeros(n, bool)
    skin[G["body"]] = True
    skin[G.get("ears", np.zeros(0, int))] = False             # the game's ears are too rough to copy
    H = np.where(skin & (P0[:, 2] > eye_z - 0.15))[0]
    rows = np.concatenate([H, er, el])
    nh = len(H)
    M3 = np.array(body.matrix_world)[:3, :3]
    base = np.empty(n * 3, np.float32)
    body.data.shape_keys.reference_key.data.foreach_get("co", base)
    base = base.reshape(-1, 3)
    groups = face_targets()
    report("reading %d face shapes" % len(groups))
    D, names = [], []
    for key, paths in groups.items():
        d = np.zeros((len(rows), 3))
        for path in paths:
            kb = TS.load_target(body, path, weight=0.0, name="velvet_fit")
            co = np.empty(n * 3, np.float32)
            kb.data.foreach_get("co", co)
            body.shape_key_remove(kb)
            d += ((co.reshape(-1, 3) - base)[rows]) @ M3.T
        if np.abs(d).max() > 2e-5:
            D.append(d)
            names.append(key)
    D = np.stack(D, axis=2)                                     # rows x 3 x targets
    mp_pts, _bvh, _P, _G = mpfb_points(body)[0], None, None, None
    g_pts, _gF = game.points()
    lm = {}
    for k in ("RMouthCorner", "LMouthCorner", "nose", "chin", "forehead", "glabella", "upper_lip", "lower_lip",
              "cheekR", "cheekL", "browR", "browL", "jawR", "jawL"):
        if k in mp_pts and k in g_pts:
            lm[k] = [int(np.argmin(np.linalg.norm(P0[H] - mp_pts[k], axis=1)))]
    lm["REye"] = list(range(nh, nh + len(er)))
    lm["LEye"] = list(range(nh + len(er), len(rows)))
    gout = np.array([v.co for v in game.outer.data.vertices])
    gpolys = [tuple(p.vertices) for p in game.outer.data.polygons]
    w = np.zeros(D.shape[2])
    feat = [k for k in ("REye", "LEye", "RMouthCorner", "LMouthCorner", "nose", "chin", "forehead") if k in lm]
    for rnd in range(rounds):
        p = P0[rows] + D @ w
        cur = {k: p[ix].mean(0) for k, ix in lm.items()}
        s_, R_, t_ = similarity(np.array([g_pts[k] for k in feat]), np.array([cur[k] for k in feat]))
        sim = lambda X: np.asarray(X) @ (s_ * R_).T + t_
        bvh = BVHTree.FromPolygons([Vector(v) for v in sim(gout)], gpolys)
        q = np.zeros((nh, 3))
        ok = np.zeros(nh, bool)
        for i in range(nh):
            loc, _n, _i, dist = bvh.find_nearest(Vector(p[i]), 0.02)
            if loc is not None:
                q[i], ok[i] = np.array(loc), True
        err0 = np.linalg.norm(q[ok] - p[:nh][ok], axis=1).mean() * 1000
        A = [D[:nh][ok].reshape(-1, D.shape[2])]
        b = [(q[ok] - P0[rows][:nh][ok]).reshape(-1)]
        alpha = math.sqrt(max(1.0, ok.sum() / 60.0))           # each landmark counts like ~60 skin points
        for k, ix in lm.items():
            A.append(alpha * D[ix].mean(0))
            b.append(alpha * (sim(g_pts[k]) - P0[rows][ix].mean(0)))
        w = _box_lsq(np.vstack(A), np.concatenate(b), lam, hi=FIT_MAX)
        p2 = P0[rows] + D @ w
        err1 = np.linalg.norm(q[ok] - p2[:nh][ok], axis=1).mean() * 1000
        report("face fit %d: %.1f mm -> %.1f mm (scale %.3f)" % (rnd + 1, err0, err1, s_))
    used = 0
    for key, wk in zip(names, w):
        if wk > 0.03:
            for path in groups[key]:
                TS.load_target(body, path, weight=float(wk))
            used += 1
    top = sorted(zip(w, names), reverse=True)[:8]
    report("face shapes used: %d (%s)" % (used, ", ".join("%s %.2f" % (k.split("/")[1], v) for v, k in top)))
    return dict(zip(names, w))


# ---------------------------------------------------------------- the whole person
def _years(y):
    return 0.1875 + (y - 11) / 14 * 0.3125 if y <= 25 else 0.5 + (y - 25) / 65 * 0.5


_BLACK = (0.018, 0.018, 0.022, 1)
# Bodies for the game's own characters (MPFB macros, the waistcoat colour); the face, hair and eyes come from the game.
DEFAULT_SPECS = {
    "player_01": dict(age=_years(27), weight=.74, muscle=.45, race={"caucasian": 1}, waistcoat=_BLACK),
    "player_02": dict(age=_years(30), weight=.66, muscle=.5, race={"caucasian": 1}, waistcoat=(0.107, 0.004, 0.008, 1)),
    "pro_m08": dict(age=_years(30), weight=.62, muscle=.55, race={"caucasian": 1}, waistcoat=(0.008, 0.014, 0.07, 1)),
    "pro_m07": dict(age=_years(34), weight=.7, muscle=.5, race={"caucasian": 1}, waistcoat=_BLACK),
    "pro_m03": dict(age=_years(60), weight=.62, muscle=.45, race={"caucasian": 1}, waistcoat=(0.03, 0.03, 0.033, 1)),
    "pro_b04": dict(age=_years(50), weight=.6, muscle=.5, race={"caucasian": 1}, waistcoat=(0.04, 0.008, 0.065, 1)),
    "pro_b02": dict(age=_years(30), weight=.62, muscle=.5, race={"asian": .85, "caucasian": .15}, waistcoat=(0.09, 0.004, 0.01, 1)),
    "pro_m13": dict(age=_years(45), weight=.72, muscle=.45, race={"caucasian": 1}, waistcoat=(0.004, 0.03, 0.032, 1)),
    "pro_oudom": dict(age=_years(22), weight=.74, muscle=.62, race={"asian": .55, "african": .25, "caucasian": .2}, waistcoat=_BLACK),
    "referee": dict(age=_years(38), weight=.72, muscle=.45, race={"caucasian": 1}, waistcoat=_BLACK, gloves=True, role="referee"),
    "referee_m2": dict(age=_years(35), weight=.6, muscle=.6, race={"african": .85, "caucasian": .15}, waistcoat=_BLACK, gloves=True, role="referee"),
    "referee_f1": dict(gender=0.0, age=_years(30), weight=.55, muscle=.45, race={"african": .5, "caucasian": .5}, waistcoat=_BLACK, gloves=True, role="referee"),
}


def spec_for(cid, entry):
    """The body for a game character: ours for the game's own, else from its entry (man or woman, role)."""
    spec = dict({"gender": 1.0, "age": _years(30), "weight": .6, "muscle": .5, "race": {"caucasian": 1}, "waistcoat": _BLACK},
                **DEFAULT_SPECS.get(cid, {}))
    if cid not in DEFAULT_SPECS:
        spec["gender"] = 0.0 if (entry or {}).get("gender") == "female" else 1.0
        if (entry or {}).get("role") == "referee":
            spec.update(gloves=True, role="referee")
    spec.setdefault("role", (entry or {}).get("role", "player"))
    return spec


def make_hd_person(game_root, cid, model_path=None, report=print):
    """Everything for one game character: the HD body with its face, the snooker outfit (gloves for referees)."""
    from . import outfit
    entry = read_people(game_root).get(cid)
    spec = spec_for(cid, entry)
    body = build(game_root, cid, spec, model_path=model_path, report=report)
    rig = core.person_rig(body)
    report("dressing")
    outfit.make(body, rig, dict(outfit.DEFAULTS, waistcoat=spec["waistcoat"]))
    if spec.get("gloves"):
        add_gloves(body)
    s = getattr(body, "velvet", None)
    if s is not None:
        s.name = cid
        s.role = spec.get("role", "player") if spec.get("role") in ("player", "referee", "audience") else "player"
        s.gender = "female" if spec["gender"] < 0.5 else "male"
        s.detail = "player"
        s.waistcoat = spec["waistcoat"]
    return body, spec


def build(game_root, cid, spec, model_path=None, report=print):
    """A new HD person in the scene that wears game character `cid`'s face. Returns the MPFB body."""
    people = read_people(game_root)
    if cid not in people:
        raise RuntimeError("No character '%s' in characters.js" % cid)
    entry = people[cid]
    report("reading the game character " + cid)
    game = GameHead(game_root, entry, model_path)
    try:
        hs = mpfb_link.human_service()
        TS = mpfb_link.module("services.targetservice").TargetService
        target_h = float(entry.get("height") or game.height) - 0.022
        macro = TS.get_default_macro_info_dict()
        for k in ("gender", "age", "muscle", "weight", "proportions", "cupsize", "firmness"):
            if k in spec:
                macro[k] = float(spec[k])
        macro["race"] = dict(spec.get("race") or {"caucasian": 1.0})
        report("shaping the body to %.2f m" % (target_h + 0.022))
        h = float(spec.get("height", 0.5))
        body = None
        for _ in range(3):
            macro["height"] = min(1.0, max(0.0, h))
            if body is not None:
                me = body.data
                bpy.data.objects.remove(body, do_unlink=True)
                bpy.data.meshes.remove(me)
            body = hs.create_human(macro_detail_dict=macro)
            P = shaped_positions(body)
            top = P[all_groups(body)["body"]][:, 2].max()
            if abs(top - target_h) < 0.004:
                break
            h += (target_h - top) / 0.55
        body.name = spec.get("name", cid) + " HD"
        if spec.get("fit", True):
            fit_face(body, game, report)
        report("adding the skeleton and eyes")
        mpfb_link.add_game_skeleton(body)
        mpfb_link.add_basics(body)
        iris = game.iris_color()                                # before the game head is moved onto the new one
        img, F, mp_bvh = carry_face(body, game, report)
        skin_material(body, img)
        if spec.get("hair_cards"):                               # optional: the game's hair cards as they are
            report("carrying the hair cards over")
            carry_hair(body, game, F, mp_bvh)
        tint_eyes(body, iris)
        report("adding the face's movements")
        made = add_expressions(body)
        body["velvet_hd"] = cid
        body["velvet_morphs"] = ",".join(made)
        return body
    finally:
        game.remove()
