# VELVET Character Maker - geometry for the snooker outfit.
# Garments are lofted from rings around the body: each ring is the convex
# outline of a slice of the body (so cloth bridges hollows the way fabric does)
# pushed out by the garment's ease, described as a radius for every angle
# around a centre. Rings are smoothed against each other, never closer to the
# body than their ease, then turned into clean quad grids that can be cut
# along smooth curves (necklines, armholes, hems).
import math

import bmesh
import numpy as np

TAU = 2.0 * math.pi


# ------------------------------------------------------------------ 2D outlines
def hull2d(P):
    """Convex hull of 2D points, counter-clockwise."""
    P = np.unique(np.round(np.asarray(P, float), 5), axis=0)
    if len(P) < 3:
        return P
    P = P[np.lexsort((P[:, 1], P[:, 0]))]

    def half(points):
        out = []
        for p in points:
            while len(out) >= 2 and ((out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0])) <= 0:
                out.pop()
            out.append(p)
        return out
    lower, upper = half(P), half(P[::-1])
    return np.array(lower[:-1] + upper[:-1])


def resample_closed(poly, n):
    seg = np.roll(poly, -1, 0) - poly
    L = np.hypot(seg[:, 0], seg[:, 1])
    cum = np.concatenate([[0.0], np.cumsum(L)])
    s = np.arange(n) / n * cum[-1]
    i = np.clip(np.searchsorted(cum, s, side="right") - 1, 0, len(poly) - 1)
    t = (s - cum[i]) / np.maximum(L[i], 1e-12)
    return poly[i] + seg[i] * t[:, None]


def offset_closed(poly, d):
    """Push a counter-clockwise outline out along its normals (d: number or one per point)."""
    tng = np.roll(poly, -1, 0) - np.roll(poly, 1, 0)
    tng /= np.linalg.norm(tng, axis=1)[:, None] + 1e-12
    nrm = np.stack([tng[:, 1], -tng[:, 0]], 1)
    return poly + nrm * (np.asarray(d)[:, None] if np.ndim(d) else d)


def smooth_closed(poly, it=2, k=0.4):
    for _ in range(it):
        poly = poly + k * ((np.roll(poly, 1, 0) + np.roll(poly, -1, 0)) * 0.5 - poly)
    return poly


class Polar:
    """A closed outline around the origin as radius by angle."""

    def __init__(self, poly):
        a = np.arctan2(poly[:, 1], poly[:, 0])
        o = np.argsort(a)
        self.a, self.r = a[o], np.hypot(poly[o, 0], poly[o, 1])

    def __call__(self, th):
        return np.interp(np.mod(np.asarray(th) + math.pi, TAU) - math.pi, self.a, self.r, period=TAU)


def outline(points2d, ease):
    """Polar outline of the convex hull of the points, pushed out by ease(angle) metres."""
    H = hull2d(points2d)
    if len(H) < 3:
        return None
    D = resample_closed(H, 240)
    D = offset_closed(D, ease(np.arctan2(D[:, 1], D[:, 0])))
    return Polar(smooth_closed(D, 3))


# ------------------------------------------------------------------ grids
def relax(R, Rmin, it=24, k=0.5, closed=True, w_row=1.0, w_col=0.6, fixed_rows=()):
    """Smooth radii like cloth under tension, never inside Rmin."""
    R = np.maximum(R, Rmin)
    for _ in range(it):
        up = np.vstack([R[1:], R[-1:]])
        dn = np.vstack([R[:1], R[:-1]])
        if closed:
            lf, rt = np.roll(R, 1, 1), np.roll(R, -1, 1)
        else:
            lf = np.hstack([R[:, :1], R[:, :-1]])
            rt = np.hstack([R[:, 1:], R[:, -1:]])
        avg = (w_row * (up + dn) + w_col * (lf + rt)) / (2 * w_row + 2 * w_col)
        new = R + k * (avg - R)
        for r in fixed_rows:
            new[r] = R[r]
        R = np.maximum(new, Rmin)
    return R


def points(O, U, Vv, TH, R):
    """3D points of a grid: row frames (O, U, V), angles TH and radii R (rows x cols)."""
    c, s = np.cos(TH), np.sin(TH)
    return O[:, None, :] + R[..., None] * (c[..., None] * U[:, None, :] + s[..., None] * Vv[:, None, :])


def grid_bm(P, closed, flip=False, mat=0, bm=None):
    """Quads between rows of points (rows x cols x 3)."""
    bm = bm or bmesh.new()
    rows, cols = P.shape[:2]
    vs = [[bm.verts.new(P[k, j]) for j in range(cols)] for k in range(rows)]
    for k in range(rows - 1):
        for j in range(cols if closed else cols - 1):
            j2 = (j + 1) % cols
            q = [vs[k][j], vs[k][j2], vs[k + 1][j2], vs[k + 1][j]]
            if flip:
                q.reverse()
            try:
                f = bm.faces.new(q)
                f.material_index = mat
                f.smooth = True
            except ValueError:
                pass
    return bm, vs


def coords(bm):
    return np.array([v.co[:] for v in bm.verts]) if len(bm.verts) else np.zeros((0, 3))


def trim(bm, f):
    """Cut the mesh along the zero line of f (numpy function of N x 3 points) and keep f >= 0."""
    bm.verts.ensure_lookup_table()
    vals = f(coords(bm))
    val = {v: (x if abs(x) > 1e-9 else 1e-9) for v, x in zip(bm.verts, vals)}
    cut = set()
    for e in list(bm.edges):
        a, b = e.verts
        fa, fb = val[a], val[b]
        if (fa < 0) != (fb < 0):
            t = fa / (fa - fb)
            _ne, nv = bmesh.utils.edge_split(e, a, t)
            val[nv] = 0.0
            cut.add(nv)
    for face in list(bm.faces):
        zs = [v for v in face.verts if v in cut]
        if len(zs) == 2 and not any(e.other_vert(zs[0]) is zs[1] for e in zs[0].link_edges if e in face.edges):
            try:
                bmesh.utils.face_split(face, zs[0], zs[1])
            except Exception:
                pass
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if val.get(v, 1.0) < 0], context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0006)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=0.0004)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    return bm


def merge(parts):
    """One mesh from several bmeshes: [(bm, zone)] -> (bm, zone per vertex)."""
    out = bmesh.new()
    zones = []
    for bm, zone in parts:
        m = {}
        for v in bm.verts:
            m[v] = out.verts.new(v.co)
            zones.append(zone(v.co) if callable(zone) else zone)
        for f in bm.faces:
            try:
                nf = out.faces.new([m[v] for v in f.verts])
                nf.material_index = f.material_index
                nf.smooth = f.smooth
            except ValueError:
                pass
        bm.free()
    return out, zones


def orient_out(bm, centre_fn):
    """Flip faces whose normal points towards centre_fn(face centre)."""
    bm.normal_update()
    flip = []
    for f in bm.faces:
        c = f.calc_center_median()
        if (c - centre_fn(c)).dot(f.normal) < 0:
            flip.append(f)
    if flip:
        bmesh.ops.reverse_faces(bm, faces=flip)
    bm.normal_update()


# ------------------------------------------------------------------ frames
def rmf(C, T, n0):
    """Rotation-minimising frames along a curve (points C, unit tangents T), first normal n0."""
    N = [n0 / np.linalg.norm(n0)]
    for i in range(1, len(C)):
        v1 = C[i] - C[i - 1]
        c1 = v1 @ v1
        if c1 < 1e-14:
            N.append(N[-1])
            continue
        rL = N[-1] - (2 / c1) * (v1 @ N[-1]) * v1
        tL = T[i - 1] - (2 / c1) * (v1 @ T[i - 1]) * v1
        v2 = T[i] - tL
        c2 = v2 @ v2
        r = rL - (2 / c2) * (v2 @ rL) * v2 if c2 > 1e-14 else rL
        r = r - (r @ T[i]) * T[i]
        N.append(r / np.linalg.norm(r))
    N = np.array(N)
    return N, np.cross(T, N)


def fillet_path(pts, radius, step):
    """Points and tangents every `step` metres along a polyline whose corners are rounded."""
    pts = [np.asarray(p, float) for p in pts]
    segs = []                                          # (kind, data, length)
    start = pts[0]
    for i in range(1, len(pts) - 1):
        d1 = pts[i] - pts[i - 1]
        d1 /= np.linalg.norm(d1)
        d2 = pts[i + 1] - pts[i]
        d2 /= np.linalg.norm(d2)
        ang = math.acos(max(-1.0, min(1.0, float(d1 @ d2))))
        lt = radius * math.tan(ang / 2) if ang > 1e-3 else 0.0
        a, b = pts[i] - d1 * lt, pts[i] + d2 * lt
        segs.append(("line", (start, a), np.linalg.norm(a - start)))
        if lt > 0:
            segs.append(("arc", (a, b, d1, d2, ang), radius * ang))
        start = b
    segs.append(("line", (start, pts[-1]), np.linalg.norm(pts[-1] - start)))
    total = sum(s[2] for s in segs)
    out_p, out_t, out_s = [], [], []
    for s in np.arange(0.0, total + 1e-9, step):
        acc = 0.0
        for si, (kind, d, L) in enumerate(segs):
            if s <= acc + L + 1e-12 or si == len(segs) - 1:
                u = (s - acc) / L if L > 1e-12 else 0.0
                if kind == "line":
                    p0, p1 = d
                    t = (p1 - p0) / max(L, 1e-12)
                    out_p.append(p0 + (p1 - p0) * u)
                    out_t.append(t)
                else:
                    a, b, d1, d2, ang = d
                    phi = ang * u                      # rotate d1 towards d2 by phi
                    axis = np.cross(d1, d2)
                    axis /= np.linalg.norm(axis)
                    t = d1 * math.cos(phi) + np.cross(axis, d1) * math.sin(phi)
                    centre = a + np.cross(axis, d1) * radius
                    out_p.append(centre - np.cross(axis, t) * radius)
                    out_t.append(t)
                out_s.append(s)
                break
            acc += L
    return np.array(out_p), np.array(out_t), np.array(out_s)
