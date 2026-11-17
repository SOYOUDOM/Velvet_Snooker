# VELVET Character Maker - a snooker outfit tailored to the person's body.
# Shirt (collar, cuffs, button strip), waistcoat (V neck, armholes, pointed
# front, buttons, pockets, satin back with a strap), trousers (waistband,
# crease, straight legs), socks, shoes (sole, heel, toe box) and a bow tie.
# Every piece is built from rings fitted around the body (see cloth.py), so
# it hangs like cloth instead of copying the skin, fits any MPFB shape and
# moves with the skeleton. The skin under the clothes is hidden.
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

from . import cloth as C

DEFAULTS = {"shirt": (0.86, 0.86, 0.84, 1), "waistcoat": (0.018, 0.018, 0.022, 1), "trousers": (0.02, 0.02, 0.024, 1),
            "shoes": (0.012, 0.012, 0.012, 1), "bowtie": (0.015, 0.015, 0.018, 1)}
HIDE_GROUP = "velvet under clothes"
HIDE_MOD = "VELVET hide under clothes"
UP = np.array([0.0, 0.0, 1.0])
FRONT = np.array([0.0, -1.0, 0.0])
LEFT = np.array([1.0, 0.0, 0.0])
BACK = np.array([0.0, 1.0, 0.0])
TORSO = ("pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "neck_01")
ZONES = {
    "torso": TORSO,            # shirt body and waistcoat move together with the chest (layers never cross);
    "vest": TORSO,             # the sleeves follow the arms and slide out from under the shoulders
    "neck": ("neck_01", "spine_03", "clavicle_l", "clavicle_r"),
    "shoulder_l": TORSO + ("upperarm_l",),                  # the top of a sleeve bends like the skin of the armpit
    "shoulder_r": TORSO + ("upperarm_r",),
    "arm_l": ("clavicle_l", "upperarm_l", "lowerarm_l", "hand_l"),
    "arm_r": ("clavicle_r", "upperarm_r", "lowerarm_r", "hand_r"),
    "hips": ("pelvis", "spine_01", "thigh_l", "thigh_r"),
    "leg_l": ("pelvis", "thigh_l", "calf_l"),
    "leg_r": ("pelvis", "thigh_r", "calf_r"),
    "foot_l": ("calf_l", "foot_l", "ball_l"),
    "foot_r": ("calf_r", "foot_r", "ball_r"),
}


# ============================================================== public
def remove(body):
    """Take the outfit off (and show the skin again)."""
    for ob in [o for o in bpy.data.objects if o.get("velvet_outfit_of") == body.name]:
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if data is not None and data.users == 0:
            bpy.data.meshes.remove(data)
    for m in [m for m in bpy.data.materials if m.name.startswith("VELVET ") and m.users == 0]:
        bpy.data.materials.remove(m)
    md = body.modifiers.get(HIDE_MOD)
    if md:
        body.modifiers.remove(md)
    g = body.vertex_groups.get(HIDE_GROUP)
    if g:
        body.vertex_groups.remove(g)


def pieces(body):
    return [o for o in bpy.data.objects if o.get("velvet_outfit_of") == body.name]


def _shape_mesh(body):
    """The body's mesh in its current shape (sliders applied), not posed, with its groups."""
    states = {md.name: md.show_viewport for md in body.modifiers}
    for md in body.modifiers:
        md.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(body.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    for md in body.modifiers:
        md.show_viewport = states[md.name]
    return me


def make(body, rig, colors=None):
    """Dress the person in a snooker outfit (replaces an earlier one)."""
    if rig is None:
        raise RuntimeError("Add the game skeleton first: the outfit takes its weights from it.")
    missing = [b for b in ("pelvis", "spine_03", "neck_01", "head", "upperarm_l", "lowerarm_l", "hand_l", "thigh_l", "calf_l", "foot_l", "ball_l")
               if b not in rig.data.bones]
    if missing:
        raise RuntimeError("This skeleton is not the game's (missing %s)" % ", ".join(missing))
    remove(body)
    colors = dict(DEFAULTS, **(colors or {}))
    B = Body(body, rig)
    T = Tailor(B, colors)
    made = T.sew(body, rig)
    T.hide_skin(body, made)
    return made


# ============================================================== the body
class Body:
    def __init__(self, body, rig):
        me = _shape_mesh(body)
        n = len(me.vertices)
        V = np.empty(n * 3)
        me.vertices.foreach_get("co", V)
        self.V = V.reshape(n, 3)
        self.Vm = self.V * np.array([-1.0, 1.0, 1.0])
        E = np.empty(len(me.edges) * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", E)
        self.E = E.reshape(-1, 2)
        names = {g.index: g.name for g in body.vertex_groups}
        self.bones = [b.name for b in rig.data.bones]
        self.bid = {b: i for i, b in enumerate(self.bones)}
        W = np.zeros((n, len(self.bones)), np.float32)
        inb = np.zeros(n, bool)
        for v in me.vertices:
            for g in v.groups:
                nm = names.get(g.group)
                j = self.bid.get(nm)
                if j is not None:
                    W[v.index, j] = g.weight
                elif nm == "body" and g.weight > 0.5:
                    inb[v.index] = True
        bpy.data.meshes.remove(me)
        self.W = W
        self.inb = inb if "body" in names.values() else np.ones(n, bool)
        self.dom = np.where(W.max(1) > 0, W.argmax(1), -1)
        self.head = {b.name: np.array(b.head_local[:]) for b in rig.data.bones}
        self.tail = {b.name: np.array(b.tail_local[:]) for b in rig.data.bones}
        feet = self.mask(("foot_l", "foot_r", "ball_l", "ball_r"))
        self.floor = float(self.V[feet, 2].min()) if feet.any() else 0.0
        self.top = float(self.V[self.inb, 2].max())
        self.k = (self.top - self.floor) / 1.75
        self.crotch = self._crotch()

    def mask(self, names):
        ids = [self.bid[n] for n in names if n in self.bid]
        return self.inb & np.isin(self.dom, ids)

    def edges(self, names):
        m = self.mask(names)
        return self.E[m[self.E[:, 0]] & m[self.E[:, 1]]]

    def bone(self, name, end="head", mirror=False):
        p = (self.head if end == "head" else self.tail)[name].copy()
        if mirror:
            p[0] = -p[0]
        return p

    def slice(self, E, O, nrm, U, Vv, mirror=False, radius=None):
        """Where the plane (O, nrm) cuts the body's edges E, in the plane's (U, V) coordinates."""
        X = self.Vm if mirror else self.V
        d = (X - O) @ nrm
        a, b = E[:, 0], E[:, 1]
        da, db = d[a], d[b]
        m = (da > 0) != (db > 0)
        a, b, da, db = a[m], b[m], da[m], db[m]
        t = da / (da - db)
        P = X[a] + (X[b] - X[a]) * t[:, None] - O
        Q = np.stack([P @ U, P @ Vv], 1)
        if radius is not None:
            Q = Q[(Q * Q).sum(1) < radius * radius]
        return Q

    def _crotch(self):
        E = self.edges(("pelvis", "thigh_l", "thigh_r"))
        z0 = self.head["pelvis"][2]
        for z in np.arange(z0 - 0.3 * self.k, z0 + 0.05, 0.003):
            Q = self.slice(E, np.array([0.0, 0.0, z]), UP, LEFT, BACK)
            if len(Q) and np.abs(Q[:, 0]).min() < 0.004:
                return float(z)
        return float(z0 - 0.08 * self.k)


def _fill(a):
    a = np.array(a, float)
    ok = ~np.isnan(a)
    if not ok.any():
        return np.zeros_like(a)
    idx = np.arange(len(a))
    return np.interp(idx, idx[ok], a[ok])


def _smooth1d(a, w):
    if w <= 0 or len(a) < 3:
        return a
    p = np.pad(a, w, mode="edge")
    return np.convolve(p, np.ones(2 * w + 1) / (2 * w + 1), mode="valid")


def _fill_rows(R):
    """Rows of NaN (slices that missed the body) take the nearest good row."""
    bad = np.isnan(R).any(1)
    if bad.all():
        raise RuntimeError("The body could not be measured")
    good = np.where(~bad)[0]
    for k in np.where(bad)[0]:
        R[k] = R[good[np.argmin(np.abs(good - k))]]
    return R


# ============================================================== shells (for inside tests)
class RowShell:
    """A garment made of horizontal rings around x = 0 (shirt, waistcoat)."""

    def __init__(self, zs, yc, R):
        self.zs, self.yc, self.R = np.asarray(zs), np.asarray(yc), R
        self.n = R.shape[1]

    def radius(self, z, th):
        k = np.clip(np.searchsorted(self.zs, z) - 1, 0, len(self.zs) - 2)
        t = np.clip((z - self.zs[k]) / np.maximum(self.zs[k + 1] - self.zs[k], 1e-9), 0, 1)
        x = np.mod(th, C.TAU) / C.TAU * self.n
        j0 = np.floor(x).astype(int) % self.n
        j1 = (j0 + 1) % self.n
        f = x - np.floor(x)
        r0 = self.R[k, j0] * (1 - f) + self.R[k, j1] * f
        r1 = self.R[k + 1, j0] * (1 - f) + self.R[k + 1, j1] * f
        return r0 * (1 - t) + r1 * t, self.yc[k] * (1 - t) + self.yc[k + 1] * t

    def f(self, Q):
        """Signed distance-like value: > 0 outside the garment."""
        z = Q[:, 2]
        yc = np.interp(z, self.zs, self.yc)
        u, v = -(Q[:, 1] - yc), Q[:, 0]
        th = np.arctan2(v, u)
        r = np.hypot(u, v)
        R, _ = self.radius(z, th)
        out = r - R
        out[(z < self.zs[0]) | (z > self.zs[-1])] = 1.0
        return out

    def point(self, z, th, extra=0.0):
        R, yc = self.radius(np.atleast_1d(z), np.atleast_1d(th))
        th = np.atleast_1d(th)
        return np.stack([(R + extra) * np.sin(th), yc - (R + extra) * np.cos(th), np.broadcast_to(z, R.shape)], 1)


class TubeShell:
    """A garment made of rings along a curve (sleeves)."""

    def __init__(self, O, T, U, Vv, R, s, mirror=False):
        self.O, self.T, self.U, self.V, self.R, self.s = O, T, U, Vv, R, s
        self.n = R.shape[1]

    def f(self, Q, margin=None, rmax=0.2):
        d = np.einsum("nkc,kc->nk", Q[:, None, :] - self.O[None], self.T)          # along the axis, per station
        k = np.argmin(np.abs(d), 1)
        dk = d[np.arange(len(Q)), k]
        P = Q - self.O[k]
        u = np.einsum("nc,nc->n", P, self.U[k])
        v = np.einsum("nc,nc->n", P, self.V[k])
        th = np.arctan2(v, u)
        r = np.hypot(u, v)
        x = np.mod(th, C.TAU) / C.TAU * self.n
        j0 = np.floor(x).astype(int) % self.n
        f = x - np.floor(x)
        R = self.R[k, j0] * (1 - f) + self.R[k, (j0 + 1) % self.n] * f
        if margin is not None:
            R = R + margin(th, k)
        out = r - R
        step = np.median(np.diff(self.s)) if len(self.s) > 1 else 0.01
        out[(np.abs(dk) > step * 1.5) | (r > rmax)] = 1.0
        return out


# ============================================================== the tailor
class Tailor:
    def __init__(self, B, colors):
        self.B, self.colors = B, colors
        k = B.k
        self.k = k
        hd = B.head
        self.z_wt = float(hd["spine_01"][2] + 0.004 * k)                 # top of the trousers
        self.z_tuck = self.z_wt - 0.07 * k                               # shirt tail, inside the trousers
        self.shoulder_z = float(hd["upperarm_l"][2])
        self.armpit_z = self.shoulder_z - 0.075 * k
        self.N0 = hd["neck_01"].copy()                                   # neck base and neck axis
        a = hd["head"] - hd["neck_01"]
        self.a = a / np.linalg.norm(a)
        u = FRONT - (FRONT @ self.a) * self.a
        self.cu = u / np.linalg.norm(u)
        self.cv = np.cross(self.a, self.cu)
        self.z_top = float(self.N0[2] + 0.045 * k)
        self.z_low = self.z_wt - 0.13 * k
        self.objects = {}

    # ---------------------------------------------------------------- torso rows
    def torso_rows(self):
        B, k = self.B, self.k
        zs = list(np.arange(self.z_low, self.armpit_z - 0.03 * k, 0.012 * k))
        zs += list(np.arange(zs[-1] + 0.012 * k, self.z_top + 1e-6, 0.0065 * k))
        zs = np.array(zs)
        E = B.edges(TORSO)
        E_cap = B.edges(TORSO + ("upperarm_l", "upperarm_r"))
        sx = abs(float(B.head["upperarm_l"][0]))
        xlim_top = sx + 0.012 * k
        pts, caps = [], []
        z0, z1 = self.shoulder_z - 0.04 * k, self.shoulder_z + 0.012 * k      # over the top of the shoulder the shirt covers the cap of the arm
        for z in zs:
            Q = B.slice(E, np.array([0.0, 0.0, z]), UP, LEFT, BACK)
            if z > self.armpit_z - 0.02 * k and len(Q):
                Q = Q[np.abs(Q[:, 0]) <= xlim_top]
            pts.append(Q)
            if z > z0:
                Qc = B.slice(E_cap, np.array([0.0, 0.0, z]), UP, LEFT, BACK)
                Qc = Qc[np.abs(Qc[:, 0]) <= sx + 0.036 * k] if len(Qc) else Qc
                w = float(np.clip((z - z0) / (z1 - z0), 0, 1))
                caps.append((Qc, w * w * (3 - 2 * w)))
            else:
                caps.append(None)
        self.t_caps = caps
        yc = np.array([0.5 * (Q[:, 1].min() + Q[:, 1].max()) if len(Q) > 6 else np.nan for Q in pts])
        self.t_zs, self.t_pts, self.t_yc = zs, pts, _smooth1d(_fill(yc), 2)
        self.t_n = 96
        self.t_th = np.tile(np.arange(self.t_n) / self.t_n * C.TAU, (len(zs), 1))

    def torso_rmin(self, ease):
        R = np.full(self.t_th.shape, np.nan)
        for kk, Q in enumerate(self.t_pts):
            e = float(ease[kk])
            r = None
            if len(Q) >= 6:
                q = np.stack([-(Q[:, 1] - self.t_yc[kk]), Q[:, 0]], 1)
                prof = C.outline(q, lambda a, e=e: np.full(np.shape(a), e))
                r = prof(self.t_th[kk]) if prof is not None else None
            cap = self.t_caps[kk]
            if cap is not None and len(cap[0]) >= 6:            # blend towards the outline that covers the top of the arms
                qc = np.stack([-(cap[0][:, 1] - self.t_yc[kk]), cap[0][:, 0]], 1)
                pc = C.outline(qc, lambda a, e=e: np.full(np.shape(a), e))
                if pc is not None:
                    rc = pc(self.t_th[kk])
                    r = rc if r is None else r + (np.maximum(r, rc) - r) * cap[1]
            if r is not None:
                R[kk] = r
        return _fill_rows(R)

    def torso_points(self, R):
        n = len(self.t_zs)
        O = np.stack([np.zeros(n), self.t_yc, self.t_zs], 1)
        return C.points(O, np.tile(FRONT, (n, 1)), np.tile(LEFT, (n, 1)), self.t_th, R)

    def ease_shirt(self, z):
        k = self.k
        zs = [self.z_low, self.z_tuck, self.z_wt - 0.01 * k, self.z_wt + 0.05 * k, self.armpit_z - 0.1 * k, self.armpit_z, self.shoulder_z + 0.02 * k, self.z_top]
        es = [0.0022, 0.0022, 0.0028, 0.008, 0.0105, 0.0095, 0.0055, 0.005]
        return np.interp(z, zs, np.array(es) * k)

    def ease_trousers_top(self, z):
        k = self.k
        return np.interp(z, [self.z_wt - 0.2 * k, self.z_wt - 0.08 * k, self.z_wt], [0.010 * k, 0.0075 * k, 0.0062 * k])

    # ---------------------------------------------------------------- sleeves
    def arm_axis(self, side):
        B, k = self.B, self.k
        S, E, W = B.head["upperarm_" + side], B.head["lowerarm_" + side], B.head["hand_" + side]
        d0 = (E - S) / np.linalg.norm(E - S)
        d2 = (W - E) / np.linalg.norm(W - E)
        start, end = S - d0 * 0.03 * k, W + d2 * 0.006 * k
        Cs, Ts, ss = C.fillet_path([start, E, end], 0.075 * k, 0.011 * k)
        n0 = UP - (UP @ Ts[0]) * Ts[0]
        N, Bv = C.rmf(Cs, Ts, n0)
        s_wrist = ss[-1] - 0.006 * k
        s_elbow = float(np.argmin(np.linalg.norm(Cs - E, axis=1)))
        return Cs, Ts, N, Bv, ss, s_wrist, ss[int(s_elbow)]

    def sleeve(self, side):
        B, k = self.B, self.k
        Cs, Ts, N, Bv, ss, s_wrist, s_elbow = self.arm_axis(side)
        n = 40
        TH = np.tile(np.arange(n) / n * C.TAU, (len(ss), 1))
        names_main = ("upperarm_" + side, "lowerarm_" + side)
        E_main = B.edges(names_main)
        E_top = B.edges(names_main + ("clavicle_" + side,))
        E_end = B.edges(names_main + ("hand_" + side,))
        s_cuff = s_wrist - 0.065 * k
        Rmin = np.full(TH.shape, np.nan)
        Rcuff = []
        for i, s in enumerate(ss):
            E = E_end if s > s_wrist - 0.02 * k else E_main
            Q = B.slice(E, Cs[i], Ts[i], N[i], Bv[i], radius=0.11 * k)
            if len(Q) < 6:
                continue
            down = -UP
            th_down = math.atan2(down @ Bv[i], down @ N[i])
            # loose at the bottom, close on top; narrower down the forearm, gathered into the cuff
            e_top = np.interp(s, [0.0, 0.045 * k, 0.09 * k, s_elbow - 0.05 * k, s_elbow + 0.04 * k, s_cuff - 0.05 * k, s_cuff, ss[-1]],
                              np.array([0.0018, 0.0022, 0.006, 0.007, 0.008, 0.0055, 0.006, 0.006]) * k)
            e_bot = np.interp(s, [0, 0.06 * k, s_elbow - 0.09 * k, s_elbow, s_elbow + 0.06 * k, s_cuff - 0.05 * k, s_cuff, ss[-1]],
                              np.array([0.010, 0.018, 0.017, 0.012, 0.013, 0.012, 0.006, 0.006]) * k)
            prof = C.outline(Q, lambda a, et=e_top, eb=e_bot, td=th_down: et + (eb - et) * 0.5 * (1 + np.cos(a - td)))
            if prof is None:
                continue
            Rmin[i] = prof(TH[i])
            if s >= s_cuff - 1e-6:
                Rcuff.append(C.outline(Q, lambda a: np.full(np.shape(a), 0.0085 * k))(TH[i]))
        Rmin = _fill_rows(Rmin)
        cuff = np.max(np.array(Rcuff), 0) if Rcuff else Rmin[-1] + 0.003 * k
        cuff = C.smooth_closed(np.stack([cuff, np.zeros_like(cuff)], 1), 3, 0.5)[:, 0]
        inside = ss >= s_cuff + 0.01 * k                                 # inside the cuff: just under it
        Rmin[inside] = np.minimum(Rmin[inside], cuff - 0.0022 * k)
        R = C.relax(Rmin.copy(), Rmin, it=40, k=0.5, closed=True, w_row=1.0, w_col=0.45)
        R[inside] = cuff - 0.0022 * k
        taper = np.clip((ss + 0.03 * k) / (0.07 * k), 0, 1)
        R *= (0.55 + 0.45 * (3 * taper ** 2 - 2 * taper ** 3))[:, None]

        info = dict(Cs=Cs, Ts=Ts, N=N, Bv=Bv, ss=ss, TH=TH, R=R, cuff=cuff, s_cuff=s_cuff, s_wrist=s_wrist, s_elbow=s_elbow)
        return info

    # ---------------------------------------------------------------- shirt
    def shirt(self):
        B, k = self.B, self.k
        ease = self.ease_shirt(self.t_zs)
        Rmin = self.torso_rmin(ease)
        R = C.relax(Rmin.copy(), Rmin, it=45, k=0.5, closed=True, w_row=1.5, w_col=0.35)
        self.shirt_R = R
        self.shirt_shell = RowShell(self.t_zs, self.t_yc, R)
        P = self.torso_points(R)
        self.torso_field = _grid_field(self.B, P, ZONES["torso"], self.t_zs, self.t_yc)
        bm, _ = C.grid_bm(P, closed=True)
        self.sleeves = {s: self.sleeve(s) for s in ("l", "r")}
        tubes = {s: TubeShell(i["Cs"], i["Ts"], i["N"], i["Bv"], i["R"], i["ss"]) for s, i in self.sleeves.items()}
        self.sleeve_shells = tubes
        N0, a = self.N0, self.a
        z_tuck = self.z_tuck
        C.trim(bm, lambda Q: np.minimum(-(Q - N0) @ a, Q[:, 2] - z_tuck))                   # neckline, shirt tail
        C.trim(bm, lambda Q: np.minimum(tubes["l"].f(Q), tubes["r"].f(Q)) + 0.004 * k)       # armholes
        C.orient_out(bm, lambda c: Vector((0.0, float(np.interp(c.z, self.t_zs, self.t_yc)), c.z)))
        parts = [(bm, "torso")]
        for s, inf in self.sleeves.items():
            O, T, U, Vv = inf["Cs"], inf["Ts"], inf["N"], inf["Bv"]
            keep = inf["ss"] <= inf["s_wrist"] - 0.012 * k
            P = C.points(O[keep], U[keep], Vv[keep], inf["TH"][keep], inf["R"][keep])
            sb, _ = C.grid_bm(P, closed=True)
            C.trim(sb, lambda Q: self.shirt_shell.f(Q) + 0.004 * k)         # meets the armhole; sewn to it below
            axis = (O, T)
            C.orient_out(sb, lambda c, axis=axis: _axis_point(axis, c))
            top = 0.075 * k

            def zone(co, inf=inf, s=s, top=top):
                i = int(np.argmin(np.linalg.norm(inf["Cs"] - np.array(co[:]), axis=1)))
                return ("shoulder_" if inf["ss"][i] < top else "arm_") + s
            parts.append((sb, zone))
        # the button strip down the front, seen in the waistcoat's V
        z0 = float(self.N0[2] - 0.03 * k)
        z1 = self.v_bottom - 0.03 * k
        rows = np.linspace(z1, z0, 14)
        half = 0.016 * k
        strip = []
        for z in rows:
            r, yc = self.shirt_shell.radius(np.array([z]), np.array([0.0]))
            th = half / max(float(r[0]), 0.05)
            pts = self.shirt_shell.point(np.full(3, z), np.array([-th, 0.0, th]), extra=0.0011 * k)
            strip.append(pts)
        pb, _ = C.grid_bm(np.array(strip), closed=False)
        C.trim(pb, lambda Q: -(Q - N0) @ a - 0.004 * k)
        C.orient_out(pb, lambda c: Vector((0.0, float(np.interp(c.z, self.t_zs, self.t_yc)), c.z)))
        parts.append((pb, "torso"))
        self.placket_rows = rows
        return parts

    # ---------------------------------------------------------------- collar and cuffs
    def collar_and_cuffs(self):
        B, k = self.B, self.k
        N0, a, cu, cv = self.N0, self.a, self.cu, self.cv
        E = B.edges(("neck_01",))
        ts = np.arange(0.0, 0.046 * k, 0.004 * k)
        n = 72
        TH = np.tile(np.arange(n) / n * C.TAU, (len(ts), 1))
        Rmin = np.full(TH.shape, np.nan)
        for i, t in enumerate(ts):
            Q = B.slice(E, N0 + a * t, a, cu, cv, radius=0.09 * k)
            if len(Q) >= 6:
                Rmin[i] = C.outline(Q, lambda x: np.full(np.shape(x), 0.0055 * k))(TH[i])
        Rmin = _fill_rows(Rmin)
        # the stand leans in a little towards the top, like a real collar band
        R = C.relax(Rmin.copy(), Rmin, it=20, k=0.5, closed=True, w_row=1.5, w_col=0.4)
        R = np.maximum(R, Rmin)
        # the shirt's neckline must sit inside the band's bottom: start the band from the neckline outline
        bottom = self.shirt_shell
        O = N0[None, :] + ts[:, None] * a[None, :]
        P = C.points(O, np.tile(cu, (len(ts), 1)), np.tile(cv, (len(ts), 1)), TH, R)
        tuck = C.points(np.array([N0 - a * 0.007 * k]), cu[None], cv[None], TH[:1], R[:1] - 0.0018 * k)
        P = np.concatenate([tuck, P], 0)
        bm, _ = C.grid_bm(P, closed=True)
        hf, hb = 0.025 * k, 0.035 * k

        def height(th):
            return hf + (hb - hf) * 0.5 * (1 - np.cos(th))

        def f_top(Q):
            d = Q - N0
            t = d @ a
            th = np.arctan2(d @ cv, d @ cu)
            return height(th) - t
        C.trim(bm, f_top)
        C.orient_out(bm, lambda c: Vector(N0 + a * float((np.array(c[:]) - N0) @ a)))
        self.collar_R = R
        self.collar_ts = ts
        self.collar_height = height
        # the fold (the part of the collar that turns down over the band)
        rows = 9
        leaf = []
        for i in range(rows):
            r = i / (rows - 1)
            gap = 0.007 * k + 0.042 * k * r ** 1.15            # half gap at the front: narrow at the top, wide at the points
            r_front = float(np.interp(0.0, ts, R[:, 0]))
            g = math.atan2(gap, r_front)
            th = np.linspace(g, C.TAU - g, 64)
            hh = height(th)
            Rt = np.array([np.interp(h, ts, R[:, int(round(t / C.TAU * n)) % n]) for h, t in zip(hh, th)])
            drop = (0.038 * k + 0.018 * k * ((1 + np.cos(th)) * 0.5) ** 2) * r
            out = 0.0007 * k + 0.0145 * k * r ** 1.4
            base = N0[None, :] + (hh - drop)[:, None] * a[None, :]
            dirs = np.cos(th)[:, None] * cu[None, :] + np.sin(th)[:, None] * cv[None, :]
            leaf.append(base + (Rt + out)[:, None] * dirs)
        leaf = np.array(leaf)
        leaf = self.lay_on(leaf, 0.0025 * k)
        for _ in range(3):                                   # settle it smoothly, then lay it on again
            sm = leaf.copy()
            sm[1:-1, 1:-1] = (leaf[:-2, 1:-1] + leaf[2:, 1:-1] + leaf[1:-1, :-2] + leaf[1:-1, 2:]) * 0.25
            sm[1:-1, 1:-1] = 0.5 * leaf[1:-1, 1:-1] + 0.5 * sm[1:-1, 1:-1]
            leaf = self.lay_on(sm, 0.0025 * k)
        self.leaf = leaf
        lb, _ = C.grid_bm(leaf, closed=False)
        C.orient_out(lb, lambda c: Vector(N0 + a * float((np.array(c[:]) - N0) @ a)))
        self.stand_bm = bm                                   # the band goes with the shirt; the fold over it has the thickness
        parts = [(lb, "neck")]
        for s, inf in self.sleeves.items():
            sel = inf["ss"] >= inf["s_cuff"]
            Cs, Ts, U, Vv = inf["Cs"][sel], inf["Ts"][sel], inf["N"][sel], inf["Bv"][sel]
            Rc = np.tile(inf["cuff"], (len(Cs), 1))
            Rc[-1] += 0.0006 * k
            P = C.points(Cs, U, Vv, inf["TH"][sel], Rc)
            cb, _ = C.grid_bm(P, closed=True)
            C.orient_out(cb, lambda c, axis=(Cs, Ts): _axis_point(axis, c))
            parts.append((cb, "arm_" + s))
        return C.merge(parts)

    def lay_on(self, P, gap):
        """Move points out of the shirt (and the waistcoat) the shortest way: sideways off a
        steep surface, straight up off a flat one (the top of the shoulders)."""
        flat = P.reshape(-1, 3).copy()
        shells = [self.shirt_shell] + ([self.wc_shell_outer] if getattr(self, "wc_shell_outer", None) else [])
        steps = np.linspace(0.0, 0.08 * self.k, 33)[1:]
        for sh in shells:
            for _ in range(2):
                f = sh.f(flat)
                bad = np.where(f < gap)[0]
                if not len(bad):
                    break
                q = flat[bad]
                z = q[:, 2]
                yc = np.interp(z, sh.zs, sh.yc)
                th = np.arctan2(q[:, 0], -(q[:, 1] - yc))
                R, _ = sh.radius(z, th)
                side = np.stack([(R + gap) * np.sin(th), yc - (R + gap) * np.cos(th), z], 1)
                d_side = np.linalg.norm(side - q, axis=1)
                up = np.full(len(q), np.inf)
                for dz in steps:
                    ok = (sh.f(q + np.array([0.0, 0.0, dz])) >= gap) & np.isinf(up)
                    up[ok] = dz
                use_up = up < d_side
                q2 = side.copy()
                q2[use_up] = q[use_up] + np.stack([np.zeros(use_up.sum()), np.zeros(use_up.sum()), up[use_up]], 1)
                flat[bad] = q2
        return flat.reshape(P.shape)

    # ---------------------------------------------------------------- waistcoat
    def waistcoat(self):
        B, k = self.B, self.k
        e_s = self.ease_shirt(self.t_zs)
        e_t = np.where(self.t_zs < self.z_wt + 0.01 * k, self.ease_trousers_top(self.t_zs) + 0.0028 * k, 0.0)
        ease = np.maximum(e_s, e_t) + 0.0045 * k
        Rmin = self.torso_rmin(ease)
        gap = np.interp(self.t_zs, [self.armpit_z, self.shoulder_z], [0.0042 * k, 0.0058 * k])[:, None]
        Rmin = np.maximum(Rmin, self.shirt_R + gap)
        R = C.relax(Rmin.copy(), Rmin, it=45, k=0.5, closed=True, w_row=1.5, w_col=0.35)
        self.wc_R = R
        self.wc_shell = RowShell(self.t_zs, self.t_yc, R)
        self.wc_shell_outer = RowShell(self.t_zs, self.t_yc, R + 0.0036 * k)
        P = self.torso_points(R)
        n_rows = len(self.t_zs)
        bm, _ = C.grid_bm(P, closed=True)
        N0, a = self.N0, self.a
        hb = self.z_wt - 0.045 * k                    # hem at the back and sides
        hp = hb - 0.05 * k                            # the two points at the front
        hc = hb - 0.005 * k                           # between the points
        xp = 0.055 * k
        yc_hem = float(np.interp(hb, self.t_zs, self.t_yc))
        vb = self.v_bottom
        top_half = 0.072 * k                          # V width at the shoulder

        def hem(Q):
            x, y = np.abs(Q[:, 0]), Q[:, 1]
            front = np.clip((yc_hem - y) / (0.05 * k), 0, 1)       # 1 at the front, 0 at the sides/back
            zf = np.where(x < xp, hc + (hp - hc) * (x / xp), hp + (hb - hp) * np.clip((x - xp) / (0.11 * k), 0, 1))
            return Q[:, 2] - (hb + (zf - hb) * front)

        def vneck(Q):
            x, y, z = np.abs(Q[:, 0]), Q[:, 1], Q[:, 2]
            yc = np.interp(z, self.t_zs, self.t_yc)
            xv = 0.004 * k + (z - vb) / max(0.05, N0[2] - vb) * top_half
            return np.maximum(x - xv, (y - (yc - 0.02 * k)) / (0.03 * k))

        ya = float(np.interp(self.shoulder_z, self.t_zs, self.t_yc)) + 0.014 * k   # cut deeper behind the arm: room to swing back
        z_ab, z_at = self.armpit_z - 0.05 * k, self.shoulder_z + 0.09 * k
        za, az = 0.5 * (z_ab + z_at), 0.5 * (z_at - z_ab)
        ay = 0.094 * k
        x_in = abs(float(B.head["upperarm_l"][0])) - 0.05 * k

        def armholes(Q):
            e = ((Q[:, 1] - ya) / ay) ** 2 + ((Q[:, 2] - za) / az) ** 2 - 1
            return np.maximum(e, (x_in - np.abs(Q[:, 0])) / (0.02 * k))

        def neck(Q):
            return -((Q - N0) @ a) - 0.013 * k
        C.trim(bm, lambda Q: np.minimum.reduce([hem(Q), vneck(Q), armholes(Q), neck(Q)]))
        C.orient_out(bm, lambda c: Vector((0.0, float(np.interp(c.z, self.t_zs, self.t_yc)), c.z)))
        for f in bm.faces:                                    # satin back
            c = f.calc_center_median()
            if c.y > float(np.interp(c.z, self.t_zs, self.t_yc)) + 0.012 * k:
                f.material_index = 1
        parts = [(bm, "vest")]
        # pockets: two at the front below the waist, one on the left chest
        outer = self.wc_shell_outer
        for sx in (1, -1):
            parts.append((self.welt(outer, hb + 0.045 * k, sx * 0.088 * k, 0.098 * k, 0.011 * k, sx * 0.09), "vest"))
        parts.append((self.welt(outer, self.armpit_z - 0.045 * k, 0.088 * k, 0.082 * k, 0.010 * k, 0.05), "vest"))
        # the strap across the back
        zb = hb + 0.07 * k
        rows = []
        for z in (zb - 0.012 * k, zb + 0.012 * k):
            th = np.linspace(math.pi - 0.42, math.pi + 0.42, 16)
            rows.append(outer.point(np.full(len(th), z), th, extra=0.0016 * k))
        sb, _ = C.grid_bm(np.array(rows), closed=False, mat=1)
        C.orient_out(sb, lambda c: Vector((0.0, float(np.interp(c.z, self.t_zs, self.t_yc)), c.z)))
        parts.append((sb, "vest"))
        self.wc = dict(hb=hb, hp=hp, hc=hc, xp=xp, zb=zb)
        return C.merge(parts)

    def welt(self, shell, z, x, length, height, tilt):
        """A welt pocket: a narrow raised strip on the waistcoat."""
        k = self.k
        xs = x + np.linspace(-length / 2, length / 2, 10)
        rows = []
        for dz, lift in ((-height / 2, 0.0005 * k), (-height / 2, 0.0022 * k), (height / 2, 0.0022 * k), (height / 2, 0.0005 * k)):
            pts = []
            for xx in xs:
                zz = z + dz + (xx - x) * math.tan(tilt)
                r_guess = shell.radius(np.array([zz]), np.array([0.0]))[0][0]
                th = math.asin(max(-0.95, min(0.95, xx / max(r_guess, 0.05))))
                pts.append(shell.point(np.array([zz]), np.array([th]), extra=lift)[0])
            rows.append(pts)
        bm, _ = C.grid_bm(np.array(rows), closed=False)
        C.orient_out(bm, lambda c: Vector((0.0, float(np.interp(c.z, self.t_zs, self.t_yc)), c.z)))
        return bm

    # ---------------------------------------------------------------- trousers
    def trousers(self, shoe_pts):
        B, k = self.B, self.k
        zc = B.crotch - 0.02 * k
        z_knee = float(0.5 * (B.head["calf_l"][2] + B.head["calf_r"][2]))
        z_hem = B.floor + 0.062 * k
        z_kh = z_knee + 0.03 * k
        zs = np.unique(np.concatenate([np.arange(z_hem, zc - 0.03 * k, 0.012 * k), np.arange(zc - 0.03 * k, self.z_wt - 0.04 * k, 0.008 * k),
                                       np.arange(self.z_wt - 0.04 * k, self.z_wt + 1e-6, 0.008 * k), [zc, self.z_wt]]))
        zs = zs[(zs >= z_hem - 1e-9) & (zs <= self.z_wt + 1e-9)]
        n = 56
        parts = []
        sides = {}
        for side in ("l", "r"):
            mirror = side == "r"
            E_leg = B.edges(("thigh_" + side, "calf_" + side))
            E_hip = B.edges(("pelvis", "spine_01", "thigh_" + side))
            cs, pts_all, kind = [], [], []
            for z in zs:
                O = np.array([0.0, 0.0, z])
                if z >= zc:
                    Q = B.slice(E_hip, O, UP, LEFT, BACK, mirror=mirror)
                    Q = Q[Q[:, 0] >= -0.002]
                    if len(Q) < 4:
                        Q = B.slice(E_leg, O, UP, LEFT, BACK, mirror=mirror)
                        Q = Q[Q[:, 0] > 0]
                    sym = np.vstack([Q, Q * np.array([-1.0, 1.0])])
                    kind.append("hip")
                else:
                    Q = B.slice(E_leg, O, UP, LEFT, BACK, mirror=mirror)
                    Q = Q[Q[:, 0] > 0]
                    sym = Q
                    kind.append("leg")
                if z < B.floor + 0.14 * k and shoe_pts is not None:
                    sp = shoe_pts[side]
                    sp = sp[np.abs(sp[:, 2] - z) < 0.006 * k][:, :2] * np.array([-1.0 if mirror else 1.0, 1.0])
                    if len(sp):
                        sym = np.vstack([sym, sp]) if len(sym) else sp
                pts_all.append(sym)
                if len(Q):
                    cs.append([Q[:, 0].mean() if z < zc else max(Q[:, 0].mean(), 0.03 * k), 0.5 * (Q[:, 1].min() + Q[:, 1].max())])
                else:
                    cs.append([np.nan, np.nan])
            cs = np.array(cs)
            cx, cy = _smooth1d(_fill(cs[:, 0]), 2), _smooth1d(_fill(cs[:, 1]), 2)
            # straight legs below the knee: centres on a line from the knee to the hem
            ank = B.bone("calf_" + side, "tail", mirror)
            kh = int(np.argmin(np.abs(zs - z_kh)))
            hem_c = np.array([ank[0], ank[1] - 0.012 * k])
            for i in range(kh):
                t = (zs[kh] - zs[i]) / max(zs[kh] - zs[0], 1e-6)
                cx[i] = cx[kh] + (hem_c[0] - cx[kh]) * t
                cy[i] = cy[kh] + (hem_c[1] - cy[kh]) * t
            # angles: legs go all the way round (inseam at the inner side), hips go from the middle front to the middle back
            TH = np.zeros((len(zs), n))
            Rmin = np.full((len(zs), n), np.nan)
            for i, z in enumerate(zs):
                P2 = pts_all[i]
                if len(P2) < 6:
                    continue
                q = np.stack([-(P2[:, 1] - cy[i]), P2[:, 0] - cx[i]], 1)
                e = self.ease_trousers(z, zc, z_knee)
                prof = C.outline(q, lambda x, e=e: np.full(np.shape(x), e))
                if prof is None:
                    continue
                if kind[i] == "leg":
                    th = np.linspace(-math.pi / 2, 1.5 * math.pi, n)
                else:
                    ths = np.linspace(-math.pi, math.pi, 1441)
                    rr = prof(ths)
                    xw = cx[i] + rr * np.sin(ths)
                    fr = ths[(np.cos(ths) > 0) & (np.sin(ths) < 0)]
                    bk = ths[(np.cos(ths) < 0) & (np.sin(ths) < 0)]
                    xf = xw[(np.cos(ths) > 0) & (np.sin(ths) < 0)]
                    xb = xw[(np.cos(ths) < 0) & (np.sin(ths) < 0)]
                    t0 = fr[np.argmin(np.abs(xf))] if len(fr) else -0.6
                    t1 = bk[np.argmin(np.abs(xb))] + C.TAU if len(bk) else 3.6
                    blend = np.clip((z - zc) / (0.06 * k), 0, 1)     # close the crotch: both ends meet at the inside
                    t0 = -math.pi / 2 + (t0 + math.pi / 2) * blend
                    t1 = 1.5 * math.pi + (t1 - 1.5 * math.pi) * blend
                    th = np.linspace(t0, t1, n)
                TH[i] = th
                Rmin[i] = prof(th)
            Rmin = _fill_rows(Rmin)
            for i in range(len(zs)):
                if not TH[i].any():
                    TH[i] = TH[i - 1] if i else np.linspace(-math.pi / 2, 1.5 * math.pi, n)
            # hang straight: below the knee, from the knee's ring to a slightly narrower hem
            Rk = Rmin[kh].copy()
            low = zs < B.floor + 0.13 * k
            Rhem = np.maximum(Rk * 0.9, Rmin[low].max(0) + 0.002 * k) if low.any() else Rk * 0.9
            for _ in range(3):
                Rhem = np.maximum(Rhem, 0.5 * (np.roll(Rhem, 1) + np.roll(Rhem, -1)))
            Rt = Rmin.copy()
            for i in range(kh):
                t = (zs[kh] - zs[i]) / max(zs[kh] - zs[0], 1e-6)
                Rt[i] = np.maximum(Rk + (Rhem - Rk) * t, Rmin[i])
            R = C.relax(Rt.copy(), Rt, it=36, k=0.5, closed=False, w_row=1.0, w_col=0.5)
            legs = np.array([kd == "leg" for kd in kind])
            R[legs, -1] = R[legs, 0] = 0.5 * (R[legs, 0] + R[legs, -1])
            # pressed crease down the front (and a softer one at the back)
            for i, z in enumerate(zs):
                if z < self.z_wt - 0.07 * k:
                    for c0, amp in ((0.0, 0.0022), (math.pi, 0.0012)):
                        d = np.abs(np.angle(np.exp(1j * (TH[i] - c0))))
                        R[i] += amp * k * np.clip(1 - d / 0.2, 0, 1) ** 2
            # waistband: a little proud of the trousers, with a clean step
            band = zs >= self.z_wt - 0.036 * k
            R[band] += 0.0018 * k
            O = np.stack([cx, cy, zs], 1)
            P = C.points(O, np.tile(FRONT, (len(zs), 1)), np.tile(LEFT, (len(zs), 1)), TH, R)
            hip = np.array([kd == "hip" for kd in kind])
            P[hip, 0, 0] = 0.0                                   # the middle seams
            P[hip, -1, 0] = 0.0
            P[..., 0] = np.maximum(P[..., 0], 0.0) if True else P[..., 0]
            # the inside of the hem (a turned-up facing)
            inner = []
            for dz in (0.03 * k, 0.0):
                row = P[0].copy()
                ctr = np.array([cx[0], cy[0], zs[0]])
                row = ctr + (row - ctr) * (1 - 0.0035 * k / max(float(np.mean(R[0])), 0.02))
                row[:, 2] = zs[0] + dz
                inner.append(row)
            P = np.concatenate([np.array(inner), P], 0)
            if mirror:
                P[..., 0] *= -1
            sides[side] = (P, zs, cx, cy)
            bm, _ = C.grid_bm(P, closed=False, flip=mirror)
            parts.append((bm, None))
        self.trouser_rows = sides
        out, _z = C.merge(parts)
        bmesh.ops.remove_doubles(out, verts=out.verts[:], dist=0.0015 * k)
        out.normal_update()
        zones = []
        for v in out.verts:
            zones.append("hips" if v.co.z > zc + 0.02 * k else ("leg_l" if v.co.x > 0 else "leg_r"))
        self.zc = zc
        return out, zones

    def ease_trousers(self, z, zc, z_knee):
        k = self.k
        zs = [z_knee - 0.1 * k, z_knee, zc - 0.05 * k, zc, zc + 0.06 * k, self.z_wt - 0.08 * k, self.z_wt]
        es = [0.012, 0.015, 0.014, 0.012, 0.011, 0.0085, 0.0062]
        return float(np.interp(z, zs, np.array(es) * k))

    # ---------------------------------------------------------------- shoes and socks
    def shoe(self, side):
        B, k = self.B, self.k
        mirror = side == "r"
        ank = B.bone("foot_" + side, "head", mirror)
        ball = B.bone("ball_" + side, "head", mirror)
        f = ball - ank
        f[2] = 0
        f /= np.linalg.norm(f)
        s_out = np.cross(UP, f)
        s_out /= np.linalg.norm(s_out)
        X = B.Vm if mirror else B.V
        m = B.mask(("foot_" + side, "ball_" + side)) | (B.mask(("calf_" + side,)) & (X[:, 2] < ank[2] + 0.02 * k))
        P = X[m]
        H = ank.copy()
        H[2] = B.floor
        A = (P - H) @ f
        L = (P - H) @ s_out
        a0, a1 = float(A.min()) - 0.007 * k, float(A.max()) + 0.02 * k
        z0 = B.floor
        st = 44
        ts = np.concatenate([np.linspace(0, 0.08, 6)[:-1], np.linspace(0.08, 0.9, 30)[:-1], np.linspace(0.9, 1.0, 10)])
        an = a0 + ts * (a1 - a0)
        bins = np.linspace(a0, a1, 41)
        lo, hi, top = np.full(40, np.nan), np.full(40, np.nan), np.full(40, np.nan)
        for i in range(40):
            sel = (A >= bins[i] - 0.004 * k) & (A < bins[i + 1] + 0.004 * k)
            if sel.sum() > 2:
                lo[i], hi[i] = L[sel].min(), L[sel].max()
                top[i] = (P[sel, 2]).max()
        mid = 0.5 * (bins[:-1] + bins[1:])
        has = ~np.isnan(hi)
        lo, hi, top = _fill(lo), _fill(hi), _fill(top)
        lo, hi = _smooth1d(lo, 1), _smooth1d(hi, 1)
        need_out = np.where(np.interp(an, mid, has.astype(float)) > 0.5, np.interp(an, mid, np.where(has, hi, -9)) + 0.0045 * k, -9)
        need_in = np.where(np.interp(an, mid, has.astype(float)) > 0.5, np.interp(an, mid, np.where(has, lo, 9)) - 0.0045 * k, 9)
        w_out = np.interp(an, mid, hi) + 0.0065 * k
        w_in = np.interp(an, mid, lo) - 0.0065 * k
        rnd = np.ones_like(ts)                               # round heel and toe
        rnd = np.where(ts < 0.14, np.sqrt(np.clip(1 - ((0.14 - ts) / 0.14) ** 2, 0.02, 1)), rnd)
        rnd = np.where(ts > 0.8, np.sqrt(np.clip(1 - np.clip((ts - 0.8) / 0.2, 0, 1) ** 2.2, 0.0, 1)), rnd)
        wc = 0.5 * (w_out + w_in)
        hw = 0.5 * (w_out - w_in)
        toe_c = np.where(ts > 0.8, wc - (ts - 0.8) / 0.2 * hw * 0.25, wc)   # toe point a little towards the big toe
        w_out, w_in = np.maximum(toe_c + hw * rnd, need_out), np.minimum(toe_c - hw * rnd, need_in)
        toe_c = 0.5 * (w_out + w_in)
        foot_top = np.interp(an, mid, _smooth1d(top, 2)) - z0
        z_welt = z0 + (0.003 + 0.013 * np.clip((0.3 - ts) / 0.1, 0, 1)) * k
        h_design = np.interp(ts, [0, 0.25, 0.45, 0.6, 0.78, 0.9, 1.0], np.array([0.074, 0.074, 0.08, 0.066, 0.046, 0.036, 0.022]) * k)
        h = np.maximum(h_design, np.where(ts > 0.35, foot_top + 0.008 * k, 0)) + z0
        h = np.where(ts > 0.97, z_welt + (h - z_welt) * np.clip((1.0 - ts) / 0.03, 0.25, 1), h)
        nphi = 28
        phi = np.linspace(0, math.pi, nphi)
        p = 2.7
        cphi, sphi = np.cos(phi), np.sin(phi)
        ce = np.sign(cphi) * np.abs(cphi) ** (2 / p)
        se = np.abs(sphi) ** (2 / p)
        rows = []
        for i in range(len(ts)):
            lat = np.where(ce >= 0, ce * (w_out[i] - toe_c[i]), ce * (toe_c[i] - w_in[i])) + toe_c[i]
            z = z_welt[i] + (h[i] - z_welt[i]) * se
            pts = H[None, :] + an[i] * f[None, :] + lat[:, None] * s_out[None, :]
            pts[:, 2] = z
            rows.append(pts)
        up = np.array(rows)
        bm, _ = C.grid_bm(up, closed=False)
        # the opening for the ankle
        t_open = 0.47

        def topline(Q):
            a = ((Q - H) @ f - a0) / (a1 - a0)
            lim = z0 + np.interp(a, [0.0, 0.12, 0.3, 0.42, t_open, 0.55], np.array([0.063, 0.06, 0.05, 0.055, 0.085, 0.2]) * k)
            return lim - Q[:, 2]
        C.trim(bm, topline)
        # sole and heel: the outline of the upper, a little wider, down to the ground
        out_edge = up[:, 0, :]
        in_edge = up[:, -1, :]
        ring = np.concatenate([out_edge, in_edge[::-1]], 0)
        ctr = ring.mean(0)
        ring_w = ctr + (ring - ctr) * np.array([1.0, 1.0, 0.0])
        lat_dir = ring_w - np.array([ctr[0], ctr[1], 0])
        tt = np.concatenate([ts, ts[::-1]])
        grow = 0.0028 * k
        sole_top = ring.copy()
        sole_top[:, :2] += _unit2(ring[:, :2] - _closest_axis(ring[:, :2], H, f)) * grow
        sole_top[:, 2] = np.concatenate([z_welt, z_welt[::-1]]) + 0.001 * k
        bottom = sole_top.copy()
        arch = np.clip(1 - np.abs(tt - 0.41) / 0.13, 0, 1)
        arch = np.where((tt > 0.27) & (tt < 0.55), np.maximum(arch, 0.6), 0) * 0.006 * k
        bottom[:, 2] = z0 - 0.012 * k + arch
        sole = bmesh.new()
        vt = [sole.verts.new(p) for p in sole_top]
        vb = [sole.verts.new(p) for p in bottom]
        m_ = len(vt)
        for i in range(m_):
            j = (i + 1) % m_
            try:
                f_ = sole.faces.new([vt[i], vb[i], vb[j], vt[j]])
                f_.material_index = 1
            except ValueError:
                pass
        try:
            fb = sole.faces.new(vb[::-1])
            fb.material_index = 1
            ft = sole.faces.new(vt)
            ft.material_index = 1
        except ValueError:
            pass
        bmesh.ops.triangulate(sole, faces=[f_ for f_ in sole.faces if len(f_.verts) > 4])
        bmesh.ops.recalc_face_normals(sole, faces=sole.faces[:])
        for f_ in sole.faces:
            f_.smooth = len(f_.verts) == 4
        C.orient_out(bm, lambda c: Vector((c.x, c.y, float(z0 + 0.02 * k))) if False else _shoe_inside(c, H, f, a0, a1, z0, k))
        if mirror:
            for b_ in (bm, sole):
                for v in b_.verts:
                    v.co.x = -v.co.x
                bmesh.ops.reverse_faces(b_, faces=b_.faces[:])
        pts = np.array([v.co[:] for v in bm.verts])
        pts_sole = np.array([v.co[:] for v in sole.verts])
        return [(bm, "foot_" + side), (sole, "foot_" + side)], np.vstack([pts, pts_sole])

    def socks(self):
        B, k = self.B, self.k
        parts = []
        for side in ("l", "r"):
            mirror = side == "r"
            E = B.edges(("calf_" + side, "foot_" + side))
            ank = B.bone("calf_" + side, "tail", mirror)
            zs = np.arange(B.floor + 0.035 * k, B.floor + 0.2 * k, 0.012 * k)
            n = 28
            TH = np.tile(np.arange(n) / n * C.TAU, (len(zs), 1))
            R = np.full(TH.shape, np.nan)
            cs = []
            for i, z in enumerate(zs):
                Q = B.slice(E, np.array([0.0, 0.0, z]), UP, LEFT, BACK, mirror=mirror)
                Q = Q[np.hypot(Q[:, 0] - ank[0], Q[:, 1] - ank[1]) < 0.065 * k] if len(Q) else Q
                if len(Q) < 6:
                    cs.append([np.nan, np.nan])
                    continue
                c = np.array([Q[:, 0].mean(), 0.5 * (Q[:, 1].min() + Q[:, 1].max())])
                cs.append(c)
                q = np.stack([-(Q[:, 1] - c[1]), Q[:, 0] - c[0]], 1)
                R[i] = C.outline(q, lambda x: np.full(np.shape(x), 0.0024 * k))(TH[i])
            cs = np.array(cs)
            R = _fill_rows(R)
            R = C.relax(R.copy(), R, it=12, closed=True)
            O = np.stack([_fill(cs[:, 0]), _fill(cs[:, 1]), zs], 1)
            P = C.points(O, np.tile(FRONT, (len(zs), 1)), np.tile(LEFT, (len(zs), 1)), TH, R)
            if mirror:
                P[..., 0] *= -1
            bm, _ = C.grid_bm(P, closed=True, flip=mirror)
            parts.append((bm, "foot_" + side))
        return C.merge(parts)

    # ---------------------------------------------------------------- bow tie and buttons
    def bowtie(self):
        k = self.k
        N0, a, cu, cv = self.N0, self.a, self.cu, self.cv
        h0 = float(self.collar_height(np.array([0.0]))[0])
        r0 = float(np.interp(h0 * 0.5, self.collar_ts, self.collar_R[:, 0]))
        centre = N0 + a * (h0 * 0.52) + cu * (r0 + 0.0024 * k + 0.0075 * k)
        # in front of the collar's points, which lie on the shirt around the knot
        lf = self.leaf.reshape(-1, 3) - centre
        near = (np.abs(lf @ cv) < 0.05 * k) & (np.abs(lf @ a) < 0.022 * k)
        if near.any():
            ahead = float((lf[near] @ cu).max()) + 0.0021 * k + 0.0062 * k
            centre = centre + cu * max(0.0, ahead)
        bm = bmesh.new()
        W, KNOT = 0.057 * k, 0.0085 * k

        def put(x, y, z):                                    # x across, y towards the front, z up the neck
            return centre + x * cv + y * cu + z * a

        def ring(x, hh, dd, n=16, pinch=0.0):
            out = []
            for i in range(n):
                t = i * C.TAU / n
                z = hh * math.cos(t)
                y = dd * math.sin(t) * (1 - pinch * (math.cos(t) ** 2))
                out.append(bm.verts.new(put(x, y, z)))
            return out
        for side in (-1.0, 1.0):
            rings = []
            for t in (0.0, 0.12, 0.3, 0.5, 0.7, 0.86, 0.96, 1.0):
                x = side * (KNOT + (W - KNOT) * t)
                hh = 0.006 * k + 0.0175 * k * math.sin(min(1.0, t * 1.08) * math.pi * 0.5) ** 1.3
                if t > 0.95:
                    hh *= 0.92 + 0.08 * (1 - t) / 0.05
                dd = 0.0035 * k + 0.0045 * k * math.sin(t * math.pi) * (1 if t < 0.97 else 0.6)
                rings.append(ring(x, hh, dd, pinch=0.35 if 0.2 < t < 0.95 else 0.0))
            for r0_, r1_ in zip(rings, rings[1:]):
                for i in range(len(r0_)):
                    j = (i + 1) % len(r0_)
                    bm.faces.new([r0_[i], r0_[j], r1_[j], r1_[i]] if side > 0 else [r0_[j], r0_[i], r1_[i], r1_[j]])
            bm.faces.new(rings[-1] if side > 0 else rings[-1][::-1])
        knot1 = ring(-KNOT * 1.15, 0.0082 * k, 0.0068 * k)
        knot2 = ring(KNOT * 1.15, 0.0082 * k, 0.0068 * k)
        for i in range(len(knot1)):
            j = (i + 1) % len(knot1)
            bm.faces.new([knot1[i], knot1[j], knot2[j], knot2[i]])
        bm.faces.new(knot1[::-1])
        bm.faces.new(knot2)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        for f in bm.faces:
            f.smooth = True
        return bm

    def button(self, bm, centre, normal, radius, depth, mat):
        """A button: a short rounded disc lying on a surface."""
        normal = normal / np.linalg.norm(normal)
        t1 = np.cross(normal, UP if abs(normal[2]) < 0.9 else LEFT)
        t1 /= np.linalg.norm(t1)
        t2 = np.cross(normal, t1)
        n = 12
        rings = []
        for rr, hh in ((radius, 0.0), (radius, depth * 0.6), (radius * 0.75, depth)):
            rings.append([bm.verts.new(centre + normal * hh + rr * (math.cos(i * C.TAU / n) * t1 + math.sin(i * C.TAU / n) * t2)) for i in range(n)])
        for r0, r1 in zip(rings, rings[1:]):
            for i in range(n):
                j = (i + 1) % n
                f = bm.faces.new([r0[i], r0[j], r1[j], r1[i]])
                f.material_index = mat
                f.smooth = True
        f = bm.faces.new(rings[-1])
        f.material_index = mat
        f = bm.faces.new(rings[0][::-1])
        f.material_index = mat

    def buttons(self):
        k = self.k
        bm = bmesh.new()
        outer = self.wc_shell_outer
        zs = np.linspace(self.v_bottom - 0.012 * k, self.wc["hc"] + 0.035 * k, 5)
        for z in zs:
            p = outer.point(np.array([z]), np.array([0.0]), extra=0.0005 * k)[0]
            yc = float(np.interp(z, self.t_zs, self.t_yc))
            self.button(bm, p, np.array([0.0, p[1] - yc, 0.0]), 0.0068 * k, 0.003 * k, 0)
        for z in self.placket_rows[[-3, -6, -9]]:
            if z < self.v_bottom - 0.005 * k:
                continue
            p = self.shirt_shell.point(np.array([z]), np.array([0.0]), extra=0.0022 * k)[0]
            yc = float(np.interp(z, self.t_zs, self.t_yc))
            self.button(bm, p, np.array([0.0, p[1] - yc, 0.0]), 0.0045 * k, 0.0018 * k, 1)
        for s, inf in self.sleeves.items():                    # cuff buttons, on the outside of each cuff
            i = int(np.argmin(np.abs(inf["ss"] - (inf["s_wrist"] - 0.03 * k))))
            th = 0.0
            r = float(np.interp(th, inf["TH"][i], inf["cuff"]))
            p = inf["Cs"][i] + (r + 0.0023 * k) * inf["N"][i]
            self.button(bm, p, inf["N"][i], 0.0042 * k, 0.0017 * k, 1)
        return bm

    # ---------------------------------------------------------------- sewing it all
    def sew(self, body, rig):
        k = self.k
        self.torso_rows()
        self.v_bottom = self.armpit_z - 0.075 * k
        made = []
        col = self.colors
        mats = lambda *specs: [_material(*s) for s in specs]
        shirt_parts = self.shirt()
        wc_bm, wc_z = self.waistcoat()
        cc_bm, cc_z = self.collar_and_cuffs()
        shirt_bm, shirt_z = C.merge(shirt_parts + [(self.stand_bm, "neck")])
        _sew_sleeves(shirt_bm, shirt_z, self.k)
        shoe_parts, shoe_pts = [], {}
        for side in ("l", "r"):
            parts, pts = self.shoe(side)
            shoe_parts += parts
            shoe_pts[side] = pts
        tr_bm, tr_z = self.trousers(shoe_pts)
        sk_bm, sk_z = self.socks()
        sh_bm, sh_z = C.merge(shoe_parts)
        bt_bm = self.bowtie()
        bu_bm = self.buttons()
        cloth = {}
        specs = [
            ("Shirt", shirt_bm, shirt_z, mats(("Shirt", col["shirt"], 0.72, cloth)), None),
            ("Collar and cuffs", cc_bm, cc_z, mats(("Shirt collar", col["shirt"], 0.6, cloth)), 0.0021 * k),
            ("Waistcoat", wc_bm, wc_z, mats(("Waistcoat", col["waistcoat"], 0.78, {}),
                                            ("Waistcoat back", _shade(col["waistcoat"], 1.25), 0.42, {})), 0.0036 * k),
            ("Trousers", tr_bm, tr_z, mats(("Trousers", col["trousers"], 0.8, {})), None),
            ("Socks", sk_bm, sk_z, mats(("Socks", _shade(col["trousers"], 0.8), 0.9, {})), None),
            ("Shoes", sh_bm, sh_z, mats(("Shoes", col["shoes"], 0.24, dict(coat=0.6)), ("Soles", (0.018, 0.013, 0.01, 1), 0.65, {})), None),
            ("Bow tie", bt_bm, ["neck"] * len(bt_bm.verts), mats(("Bow tie", col["bowtie"], 0.36, {})), None),
            ("Buttons", bu_bm, None, mats(("Waistcoat buttons", _shade(col["waistcoat"], 1.6), 0.28, {}),
                                          ("Shirt buttons", (0.82, 0.82, 0.8, 1), 0.25, {})), None),
        ]
        for name, bm, zones, materials, thick in specs:
            if zones is None:
                zones = self.zone_of(bm)
            ob = _new_object(body, rig, name, bm, materials)
            if thick:
                so = ob.modifiers.new("Thickness", "SOLIDIFY")
                so.thickness = thick
                so.offset = 1.0
                so.use_even_offset = False
                so.thickness_clamp = 1.0
                ob.modifiers.move(ob.modifiers.find(so.name), 0)
            if name == "Waistcoat":
                zones = ["torso"] * len(ob.data.vertices)
            _weights(self.B, ob, zones, smooth=8 if name in ("Shirt", "Collar and cuffs") else 3, field=self.torso_field)
            made.append(ob)
        return made

    def hide_skin(self, body, made):
        _hide_skin(body, self, made)

    def shows(self, p):
        """Skin that can be seen with the outfit on: above the collar's top and inside the cuffs."""
        k = self.k
        d = p - self.N0
        t = float(d @ self.a)
        th = math.atan2(float(d @ self.cv), float(d @ self.cu))
        if t > float(self.collar_height(np.array([th]))[0]) - 0.012 * k and abs(p[0]) < 0.12 * k:
            return True
        for inf in self.sleeves.values():
            i = int(np.argmin(np.linalg.norm(inf["Cs"] - p, axis=1)))
            if inf["ss"][i] > inf["s_wrist"] - 0.028 * k and np.linalg.norm(inf["Cs"][i] - p) < 0.08 * k:
                return True
        return False

    def zone_of(self, bm):
        """Zones for loose bits (buttons): by where they are."""
        out = []
        for v in bm.verts:
            c = v.co
            if c.z > self.armpit_z + 0.02 * self.k and abs(c.x) > 0.16 * self.k:
                out.append("arm_l" if c.x > 0 else "arm_r")
            elif abs(c.x) > 0.3 * self.k:
                out.append("arm_l" if c.x > 0 else "arm_r")
            else:
                out.append("torso")
        return out


# ============================================================== helpers
def _sew_sleeves(bm, zones, k):
    """Join each sleeve's top edge to its armhole with a band of faces: one garment, no gap at the armpit."""
    bm.verts.index_update()
    bm.verts.ensure_lookup_table()
    zone = {v: zones[v.index] for v in bm.verts}
    loops = []
    seen = set()
    for e in bm.edges:
        if not e.is_boundary or e in seen:
            continue
        comp, stack = [], [e]
        seen.add(e)
        while stack:
            cur = stack.pop()
            comp.append(cur)
            for v in cur.verts:
                for e2 in v.link_edges:
                    if e2.is_boundary and e2 not in seen:
                        seen.add(e2)
                        stack.append(e2)
        loops.append(comp)
    for side, sx in (("l", 1.0), ("r", -1.0)):
        def score(comp, want):
            vs = {v for e in comp for v in e.verts}
            kinds = {zone[v][:4] for v in vs}
            if want == "torso" and kinds != {"tors"}:
                return None
            if want == "arm" and not (kinds <= {"shou", "arm_"}):
                return None
            c = sum((v.co for v in vs), Vector()) / len(vs)
            if c.x * sx < 0.08 * k:
                return None
            return c.z                                      # the highest such loop is the one at the shoulder
        torso = [(score(c, "torso"), c) for c in loops]
        torso = [t for t in torso if t[0] is not None]
        arm = [(score(c, "arm"), c) for c in loops]
        arm = [t for t in arm if t[0] is not None]
        if not torso or not arm:
            continue
        a = max(torso, key=lambda t: t[0])[1]
        b = max(arm, key=lambda t: t[0])[1]
        A, B_ = _ordered(a), _ordered(b)
        if len(A) < 3 or len(B_) < 3:
            continue
        pts = np.array([v.co[:] for v in A])
        c = pts.mean(0)
        axis = np.linalg.eigh(np.cov((pts - c).T))[1][:, 0]          # the loop's plane normal: along the arm
        def turn(L):
            q = np.array([v.co[:] for v in L]) - c
            return float(np.sum(np.cross(q, np.roll(q, -1, 0)) @ axis))
        if (turn(A) > 0) != (turn(B_) > 0):
            B_.reverse()
        ref = np.array([0.0, 0.0, 1.0]) - axis * axis[2]
        i0 = int(np.argmax([(np.array(v.co[:]) - c) @ ref for v in A]))
        A = A[i0:] + A[:i0]
        j0 = min(range(len(B_)), key=lambda j: (B_[j].co - A[0].co).length)
        B_ = B_[j0:] + B_[:j0]
        _zip(bm, A, B_)
    for f in bm.faces:
        f.smooth = True


def _ordered(edges):
    """The vertices of a closed loop of edges, in order."""
    nxt = {}
    for e in edges:
        a, b = e.verts
        nxt.setdefault(a, []).append(b)
        nxt.setdefault(b, []).append(a)
    start = edges[0].verts[0]
    out, prev, cur = [start], None, start
    while True:
        cand = [v for v in nxt.get(cur, []) if v is not prev]
        if not cand or cand[0] is start or len(out) > len(edges):
            break
        prev, cur = cur, cand[0]
        out.append(cur)
    return out


def _zip(bm, A, B):
    """Close the gap between two loops with a strip of triangles, wound like the faces next to them."""
    def frac(L):
        d = [0.0]
        for i in range(len(L)):
            d.append(d[-1] + (L[(i + 1) % len(L)].co - L[i].co).length)
        return [x / max(d[-1], 1e-9) for x in d]
    ta, tb = frac(A), frac(B)
    n, m = len(A), len(B)
    i = j = 0
    new = []
    while i < n or j < m:
        if j >= m or (i < n and ta[i + 1] <= tb[j + 1]):
            tri = (A[i % n], A[(i + 1) % n], B[j % m])
            i += 1
        else:
            tri = (A[i % n], B[(j + 1) % m], B[j % m])
            j += 1
        if len(set(tri)) == 3:
            try:
                new.append(bm.faces.new(tri))
            except ValueError:
                pass
    for f in new:                                         # wind each triangle against its neighbour across the shared edge
        for e in f.edges:
            others = [g for g in e.link_faces if g is not f and g not in new]
            if not others:
                continue
            g = others[0]
            def forward(face, e=e):
                vs = list(face.verts)
                ia, ib = vs.index(e.verts[0]), vs.index(e.verts[1])
                return (ib - ia) % len(vs) == 1
            if forward(f) == forward(g):
                bmesh.utils.face_flip(f)
            break



def _unit2(v):
    return v / (np.linalg.norm(v, axis=1)[:, None] + 1e-12)


def _closest_axis(p2, H, f):
    """The point on the foot's long axis closest to each 2D point."""
    h, ff = H[:2], f[:2] / np.linalg.norm(f[:2])
    t = (p2 - h) @ ff
    return h + t[:, None] * ff


def _shoe_inside(c, H, f, a0, a1, z0, k):
    p = np.array(c[:])
    a = float((p - H) @ f)
    a = min(max(a, a0 + 0.03 * k), a1 - 0.04 * k)
    q = H + a * f
    return Vector((q[0], q[1], z0 + 0.025 * k))


def _axis_point(axis, c):
    O, T = axis
    p = np.array(c[:])
    i = int(np.argmin(np.linalg.norm(O - p, axis=1)))
    q = O[i] + T[i] * float((p - O[i]) @ T[i])
    return Vector(q)


def _shade(col, f):
    return tuple(min(1.0, c * f) for c in col[:3]) + (1.0,)


def _material(name, color, rough, opts):
    m = bpy.data.materials.new("VELVET " + name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    # only colour, roughness and (shoes) a clear coat: the game shows these the same way Blender does
    # (a sheen comes out as plain white in the browser and turns black cloth grey)
    if opts.get("coat") and "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = opts["coat"]
    m.diffuse_color = color
    m.roughness = rough
    return m


def _new_object(body, rig, name, bm, materials):
    me = bpy.data.meshes.new(body.name + " " + name)
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    ob = bpy.data.objects.new(body.name + " " + name, me)
    for coll in body.users_collection:
        coll.objects.link(ob)
        break
    ob.parent = rig
    ob["velvet_outfit_of"] = body.name
    md = ob.modifiers.new("Armature", "ARMATURE")
    md.object = rig
    return ob


_TREES = {}


def _grid_field(B, P, bones, zs, yc, smooth=6):
    """Skin weights on the torso grid (rows x columns), smoothed around and up and down.
    Every torso layer (shirt, waistcoat, buttons) reads its weights from here at its own
    height and angle, so the layers bend exactly alike and never cross."""
    rows, cols = P.shape[:2]
    m = B.mask(bones)
    ids = np.where(m)[0]
    tree = KDTree(len(ids))
    for i, vi in enumerate(ids):
        tree.insert(B.V[vi], i)
    tree.balance()
    W = np.zeros((rows, cols, len(B.bones)))
    for r in range(rows):
        for c in range(cols):
            wsum = 0.0
            for _p, j, d in tree.find_n(P[r, c], 6):
                w = 1.0 / (d * d + 1e-5)
                W[r, c] += w * B.W[ids[j]]
                wsum += w
            if wsum:
                W[r, c] /= wsum
    for _ in range(smooth):
        up = np.concatenate([W[1:], W[-1:]], 0)
        dn = np.concatenate([W[:1], W[:-1]], 0)
        W = 0.5 * W + 0.125 * (up + dn + np.roll(W, 1, 1) + np.roll(W, -1, 1))

    def field(Q):
        z = Q[:, 2]
        kf = np.interp(z, zs, np.arange(rows))
        k0 = np.clip(np.floor(kf).astype(int), 0, rows - 2)
        t = np.clip(kf - k0, 0, 1)[:, None]
        y0 = np.interp(z, zs, yc)
        th = np.mod(np.arctan2(Q[:, 0], -(Q[:, 1] - y0)), C.TAU)
        jf = th / C.TAU * cols
        j0 = np.floor(jf).astype(int) % cols
        j1 = (j0 + 1) % cols
        f = (jf - np.floor(jf))[:, None]
        a = W[k0, j0] * (1 - f) + W[k0, j1] * f
        b = W[k0 + 1, j0] * (1 - f) + W[k0 + 1, j1] * f
        return (a * (1 - t) + b * t).astype(np.float32)
    return field


def _weights(B, ob, zones, smooth=3, field=None):
    """Skin weights from the nearest skin of the matching body part (k nearest, by distance)."""
    me = ob.data
    n = len(me.vertices)
    if n == 0:
        return
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    zones = list(zones) + ["torso"] * (n - len(zones))
    acc = np.zeros((n, len(B.bones)), np.float32)
    from_field = np.zeros(n, bool)
    if field is not None:
        sel = np.array([z == "torso" for z in zones])
        if sel.any():
            acc[sel] = field(co[sel])
            from_field = sel
    for zone in set(zones) - ({"torso"} if field is not None else set()):
        idx = np.array([i for i, z in enumerate(zones) if z == zone])
        key = (id(B), zone)
        if key not in _TREES:
            m = B.mask(ZONES.get(zone, TORSO))
            if m.sum() < 8:
                m = B.inb.copy()
            ids = np.where(m)[0]
            tree = KDTree(len(ids))
            for i, vi in enumerate(ids):
                tree.insert(B.V[vi], i)
            tree.balance()
            _TREES[key] = (tree, ids)
        tree, ids = _TREES[key]
        for i in idx:
            hits = tree.find_n(co[i], 6)
            wsum = 0.0
            for _p, j, d in hits:
                w = 1.0 / (d * d + 1e-5)
                acc[i] += w * B.W[ids[j]]
                wsum += w
            if wsum:
                acc[i] /= wsum
    _TREES.clear()
    # smooth along the cloth, so that neighbouring vertices bend alike (no tearing at seams)
    if len(me.edges):
        E = np.empty(len(me.edges) * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", E)
        E = E.reshape(-1, 2)
        cols = np.where(acc.any(0))[0]
        sub = acc[:, cols].astype(np.float64)
        keep = sub[from_field].copy()
        cnt = np.bincount(E.ravel(), minlength=n).astype(np.float64)
        for _ in range(smooth):
            tot = np.zeros_like(sub)
            np.add.at(tot, E[:, 0], sub[E[:, 1]])
            np.add.at(tot, E[:, 1], sub[E[:, 0]])
            sub = 0.5 * sub + 0.5 * np.where(cnt[:, None] > 0, tot / np.maximum(cnt, 1)[:, None], sub)
            sub[from_field] = keep                            # the shared torso field is smooth already: keep it exact
        acc[:, cols] = sub
    _set_groups(B, ob, acc)
    return acc


def _set_groups(B, ob, acc):
    n = len(acc)
    groups = {}
    for i in range(n):
        row = acc[i]
        top = np.argsort(row)[-4:]
        tot = float(row[top].sum())
        if tot <= 0:
            continue
        for j in top:
            w = float(row[j]) / tot
            if w < 0.01:
                continue
            nm = B.bones[j]
            g = groups.get(nm)
            if g is None:
                g = groups[nm] = ob.vertex_groups.new(name=nm)
            g.add([i], w, "REPLACE")


def _hide_skin(body, T, made):
    """Hide the skin under the clothes. Only the neck above the collar, the wrists inside
    the cuffs, the hands and the head stay."""
    B = T.B
    pts, nrm, edge = [], [], []
    for ob in made:
        if "Bow tie" in ob.name or "Buttons" in ob.name:
            continue
        me = ob.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.normal_update()
        bnd = [v.co.copy() for v in bm.verts if v.is_boundary]
        for v in bm.verts:
            pts.append(v.co[:])
            nrm.append(v.normal[:])
        edge += [b[:] for b in bnd]
        bm.free()
    if not pts:
        return
    pts, nrm = np.array(pts), np.array(nrm)
    tree = KDTree(len(pts))
    for i, p in enumerate(pts):
        tree.insert(p, i)
    tree.balance()
    keep_bones = {B.bid[b] for b in B.bones if b.startswith(("hand_", "head", "thumb", "index", "middle", "ring", "pinky"))}
    hide = []
    k = B.k
    for vi in np.where(B.inb)[0]:
        if B.dom[vi] in keep_bones:
            continue
        p = B.V[vi]
        _q, i, d = tree.find(p)
        if i is None or d > 0.07 * k:
            continue
        if (p - pts[i]) @ nrm[i] > 0:
            continue
        if T.shows(p):
            continue
        hide.append(int(vi))
    g = body.vertex_groups.get(HIDE_GROUP) or body.vertex_groups.new(name=HIDE_GROUP)
    g.add(hide, 1.0, "REPLACE")
    md = body.modifiers.new(HIDE_MOD, "MASK")
    md.vertex_group = HIDE_GROUP
    md.invert_vertex_group = True
