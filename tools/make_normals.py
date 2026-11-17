"""Normal maps from the people's own textures, so clothes and faces catch the
light with relief (folds and creases, seams, buttons and pockets, the weave of
a waistcoat, the lines of a face) instead of looking printed on.

Heights are read from each texture's light and shade (darker is deeper),
high-passed so only the small relief counts, and evened out where colours
meet, so the edge of a white shirt against a black waistcoat is a seam rather
than a cliff. Writes characters/textures/<id>_<part>_normal.jpg (OpenGL
convention, as glTF uses) and lists each one under 'normals' in
characters/characters.js. Hand-made normal maps already listed are kept.

usage: python3 make_normals.py <game folder>      (then: pack_characters.py <game folder>)
"""
import json, pathlib, re, subprocess, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

STRENGTH = {'body': .75, 'head': .32}     # how deep the relief reads (body: cloth; head: gentle)


def normal_map(path, part):
    img = Image.open(path).convert('RGB')
    a = np.asarray(img, dtype=np.float32) / 255
    lum = .2126 * a[..., 0] + .7152 * a[..., 1] + .0722 * a[..., 2]
    w = img.size[0]
    k = w / 1024                                            # same relief whatever the texture's size
    hp = gaussian_filter(lum, 1.3 * k) - gaussian_filter(lum, 6 * k)
    loc = np.sqrt(gaussian_filter(hp * hp, 14 * k)) + .015  # local contrast: colour edges stay seams
    h = np.tanh(hp / loc * .55)
    if part == 'head':
        h = gaussian_filter(h, 1.6 * k)                     # faces: no grain
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / 2
    gy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) / 2         # +Y is up the image
    s = STRENGTH[part] / max(k, .5)
    n = np.dstack([-gx * s, -gy * s, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return Image.fromarray(np.round((n * .5 + .5) * 255).astype(np.uint8))


def main():
    root = pathlib.Path(sys.argv[1]).resolve()
    manifest = root / 'characters/characters.js'
    man = json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.VELVET_CHARACTERS))",
                                     str(manifest)], capture_output=True, text=True, check=True).stdout)
    src = manifest.read_text()
    made = 0
    for p in man.get('people') or []:
        tex, nrm = p.get('textures') or {}, dict(p.get('normals') or {})
        add = {}
        for part in ('body', 'head'):
            if part not in tex or part in nrm:
                continue
            out = f"characters/textures/{p['id']}_{part}_normal.jpg"
            normal_map(root / tex[part], part).save(root / out, quality=90, optimize=True)
            add[part] = out
            made += 1
        if not add:
            continue
        nrm.update(add)
        # rewrite this person's 'normals' entry (or add one after 'textures')
        block = re.search(r"\{id: '" + re.escape(p['id']) + r"',.*?\}\}", src, re.S)
        if not block:
            print('not found in characters.js:', p['id']); continue
        b = block.group(0)
        text = 'normals: {' + ', '.join(f"{k}: '{v}'" for k, v in nrm.items()) + '}'
        if re.search(r'normals: \{[^}]*\}', b):
            nb = re.sub(r'normals: \{[^}]*\}', text, b)
        else:
            nb = re.sub(r"(textures: \{[^}]*\})", r"\1,\n     " + text.replace('\\', '\\\\'), b, count=1)
        src = src.replace(b, nb)
    manifest.write_text(src)
    print('normal maps made:', made)


if __name__ == '__main__':
    main()
