"""Pack every file named in characters/characters.js into
characters/characters-pack.js, so the game can read them when index.html is
opened straight from disk. (Pack Characters.html does the same in a browser.)

usage: python3 pack_characters.py <game folder>
"""
import base64, json, pathlib, subprocess, sys
root = pathlib.Path(sys.argv[1]).resolve()
man = json.loads(subprocess.run(['node', '-e', "global.window={};require(process.argv[1]);console.log(JSON.stringify(window.VELVET_CHARACTERS))",
                                 str(root / 'characters/characters.js')], capture_output=True, text=True, check=True).stdout)
paths = list((man.get('animations') or {}).values())
for p in man.get('people') or []:
    paths.append(p['model'])
    for k in ('textures', 'normals', 'shine'):
        paths += list((p.get(k) or {}).values())
files, missing = {}, []
for p in dict.fromkeys(paths):
    f = root / p
    if f.is_file():
        files[p] = base64.b64encode(f.read_bytes()).decode()
    else:
        missing.append(p)
out = '/* VELVET characters pack - generated from characters/characters.js; lets the game read these files when opened from disk. */\n'
out += 'window.VELVET_FILES=Object.assign(window.VELVET_FILES||{},{\n' + ',\n'.join(f'{json.dumps(k)}:"{v}"' for k, v in files.items()) + '});\n'
(root / 'characters/characters-pack.js').write_text(out)
print('packed', len(files), 'files,', len(out) // 1024, 'KB; missing:', missing)
