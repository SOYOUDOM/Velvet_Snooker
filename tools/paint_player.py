"""Tailor a Rocketbox business-suit texture into a snooker player's outfit:
waistcoat (any colour) with a V neck and buttons, white shirt sleeves and
front, closed collar with a black bow tie, bare hands. Every texel is classified by its true 3D bind-pose position and
skin weights (rasterised from the mesh in UV space), so edges are smooth and
independent of the triangle layout.

usage: python3 -I paint_player.py mesh.json body.tga out_body.png r,g,b [preview.png]
"""
import json
import re
import sys

import numpy as np
from PIL import Image

mesh_json, body_tga, out_png = sys.argv[1:4]
VEST = [float(v) for v in sys.argv[4].split(',')]          # waistcoat colour (linear-ish 0..1)
preview = sys.argv[5] if len(sys.argv) > 5 and not sys.argv[5].startswith('--') else None

d = json.load(open(mesh_json))
names = d['jointNames']
prim = d['prims']['body']
pos = np.array(prim['pos'], np.float64).reshape(-1, 3)
uv = np.array(prim['uv'], np.float64).reshape(-1, 2)
tri = np.array(prim['idx']).reshape(-1, 3)
joints = np.array(prim['joints']).reshape(-1, 4)
weights = np.array(prim['weights'], np.float64).reshape(-1, 4)


def weight_of(pattern):
    hit = np.array([bool(re.search(pattern, n)) for n in names])
    return (weights * hit[joints]).sum(1)


hand = weight_of(r'Hand|Finger')
arm = weight_of(r'UpperArm|Forearm|Hand|Finger')
foot = weight_of(r'Foot|Toe')
attrs = np.column_stack([pos, hand, arm, foot])  # x, depth(y: front is negative), z(up), hand, arm, foot

src = Image.open(body_tga).convert('RGB')
S = src.size[0]
img = np.asarray(src).astype(np.float64) / 255.0

# --- rasterise every triangle into texel space, interpolating attributes ---
A = np.zeros((S, S, attrs.shape[1]))
covered = np.zeros((S, S), bool)
for t in tri:
    p = uv[t] * S - 0.5
    x0, y0 = np.floor(p.min(0)).astype(int)
    x1, y1 = np.ceil(p.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, S - 1), min(y1, S - 1)
    if x1 < x0 or y1 < y0:
        continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    (ax, ay), (bx, by), (cx, cy) = p
    den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-12:
        continue
    l0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
    l1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
    l2 = 1 - l0 - l1
    inside = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
    if not inside.any():
        continue
    vals = l0[..., None] * attrs[t[0]] + l1[..., None] * attrs[t[1]] + l2[..., None] * attrs[t[2]]
    yy, xx = ys[inside], xs[inside]
    A[yy, xx] = vals[inside]
    covered[yy, xx] = True

X, Y, Z, H, ARM, FOOT = (A[..., i] for i in range(6))
Z = Z * (1.5838 / max(pos[:, 2].max(), 1e-6))   # heights tuned on a 1.584 m body


def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


lum = img.mean(2)
front = smooth(-0.005, -0.035, Y)  # 1 on the chest side (mesh faces -Y)

# Waistcoat: torso between the belt and the shoulders, not on the sleeves,
# open in a V at the front, and stopping below the collar at the back.
Z_BOT, Z_TOP, Z_V, K_V = 0.915, 1.54, 1.235, 0.40
band = smooth(Z_BOT - 0.004, Z_BOT + 0.004, Z) * (1 - smooth(Z_TOP - 0.006, Z_TOP + 0.006, Z))
sleeves = 1 - smooth(0.12, 0.26, ARM)
v_open = smooth(-0.0035, 0.0035, (Z - Z_V) * K_V - np.abs(X)) * front * (Z > Z_V)
neck = smooth(1.455, 1.468, Z) * (1 - smooth(0.085, 0.10, np.abs(X)))
vest = band * sleeves * (1 - v_open) * (1 - neck) * covered

# Gloves: everything skinned mainly to the hands and fingers.
glove = smooth(0.35, 0.6, H) * covered if '--gloves' in sys.argv else np.zeros_like(Z)   # a referee's white gloves
# Shirt: the jacket sleeves (above the hands) and the V opening become white shirt.
sleeve = smooth(0.12, 0.26, ARM) * (1 - smooth(0.10, 0.22, H)) * (Z > Z_BOT) * covered
shirt_zone = np.maximum(sleeve, v_open * band * covered)
# The suit's tie (a strongly coloured strip down the chest) disappears: shirt
# inside the V, waistcoat below it.
mx, mn = img.max(2), img.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-3)
tie = ((sat > 0.22) & (np.abs(X) < 0.07) & (Z > Z_BOT - 0.12) & (Z < 1.5) & (Y < -0.02) & covered).astype(np.float64)
shirt_zone = np.maximum(shirt_zone, tie * (Z > Z_V))
vest = np.maximum(vest, tie * (Z <= Z_V))

# Closed collar: the open-neck shadow inside the V becomes shirt white.
collar_zone = front * smooth(1.40, 1.43, Z) * (1 - smooth(0.055, 0.075, np.abs(X))) * covered

# Bow tie at the top of the V, just under the collar.
bz = 1.468
dx, dz = np.abs(X), Z - bz
wing = (dx < 0.052) & (np.abs(dz) < 0.010 + 0.015 * dx / 0.052)
knot = (dx < 0.0095) & (np.abs(dz) < 0.0115)
bow = ((wing | knot) & (Y < -0.04) & covered).astype(np.float64)

# Four small buttons down the waistcoat front.
buttons = np.zeros_like(Z)
for k in range(4):
    bzk = Z_V - 0.045 - k * 0.068
    buttons = np.maximum(buttons, (np.hypot(X, Z - bzk) < 0.0058) * (Y < -0.05))
buttons *= covered

out = img.copy()
shade = np.clip(lum / max(np.median(lum[(vest > 0.5)]) if (vest > 0.5).any() else 1, 1e-3), 0.55, 1.25)
vest_rgb = np.array(VEST)
vest_col = vest_rgb[None, None, :] * (0.55 + 0.75 * shade[..., None])
# A faint woven sheen keeps the waistcoat from reading as flat black.
out = out * (1 - vest[..., None]) + vest_col * vest[..., None]

shirt = np.clip(0.80 + 0.12 * (lum - 0.5), 0.70, 0.93)
out = out * (1 - collar_zone[..., None]) + shirt[..., None] * np.array([1, 1, 0.985]) * collar_zone[..., None]
s_lum = lum[shirt_zone > 0.5]
s_shade = np.clip(lum / (np.median(s_lum) if s_lum.size else 0.5), 0.75, 1.12)
shirt_col = np.array([0.86, 0.86, 0.85])[None, None, :] * (0.55 + 0.45 * s_shade[..., None])
out = out * (1 - shirt_zone[..., None]) + shirt_col * shirt_zone[..., None]

hand_lum = lum[glove > 0.5]
g_shade = np.clip(lum / (hand_lum.mean() if hand_lum.size else 0.6), 0.6, 1.25)
glove_col = np.array([0.93, 0.93, 0.90])[None, None, :] * (0.70 + 0.30 * g_shade[..., None])
out = out * (1 - glove[..., None]) + glove_col * glove[..., None]

out = out * (1 - bow[..., None]) + np.array([0.012, 0.012, 0.016]) * bow[..., None]

# Below the belt: black dress trousers with their folds, and polished black
# shoes (casual bodies arrive in jeans and trainers).
lower = (1 - smooth(Z_BOT - 0.008, Z_BOT + 0.002, Z)) * (1 - smooth(0.3, 0.5, ARM)) * covered
shoe = smooth(0.35, 0.6, FOOT) * lower
trouser = lower * (1 - shoe)
t_lum = lum[trouser > 0.5]
t_shade = np.clip(lum / (np.median(t_lum) if t_lum.size else 0.4), 0.6, 1.3)
out = out * (1 - trouser[..., None]) + (np.array([0.036, 0.036, 0.042])[None, None, :] * (0.55 + 0.6 * t_shade[..., None])) * trouser[..., None]
sh_lum = lum[shoe > 0.5]
sh_shade = np.clip(lum / (np.median(sh_lum) if sh_lum.size else 0.4), 0.5, 1.6)
out = out * (1 - shoe[..., None]) + (np.array([0.018, 0.018, 0.02])[None, None, :] * (0.5 + 0.9 * sh_shade[..., None])) * shoe[..., None]
btn_col = np.array([0.20, 0.20, 0.22])
out = out * (1 - buttons[..., None]) + btn_col * buttons[..., None]

# Bleed painted colours a few texels into the UV gutters so mipmaps don't
# show the old shirt colour along seams.
changed = (np.abs(out - img).sum(2) > 0.02) & covered
res = out.copy()
mask = changed.copy()
for _ in range(6):
    acc = np.zeros_like(res)
    cnt = np.zeros(mask.shape)
    for sy, sx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        m = np.roll(mask, (sy, sx), (0, 1))
        acc += np.roll(res, (sy, sx), (0, 1)) * m[..., None]
        cnt += m
    grow = (~covered) & (~mask) & (cnt > 0)
    res[grow] = acc[grow] / cnt[grow][:, None]
    mask |= grow

Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).save(out_png)
if preview:
    Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8)).resize((768, 768)).save(preview)
print('painted texels: vest %.0f  shirt %.0f  bow %.0f  collar %.0f' % ((vest > .5).sum(), (shirt_zone > .5).sum(), bow.sum(), (collar_zone > .5).sum()))
