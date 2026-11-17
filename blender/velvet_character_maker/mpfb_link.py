# VELVET Character Maker - talking to MPFB (MakeHuman Plugin For Blender).
# MPFB is an extension with its own package name (bl_ext.<repository>.mpfb),
# so its services are looked up among the loaded modules.
import importlib
import os
import re
import sys
import time

import bpy


def _root():
    for name in list(sys.modules):
        if name.startswith("bl_ext.") and name.endswith(".mpfb") and name.count(".") == 2:
            return name
    return "mpfb" if "mpfb" in sys.modules and hasattr(sys.modules["mpfb"], "__file__") else None


def available():
    return _root() is not None


def module(name):
    root = _root()
    if root is None:
        raise RuntimeError("MPFB is not installed or not enabled. Get it in Edit > Preferences > Get Extensions (search for MPFB).")
    return importlib.import_module(root + "." + name)


_versions = {}


def version():
    root = _root()
    if not root:
        return ""
    if root not in _versions:
        try:
            path = os.path.join(os.path.dirname(sys.modules[root].__file__), "blender_manifest.toml")
            with open(path, encoding="utf-8") as f:
                m = re.search(r'^version\s*=\s*"([^"]+)"', f.read(), re.M)
            _versions[root] = m.group(1) if m else ""
        except Exception:
            _versions[root] = ""
    return _versions[root]


def human_service():
    return module("services.humanservice").HumanService


def find_asset(filename, subdir):
    try:
        return module("services.assetservice").AssetService.find_asset_absolute_path(filename, asset_subdir=subdir)
    except Exception:
        return None


_assets = [-1e9, False]


def have_system_assets():
    """Looked up at most every 10 s: MPFB searches its asset folders on disk."""
    now = time.monotonic()
    if now - _assets[0] > 10.0:
        _assets[:] = [now, bool(find_asset("eyebrow001.mhclo", "eyebrows") or find_asset("eyelashes01.mhclo", "eyelashes"))]
    return _assets[1]


def new_human(gender):
    """A new MPFB person (1.0 = man, 0.0 = woman) with the game skeleton, skin and, when the
    MakeHuman system assets are installed, eyes, eyebrows, eyelashes, teeth and tongue."""
    hs = human_service()
    body = hs.create_human()
    props = module("entities.objectproperties").HumanObjectProperties
    props.set_value("gender", float(gender), entity_reference=body)
    module("services.targetservice").TargetService.reapply_macro_details(body)
    hs.add_builtin_rig(body, "game_engine")
    added = add_basics(body)
    skin = find_asset("young_caucasian_male.mhmat" if gender > 0.5 else "young_caucasian_female.mhmat", "skins")
    attempts = ([(skin, "ENHANCED_SSS")] if skin else []) + [(None, "LAYERED")] + ([(find_asset("default.mhmat", "skins"), "MAKESKIN")] if find_asset("default.mhmat", "skins") else [])
    for mhmat, kind in attempts:                               # newest skin first; older MPFB versions lack some
        try:
            hs.set_character_skin(mhmat, body, skin_type=kind)
            break
        except Exception as e:
            print("VELVET: skin", kind, "not available:", e)
    return body, added


BASICS = (("eyes", "high-poly.mhclo", "Eyes"), ("eyes", "low-poly.mhclo", "Eyes"), ("eyebrows", "eyebrow001.mhclo", "Eyebrows"),
          ("eyelashes", "eyelashes01.mhclo", "Eyelashes"), ("teeth", "teeth_base.mhclo", "Teeth"), ("tongue", "tongue01.mhclo", "Tongue"))


def add_basics(body, have=None):
    """Eyes, eyebrows, eyelashes, teeth and tongue from the system assets; skips what is missing or already there."""
    hs = human_service()
    have = set(have or ())
    added = []
    for sub, fname, atype in BASICS:
        if atype in have:
            continue
        path = find_asset(fname, sub)
        if not path:
            continue
        try:
            hs.add_mhclo_asset(path, body, asset_type=atype)
            have.add(atype)
            added.append(atype)
        except Exception as e:  # keep going with the others
            print("VELVET: could not add", atype, e)
    return added


def add_game_skeleton(body):
    return human_service().add_builtin_rig(body, "game_engine")


def swap_to_game_skeleton(body, old):
    """Replace another skeleton (MPFB default, Rigify, ...) by MPFB's "Game
    engine" one. The body gets MPFB's weights for it; clothes, eyes and hair
    stay where they are and take their weights from the skin at export."""
    import bpy
    bones = set(old.data.bones.keys())
    direct = [o for o in old.children]
    users = [o for o in bpy.data.objects if o.type == "MESH" and (o.parent is old or any(
        m.type == "ARMATURE" and m.object is old for m in o.modifiers))]
    for o in direct:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    for o in users:
        for m in [m for m in o.modifiers if m.type == "ARMATURE" and m.object is old]:
            o.modifiers.remove(m)
        for g in [g for g in o.vertex_groups if g.name in bones]:
            o.vertex_groups.remove(g)
    data = old.data
    bpy.data.objects.remove(old, do_unlink=True)
    if data is not None and data.users == 0:
        bpy.data.armatures.remove(data)
    rig = add_game_skeleton(body)
    bpy.context.view_layer.update()
    for o in direct:
        if o is not body and o.name in bpy.data.objects:
            mw = o.matrix_world.copy()
            o.parent = rig
            o.matrix_world = mw
    return rig
