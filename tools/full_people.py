"""The people at the table at full quality (VELVET 7.0): the nine players and three referees, rebuilt from
the Microsoft Rocketbox originals with their face shapes and full-size textures. The crowd is left as it is.

For each person:
  model        <Avatar>_facial.fbx -> FBX2glTF -> node/full_avatar.mjs: the 52 ARKit and 15 speech face shapes,
               named and checked; checked to have the same skeleton and the same body as the model it replaces
  head         the original 2K texture (the game's heads were the originals at 1K); own faces (Soy Oudom) kept
  head normal  the original 2K normal map; head shine: the original shine (specular) map as a roughness map,
               1K: lips, nose and forehead catch the light, the rest of the skin stays soft
  body         our painted outfit (1K) raised to 2K: the original 2K cloth detail is put back into it, at full
               strength where the outfit is the original (hands, neck) and at the painter's shading strength
               where it was repainted (waistcoat, shirt, trousers)
  body normal  relief from the 2K outfit (make_normals.py), with the original normal map on bare skin (hands,
               neck)
  hair         the original cut-out hair cards, 1K WebP, in the person's own hair colour (six people had lost
               the cut-out and wore solid cards)
and characters.js is updated. It starts from the 6.9 people (read from git), so it can be run again.
Run pack_characters.py afterwards.

usage: python3 -I tools/full_people.py <game folder> <Microsoft-Rocketbox checkout> [id ...]
"""
import io, json, os, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from make_normals import normal_map

# id: (Rocketbox folder, mesh id, model file, own face?)
CAST = {
    'player_01': ('Professions/Business_Male_01', 'm005', 'player_01', False),
    'player_02': ('Professions/Business_Male_03', 'm020', 'player_02', False),
    'pro_m08': ('Adults/Male_Adult_08', 'm014', 'pro_m08', False),
    'pro_m07': ('Adults/Male_Adult_07', 'm013', 'pro_m07', False),
    'pro_m03': ('Adults/Male_Adult_03', 'm004', 'pro_m03', False),
    'pro_b04': ('Professions/Business_Male_04', 'm015', 'pro_b04', False),
    'pro_b02': ('Professions/Business_Male_02', 'm008', 'pro_b02', False),
    'pro_m13': ('Adults/Male_Adult_13', 'm010', 'pro_m13', False),
    'pro_oudom': ('Professions/Business_Male_01', 'm005', 'soy_oudom_the_titan', True),   # his face, on player_01's body
    'referee': ('Professions/Business_Male_06', 'm025', 'referee', False),
    'referee_m2': ('Adults/Male_Adult_04', 'm006', 'referee_m2', False),
    'referee_f1': ('Professions/Business_Female_01', 'f014', 'referee_f1', False),
}
SHARES_BODY = {'pro_oudom': 'player_01'}     # same Rocketbox body: one model file, one head normal and shine map
BASE = os.environ.get('VELVET_BASE', '0e561ef')   # the 6.9 people this starts from

game = pathlib.Path(sys.argv[1]).resolve()
rb = pathlib.Path(sys.argv[2]).resolve() / 'Assets/Avatars'
only = sys.argv[3:]
node_dir = pathlib.Path(__file__).resolve().parent / 'node'
fbx2gltf = node_dir / 'node_modules/fbx2gltf/bin/Linux/FBX2glTF'
work = pathlib.Path('/tmp/velvet_full_people'); work.mkdir(exist_ok=True)
TEX = game / 'characters/textures'
MOD = game / 'characters/models'


def old(rel):
    """A file of the game as it was at BASE (bytes)."""
    r = subprocess.run(['git', 'show', f'{BASE}:{game.name}/{rel}'], cwd=game.parent, capture_output=True)
    if r.returncode: raise FileNotFoundError(rel)
    return r.stdout


def img(src):
    return Image.open(io.BytesIO(old(src)) if isinstance(src, str) else src)


def arr(im): return np.asarray(im, np.float32) / 255
def to_img(a, mode=None): return Image.fromarray(np.clip(np.round(a * 255), 0, 255).astype(np.uint8), mode)
def resize(a, w, h=None): return arr(to_img(a).resize((w, h or w), Image.LANCZOS))
def save_jpg(a, path, q): to_img(a).save(path, quality=q, optimize=True, progressive=True)
def lum(a): return .2126 * a[..., 0] + .7152 * a[..., 1] + .0722 * a[..., 2]


def glb_json(path):
    b = path.read_bytes(); n = int.from_bytes(b[12:16], 'little'); return json.loads(b[20:20 + n])


def model(pid, folder, cur):
    name = folder.split('/')[-1]
    fbx = rb / folder / 'Export' / f'{name}_facial.fbx'
    raw = work / f'{pid}_raw'
    subprocess.run([str(fbx2gltf), '-i', str(fbx), '-o', str(raw), '--binary', '--long-indices', 'auto'], check=True, capture_output=True)
    subprocess.run(['node', 'shape_names.mjs', str(fbx), str(work / f'{pid}_shapes.json')], check=True, capture_output=True, cwd=node_dir)
    prev = work / f'{pid}_6.9.glb'; prev.write_bytes(old(f'characters/models/{cur}.glb'))
    pj = glb_json(prev)
    no_hair = not any(m['name'].endswith('_opacity') for m in pj['materials'])
    out = work / f'{pid}.glb'
    r = subprocess.run(['node', 'full_avatar.mjs', str(raw) + '.glb', str(work / f'{pid}_shapes.json'), str(out)] + (['--no-hair'] if no_hair else []),
                       capture_output=True, text=True, cwd=node_dir)
    if r.returncode: raise SystemExit(f'{pid}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.stdout}')
    rep = json.loads(r.stdout.strip().splitlines()[-1])
    # the same skeleton as the model it replaces (the game's clips, rest and cue poses bind to these names)
    jn = lambda j: [j['nodes'][k]['name'] for k in j['skins'][0]['joints']]
    if jn(glb_json(out)) != jn(pj): raise SystemExit(f'{pid}: skeleton differs from {cur}.glb')
    # the same body: the bind-pose boxes of body and head within 2 mm of the 6.9 model's
    r = subprocess.run(['node', 'bind_boxes.mjs', str(prev), str(out)], check=True, capture_output=True, text=True, cwd=node_dir)
    a, b = json.loads(r.stdout)
    worst = 0
    for k in ('body', 'head'):
        ka = next(n for n in a if n.endswith('_' + k)); kb = next(n for n in b if n.endswith('_' + k))
        worst = max(worst, float(np.abs(np.array(a[ka][:2]) - np.array(b[kb][:2])).max()))
    rep['shapes'] = max(v[3] for v in b.values())
    rep['hair'] = not no_hair
    return out, rep, worst


def head_maps(pid, folder, mid, own):
    T = rb / folder / 'Textures'
    if not own:
        save_jpg(arr(Image.open(T / f'{mid}_head_color.tga').convert('RGB')), TEX / f'{pid}_head.jpg', 90)
    src = SHARES_BODY.get(pid, pid)
    if src == pid:
        save_jpg(arr(Image.open(T / f'{mid}_head_normal.tga').convert('RGB')), TEX / f'{pid}_head_normal.jpg', 92)
        s = np.asarray(Image.open(T / f'{mid}_head_specular.tga').convert('L').resize((1024, 1024), Image.LANCZOS), np.float32)
        s = s / max(np.percentile(s, 99.5), 60)
        r = np.clip(1 - 0.45 * s, 0.5, 1.0)           # x the skin's .62: lips and nose a little glossy, never oily
        Image.fromarray(np.round(r * 255).astype(np.uint8)).save(TEX / f'{pid}_head_shine.jpg', quality=90, optimize=True)
    return f'characters/textures/{src}_head_normal.jpg', f'characters/textures/{src}_head_shine.jpg'


def body_maps(pid, folder, mid):
    T = rb / folder / 'Textures'
    orig = arr(Image.open(T / f'{mid}_body_color.tga').convert('RGB'))
    S = orig.shape[0]
    ours1 = arr(img(f'characters/textures/{pid}_body.jpg').convert('RGB'))
    s1 = ours1.shape[0]
    orig1 = resize(orig, s1)
    # what was repainted (the outfit), at 1K, widened a little and softened, then at 2K
    painted = binary_dilation(np.abs(ours1 - orig1).mean(2) > 0.05, iterations=2)
    pm = gaussian_filter(painted.astype(np.float32), 1.2)
    pm2 = np.asarray(to_img(pm).resize((S, S), Image.BILINEAR), np.float32) / 255
    base = resize(ours1, S)
    L2 = lum(orig)
    low = resize(resize(L2, s1), S)
    ratio = (L2 + .02) / (low + .02)
    # repainted parts take the cloth's fine detail at the strength the painter shades with, never the old tie
    sat = (orig.max(2) - orig.min(2)) / np.maximum(orig.max(2), 1e-3)
    tie = np.clip(gaussian_filter(((sat > .22) & (pm2 > .5)).astype(np.float32), 2), 0, 1)
    detail = (1 - pm2) * (np.clip(ratio, 0.5, 1.8) - 1) + pm2 * (1 - tie) * 0.55 * (np.clip(ratio, 0.8, 1.25) - 1)
    save_jpg(np.clip(base * (1 + detail[..., None]), 0, 1), TEX / f'{pid}_body.jpg', 88)
    # relief: from the new outfit (so folds, seams and buttons sit where the outfit shows them), and the
    # original normal map on bare skin (hands, neck), where the outfit is the original
    gen = arr(normal_map(TEX / f'{pid}_body.jpg', 'body')) * 2 - 1
    real = arr(Image.open(T / f'{mid}_body_normal.tga').convert('RGB')) * 2 - 1
    r_, g_, b_ = orig[..., 0], orig[..., 1], orig[..., 2]
    skin = (r_ > .28) & (r_ > g_) & (g_ > b_) & ((r_ - b_) / np.maximum(r_, 1e-3) > .18) & ((r_ - b_) / np.maximum(r_, 1e-3) < .62)
    w = (np.clip(gaussian_filter(skin.astype(np.float32), 3 * S / 2048), 0, 1) * (1 - pm2))[..., None]
    n = gen * (1 - w) + real * w
    n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-6
    save_jpg(n * .5 + .5, TEX / f'{pid}_body_normal.jpg', 90)
    return float(pm.mean())


def hair_map(pid, folder, mid):
    src = rb / folder / 'Textures' / f'{mid}_opacity_color.tga'
    if not src.exists(): return None
    o = Image.open(src).convert('RGBA')
    w, h = o.size; k = min(1, 1024 / max(w, h)); o = o.resize((round(w * k), round(h * k)), Image.LANCZOS)
    a = arr(o)
    try: cur = img(f'characters/textures/{pid}_opacity.png').convert('RGB')
    except FileNotFoundError: cur = None
    if cur is not None:   # keep the hair colour the game gives this person: a tint over the original's detail
        c = arr(cur.resize(o.size, Image.LANCZOS))
        lo = arr(to_img(a[..., :3]).resize(cur.size, Image.LANCZOS).resize(o.size, Image.LANCZOS))
        a[..., :3] = np.clip(a[..., :3] * np.clip((c + .03) / (lo + .03), 0.6, 1.6), 0, 1)
    to_img(a, 'RGBA').save(TEX / f'{pid}_hair.webp', quality=90, alpha_quality=100, method=6)
    return f'characters/textures/{pid}_hair.webp'


def update_manifest(pid, entry):
    man = game / 'characters/characters.js'
    src = man.read_text()
    a = src.index("{id: '%s'," % pid)
    z = min(e for e in (src.find('\n    {id:', a + 1), src.find('\n  ]', a + 1)) if e > 0)
    b = src[a:z]
    nb = re.sub(r"model: '[^']*'", f"model: '{entry['model']}'", b)
    nb = re.sub(r"textures: \{[^}]*\}", 'textures: {' + ', '.join(f"{k}: '{v}'" for k, v in entry['textures'].items()) + '}', nb)
    nb = re.sub(r"normals: \{[^}]*\}", 'normals: {' + ', '.join(f"{k}: '{v}'" for k, v in entry['normals'].items()) + '}', nb)
    nb = re.sub(r",\s*shine: \{[^}]*\}", '', nb)
    shine = 'shine: {' + ', '.join(f"{k}: '{v}'" for k, v in entry['shine'].items()) + '}'
    nb = re.sub(r"(normals: \{[^}]*\})", lambda m: m.group(1) + ',\n     ' + shine, nb, count=1)
    for k, v in entry.get('extra', {}).items():
        nb = re.sub(rf",\s*{k}: [0-9.]+", '', nb)
        nb = re.sub(r"(height: [0-9.]+)", lambda m: m.group(1) + f', {k}: {v}', nb, count=1)
    man.write_text(src[:a] + nb + src[z:])


def main():
    done = []
    for pid, (folder, mid, cur, own) in CAST.items():
        if only and pid not in only: continue
        share = SHARES_BODY.get(pid)
        if share:
            mfile, rep, worst = f'characters/models/{share}.glb', {'model': 'shared with ' + share}, 0
        else:
            out, rep, worst = model(pid, folder, cur)
            if worst > 0.002: raise SystemExit(f'{pid}: the new body is {worst * 1000:.1f} mm off the old one')
            (MOD / f'{cur}.glb').write_bytes(out.read_bytes())
            mfile = f'characters/models/{cur}.glb'
        hn, hs = head_maps(pid, folder, mid, own)
        painted = body_maps(pid, folder, mid)
        hair = hair_map(pid, folder, mid)
        tex = {'body': f'characters/textures/{pid}_body.jpg', 'head': f'characters/textures/{pid}_head.jpg'}
        if hair: tex['opacity'] = hair
        entry = {'model': mfile, 'textures': tex, 'normals': {'body': f'characters/textures/{pid}_body_normal.jpg', 'head': hn}, 'shine': {'head': hs}}
        if pid == 'pro_oudom': entry['extra'] = {'muscle': '0.8'}       # his build, made at load (it was baked into his old model)
        update_manifest(pid, entry)
        if hair and (TEX / f'{pid}_opacity.png').exists(): (TEX / f'{pid}_opacity.png').unlink()
        rep.update(id=pid, body_mm=round(worst * 1000, 2), repainted=round(painted, 3))
        print(json.dumps(rep), flush=True); done.append(pid)
    print('done:', ', '.join(done))


if __name__ == '__main__':
    main()
