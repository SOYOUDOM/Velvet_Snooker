"""Compress the HD people (characters/hd/*.glb) with gltfpack (meshopt + quantisation, the same as the
Rocketbox models) and rewrite characters/hd.js with the smaller files embedded.

usage: python3 tools/hd_pack.py <game folder> [<folder with new HD .glb files to copy in first>]
Needs gltfpack (npm i -g gltfpack, or npm i gltfpack in tools/node); GLTFPACK=path overrides where it is looked for."""
import base64
import json
import os
import pathlib
import shutil
import struct
import subprocess
import sys
import time

GLTFPACK = (os.environ.get("GLTFPACK") or shutil.which("gltfpack")
            or str(pathlib.Path(__file__).resolve().parent / "node" / "node_modules" / ".bin" / "gltfpack"))


def read_glb(path):
    b = path.read_bytes()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])


def face_names(js):
    names = set()
    for m in js.get("meshes", []):
        names.update((m.get("extras") or {}).get("targetNames") or [])
    return sorted(names)


def main():
    root = pathlib.Path(sys.argv[1])
    hd = root / "characters" / "hd"
    hd.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 2:
        for f in sorted(pathlib.Path(sys.argv[2]).glob("*.glb")):
            shutil.copy(f, hd / f.name)
    hd_js = root / "characters" / "hd.js"
    looks = {}
    if hd_js.is_file():
        for line in hd_js.read_text(encoding="utf-8").splitlines():
            if line.startswith("window.VELVET_HD="):
                looks = json.loads(line[len("window.VELVET_HD="):-1]) or {}
    files = {}
    for f in sorted(hd.glob("*.glb")):
        cid = f.stem
        js = read_glb(f)
        if "EXT_meshopt_compression" not in (js.get("extensionsUsed") or []):
            tmp = f.with_suffix(".packed.glb")
            subprocess.run([GLTFPACK, "-i", str(f), "-o", str(tmp), "-cc", "-kn", "-km", "-ke"], check=True, capture_output=True)
            os.replace(tmp, f)
            js = read_glb(f)
        rel = "characters/hd/" + f.name
        data = f.read_bytes()
        files[rel] = base64.b64encode(data).decode("ascii")
        tris = 0
        for m in js.get("meshes", []):
            for pr in m.get("primitives", []):
                if "indices" in pr:
                    tris += js["accessors"][pr["indices"]]["count"] // 3
        look = looks.get(cid, {})
        look.update({"id": cid, "model": rel, "face": face_names(js) or look.get("face", []), "triangles": tris, "bytes": len(data)})
        look.setdefault("made", time.strftime("%Y-%m-%d %H:%M"))
        looks[cid] = look
        print("%-12s %7.0f KB  %6d triangles  face: %s" % (cid, len(data) / 1024, tris, ",".join(look["face"])))
    looks = {k: v for k, v in looks.items() if "characters/hd/" + k + ".glb" in files}
    head = ("/* VELVET - HD people: the game's own characters rebuilt in Blender (MPFB body, their own face and hair,\n"
            "   eyes that turn and a face that moves). Written by the VELVET Character Maker add-on and tools/hd_pack.py.\n"
            "   Each model is also kept in characters/hd/ as a .glb. Settings: PEOPLE · HD / CLASSIC. */\n")
    body = ("window.VELVET_FILES=Object.assign(window.VELVET_FILES||{}," + json.dumps(files, separators=(",", ":")) + ");\n"
            + "window.VELVET_HD=" + json.dumps(looks, separators=(",", ":"), ensure_ascii=False) + ";\n")
    hd_js.write_text(head + body, encoding="utf-8")
    print("hd.js %.1f MB, %d people" % (hd_js.stat().st_size / 1e6, len(looks)))


if __name__ == "__main__":
    main()
