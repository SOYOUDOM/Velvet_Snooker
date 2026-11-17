"""Clean up the painted player outfits (VELVET 6.8).

The players' waistcoats were painted onto Rocketbox textures, and a few of
them kept bits of the old shirt and tie: white specks on the waistcoat, a
noisy patch under the bow tie, a white block where the V-neck should close.
This rebuilds those V-necks from the clean rows just above them and removes
the specks.

usage: python3 clean_textures.py <game folder>      (then run pack_characters.py)
Run it once: it changes the files in characters/textures.
"""
import pathlib, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# V-necks to rebuild: template row (y), the V's left/right edge there, the apex, the box to repaint.
VNECKS = {
    'player_01': dict(top=566, l=482, r=543, apex=(512.5, 621), box=(466, 567, 561, 646)),
    'pro_m03': dict(top=600, l=490, r=532, apex=(508, 648), box=(462, 601, 560, 660), coat='keep'),
    'pro_b02': dict(top=536, l=467, r=556, apex=(512, 584), box=(462, 537, 562, 632)),
    'pro_m13': dict(top=594, l=486, r=536, apex=(509, 647), box=(462, 595, 561, 663), coat=38),
    'pro_m08': dict(top=548, l=469, r=554, apex=(512, 655), box=(463, 549, 561, 662)),
    'pro_m07': dict(top=552, l=465, r=559, apex=(512, 640), box=(460, 553, 565, 680)),
}
# coat: how the waistcoat round the rebuilt V is filled: 'fill' (its colour, for plain cloth), 'keep' (the
# original, less any bright leftovers) or a number (copied from that many rows lower: the pattern's repeat).
# Where stray specks are removed (x0, y0, x1, y1): the waistcoat fronts and side panels.
SPECKS = {
    'player_01': [(430, 540, 600, 690), (300, 470, 400, 640), (610, 470, 720, 640)],
    'pro_m03': [(430, 540, 600, 690)],
    'pro_b04': [(420, 540, 620, 690), (300, 560, 360, 620), (650, 560, 750, 620)],
    'pro_b02': [(430, 540, 600, 690), (330, 470, 400, 620), (620, 470, 690, 600)],
    'pro_m13': [(430, 540, 600, 700)],
}


def band(a, y, x0, x1):
    """Median colour of the darker pixels of a short horizontal band (rows y-3..y+3)."""
    px = a[max(0, y - 3):y + 4, x0:x1].reshape(-1, 3)
    lum = px.mean(1)
    keep = px[lum <= np.percentile(lum, 70)]
    return np.median(keep, 0)


def rebuild_v(a, top, l, r, apex, box, coat='fill'):
    x0, y0, x1, y1 = box
    ax, ay = apex
    a0 = a.copy()
    tmpl = a[top - 2:top + 1].mean(0)                       # the last clean rows, averaged
    xs = np.arange(a.shape[1], dtype=float)
    rng = np.random.default_rng(7)
    for y in range(y0, y1):
        t = (y - top) / (ay - top)
        lo, hi = l + (ax - l) * t, r + (ax - r) * t           # the V's edges on this row
        wl, wr = band(a, y, x0 - 12, x0 - 2), band(a, y, x1 + 2, x1 + 12)
        for x in range(x0, x1):
            u = (x - x0) / max(1, x1 - x0 - 1)
            plain = wl * (1 - u) + wr * u
            if coat == 'keep':
                cloth = a0[y, x] if a0[y, x].mean() < plain.mean() + 40 else plain + rng.normal(0, 1.6, 3)
            elif isinstance(coat, int):
                sy = y + coat
                while sy < y1:
                    sy += coat
                cloth = a0[sy, x]
            else:
                cloth = plain + rng.normal(0, 1.6, 3)
            cov = 0.0
            if t < 1 and hi - lo > 0.05:
                cov = np.clip(min(x + 0.5 - lo, hi - (x - 0.5)), 0, 1)
            if cov > 0:
                s = l + (x - lo) / (hi - lo) * (r - l)        # where this point sits on the template row
                shirt = np.array([np.interp(s, xs, tmpl[:, c]) for c in range(3)])
                a[y, x] = shirt * cov + cloth * (1 - cov)
            else:
                a[y, x] = cloth


def despeckle(a, box, thr=55, max_area=40):
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    lum = sub.mean(2)
    salt = (lum - ndi.median_filter(lum, size=9)) > thr
    lab, n = ndi.label(salt)
    if not n:
        return 0
    area = ndi.sum(salt, lab, range(1, n + 1))
    small = np.isin(lab, 1 + np.where(area <= max_area)[0])
    small = ndi.binary_dilation(small, iterations=1)       # with the JPEG halo round each speck
    clean = np.stack([ndi.median_filter(sub[..., c], size=9) for c in range(3)], -1)
    sub[small] = clean[small]
    return int(small.sum())


def main(root):
    tex = root / 'characters' / 'textures'
    for name in sorted(set(VNECKS) | set(SPECKS)):
        path = tex / f'{name}_body.jpg'
        a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
        n = sum(despeckle(a, b) for b in SPECKS.get(name, []))
        if name in VNECKS:
            rebuild_v(a, **VNECKS[name])
        Image.fromarray(a.round().clip(0, 255).astype(np.uint8)).save(path, quality=93, subsampling=0)
        print(f'{path.name}: {n} speck pixels' + (', V-neck rebuilt' if name in VNECKS else ''))


if __name__ == '__main__':
    main(pathlib.Path(sys.argv[1]).resolve())
