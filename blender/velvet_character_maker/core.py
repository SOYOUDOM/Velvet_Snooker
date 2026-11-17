# VELVET Character Maker - turning an MPFB person into a VELVET character.
#
# The game animates people with one skeleton (the "Bip01" skeleton of its
# Rocketbox characters): walking, sitting, cheering and the computed shot
# stance all expect its bone names, its parent bones and its rest pose. So:
#   1. a copy of the person is posed so that every bone points the way the
#      game skeleton's does (MPFB's pose is close already), and that pose is
#      baked into the body and the clothes;
#   2. a new skeleton with the game's names and parents is built at this
#      person's own joints (face points from MPFB's hidden helper geometry);
#   3. the skin weights move across by name; materials become plain textures
#      (baked where MPFB uses procedural shaders);
#   4. after the glTF export every joint gets the game skeleton's rest
#      rotation (see gamefiles.fix_skeleton).
# The user's own scene is never changed: all the work is on copies.
import math
import os
import tempfile
import time

import bpy
from mathutils import Matrix, Vector

from . import gamefiles

G2B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))     # glTF (Y up) -> Blender (Z up)

SIDES = (("l", "L"), ("r", "R"))
FINGERS = (("thumb", "0"), ("index", "1"), ("middle", "2"), ("ring", "3"), ("pinky", "4"))


def bone_map():
    """MPFB 'Game engine' skeleton -> the game's skeleton."""
    m = {"pelvis": "Bip01 Pelvis", "spine_01": "Bip01 Spine", "spine_02": "Bip01 Spine1", "spine_03": "Bip01 Spine2",
         "neck_01": "Bip01 Neck", "head": "Bip01 Head"}
    for s, S in SIDES:
        m.update({f"clavicle_{s}": f"Bip01 {S} Clavicle", f"upperarm_{s}": f"Bip01 {S} UpperArm", f"lowerarm_{s}": f"Bip01 {S} Forearm",
                  f"hand_{s}": f"Bip01 {S} Hand", f"thigh_{s}": f"Bip01 {S} Thigh", f"calf_{s}": f"Bip01 {S} Calf",
                  f"foot_{s}": f"Bip01 {S} Foot", f"ball_{s}": f"Bip01 {S} Toe0"})
        for f, k in FINGERS:
            m[f"{f}_01_{s}"] = f"Bip01 {S} Finger{k}"
            m[f"{f}_02_{s}"] = f"Bip01 {S} Finger{k}1"
            m[f"{f}_03_{s}"] = f"Bip01 {S} Finger{k}2"
    return m


MAP = bone_map()


def aim_order():
    """(bone, the joint it points at), parents first."""
    out = [("spine_01", "spine_02"), ("spine_02", "spine_03"), ("spine_03", "neck_01"), ("neck_01", "head")]
    for s, _ in SIDES:
        out += [(f"clavicle_{s}", f"upperarm_{s}"), (f"upperarm_{s}", f"lowerarm_{s}"), (f"lowerarm_{s}", f"hand_{s}"), (f"hand_{s}", f"middle_01_{s}")]
        for f, _k in FINGERS:
            out += [(f"{f}_01_{s}", f"{f}_02_{s}"), (f"{f}_02_{s}", f"{f}_03_{s}")]
        out += [(f"thigh_{s}", f"calf_{s}"), (f"calf_{s}", f"foot_{s}"), (f"foot_{s}", f"ball_{s}")]
    return out


# ---------------------------------------------------------------- finding a person
def mpfb_type(ob):
    try:
        return str(getattr(ob, "MPFB_GEN_object_type", "") or "").strip()
    except Exception:
        return ""


def find_person(ob):
    """The MPFB body (basemesh) for a selected object: the body itself, its
    skeleton, or anything the person wears."""
    if ob is None:
        return None
    seen = set()
    while ob is not None and ob.name not in seen:
        seen.add(ob.name)
        if mpfb_type(ob) == "Basemesh":
            return ob
        if ob.type == "ARMATURE":
            for c in ob.children:
                if mpfb_type(c) == "Basemesh":
                    return c
        if ob.get("velvet_outfit_of") and ob["velvet_outfit_of"] in bpy.data.objects:
            return bpy.data.objects[ob["velvet_outfit_of"]]
        ob = ob.parent
    return None


def person_rig(body):
    p = body.parent
    if p is not None and p.type == "ARMATURE":
        return p
    for md in body.modifiers:
        if md.type == "ARMATURE" and md.object is not None:
            return md.object
    return None


KIND_OF_TYPE = {"Basemesh": "skin", "Proxymeshes": "skin", "Eyes": "eyes", "Eyebrows": "brows", "Eyelashes": "lashes",
                "Hair": "hair", "Teeth": "teeth", "Tongue": "tongue", "Clothes": "cloth"}


def person_parts(body):
    """Everything that belongs to the person and is visible: (object, kind)."""
    rig = person_rig(body)
    roots = [rig] if rig else [body]
    out, seen = [], set()

    def walk(o):
        for c in o.children:
            if c.name in seen:
                continue
            seen.add(c.name)
            if c.type == "MESH" and c.visible_get():
                t = mpfb_type(c)
                kind = "cloth" if c.get("velvet_outfit_of") else (c.get("velvet_part") or KIND_OF_TYPE.get(t))
                if kind:
                    out.append((c, kind))
            walk(c)
    for r in roots:
        walk(r)
    if body.visible_get() and body.name not in seen:
        out.insert(0, (body, "skin"))
    # a body proxy replaces the basemesh
    if any(mpfb_type(o) == "Proxymeshes" for o, _k in out):
        out = [(o, k) for o, k in out if o is not body]
    return out


def summary(body):
    """What the person has, for the panel."""
    parts = person_parts(body)
    kinds = {}
    for o, k in parts:
        kinds.setdefault(k, []).append(o.name)
    rig = person_rig(body)
    rig_kind = ""
    if rig is not None:
        names = set(rig.data.bones.keys())
        rig_kind = "game_engine" if {"pelvis", "spine_01", "upperarm_l", "ball_l"} <= names and "spine_04" not in names else "other"
    tris = 0
    for o, _k in parts:
        me = o.data
        tris += sum(len(p.vertices) - 2 for p in me.polygons)
    roots = [rig] if rig else [body]
    curves = [c.name for r in roots for c in getattr(r, "children_recursive", []) if c.type in ("CURVES", "CURVE") and c.visible_get()]
    curves += [o.name for o, _k in parts if any(m.type == "PARTICLE_SYSTEM" and m.show_viewport for m in o.modifiers)]
    return {"kinds": kinds, "rig": rig, "rig_kind": rig_kind, "triangles": tris, "parts": parts, "curves": curves}


# ---------------------------------------------------------------- helpers
def _ctx_obj(ob, selected=None):
    sel = selected if selected is not None else [ob]
    return bpy.context.temp_override(object=ob, active_object=ob, selected_objects=sel, selected_editable_objects=sel)


def group_points(ob, name, min_w=0.5):
    g = ob.vertex_groups.get(name)
    if g is None:
        return []
    gi, mw = g.index, ob.matrix_world
    return [mw @ v.co for v in ob.data.vertices if any(e.group == gi and e.weight >= min_w for e in v.groups)]


def centroid(pts):
    if not pts:
        return None
    s = Vector()
    for p in pts:
        s += p
    return s / len(pts)


def baked_mesh(ob, keep_types=None, only_types=None):
    """Replace the object's mesh by its evaluated mesh with some modifiers applied; those modifiers are removed."""
    states = {}
    for md in ob.modifiers:
        states[md.name] = md.show_viewport
        use = (md.type in only_types) if only_types else (md.type not in (keep_types or ()))
        md.show_viewport = bool(use and states[md.name])
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.shape_key_clear() if ob.data.shape_keys else None
    ob.data = me
    for md in list(ob.modifiers):
        applied = (md.type in only_types) if only_types else (md.type not in (keep_types or ()))
        if applied:
            ob.modifiers.remove(md)
        else:
            md.show_viewport = states.get(md.name, True)
    if old.users == 0:
        bpy.data.meshes.remove(old)


# ---------------------------------------------------------------- the steps
def copy_person(body, parts, rig, coll):
    """Deep copies of the skeleton and the visible parts, in a scratch collection.
    Every copy hangs from the skeleton copy, keeping where it is."""
    rig_c = rig.copy()
    rig_c.data = rig.data.copy()
    rig_c.animation_data_clear()
    coll.objects.link(rig_c)
    copies = []
    body_c = None
    for o, kind in parts + ([] if any(o is body for o, _k in parts) else [(body, "landmarks")]):
        c = o.copy()
        c.data = o.data.copy()
        c.animation_data_clear()
        coll.objects.link(c)
        mw = o.matrix_world.copy()
        c.parent = rig_c
        c.matrix_world = mw
        for md in c.modifiers:
            if md.type == "ARMATURE":
                md.object = rig_c
        if o is body:
            body_c = c
        copies.append((c, kind))
    bpy.context.view_layer.update()
    for c, kind in copies:
        if c is not body_c:
            give_weights(c, kind, body_c, rig_c)
    return rig_c, copies, body_c


def give_weights(c, kind, body_c, rig_c):
    """Parts that MPFB left without skin weights (eyes, often teeth) still have
    to move with the body: eyes, teeth and tongue follow the head; anything
    else takes the weights of the nearest skin."""
    bones = set(rig_c.data.bones.keys())
    has_groups = any(g.name in bones for g in c.vertex_groups)
    if not has_groups:
        if kind in ("eyes", "teeth", "tongue", "brows", "lashes") and "head" in bones:
            g = c.vertex_groups.new(name="head")
            g.add([v.index for v in c.data.vertices], 1.0, "REPLACE")
        elif body_c is not None:
            for o in bpy.context.view_layer.objects:
                o.select_set(False)
            c.select_set(True)
            body_c.select_set(True)
            bpy.context.view_layer.objects.active = body_c
            with bpy.context.temp_override(object=body_c, active_object=body_c, selected_objects=[body_c, c], selected_editable_objects=[body_c, c]):
                bpy.ops.object.data_transfer(use_reverse_transfer=False, data_type="VGROUP_WEIGHTS", vert_mapping="POLYINTERP_NEAREST",
                                             layers_select_src="BONE_DEFORM", layers_select_dst="NAME", use_create=True)
            c.select_set(False)
            body_c.select_set(False)
    if not any(md.type == "ARMATURE" for md in c.modifiers):
        md = c.modifiers.new("Armature", "ARMATURE")
        md.object = rig_c
        c.modifiers.move(c.modifiers.find(md.name), 0)


def unit_scale(body):
    """The game works in metres; MPFB can make people in other units."""
    h = max((body.matrix_world @ Vector(b)).z for b in body.bound_box) - min((body.matrix_world @ Vector(b)).z for b in body.bound_box)
    for k in (1.0, 0.1, 0.01, 10.0):
        if 1.2 <= h * k <= 2.6:
            return k
    return 1.0


def pose_to_game(rig, ref):
    """Turn the copy's bones to point the way the game skeleton's do."""
    mw = rig.matrix_world
    pbs = rig.pose.bones
    for pb in pbs:
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()

    def head(n):
        return mw @ pbs[n].head

    def turn(n, q, pivot):
        r = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot)
        pbs[n].matrix = mw.inverted() @ r @ mw @ pbs[n].matrix
        bpy.context.view_layer.update()

    for bone, child in aim_order():
        if bone not in pbs or child not in pbs or MAP.get(bone) not in ref or MAP.get(child) not in ref:
            continue
        a, b = ref[MAP[bone]], ref[MAP[child]]
        target = (G2B @ (b["pos"] - a["pos"])).normalized()
        h = head(bone)
        cur = (head(child) - h).normalized()
        if cur.length < 0.5 or target.length < 0.5:
            continue
        turn(bone, cur.rotation_difference(target), h)
        if bone.startswith("hand_"):                         # the palm faces the same way too
            s, S = bone[-1], bone[-1].upper()
            i1, i4 = f"index_01_{s}", f"pinky_01_{s}"
            r1, r4 = ref.get(f"Bip01 {S} Finger1"), ref.get(f"Bip01 {S} Finger4")
            if i1 in pbs and i4 in pbs and r1 and r4:
                axis = target
                want = G2B @ (r1["pos"] - r4["pos"])
                have = head(i1) - head(i4)
                want -= axis * want.dot(axis)
                have -= axis * have.dot(axis)
                if want.length > 1e-4 and have.length > 1e-4:
                    ang = have.angle(want)
                    if have.cross(want).dot(axis) < 0:
                        ang = -ang
                    from mathutils import Quaternion
                    turn(bone, Quaternion(axis, ang), head(bone))


def build_game_skeleton(rig_c, body_c, ref, coll, name):
    """A new armature with the game's bone names and parents, at this person's joints."""
    mw = rig_c.matrix_world
    pos = {}
    inv = {v: k for k, v in MAP.items()}
    for rb, mp in inv.items():
        if mp in rig_c.pose.bones:
            pos[rb] = mw @ rig_c.pose.bones[mp].head
    pel = pos.get("Bip01 Pelvis")
    if pel is None:
        raise RuntimeError("the skeleton has no pelvis bone")
    pos["Bip01"] = Vector((0.0, pel.y, pel.z))
    # face: eyes and mouth from MPFB's helper geometry, the rest scaled from the game skeleton
    eye_r = centroid(group_points(body_c, "helper-r-eye"))
    eye_l = centroid(group_points(body_c, "helper-l-eye"))
    lips = group_points(body_c, "lips", 0.5)
    rb = {k: G2B @ v["pos"] for k, v in ((n, ref[n]) for n in ref)}
    if eye_r is None or eye_l is None:                       # a body without helpers: scale the game's face to the head
        hd = pos["Bip01 Head"]
        eye_r = hd + (rb["Bip01 REye"] - rb["Bip01 Head"])
        eye_l = hd + (rb["Bip01 LEye"] - rb["Bip01 Head"])
    if eye_r.x > eye_l.x:
        eye_r, eye_l = eye_l, eye_r
    if lips:
        mid_z = sum(p.z for p in lips) / len(lips)
        near = [p for p in lips if abs(p.z - mid_z) < 0.012] or lips
        m_r = min(near, key=lambda p: p.x)
        m_l = max(near, key=lambda p: p.x)
    else:
        m_r = m_l = None
    rb_mid, rb_mouth = (rb["Bip01 REye"] + rb["Bip01 LEye"]) / 2, (rb["Bip01 RMouthCorner"] + rb["Bip01 LMouthCorner"]) / 2
    mp_mid = (eye_r + eye_l) / 2
    mp_mouth = (m_r + m_l) / 2 if m_r is not None else mp_mid + (rb_mouth - rb_mid) * ((eye_l - eye_r).length / (rb["Bip01 LEye"] - rb["Bip01 REye"]).length)

    def frame(r, l, mouth):
        x = (l - r).normalized()
        up = ((r + l) / 2 - mouth)
        up = (up - x * up.dot(x)).normalized()
        f = up.cross(x).normalized()                          # the same convention for both faces
        return x, up, f
    rx, ru, rf = frame(rb["Bip01 REye"], rb["Bip01 LEye"], rb_mouth)
    mx, mu, mf = frame(eye_r, eye_l, mp_mouth)
    sx = (eye_l - eye_r).length / max(1e-4, (rb["Bip01 LEye"] - rb["Bip01 REye"]).length)
    sy = (mp_mid - mp_mouth).length / max(1e-4, (rb_mid - rb_mouth).length)
    sz = (sx + sy) / 2
    for n in ref:
        if n in pos:
            continue
        d = rb[n] - rb_mid
        pos[n] = mp_mid + mx * (d.dot(rx) * sx) + mu * (d.dot(ru) * sy) + mf * (d.dot(rf) * sz)
    pos["Bip01 REye"], pos["Bip01 LEye"] = eye_r, eye_l
    if m_r is not None:
        pos["Bip01 RMouthCorner"], pos["Bip01 LMouthCorner"] = m_r, m_l

    arm = bpy.data.armatures.new(name + "_skeleton")
    ob = bpy.data.objects.new(name + "_rig", arm)
    coll.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    with _ctx_obj(ob):
        bpy.ops.object.mode_set(mode="EDIT")
    order = gamefiles.order_parents_first(ref)
    for n in order:
        eb = arm.edit_bones.new(n)
        eb.head = pos[n]
        axis = (G2B @ ref[n]["rot"].col[0]).normalized()
        eb.tail = pos[n] + axis * 0.03
    for n in order:
        p = ref[n]["parent"]
        if p:
            arm.edit_bones[n].parent = arm.edit_bones[p]
            arm.edit_bones[n].use_connect = False
    with _ctx_obj(ob):
        bpy.ops.object.mode_set(mode="OBJECT")
    return ob, pos


def move_weights(ob, kind, rig_c=None):
    """MPFB bone names -> the game's; eyes follow the eye bones. Weights on
    bones the game does not have (twist or breast bones, the root) go to the
    nearest bone it does have, so no vertex is left without a bone."""
    if kind == "eyes":
        for g in list(ob.vertex_groups):
            ob.vertex_groups.remove(g)
        gr = ob.vertex_groups.new(name="Bip01 REye")
        gl = ob.vertex_groups.new(name="Bip01 LEye")
        cx = sum(v.co.x for v in ob.data.vertices) / max(1, len(ob.data.vertices))
        gr.add([v.index for v in ob.data.vertices if v.co.x < cx], 1.0, "REPLACE")
        gl.add([v.index for v in ob.data.vertices if v.co.x >= cx], 1.0, "REPLACE")
        return
    bones = rig_c.data.bones if rig_c is not None else {}

    def target(name):
        if name in MAP:
            return MAP[name]
        b = bones.get(name) if bones else None
        while b is not None:
            if b.name in MAP:
                return MAP[b.name]
            b = b.parent
        return "Bip01 Pelvis" if name.lower() == "root" else None
    idx = {g.index: g.name for g in ob.vertex_groups}
    acc = {}                                                  # vertex -> {game bone: weight}
    for v in ob.data.vertices:
        for e in v.groups:
            t = target(idx.get(e.group, ""))
            if t and e.weight > 0:
                d = acc.setdefault(v.index, {})
                d[t] = d.get(t, 0.0) + e.weight
    for g in list(ob.vertex_groups):
        ob.vertex_groups.remove(g)
    groups = {}
    for vi, d in acc.items():
        for t, w in d.items():
            g = groups.get(t) or groups.setdefault(t, ob.vertex_groups.new(name=t))
            g.add([vi], min(1.0, w), "REPLACE")
    lost = [v.index for v in ob.data.vertices if v.index not in acc]
    if lost:                                                  # nothing to follow: the nearest group's bone, else the head
        g = groups.get("Bip01 Head") or ob.vertex_groups.new(name="Bip01 Head")
        g.add(lost, 1.0, "REPLACE")


# ---------------------------------------------------------------- materials
TEX_SIZE = {"player": {"skin": 2048, "cloth": 1024, "hair": 1024, "brows": 512, "lashes": 512, "eyes": 256, "teeth": 256, "tongue": 128},
            "crowd": {"skin": 1024, "cloth": 512, "hair": 512, "brows": 256, "lashes": 256, "eyes": 128, "teeth": 128, "tongue": 64}}
ROUGH = {"skin": 0.55, "cloth": 0.75, "hair": 0.6, "brows": 0.7, "lashes": 0.7, "eyes": 0.08, "teeth": 0.3, "tongue": 0.4}
ALPHA_KINDS = ("hair", "brows", "lashes")


def _upstream_image(node, sock_name, seen=None):
    """The first image texture feeding a socket (through any nodes)."""
    seen = seen or set()
    sock = node.inputs.get(sock_name) if sock_name else None
    links = sock.links if sock is not None else [l for s in node.inputs for l in s.links]
    for l in links:
        n = l.from_node
        if n.name in seen:
            continue
        seen.add(n.name)
        if n.type == "TEX_IMAGE" and n.image is not None:
            return n.image
        if n.type == "GROUP" and n.node_tree is not None:
            for gn in n.node_tree.nodes:
                if gn.type == "TEX_IMAGE" and gn.image is not None:
                    return gn.image
        img = _upstream_image(n, None, seen)
        if img is not None:
            return img
    return None


def _principled(mat):
    nt = getattr(mat, "node_tree", None)
    if nt is None:
        return None
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None) or next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
    if out is None or not out.inputs["Surface"].links:
        return None
    n = out.inputs["Surface"].links[0].from_node
    return n


def _plain_color(mat):
    """(r,g,b,a) if the material is a plain colour, else None."""
    n = _principled(mat)
    if n is None:
        c = getattr(mat, "diffuse_color", (0.8, 0.8, 0.8, 1))
        return tuple(c)
    if n.type == "BSDF_PRINCIPLED" and not n.inputs["Base Color"].links:
        return tuple(n.inputs["Base Color"].default_value)
    return None


def _resized(img, size):
    c = img.copy()
    c.name = img.name + "_velvet"
    w, h = c.size
    if w and h and max(w, h) > size:
        k = size / max(w, h)
        c.scale(max(4, int(w * k)), max(4, int(h * k)))
    return c


def _ensure_cycles():
    import addon_utils
    if "CYCLES" not in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items.keys():
        try:
            addon_utils.enable("cycles", default_set=True)
        except Exception:
            pass


def bake_color(ob, size, name):
    """The colour of a procedural material, baked into an image (Cycles)."""
    _ensure_cycles()
    img = bpy.data.images.new(name, size, size, alpha=False)
    temp = []
    for slot in ob.material_slots:
        m = slot.material
        if m is None or getattr(m, "node_tree", None) is None:
            continue
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
        temp.append((m, n))
    sc = bpy.context.scene
    bk = sc.render.bake
    saved = {"engine": sc.render.engine, "bake": (bk.use_pass_direct, bk.use_pass_indirect, bk.use_pass_color, bk.margin, bk.target)}
    sc.render.engine = "CYCLES"
    try:
        saved["cycles"] = (sc.cycles.samples, sc.cycles.device)
        sc.cycles.samples = 1                                 # the colour needs no light: one sample is enough
        sc.cycles.device = "CPU"
    except Exception:
        pass
    bk.use_pass_direct, bk.use_pass_indirect, bk.use_pass_color = False, False, True
    bk.margin = 8
    bk.target = "IMAGE_TEXTURES"
    try:
        with _ctx_obj(ob):
            bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=8, use_clear=True)
    finally:
        try:
            if "cycles" in saved:
                sc.cycles.samples, sc.cycles.device = saved["cycles"]
        except Exception:
            pass
        bk.use_pass_direct, bk.use_pass_indirect, bk.use_pass_color, bk.margin, bk.target = saved["bake"]
        sc.render.engine = saved["engine"]
        for m, n in temp:
            m.node_tree.nodes.remove(n)
    return img


def simple_material(name, kind, image=None, color=None, alpha=False, rough=None, metal=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = ROUGH.get(kind, 0.6) if rough is None else rough
    bsdf.inputs["Metallic"].default_value = metal
    if color is not None:
        bsdf.inputs["Base Color"].default_value = color
    if image is not None:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
    if alpha:
        for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    m["velvet_kind"] = kind
    return m


def prepare_materials(ob, kind, detail, report):
    """One plain material per part: an image (or a colour) the game can show."""
    size = TEX_SIZE[detail].get(kind, 512)
    mats = [s.material for s in ob.material_slots if s.material is not None]
    if ob.get("velvet_outfit_of") and mats:                # the snooker outfit: plain colours already, one per fabric
        return
    name = kind if kind != "cloth" else "cloth_" + "".join(ch if ch.isalnum() else "_" for ch in ob.name.lower())[:24]
    new = None
    if not mats:
        new = simple_material(name, kind, color=(0.78, 0.6, 0.5, 1) if kind == "skin" else (0.5, 0.5, 0.5, 1))
    else:
        plain = _plain_color(mats[0]) if len(mats) == 1 else None
        if plain is not None:
            n = _principled(mats[0])
            rough = n.inputs["Roughness"].default_value if n is not None and n.type == "BSDF_PRINCIPLED" else None
            new = simple_material(name, kind, color=plain, rough=rough)
        elif kind == "skin" and mats[0].get("velvet_hd") and _principled(mats[0]) is not None and _upstream_image(_principled(mats[0]), "Base Color"):
            new = simple_material(name, kind, image=_resized(_upstream_image(_principled(mats[0]), "Base Color"), size))
        elif kind == "eyes":
            img = None
            for m in mats:
                n = _principled(m)
                img = img or (n is not None and (_upstream_image(n, "Base Color") or _upstream_image(n, None)))
            see_through = any(_principled(m) is not None and _principled(m).type == "BSDF_PRINCIPLED" and _principled(m).inputs["Alpha"].links for m in mats)
            new = simple_material(name, kind, image=_resized(img, size), alpha=see_through) if img else simple_material(name, kind, image=bake_color(ob, size, name + "_baked"))
            if see_through:
                new["velvet_alpha"] = True
        elif kind in ALPHA_KINDS:
            img = None
            for m in mats:
                n = _principled(m)
                img = img or (n is not None and (_upstream_image(n, "Base Color") or _upstream_image(n, None)))
            if img:
                new = simple_material(name, kind, image=_resized(img, size), alpha=True)
            else:
                new = simple_material(name, kind, image=bake_color(ob, size, name + "_baked"))
        else:
            report("baking the " + (kind if kind != "cloth" else ob.name) + " colour")
            new = simple_material(name, kind, image=bake_color(ob, size, name + "_baked"))
    ob.data.materials.clear()
    ob.data.materials.append(new)
    for p in ob.data.polygons:
        p.material_index = 0


# ---------------------------------------------------------------- export
def export_person(body, settings, game_root, report=print):
    """Make the game character and put it into the game. Returns a result dict."""
    t0 = time.time()
    rig = person_rig(body)
    if rig is None:
        raise RuntimeError("This person has no skeleton yet. Press \"Add the game skeleton\".")
    if not {"pelvis", "spine_01", "upperarm_l", "hand_l", "thigh_l", "ball_l"} <= set(rig.data.bones.keys()):
        raise RuntimeError("This person has a different skeleton. Press \"Swap for the game skeleton\" in step 1.")
    ref = gamefiles.reference_skeleton(game_root)
    parts = person_parts(body)
    if not parts:
        raise RuntimeError("Nothing of this person is visible to export.")
    detail = settings.get("detail", "player")
    name = settings.get("name") or body.name
    cid = gamefiles.make_id(name, game_root, settings.get("id"))
    prev_active = bpy.context.view_layer.objects.active
    prev_selected = [o.name for o in bpy.context.view_layer.objects if o.select_get()]
    prev_mode = bpy.context.mode
    if prev_mode != "OBJECT":
        with _ctx_obj(prev_active):
            bpy.ops.object.mode_set(mode="OBJECT")
    coll = bpy.data.collections.new("VELVET export (temporary)")
    bpy.context.scene.collection.children.link(coll)
    tmpdir = tempfile.mkdtemp(prefix="velvet_")
    try:
        report("copying the person")
        rig_c, copies, body_c = copy_person(body, parts, rig, coll)
        if (body.get("velvet_hd") or body.get("velvet_face")) and body_c is not None:   # lashes, teeth, tongue from MPFB's helpers
            from . import hd
            have = {k for _c, k in copies}
            copies += [(c, k) for c, k in hd.helper_parts(body_c, rig_c, coll, skip=have)]
        k = unit_scale(body)                                   # metres, at the origin, facing the front
        rig_c.matrix_world = Matrix.Scale(k, 4) @ Matrix.Translation(-rig.matrix_world.translation) if (k != 1.0 or rig.matrix_world.translation.length) else rig_c.matrix_world
        bpy.context.view_layer.update()
        report("posing to the game skeleton")
        pose_to_game(rig_c, ref)
        from . import hd
        morphs = hd.capture_morphs(copies)                     # the face's movements, before the pose is baked in
        report("baking the pose into the body and clothes")
        for c, _kind in copies:
            if c.data.shape_keys is not None or any(m.type == "ARMATURE" for m in c.modifiers):
                baked_mesh(c, only_types={"ARMATURE"})
        # straightening the legs to the game's pose lengthens them a little: stand on the floor again
        low = min((c.matrix_world @ v.co).z for c, kind in copies if kind != "landmarks" for v in c.data.vertices)
        if abs(low) > 1e-4:
            rig_c.matrix_world = Matrix.Translation((0.0, 0.0, -low)) @ rig_c.matrix_world
            bpy.context.view_layer.update()
        if body_c is not None:
            from . import hd
            hd.unhide_under_collar(body_c, copies)             # no gaps between the collar band and the neck
        report("building the game skeleton")
        new_rig, _pos = build_game_skeleton(rig_c, body_c, ref, coll, cid)
        for c, kind in copies:                                # the rest of the modifiers (hidden helpers, clothes cut-outs, smoothing)
            keep = () if detail == "player" else ()
            if detail == "crowd":
                for md in c.modifiers:
                    if md.type == "SUBSURF":
                        md.show_viewport = False
            baked_mesh(c, keep_types=keep)
            c.data.transform(c.matrix_world)
            c.parent = None
            c.matrix_world = Matrix()
        copies = [(c, kind) for c, kind in copies if kind != "landmarks" and len(c.data.vertices)]
        hd.lift_cloth(copies)                                  # collar, cuffs and the shirt's neck clear of the skin
        morph_names = hd.restore_morphs(copies, morphs) if morphs else []
        if body.get("velvet_hd"):
            for c, kind in copies:
                if kind == "skin":
                    hd.tuck_mouth(c)
        if detail == "crowd":
            for c, kind in copies:
                if kind in ("skin", "cloth", "hair") and len(c.data.polygons) > 2000:
                    md = c.modifiers.new("velvet_lighter", "DECIMATE")
                    md.ratio = 0.4
                    baked_mesh(c, only_types={"DECIMATE"})
        report("moving the skin weights")
        for c, kind in copies:
            move_weights(c, kind, rig_c)
            c.parent = new_rig
            md = c.modifiers.new("VELVET skeleton", "ARMATURE")
            md.object = new_rig
        report("preparing materials and textures")
        for c, kind in copies:
            prepare_materials(c, kind, detail, report)
            c.name = kind if kind != "cloth" else c.name
        report("exporting")
        glb = os.path.join(tmpdir, "model.glb")
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        new_rig.select_set(True)
        for c, _kind in copies:
            c.select_set(True)
        bpy.context.view_layer.objects.active = new_rig
        bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True, export_yup=True, export_apply=not morph_names,
                                  export_skins=True, export_morph=bool(morph_names), export_morph_normal=False, export_animations=False, export_image_format="WEBP",
                                  export_image_quality=90, export_materials="EXPORT", export_cameras=False, export_lights=False,
                                  export_extras=False, export_def_bones=False, export_rest_position_armature=True,
                                  export_tangents=False, export_texcoords=True, export_normals=True, export_influence_nb=4,
                                  export_vertex_color="NONE")
        report("fitting the skeleton to the game's animations")
        gamefiles.fix_skeleton(glb, ref)
        _alpha_modes(glb)
        stats = gamefiles.glb_stats(glb)
        entry = {"id": cid, "name": name, "role": settings.get("role", "player"), "gender": settings.get("gender", "male"),
                 "weight": settings.get("weight", 1) if settings.get("role") == "audience" else None,
                 "detail": detail, "made": time.strftime("%Y-%m-%d %H:%M"), "triangles": stats["triangles"], "bytes": stats["bytes"]}
        if morph_names:
            entry["face"] = morph_names
        entry = {k: v for k, v in entry.items() if v is not None}
        if settings.get("hd_of"):                              # the HD look of one of the game's own characters
            gamefiles.install_hd(game_root, settings["hd_of"], glb, entry)
        else:
            gamefiles.install_character(game_root, entry, glb)
        stats.update({"id": cid, "name": name, "seconds": round(time.time() - t0, 1)})
        return stats
    finally:
        for o in list(coll.objects):
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data is not None and getattr(data, "users", 1) == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Armature):
                    bpy.data.armatures.remove(data)
        bpy.data.collections.remove(coll)
        for m in list(bpy.data.materials):
            if m.users == 0 and m.get("velvet_kind"):
                bpy.data.materials.remove(m)
        for img in list(bpy.data.images):
            if img.users == 0 and (img.name.endswith("_velvet") or img.name.endswith("_baked")):
                bpy.data.images.remove(img)
        try:
            for o in bpy.context.view_layer.objects:
                o.select_set(o.name in prev_selected)
            if prev_active is not None and prev_active.name in bpy.data.objects:
                bpy.context.view_layer.objects.active = prev_active
        except Exception:
            pass


def _alpha_modes(glb):
    js, binbuf = gamefiles.read_glb(glb)
    for m in js.get("materials", []):
        m["name"] = str(m.get("name", "")).split(".")[0]
        if m["name"] in ALPHA_KINDS or (m["name"] == "eyes" and m.get("alphaMode") in ("BLEND", "MASK")):
            m["alphaMode"] = "MASK"
            m["alphaCutoff"] = 0.5
            m["doubleSided"] = True
        elif m["name"] in ("skin", "teeth", "tongue"):          # closed surfaces: their back faces are never seen
            m["doubleSided"] = False
    gamefiles.write_glb(glb, js, binbuf)
