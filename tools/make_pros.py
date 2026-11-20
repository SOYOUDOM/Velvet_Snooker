"""Every pro their own model file, with their own build (VELVET 7.2).

Before 7.2 the fifteen pros shared eight bodies, all of them the same slim-to-average Rocketbox build. Now each
pro has a model file of their own, characters/models/pros/<id>.glb, reshaped to how they are built
(tools/node/body_shape.mjs: the waist as a waist-to-height ratio, how much of it is belly, and the chest, seat,
arms, legs, neck and jaw line that go with it), at their own height (characters.js). Eight pros who shared a
face with another pro (or with you, player_01) also get a face of their own: another Microsoft Rocketbox person's head (with its face shapes, full-size textures, relief and
hair, as in VELVET 7.0) on the suit body player one wears (tools/node/swap_body.mjs), the waistcoat in their own
colour. The other seven keep their face; their model is still a file of their own.

Heights are published figures where there are any (celebheights.com, IMDb, Google's panel); otherwise estimated
from pictures beside other players. Builds are from how they look at the table in 2025-26.

The pros are read when they are first needed (lazy: an opponent you pick, a tournament draw), not all at start.

usage: python3 -I tools/make_pros.py <game folder> <Microsoft-Rocketbox checkout> [id ...]
then:  python3 -I tools/pack_characters.py <game folder>
"""
import io, json, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image

# id: base (an existing character's model) or rb (a Rocketbox person: folder, texture id) whose head goes on the suit
#     body (casual clothes - hoodies, track tops, shorts - do not make a snooker outfit) with a waistcoat colour;
#     height (m), whtr (waist round the navel, clothed / height), belly (0..1: how much of the build is in front)
PROS = {
    'osullivan': dict(base='player_02', height=1.78, whtr=.505, belly=.25),          # lean, a runner
    'trump':     dict(base='pro_m08',   height=1.79, whtr=.51, belly=.35),
    'selby':     dict(base='pro_m07',   height=1.83, whtr=.56, belly=.6),
    'higgins':   dict(base='pro_m03',   height=1.73, whtr=.61, belly=.8),           # short and stocky
    'williams':  dict(base='pro_b04',   height=1.85, whtr=.64, belly=.9),           # tall, a big belly
    'ding':      dict(base='pro_b02',   height=1.75, whtr=.56, belly=.6),
    'robertson': dict(base='pro_m13',   height=1.84, whtr=.53, belly=.45),
    'murphy':    dict(rb=('Adults/Male_Adult_20', 'm027'), vest=(.022, .022, .026), height=1.81, whtr=.66, belly=.85),   # heavy, round
    'zhao':      dict(rb=('Adults/Male_Adult_10', 'm024'), vest=(.02, .02, .024), height=1.70, whtr=.485, belly=.25),
    'allen':     dict(rb=('Adults/Male_Adult_11', 'm001'), vest=(.02, .02, .024), height=1.75, whtr=.54, belly=.55),  # after losing six stone
    'wilson':    dict(rb=('Adults/Male_Adult_06', 'm011'), vest=(.018, .028, .07), height=1.75, whtr=.56, belly=.55),
    'brecel':    dict(rb=('Adults/Male_Adult_02', 'm003'), vest=(.06, .06, .066), height=1.80, whtr=.51, belly=.35),
    'hawkins':   dict(rb=('Adults/Male_Adult_14', 'm012'), vest=(.045, .045, .05), height=1.78, whtr=.58, belly=.7),
    'bingham':   dict(rb=('Professions/Business_Male_07', 'm018'), vest=(.02, .055, .038), height=1.73, whtr=.60, belly=.75),
    'lisowski':  dict(rb=('Adults/Male_Adult_01', 'm002'), vest=(.12, .022, .036), height=1.86, whtr=.485, belly=.25),  # tall and slim
}
SUIT = ('Professions/Business_Male_01', 'm005')     # player_01's suit: a white shirt, the outfit paints cleanly
OWN_FILE_ONLY = {'oudom': 'player_01'}       # Soy Oudom: his own file, his body as it is (his build is made at load)

game = pathlib.Path(sys.argv[1]).resolve()
rb = pathlib.Path(sys.argv[2]).resolve() / 'Assets/Avatars'
only = sys.argv[3:]
node_dir = pathlib.Path(__file__).resolve().parent / 'node'
fbx2gltf = node_dir / 'node_modules/fbx2gltf/bin/Linux/FBX2glTF'
work = pathlib.Path('/tmp/velvet_pros'); work.mkdir(exist_ok=True)
TEX, MOD = game / 'characters/textures', game / 'characters/models'
(MOD / 'pros').mkdir(exist_ok=True)


def arr(im): return np.asarray(im, np.float32) / 255
def to_img(a, mode=None): return Image.fromarray(np.clip(np.round(a * 255), 0, 255).astype(np.uint8), mode)
def save_jpg(a, path, q): to_img(a).save(path, quality=q, optimize=True, progressive=True)
def glb_json(path):
    b = path.read_bytes(); n = int.from_bytes(b[12:16], 'little'); return json.loads(b[20:20 + n])
def joint_names(path): j = glb_json(path); return [j['nodes'][k]['name'] for k in j['skins'][0]['joints']]


def manifest():
    return json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.VELVET_CHARACTERS))",
                                      str(game / 'characters/characters.js')], capture_output=True, text=True, check=True).stdout)


def avatar(folder, mid):
    """A Rocketbox person as full_avatar.mjs writes them (face shapes named, each part its own mesh) and its raw mesh."""
    name, T = folder.split('/')[-1], rb / folder / 'Textures'
    out, raw = work / f'{name}.glb', work / f'{name}_raw.glb'
    if out.exists() and raw.exists(): return out, raw, T
    fbx = rb / folder / 'Export' / f'{name}_facial.fbx'
    subprocess.run([str(fbx2gltf), '-i', str(fbx), '-o', str(raw.with_suffix('')), '--binary', '--long-indices', 'auto'], check=True, capture_output=True)
    subprocess.run(['node', 'shape_names.mjs', str(fbx), str(work / f'{name}_shapes.json')], check=True, capture_output=True, cwd=node_dir)
    hair = (T / f'{mid}_opacity_color.tga').exists() and any(m['name'].endswith('_opacity') for m in glb_json(raw)['materials'])
    r = subprocess.run(['node', 'full_avatar.mjs', str(raw), str(work / f'{name}_shapes.json'), str(out)] + ([] if hair else ['--no-hair']),
                       capture_output=True, text=True, cwd=node_dir)
    if r.returncode: raise SystemExit(f'{name}: {r.stderr.strip()[-400:]}')
    if set(joint_names(out)) != set(joint_names(MOD / 'player_01.glb')): raise SystemExit(f'{name}: not the same skeleton as the other players')   # (the clips bind by name)
    return out, raw, T


def new_person(pid, folder, mid, vest):
    """A Rocketbox person as a pro: their head (face, face shapes, hair) on the suit body in the snooker outfit."""
    head_glb, _, T = avatar(folder, mid)
    suit_glb = avatar(*SUIT)[0]
    out = work / f'{pid}_base.glb'
    r = subprocess.run(['node', 'swap_body.mjs', str(head_glb), str(suit_glb), str(out)], capture_output=True, text=True, cwd=node_dir)
    if r.returncode: raise SystemExit(f'{pid}: {r.stderr.strip()[-400:]}')
    return out, maps_for(pid, vest, head_glb, T, mid)


def maps_for(pid, vest, head_glb, T, mid):
    """The outfit: player one's finished suit (painted for 6.9, full size since 7.0) with the waistcoat in this pro's
    colour and the same relief (the same body); the face and hair: the person's own, full size."""
    mask = work / 'suit_vest_mask.png'
    if not mask.exists():
        _, suit_raw, ST = avatar(*SUIT)
        subprocess.run(['node', 'export_mesh.mjs', str(suit_raw), str(work / 'suit_mesh.json')], check=True, capture_output=True, cwd=node_dir)
        subprocess.run([sys.executable, '-I', str(pathlib.Path(__file__).parent / 'paint_player.py'), str(work / 'suit_mesh.json'),
                        str(ST / f'{SUIT[1]}_body_color.tga'), str(work / 'suit_painted.png'), '0,0,0', '--mask', str(mask)], check=True, capture_output=True)
    body = 'characters/textures/player_01_body.jpg'
    if max(vest) > .03:
        src = arr(Image.open(game / body).convert('RGB')); S = src.shape[0]
        m = arr(Image.open(mask).convert('L').resize((S, S), Image.BILINEAR))[..., None]
        lum = .2126 * src[..., 0] + .7152 * src[..., 1] + .0722 * src[..., 2]
        shade = np.clip(lum / max(float(np.median(lum[m[..., 0] > .5])), 1e-3), .55, 1.25)[..., None]
        save_jpg(src * (1 - m) + np.array(vest)[None, None, :] * (.55 + .75 * shade) * m, TEX / f'{pid}_body.jpg', 88)
        body = f'characters/textures/{pid}_body.jpg'
    # the face: the original 2K colour and relief; its shine map as roughness (lips and nose catch the light)
    save_jpg(arr(Image.open(T / f'{mid}_head_color.tga').convert('RGB')), TEX / f'{pid}_head.jpg', 90)
    save_jpg(arr(Image.open(T / f'{mid}_head_normal.tga').convert('RGB')), TEX / f'{pid}_head_normal.jpg', 92)
    s = np.asarray(Image.open(T / f'{mid}_head_specular.tga').convert('L').resize((1024, 1024), Image.LANCZOS), np.float32)
    s = s / max(np.percentile(s, 99.5), 60)
    Image.fromarray(np.round(np.clip(1 - .45 * s, .5, 1) * 255).astype(np.uint8)).save(TEX / f'{pid}_head_shine.jpg', quality=90, optimize=True)
    tex = {'body': body, 'head': f'characters/textures/{pid}_head.jpg'}
    if any(m['name'].endswith('_opacity') for m in glb_json(head_glb)['materials']):   # the cut-out hair cards, 1K
        o = Image.open(T / f'{mid}_opacity_color.tga').convert('RGBA'); k = min(1, 1024 / max(o.size))
        o.resize((round(o.size[0] * k), round(o.size[1] * k)), Image.LANCZOS).save(TEX / f'{pid}_hair.webp', quality=90, alpha_quality=100, method=6)
        tex['opacity'] = f'characters/textures/{pid}_hair.webp'
    return {'textures': tex, 'normals': {'body': 'characters/textures/player_01_body_normal.jpg', 'head': f'characters/textures/{pid}_head_normal.jpg'},
            'shine': {'head': f'characters/textures/{pid}_head_shine.jpg'}}


def entry_js(e):
    q = lambda d: '{' + ', '.join(f"{k}: '{v}'" for k, v in d.items()) + '}'
    return (f"    {{id: '{e['id']}',\n     name: {json.dumps(e.get('name') or e['id'])},\n     role: 'player',\n     gender: 'male',\n     lazy: true,\n     model: '{e['model']}',\n"
            f"     textures: {q(e['textures'])},\n     normals: {q(e['normals'])},\n     shine: {q(e['shine'])},\n     height: {e['height']}}}")


def main():
    man = manifest(); people = {p['id']: p for p in man['people']}
    names = {o['id']: o['name'] for o in json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.VELVET_OPPONENTS))",
                                                                   str(game / 'js/opponents.js')], capture_output=True, text=True, check=True).stdout)}
    done, entries = [], {}
    prev = re.search(r"[ \t]*// the pros, each with their own model file.*?// end of the pros\n", (game / 'characters/characters.js').read_text(), re.S)
    for pro, c in PROS.items():
        pid = 'pro_' + pro
        if only and pro not in only:
            if pid in people: entries[pro] = people[pid]
            continue
        if 'base' in c:
            src, b = MOD / f"{c['base']}.glb", people[c['base']]
            maps = {k: dict(b[k]) for k in ('textures', 'normals', 'shine')}
        else:
            src, maps = new_person(pid, *c['rb'], c['vest'])
        dst = MOD / 'pros' / f'{pro}.glb'
        r = subprocess.run(['node', 'body_shape.mjs', str(src), str(dst), json.dumps({'whtr': c['whtr'], 'belly': c['belly']})],
                           capture_output=True, text=True, cwd=node_dir)
        if r.returncode: raise SystemExit(f'{pro}: {r.stderr.strip()[-400:]}')
        rep = json.loads(r.stdout.strip().splitlines()[-1])
        if abs(rep['after']['whtr'] - c['whtr']) > .012: print(f"  {pro}: waist {rep['after']['whtr']} (asked {c['whtr']})")
        entries[pro] = dict(id=pid, name=names[pro], model=f'characters/models/pros/{pro}.glb', height=c['height'], **maps)
        print(json.dumps({'pro': pro, 'from': c.get('base') or c['rb'][0], 'fat': rep['fat'], 'waist_cm': [rep['base']['waist'], rep['after']['waist']],
                          'whtr': rep['after']['whtr'], 'height': c['height'], 'kb': rep['bytes'] // 1024}), flush=True)
        done.append(pro)
    # Soy Oudom: his own file (his body as it is; the build he chose is made at load)
    for pro, src in OWN_FILE_ONLY.items():
        if only and pro not in only: continue
        (MOD / 'pros' / f'{pro}.glb').write_bytes((MOD / f'{src}.glb').read_bytes())
    # characters.js: the pros' block (written again each time), Oudom's model
    js = (game / 'characters/characters.js').read_text()
    block = ('    // the pros, each with their own model file and build (tools/make_pros.py); read when first needed\n'
             + ',\n'.join(entry_js(entries[p]) for p in PROS if p in entries) + ',\n    // end of the pros\n')
    if prev: js = js.replace(prev.group(0), block)
    else:
        a = js.index("    {id: 'pro_oudom',"); js = js[:a] + block + js[a:]
    js = re.sub(r"(\{id: 'pro_oudom',[^}]*?model: )'[^']*'", r"\1'characters/models/pros/oudom.glb'", js, count=1, flags=re.S)
    (game / 'characters/characters.js').write_text(js)
    # opponents.js: each pro plays in their own body
    op = (game / 'js/opponents.js').read_text()
    for pro in entries: op = re.sub(r"(\{id: '%s', character: )'[^']*'" % pro, r"\1'pro_%s'" % pro, op)
    (game / 'js/opponents.js').write_text(op)
    print('done:', ', '.join(done))


if __name__ == '__main__':
    main()
