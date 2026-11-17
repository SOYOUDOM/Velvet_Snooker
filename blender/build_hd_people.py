"""Rebuild the game's own players and referees as HD people (MPFB body, their own face and hair, a face that moves).
Needs Blender 5.3 with MPFB 2 (and MakeHuman's system assets for the eyes) and the VELVET Character Maker add-on enabled.
run:  blender --background --python blender/build_hd_people.py -- <path to velvet> <id> [<id> ...]
then: python3 tools/hd_pack.py <path to velvet>      (compresses characters/hd/*.glb and rewrites characters/hd.js)
VELVET_RB_DIR=<folder> uses uncompressed copies of the game's models (<id>.glb) instead of characters/models/
(only needed where Blender cannot read meshopt-compressed glTF, such as the bpy Python module)."""
import sys, time, importlib, os, traceback
import bpy, addon_utils

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
game_root, ids = args[0], args[1:]
for m in ('bl_ext.user_default.mpfb', 'bl_ext.user_default.velvet_character_maker'):
    addon_utils.enable(m, default_set=True)
V = importlib.import_module('bl_ext.user_default.velvet_character_maker')
hd = importlib.import_module(V.__name__ + '.hd'); core, outfit = V.core, V.outfit
RB = os.environ.get('VELVET_RB_DIR')    # optional: uncompressed copies of the game's models


for cid in ids:
    t0 = time.time()
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    try:
        model = os.path.join(RB, cid + '.glb') if RB else None
        body, spec = hd.make_hd_person(game_root, cid, model_path=model, report=lambda m: print('  ', cid, m, flush=True))
        res = core.export_person(body, {'name': cid, 'role': spec.get('role', 'player'),
                                        'gender': 'female' if spec['gender'] < .5 else 'male', 'detail': 'player', 'hd_of': cid},
                                 game_root, report=lambda m: print('   export:', m, flush=True))
        print('DONE', cid, res, round(time.time() - t0, 1), 's', flush=True)
    except Exception:
        traceback.print_exc()
        print('FAILED', cid, flush=True)
