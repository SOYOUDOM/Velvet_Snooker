# VELVET Character Maker - the game's files.
# Reads the game's own skeleton (from a game character), fixes the skeleton
# of an exported .glb so the game's animations fit it, and keeps the list of
# Blender-made characters in characters/blender.js.
import base64
import json
import os
import re
import struct
import time

from mathutils import Matrix, Quaternion, Vector

PACK_NAME = "blender.js"
PACK_FILES = "window.VELVET_FILES=Object.assign(window.VELVET_FILES||{},"
PACK_LIST = "window.VELVET_BLENDER="


# ---------------------------------------------------------------- game folder
def check_game_folder(path):
    """(ok, message, root) for a folder the user picked: the game folder, or its characters folder."""
    if not path:
        return False, "Choose your VELVET game folder (the one with index.html in it).", None
    path = os.path.abspath(bpy_path(path))
    for root in (path, os.path.dirname(path)):
        if os.path.isfile(os.path.join(root, "characters", "characters.js")):
            if not os.path.isfile(os.path.join(root, "index.html")):
                return False, "This looks like part of VELVET, but index.html is missing.", None
            return True, "VELVET found", root
    return False, "That folder is not the VELVET game folder. Choose the one with index.html and the characters folder in it.", None


def bpy_path(path):
    try:
        import bpy
        return bpy.path.abspath(path)
    except Exception:  # outside Blender
        return path


# ---------------------------------------------------------------- .glb files
def read_glb(path):
    data = open(path, "rb").read()
    if data[:4] != b"glTF":
        raise ValueError("not a .glb file: " + os.path.basename(path))
    length = struct.unpack_from("<I", data, 8)[0]
    off, js, binbuf = 12, None, bytearray()
    while off < length:
        clen, ctype = struct.unpack_from("<I4s", data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == b"JSON":
            js = json.loads(chunk.decode("utf-8"))
        elif ctype == b"BIN\x00":
            binbuf = bytearray(chunk)
    return js, binbuf


def write_glb(path, js, binbuf):
    jbytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    jbytes += b" " * ((4 - len(jbytes) % 4) % 4)
    binbuf = bytes(binbuf) + b"\x00" * ((4 - len(binbuf) % 4) % 4)
    total = 12 + 8 + len(jbytes) + (8 + len(binbuf) if binbuf else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(jbytes), b"JSON"))
        f.write(jbytes)
        if binbuf:
            f.write(struct.pack("<I4s", len(binbuf), b"BIN\x00"))
            f.write(binbuf)


def _local(node):
    if "matrix" in node:
        m = node["matrix"]
        return Matrix([m[0:4], m[4:8], m[8:12], m[12:16]]).transposed()
    t = Vector(node.get("translation", (0, 0, 0)))
    x, y, z, w = node.get("rotation", (0, 0, 0, 1))
    s = Vector(node.get("scale", (1, 1, 1)))
    return Matrix.LocRotScale(t, Quaternion((w, x, y, z)), s)


def _worlds(js):
    nodes = js.get("nodes", [])
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent[c] = i
    cache = {}

    def world(i):
        if i not in cache:
            m = _local(nodes[i])
            cache[i] = world(parent[i]) @ m if i in parent else m
        return cache[i]
    return parent, world


# ---------------------------------------------------------------- reference
REFERENCE_MODELS = ("characters/models/player_01.glb", "characters/models/player_02.glb", "characters/models/referee.glb")


def reference_skeleton(game_root):
    """The game's skeleton in its rest pose: name -> {parent, pos, rot} in glTF space (metres, Y up)."""
    path = None
    for rel in REFERENCE_MODELS:
        p = os.path.join(game_root, *rel.split("/"))
        if os.path.isfile(p):
            path = p
            break
    if not path:
        raise FileNotFoundError("The game's own player model (characters/models/player_01.glb) was not found in the game folder.")
    js, _ = read_glb(path)
    nodes = js["nodes"]
    parent, world = _worlds(js)
    skin = js["skins"][0]
    wanted = {nodes[i].get("name") for i in skin["joints"]}
    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    if "Bip01" in by_name:
        wanted.add("Bip01")
    out = {}
    for name in wanted:
        i = by_name[name]
        w = world(i)
        rot = w.to_3x3().normalized()
        p = parent.get(i)
        out[name] = {"parent": nodes[p].get("name") if p is not None and nodes[p].get("name") in wanted else None,
                     "pos": w.translation.copy(), "rot": rot}
    return out


def order_parents_first(ref):
    done, order = set(), []

    def visit(n):
        if n in done:
            return
        p = ref[n]["parent"]
        if p:
            visit(p)
        done.add(n)
        order.append(n)
    for n in sorted(ref):
        visit(n)
    return order


# ---------------------------------------------------------------- skeleton fix
def fix_skeleton(glb_path, ref):
    """Give every joint the game skeleton's rest rotation (keeping where it is),
    so the game's animations, made for that skeleton, move this body the same
    way. The bind matrices are rebuilt to match, so the mesh is unchanged."""
    js, binbuf = read_glb(glb_path)
    nodes = js["nodes"]
    parent, world = _worlds(js)
    by_name = {n.get("name"): i for i, n in enumerate(nodes)}
    missing = [n for n in ref if n not in by_name]
    if missing:
        raise ValueError("the exported skeleton is missing: " + ", ".join(sorted(missing)[:6]))
    old = {i: world(i).copy() for i in range(len(nodes))}
    new_world = {}
    for name in order_parents_first(ref):
        i = by_name[name]
        new_world[i] = Matrix.LocRotScale(old[i].translation, ref[name]["rot"].to_quaternion(), Vector((1, 1, 1)))
    for name in order_parents_first(ref):
        i = by_name[name]
        p = parent.get(i)
        pw = new_world.get(p, old.get(p, Matrix())) if p is not None else Matrix()
        local = pw.inverted() @ new_world[i]
        t, q, _s = local.decompose()
        n = nodes[i]
        n.pop("matrix", None)
        n["translation"] = [round(v, 7) for v in t]
        n["rotation"] = [round(q.x, 8), round(q.y, 8), round(q.z, 8), round(q.w, 8)]
        n.pop("scale", None)
    # the meshes keep their place: anything below a moved joint (not a joint) is not expected
    for skin in js.get("skins", []):
        acc = js["accessors"][skin["inverseBindMatrices"]]
        bv = js["bufferViews"][acc["bufferView"]]
        base = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        for k, ji in enumerate(skin["joints"]):
            w = new_world.get(ji)
            if w is None:
                continue
            ibm = w.inverted()
            vals = [ibm[r][c] for c in range(4) for r in range(4)]   # column-major
            struct.pack_into("<16f", binbuf, base + 64 * k, *vals)
        bip = by_name.get("Bip01")
        if bip is not None:
            skin["skeleton"] = bip
    js.setdefault("asset", {})["generator"] = "VELVET Character Maker (Blender)"
    write_glb(glb_path, js, binbuf)


def glb_stats(path):
    js, _ = read_glb(path)
    tris = 0
    for m in js.get("meshes", []):
        for pr in m.get("primitives", []):
            if "indices" in pr:
                tris += js["accessors"][pr["indices"]]["count"] // 3
    return {"triangles": tris, "materials": len(js.get("materials", [])), "images": len(js.get("images", [])),
            "bytes": os.path.getsize(path)}


# ---------------------------------------------------------------- blender.js
def pack_path(game_root):
    return os.path.join(game_root, "characters", PACK_NAME)


def read_pack(game_root):
    """(files, people) from characters/blender.js; empty if there is none."""
    path = pack_path(game_root)
    files, people = {}, []
    if not os.path.isfile(path):
        return files, people
    text = open(path, "r", encoding="utf-8").read()
    for line in text.splitlines():
        if line.startswith(PACK_FILES) and line.endswith(");"):
            files = json.loads(line[len(PACK_FILES):-2])
        elif line.startswith(PACK_LIST) and line.endswith(";"):
            data = json.loads(line[len(PACK_LIST):-1])
            if isinstance(data, dict):
                people = data.get("people") or []
    return files, people


def write_pack(game_root, files, people):
    path = pack_path(game_root)
    names = ", ".join(p.get("name", p.get("id", "?")) for p in people) or "none yet"
    head = ("/* VELVET - characters made in Blender with the VELVET Character Maker add-on.\n"
            "   Written by the add-on on " + time.strftime("%Y-%m-%d %H:%M") + ". Characters: " + names + ".\n"
            "   The add-on rewrites this file; to remove a character use the add-on's \"In your game\" list. */\n")
    body = PACK_FILES + json.dumps(files, separators=(",", ":")) + ");\n" + PACK_LIST + json.dumps(
        {"version": 1, "people": people}, separators=(",", ":"), ensure_ascii=False) + ";\n"
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(head + body)
    os.replace(tmp, path)


def install_character(game_root, entry, glb_path):
    """Copy the model into characters/blender/<id>/ and list it in blender.js."""
    cid = entry["id"]
    rel = "characters/blender/" + cid + "/model.glb"
    folder = os.path.join(game_root, "characters", "blender", cid)
    os.makedirs(folder, exist_ok=True)
    data = open(glb_path, "rb").read()
    with open(os.path.join(folder, "model.glb"), "wb") as f:
        f.write(data)
    files, people = read_pack(game_root)
    files = {k: v for k, v in files.items() if not k.startswith("characters/blender/" + cid + "/")}
    files[rel] = base64.b64encode(data).decode("ascii")
    entry = dict(entry, model=rel, source="blender")
    people = [p for p in people if p.get("id") != cid] + [entry]
    write_pack(game_root, files, people)
    return rel


def remove_character(game_root, cid):
    files, people = read_pack(game_root)
    files = {k: v for k, v in files.items() if not k.startswith("characters/blender/" + cid + "/")}
    people = [p for p in people if p.get("id") != cid]
    write_pack(game_root, files, people)
    path = os.path.join(game_root, "characters", "blender", cid, "model.glb")
    if os.path.isfile(path):
        os.remove(path)


def taken_ids(game_root):
    """Ids already used by the game's own characters (characters.js)."""
    path = os.path.join(game_root, "characters", "characters.js")
    try:
        text = open(path, "r", encoding="utf-8").read()
    except OSError:
        return set()
    return set(re.findall(r"\bid:\s*'([^']+)'", text))


def make_id(name, game_root, own=None):
    base = "bl_" + (re.sub(r"[^a-z0-9]+", "_", (name or "person").lower()).strip("_")[:24] or "person")
    if own and own.startswith("bl_"):
        return own
    used = taken_ids(game_root) | {p.get("id") for p in read_pack(game_root)[1]}
    cid, k = base, 1
    while cid in used:
        k += 1
        cid = base + "_" + str(k)
    return cid


# ---------------------------------------------------------------- hd.js (HD looks of the game's own characters)
HD_NAME = "hd.js"
HD_FILES = "window.VELVET_FILES=Object.assign(window.VELVET_FILES||{},"
HD_LIST = "window.VELVET_HD="


def read_hd(game_root):
    """(files, looks) from characters/hd.js: looks maps a game character's id to its HD model."""
    path = os.path.join(game_root, "characters", HD_NAME)
    files, looks = {}, {}
    if not os.path.isfile(path):
        return files, looks
    for line in open(path, "r", encoding="utf-8").read().splitlines():
        if line.startswith(HD_FILES) and line.endswith(");"):
            files = json.loads(line[len(HD_FILES):-2])
        elif line.startswith(HD_LIST) and line.endswith(";"):
            looks = json.loads(line[len(HD_LIST):-1]) or {}
    return files, looks


def write_hd(game_root, files, looks):
    path = os.path.join(game_root, "characters", HD_NAME)
    head = ("/* VELVET - HD people: the game's own characters rebuilt in Blender (MPFB body, their own face and hair,\n"
            "   eyes that turn and a face that moves). Written by the VELVET Character Maker add-on on " + time.strftime("%Y-%m-%d %H:%M") + ".\n"
            "   Each model is also kept in characters/hd/ as a .glb. Settings > People > HD people turns them off. */\n")
    body = HD_FILES + json.dumps(files, separators=(",", ":")) + ");\n" + HD_LIST + json.dumps(looks, separators=(",", ":"), ensure_ascii=False) + ";\n"
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(head + body)
    os.replace(tmp, path)


def install_hd(game_root, cid, glb_path, entry):
    """characters/hd/<cid>.glb, listed in characters/hd.js as the HD look of game character <cid>."""
    rel = "characters/hd/" + cid + ".glb"
    folder = os.path.join(game_root, "characters", "hd")
    os.makedirs(folder, exist_ok=True)
    data = open(glb_path, "rb").read()
    with open(os.path.join(folder, cid + ".glb"), "wb") as f:
        f.write(data)
    files, looks = read_hd(game_root)
    files[rel] = base64.b64encode(data).decode("ascii")
    looks[cid] = {k: v for k, v in dict(entry, model=rel, id=cid).items() if k in ("model", "id", "face", "made", "triangles", "bytes", "name")}
    write_hd(game_root, files, looks)
    return rel


def remove_hd(game_root, cid):
    files, looks = read_hd(game_root)
    rel = "characters/hd/" + cid + ".glb"
    files.pop(rel, None)
    looks.pop(cid, None)
    write_hd(game_root, files, looks)
    path = os.path.join(game_root, "characters", "hd", cid + ".glb")
    if os.path.isfile(path):
        os.remove(path)
