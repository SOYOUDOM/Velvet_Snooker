# VELVET Character Maker - a Blender add-on for the VELVET snooker game.
# Make people with MPFB (MakeHuman Plugin For Blender), dress them, and export
# them into the game with one button: the add-on fits each person to the
# game's skeleton, so the game's walking, sitting, cheering and shot stance
# work on them. Panel: 3D View > Sidebar (N) > VELVET.
import os
import re
import time
import traceback

import bpy
from bpy.props import BoolProperty, EnumProperty, FloatProperty, FloatVectorProperty, PointerProperty, StringProperty
from bpy.types import AddonPreferences, Operator, Panel, PropertyGroup

from . import core, gamefiles, hd, mpfb_link, outfit


# ============================================================== settings
def prefs(context=None):
    context = context or bpy.context
    addon = context.preferences.addons.get(__package__)
    return addon.preferences if addon else None


def game_root(context=None):
    p = prefs(context)
    ok, msg, root = gamefiles.check_game_folder(p.game_folder if p else "")
    return root if ok else None


class VELVET_Preferences(AddonPreferences):
    bl_idname = __package__
    game_folder: StringProperty(name="VELVET game folder", subtype="DIR_PATH",
                                description="The folder of your VELVET game: the one with index.html and the characters folder in it")

    def draw(self, context):
        col = self.layout.column()
        col.prop(self, "game_folder")
        ok, msg, _root = gamefiles.check_game_folder(self.game_folder)
        col.label(text=msg, icon="CHECKMARK" if ok else "ERROR")


COLOR = dict(subtype="COLOR", size=4, min=0.0, max=1.0)


class VELVET_PersonSettings(PropertyGroup):
    name: StringProperty(name="Name", description="The name the game shows (you can change it later in VELVET Studio)")
    role: EnumProperty(name="Role", default="player", items=[
        ("player", "Player", "A player at the table: you, player two or an opponent (link him in VELVET Studio)", "USER", 0),
        ("referee", "Referee", "Can referee your matches", "MOD_ARMATURE", 1),
        ("audience", "Audience", "Sits in the stands", "COMMUNITY", 2)])
    gender: EnumProperty(name="Seated as", default="male", description="Which seated motions the game gives this person in the stands",
                         items=[("male", "Man", ""), ("female", "Woman", "")])
    detail: EnumProperty(name="Detail", default="player", items=[
        ("player", "High", "Full detail and sharp textures, for the two players at the table"),
        ("crowd", "Light", "Fewer polygons and smaller textures, for people in the stands")])
    weight: FloatProperty(name="How often", default=1.0, min=0.0, max=5.0, step=50, precision=1,
                          description="How often this person is picked for a seat in the stands (0 = never)")
    game_id: StringProperty(name="Game id", description="Set by the first export: exporting again replaces the same character in the game")
    last_result: StringProperty()
    last_error: StringProperty()
    shirt: FloatVectorProperty(name="Shirt", default=outfit.DEFAULTS["shirt"], **COLOR)
    waistcoat: FloatVectorProperty(name="Waistcoat", default=outfit.DEFAULTS["waistcoat"], **COLOR)
    trousers: FloatVectorProperty(name="Trousers", default=outfit.DEFAULTS["trousers"], **COLOR)
    shoes: FloatVectorProperty(name="Shoes", default=outfit.DEFAULTS["shoes"], **COLOR)
    bowtie: FloatVectorProperty(name="Bow tie", default=outfit.DEFAULTS["bowtie"], **COLOR)


def person(context):
    return core.find_person(context.active_object)


def settings_of(body):
    return body.velvet


_GENERIC = re.compile(r"^Human(\.\d+)?$")


def shown_name(body):
    """The name the game gets: the one typed in step 1, else the object's own
    name unless that is MPFB's "Human"."""
    n = body.velvet.name.strip()
    if n:
        return n
    return "" if _GENERIC.match(body.name) else body.name


_cache = {}


def summary_cached(body):
    key = (body.name, len(body.children_recursive) if hasattr(body, "children_recursive") else 0, len(body.data.polygons),
           bool(core.person_rig(body)), len(outfit.pieces(body)))
    rig = core.person_rig(body)
    if rig is not None:
        key += (len(rig.children), len(rig.data.bones), rig.as_pointer())
    hit = _cache.get("summary")
    if hit and hit[0] == key:
        return hit[1]
    s = core.summary(body)
    _cache["summary"] = (key, s)
    return s


def library(root):
    """The characters in blender.js (only the list line is read, and only when the file changes)."""
    path = gamefiles.pack_path(root)
    try:
        mt = os.path.getmtime(path)
    except OSError:
        return []
    hit = _cache.get("library")
    if hit and hit[0] == (path, mt):
        return hit[1]
    people = []
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 400000))
            tail = f.read().decode("utf-8", "ignore")
        import json
        for line in tail.splitlines():
            if line.startswith(gamefiles.PACK_LIST) and line.endswith(";"):
                data = json.loads(line[len(gamefiles.PACK_LIST):-1])
                people = (data or {}).get("people") or []
    except Exception:
        people = []
    _cache["library"] = ((path, mt), people)
    return people


# ============================================================== operators
class VELVET_OT_choose_folder(Operator):
    bl_idname = "velvet.choose_folder"
    bl_label = "Choose the game folder"
    bl_description = "Pick your VELVET game folder: the one with index.html and the characters folder in it"
    directory: StringProperty(subtype="DIR_PATH")
    filter_folder: BoolProperty(default=True, options={"HIDDEN"})

    def invoke(self, context, event):
        p = prefs(context)
        if p and p.game_folder:
            self.directory = p.game_folder
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}

    def execute(self, context):
        ok, msg, root = gamefiles.check_game_folder(self.directory)
        if not ok:
            self.report({"ERROR"}, msg)
            return {"CANCELLED"}
        prefs(context).game_folder = root
        context.preferences.is_dirty = True
        self.report({"INFO"}, "VELVET game folder: " + root)
        return {"FINISHED"}


class VELVET_OT_new_person(Operator):
    bl_idname = "velvet.new_person"
    bl_label = "New person"
    bl_description = "Make a new person with MPFB, ready for the game: game skeleton, skin and (with MakeHuman's system assets) eyes, eyebrows, eyelashes and teeth"
    bl_options = {"REGISTER", "UNDO"}
    gender: FloatProperty(default=1.0, min=0.0, max=1.0, options={"HIDDEN"})

    @classmethod
    def poll(cls, context):
        return mpfb_link.available() and context.mode == "OBJECT"

    def execute(self, context):
        try:
            body, added = mpfb_link.new_human(self.gender)
        except Exception as e:
            traceback.print_exc()
            self.report({"ERROR"}, "MPFB could not make the person: " + str(e))
            return {"CANCELLED"}
        body.velvet.gender = "male" if self.gender > 0.5 else "female"
        body.velvet.name = ""
        for o in context.view_layer.objects:
            o.select_set(False)
        body.select_set(True)
        context.view_layer.objects.active = body
        self.report({"INFO"}, "New person ready" + (" with " + ", ".join(a.lower() for a in added) if added else
                                                   " (no eyes or eyebrows yet: install MakeHuman's system assets for those)"))
        return {"FINISHED"}


class VELVET_OT_add_skeleton(Operator):
    bl_idname = "velvet.add_skeleton"
    bl_label = "Add the game skeleton"
    bl_description = "Give this person MPFB's \"Game engine\" skeleton, which VELVET turns into the game's own skeleton on export"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        b = person(context)
        return mpfb_link.available() and b is not None and core.person_rig(b) is None and context.mode == "OBJECT"

    def execute(self, context):
        try:
            mpfb_link.add_game_skeleton(person(context))
        except Exception as e:
            self.report({"ERROR"}, "Could not add the skeleton: " + str(e))
            return {"CANCELLED"}
        self.report({"INFO"}, "Game skeleton added")
        return {"FINISHED"}


class VELVET_OT_swap_skeleton(Operator):
    bl_idname = "velvet.swap_skeleton"
    bl_label = "Swap for the game skeleton"
    bl_description = "Remove this person's skeleton and give him MPFB's \"Game engine\" skeleton, the one VELVET needs. Poses and animation made on the old skeleton are lost"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        b = person(context)
        return mpfb_link.available() and b is not None and core.person_rig(b) is not None and context.mode == "OBJECT"

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event, title="Swap the skeleton?",
                                                     message="Poses and animation on the old skeleton are lost.", confirm_text="Swap")

    def execute(self, context):
        body = person(context)
        try:
            mpfb_link.swap_to_game_skeleton(body, core.person_rig(body))
        except Exception as e:
            traceback.print_exc()
            self.report({"ERROR"}, "Could not swap the skeleton: " + str(e))
            return {"CANCELLED"}
        _cache.pop("summary", None)
        context.view_layer.objects.active = body
        body.select_set(True)
        self.report({"INFO"}, "Game skeleton added")
        return {"FINISHED"}


class VELVET_OT_add_basics(Operator):
    bl_idname = "velvet.add_basics"
    bl_label = "Add eyes, eyebrows, eyelashes & teeth"
    bl_description = "Add what this person is missing from MakeHuman's system assets: eyes, eyebrows, eyelashes, teeth and tongue"
    bl_options = {"REGISTER", "UNDO"}

    @classmethod
    def poll(cls, context):
        return mpfb_link.available() and person(context) is not None and context.mode == "OBJECT"

    def execute(self, context):
        body = person(context)
        have = {core.mpfb_type(o) for o in body.children_recursive} if hasattr(body, "children_recursive") else set()
        rig = core.person_rig(body)
        if rig is not None:
            have |= {core.mpfb_type(o) for o in rig.children_recursive}
        added = mpfb_link.add_basics(body, have)
        if not added:
            if not mpfb_link.have_system_assets():
                self.report({"WARNING"}, "MakeHuman's system assets are not installed: MPFB tab > Start here > Get system assets, then Install pack from zip")
            else:
                self.report({"INFO"}, "Nothing missing")
            return {"CANCELLED"}
        self.report({"INFO"}, "Added: " + ", ".join(a.lower() for a in added))
        return {"FINISHED"}


class VELVET_OT_outfit(Operator):
    bl_idname = "velvet.outfit"
    bl_label = "Dress in a snooker outfit"
    bl_description = "Tailor a snooker outfit to this person's body: shirt with collar and cuffs, waistcoat with buttons, pockets and a satin back, pressed trousers, socks, shoes and a bow tie (real 3D clothes, in the colours above). Press again after changing the body"
    bl_options = {"REGISTER", "UNDO"}
    remove: BoolProperty(default=False, options={"HIDDEN"})

    @classmethod
    def poll(cls, context):
        b = person(context)
        return b is not None and context.mode == "OBJECT"

    def execute(self, context):
        body = person(context)
        if self.remove:
            outfit.remove(body)
            self.report({"INFO"}, "Outfit taken off")
            return {"FINISHED"}
        rig = core.person_rig(body)
        if rig is None:
            self.report({"ERROR"}, "Add the game skeleton first")
            return {"CANCELLED"}
        s = body.velvet
        try:
            made = outfit.make(body, rig, {k: tuple(getattr(s, k)) for k in outfit.DEFAULTS})
        except Exception as e:
            traceback.print_exc()
            self.report({"ERROR"}, "Could not make the outfit: " + str(e))
            return {"CANCELLED"}
        context.view_layer.objects.active = body
        self.report({"INFO"}, "Dressed: " + ", ".join(o.name.replace(body.name + " ", "").lower() for o in made))
        return {"FINISHED"}


class VELVET_OT_export(Operator):
    bl_idname = "velvet.export"
    bl_label = "Export to VELVET"
    bl_description = "Fit this person to the game's skeleton and put him into your VELVET game (exporting again replaces him). Takes up to a minute"

    @classmethod
    def poll(cls, context):
        b = person(context)
        return b is not None and core.person_rig(b) is not None and game_root(context) is not None and context.mode == "OBJECT"

    def execute(self, context):
        body = person(context)
        s = settings_of(body)
        root = game_root(context)
        wm = context.window_manager
        steps = ["copying", "posing", "baking the pose", "building", "moving", "preparing", "exporting", "fitting"]
        wm.progress_begin(0, len(steps))
        if context.window:
            context.window.cursor_set("WAIT")

        def report(msg):
            print("VELVET:", msg)
            for i, st in enumerate(steps):
                if msg.startswith(st):
                    wm.progress_update(i)
        try:
            res = core.export_person(body, {"name": shown_name(body) or body.name, "role": s.role, "gender": s.gender, "detail": s.detail,
                                            "weight": s.weight, "id": s.game_id, "hd_of": body.get("velvet_hd") or None}, root, report)
        except Exception as e:
            traceback.print_exc()
            s.last_error = str(e)
            s.last_result = ""
            self.report({"ERROR"}, "Export failed: " + str(e))
            return {"CANCELLED"}
        finally:
            wm.progress_end()
            if context.window:
                context.window.cursor_set("DEFAULT")
        s.game_id = res["id"]
        s.last_error = ""
        s.last_result = "%s · %s triangles · %.1f MB · %s" % (res["name"], f"{res['triangles']:,}", res["bytes"] / 1e6, time.strftime("%H:%M"))
        _cache.pop("library", None)
        self.report({"INFO"}, "%s is in the game (%.0f s). Reload the game or VELVET Studio to see him." % (res["name"], res["seconds"]))
        return {"FINISHED"}


class VELVET_OT_remove_character(Operator):
    bl_idname = "velvet.remove_character"
    bl_label = "Remove from the game"
    bl_description = "Remove this character from your VELVET game (your Blender scene is not changed)"
    cid: StringProperty(options={"HIDDEN"})
    name: StringProperty(options={"HIDDEN"})

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event, title="Remove %s from the game?" % (self.name or self.cid), confirm_text="Remove")

    def execute(self, context):
        root = game_root(context)
        if not root:
            return {"CANCELLED"}
        gamefiles.remove_character(root, self.cid)
        _cache.pop("library", None)
        for o in bpy.data.objects:
            if getattr(o, "velvet", None) is not None and o.velvet.game_id == self.cid:
                o.velvet.game_id = ""
        self.report({"INFO"}, (self.name or self.cid) + " removed from the game")
        return {"FINISHED"}


class VELVET_OT_open_folder(Operator):
    bl_idname = "velvet.open_folder"
    bl_label = "Open the game folder"
    bl_description = "Show the game folder in your file browser"

    def execute(self, context):
        root = game_root(context)
        if root:
            bpy.ops.wm.path_open(filepath=root)
        return {"FINISHED"}


class VELVET_OT_select(Operator):
    bl_idname = "velvet.select_person"
    bl_label = "Select"
    bl_description = "Select this person"
    name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        ob = bpy.data.objects.get(self.name)
        if ob is None:
            return {"CANCELLED"}
        for o in context.view_layer.objects:
            o.select_set(False)
        ob.select_set(True)
        context.view_layer.objects.active = ob
        return {"FINISHED"}


# ============================================================== panels
class _Panel:
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "VELVET"

    def draw(self, context):
        try:
            self.draw_body(context)
        except Exception as e:
            traceback.print_exc()
            col = self.layout.column(align=True)
            col.alert = True
            for i, line in enumerate(_wrap("Something went wrong here: " + str(e), _chars(context))[:4]):
                col.label(text=line, icon="ERROR" if i == 0 else "BLANK1")


def _status(layout, ok, text, warn=False):
    r = layout.row()
    r.label(text=text, icon="CHECKMARK" if ok else ("ERROR" if warn else "X"))
    return r


def _chars(context=None):
    """How many characters fit on one line of the sidebar."""
    try:
        region = (context or bpy.context).region
        scale = bpy.context.preferences.system.ui_scale
        return max(16, int((region.width - 60 * scale) / (5.9 * scale)))
    except Exception:
        return 34


def _note(layout, text, icon="INFO"):
    col = layout.column(align=True)
    lines = _wrap(text, _chars())
    for i, line in enumerate(lines):
        col.label(text=line, icon=icon if i == 0 else "BLANK1")


def _wrap(text, n):
    out, cur = [], ""
    for w in text.split():
        if len(cur) + len(w) + 1 > n and cur:
            out.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        out.append(cur)
    return out


class VELVET_PT_main(_Panel, Panel):
    bl_idname = "VELVET_PT_main"
    bl_label = "VELVET Character Maker"

    def draw_header(self, context):
        self.layout.label(text="", icon="COMMUNITY")

    def draw_body(self, context):
        lay = self.layout
        p = prefs(context)
        ok, msg, root = gamefiles.check_game_folder(p.game_folder if p else "")
        box = lay.box()
        col = box.column(align=True)
        r = col.row(align=True)
        r.label(text=("Game: " + os.path.basename(root.rstrip("/\\"))) if ok else "Game folder not set", icon="CHECKMARK" if ok else "ERROR")
        r.operator("velvet.choose_folder", text="", icon="FILE_FOLDER")
        if ok:
            r.operator("velvet.open_folder", text="", icon="FOLDER_REDIRECT")
        if mpfb_link.available():
            col.label(text="MPFB " + (mpfb_link.version() or "") + (" · system assets ✓" if mpfb_link.have_system_assets() else " · no system assets"), icon="CHECKMARK")
        else:
            col.label(text="MPFB is not installed", icon="ERROR")
        b = person(context)
        col.label(text=("Person: " + b.name) if b else "No person selected", icon="USER" if b else "INFO")
        if not ok:
            lay.operator("velvet.choose_folder", text="Choose the VELVET game folder", icon="FILE_FOLDER")
        if not mpfb_link.available():
            hb = lay.box()
            hb.label(text="Get MPFB (free):", icon="IMPORT")
            for t in ("1. Edit > Preferences > Get Extensions", "2. Allow online access, search \"MPFB\", Install", "3. Come back to this tab"):
                hb.label(text=t)


class VELVET_PT_person(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "1   Person"

    def draw_body(self, context):
        lay = self.layout
        row = lay.row(align=True)
        row.scale_y = 1.3
        op = row.operator("velvet.new_person", text="New man", icon="ADD")
        op.gender = 1.0
        op = row.operator("velvet.new_person", text="New woman", icon="ADD")
        op.gender = 0.0
        b = person(context)
        if b is None:
            _note(lay, "Or select a person you made with MPFB.")
            return
        s = settings_of(b)
        lay.prop(s, "name", text="Name", placeholder=shown_name(b) or "Type the name the game shows")
        rig = core.person_rig(b)
        sm = summary_cached(b)
        if rig is None:
            lay.operator("velvet.add_skeleton", icon="ARMATURE_DATA")
        elif sm["rig_kind"] == "game_engine":
            _status(lay, True, "Game skeleton ready")
        else:
            _status(lay, False, "This skeleton is not the game's", warn=True)
            lay.operator("velvet.swap_skeleton", icon="ARMATURE_DATA")
        _note(lay, "Shape the body and face in the MPFB tab: Model (gender, age, muscle, weight, height, face).", icon="MOD_ARMATURE")


class VELVET_PT_look(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "2   Face, hair & clothes"

    @classmethod
    def poll(cls, context):
        return person(context) is not None

    def draw_body(self, context):
        lay = self.layout
        b = person(context)
        sm = summary_cached(b)
        k = sm["kinds"]
        grid = lay.grid_flow(columns=2, even_columns=True, align=True)
        for kind, label in (("eyes", "Eyes"), ("brows", "Eyebrows"), ("lashes", "Eyelashes"), ("teeth", "Teeth"), ("hair", "Hair"), ("cloth", "Clothes")):
            n = len(k.get(kind, []))
            grid.label(text=label + (" (%d)" % n if kind == "cloth" and n else ""), icon="CHECKMARK" if n else "RADIOBUT_OFF")
        col = lay.column()
        col.operator("velvet.add_basics", icon="ADD")
        if mpfb_link.available() and not mpfb_link.have_system_assets():
            _note(col, "Eyes, eyebrows and teeth need MakeHuman's free system assets: MPFB tab > Start here > \"Get system assets\" (downloads a zip), then \"Install pack from zip\".", icon="ERROR")
        _note(col, "Hair, beards and more clothes: MPFB tab > Apply assets (more free packs on the MakeHuman site).", icon="MOD_CLOTH")
        has_face = bool(b.data.shape_keys and any(kb.name.startswith(hd.PREFIX) for kb in b.data.shape_keys.key_blocks))
        r = lay.row()
        r.operator("velvet.face_moves", text="Face moves: blink, smile, frown..." if has_face else "Add a face that moves", icon="CHECKMARK" if has_face else "MONKEY")
        box = lay.box()
        box.label(text="Snooker outfit", icon="MATCLOTH")
        s = settings_of(b)
        g = box.grid_flow(columns=2, even_columns=True, align=True)
        for key in ("shirt", "waistcoat", "trousers", "shoes", "bowtie"):
            g.prop(s, key)
        dressed = bool(outfit.pieces(b))
        r = box.row(align=True)
        r.scale_y = 1.2
        r.operator("velvet.outfit", text="Dress again" if dressed else "Dress in a snooker outfit", icon="MOD_CLOTH").remove = False
        if dressed:
            r.operator("velvet.outfit", text="", icon="TRASH").remove = True
        _note(box, "Real 3D clothes made to fit this body. Press again after you change the body.")


class VELVET_PT_game(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "3   In the game"

    @classmethod
    def poll(cls, context):
        return person(context) is not None

    def draw_body(self, context):
        lay = self.layout
        s = settings_of(person(context))
        lay.use_property_split = True
        lay.use_property_decorate = False
        lay.prop(s, "role")
        if s.role == "audience":
            lay.prop(s, "weight")
        lay.prop(s, "gender")
        lay.prop(s, "detail", expand=True)
        lay.use_property_split = False
        tip = {"player": "After export, open VELVET Studio to make him your body, player two's, or an opponent with his own profile.",
               "referee": "In VELVET Studio, tick \"Referees the matches\" to make him the referee.",
               "audience": "He takes seats in the stands, as often as you set above."}[s.role]
        _note(lay, tip)


class VELVET_PT_export(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "4   Check & export"

    @classmethod
    def poll(cls, context):
        return person(context) is not None

    def draw_body(self, context):
        lay = self.layout
        b = person(context)
        s = settings_of(b)
        sm = summary_cached(b)
        root = game_root(context)
        col = lay.column(align=True)
        if context.mode != "OBJECT":
            _status(col, False, "Switch to Object Mode to export", warn=True)
        nm = shown_name(b)
        _status(col, bool(nm), ("Name: " + nm) if nm else "No name yet (step 1)", warn=True)
        _status(col, root is not None, "Game folder" if root else "Choose the game folder (top)")
        _status(col, sm["rig_kind"] == "game_engine", "Game skeleton" if sm["rig_kind"] == "game_engine" else "Needs the game skeleton (step 1)")
        _status(col, bool(sm["kinds"].get("eyes")), "Eyes" if sm["kinds"].get("eyes") else "No eyes (step 2)", warn=True)
        _status(col, bool(sm["kinds"].get("cloth")), "Clothes" if sm["kinds"].get("cloth") else "No clothes (step 2)", warn=True)
        if sm.get("curves"):
            _status(col, False, "Curve or particle hair stays in Blender: use mesh hair", warn=True)
        limit = 140000 if s.detail == "player" else 40000
        tris = sm["triangles"]
        _status(col, tris <= limit, "About %s triangles%s" % (f"{tris:,}", "" if tris <= limit else ": heavy for " + ("a player" if s.detail == "player" else "the crowd")), warn=True)
        r = lay.row()
        r.scale_y = 1.9
        r.operator("velvet.export", text=("Export again" if s.game_id else "Export to VELVET"), icon="EXPORT")
        if s.last_error:
            _note(lay, "Last export failed: " + s.last_error, icon="ERROR")
        elif s.last_result:
            _note(lay, "In the game: " + s.last_result + ". Reload the game or VELVET Studio.", icon="CHECKMARK")
        else:
            _note(lay, "Exporting copies the person, so your scene stays as it is. It takes up to a minute.")


class VELVET_PT_library(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "Characters in your game"
    bl_options = {"DEFAULT_CLOSED"}

    def draw_body(self, context):
        lay = self.layout
        root = game_root(context)
        if not root:
            lay.label(text="Choose the game folder first", icon="INFO")
            return
        people = library(root)
        if not people:
            lay.label(text="None from Blender yet", icon="INFO")
            return
        role_icon = {"player": "USER", "referee": "MOD_ARMATURE", "audience": "COMMUNITY"}
        for e in people:
            box = lay.box()
            r = box.row(align=True)
            r.label(text=e.get("name", e.get("id")), icon=role_icon.get(e.get("role"), "USER"))
            src = next((o for o in bpy.data.objects if getattr(o, "velvet", None) is not None and o.velvet.game_id == e.get("id")), None)
            if src is not None:
                r.operator("velvet.select_person", text="", icon="RESTRICT_SELECT_OFF").name = src.name
            op = r.operator("velvet.remove_character", text="", icon="TRASH")
            op.cid, op.name = e.get("id", ""), e.get("name", "")
            box.label(text="%s · %s triangles · %.1f MB · %s" % (e.get("role", "player").capitalize(), f"{e.get('triangles', 0):,}", e.get("bytes", 0) / 1e6, e.get("made", "")))


class VELVET_PT_help(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "How it works"
    bl_options = {"DEFAULT_CLOSED"}

    def draw_body(self, context):
        lay = self.layout
        for t in ("1. New man / New woman (or select an MPFB person).",
                  "2. Shape the body and face in the MPFB tab (Model).",
                  "3. Add eyes, eyebrows and teeth (one button), hair and clothes (MPFB Apply assets), or the quick snooker outfit.",
                  "4. Choose the role, then Export to VELVET.",
                  "5. Reload the game or VELVET Studio. In the studio, make him your body, player two's or an opponent's, and test him in a match.",
                  "The export fits the person to the game's skeleton, so the game's walking, sitting, cheering and shot stance work on him."):
            _note(lay, t, icon="DOT")


# ============================================================== HD people
_hd_cache = {}


def hd_sources(self, context):
    """The game's players and referees (characters.js), for the HD panel's list."""
    root = game_root(context)
    key = (root, int(time.time() // 10))
    if _hd_cache.get("key") != key:
        items = []
        try:
            for cid, e in hd.read_people(root).items() if root else []:
                if e.get("role") in ("player", "referee"):
                    items.append((cid, cid, "%s (%s)" % (cid, e.get("role")), "MOD_ARMATURE" if e.get("role") == "referee" else "USER", len(items)))
        except Exception as e:
            print("VELVET: could not read characters.js:", e)
        _hd_cache["key"], _hd_cache["items"] = key, items or [("", "(choose the game folder)", "")]
    return _hd_cache["items"]


class VELVET_OT_hd_make(Operator):
    bl_idname = "velvet.hd_make"
    bl_label = "Make HD person"
    bl_description = ("Rebuild the chosen game character as an HD person: an MPFB body shaped like him, his own face (fitted with "
                      "MPFB's face sliders and painted from his picture), his hair and eye colour, a face that moves and his snooker "
                      "outfit. About half a minute")

    @classmethod
    def poll(cls, context):
        return mpfb_link.available() and game_root(context) is not None and context.mode == "OBJECT" and bool(context.scene.velvet_hd_source)

    def execute(self, context):
        cid = context.scene.velvet_hd_source
        if context.window:
            context.window.cursor_set("WAIT")
        try:
            body, _spec = hd.make_hd_person(game_root(context), cid, report=lambda m: print("VELVET HD:", m))
        except Exception as e:
            traceback.print_exc()
            self.report({"ERROR"}, "Could not make the HD person: " + str(e))
            return {"CANCELLED"}
        finally:
            if context.window:
                context.window.cursor_set("DEFAULT")
        for o in context.view_layer.objects:
            o.select_set(False)
        body.select_set(True)
        context.view_layer.objects.active = body
        self.report({"INFO"}, "%s is ready: shape him with MPFB's sliders, then Export (step 4) puts him into the game" % cid)
        return {"FINISHED"}


class VELVET_OT_face_moves(Operator):
    bl_idname = "velvet.face_moves"
    bl_label = "Add a face that moves"
    bl_description = ("Blinks and expressions for this person in the game (MPFB's expression shapes: blink, squint, wide eyes, brows "
                      "up, down and worried, smile, frown, pressed lips, open mouth, pucker, sneer). Eyelashes, teeth and tongue come "
                      "from MPFB's own helper shapes when the system assets do not provide them")

    @classmethod
    def poll(cls, context):
        return person(context) is not None and context.mode == "OBJECT"

    def execute(self, context):
        body = person(context)
        try:
            made = hd.add_expressions(body)
        except Exception as e:
            traceback.print_exc()
            self.report({"ERROR"}, "Could not add the expressions: " + str(e))
            return {"CANCELLED"}
        body["velvet_face"] = True
        self.report({"INFO"}, "Face movements: " + ", ".join(made))
        return {"FINISHED"}


class VELVET_OT_hd_remove(Operator):
    bl_idname = "velvet.hd_remove"
    bl_label = "Remove HD look"
    bl_description = "The game shows this character's classic model again"
    cid: StringProperty(options={"HIDDEN"})

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        gamefiles.remove_hd(game_root(context), self.cid)
        self.report({"INFO"}, self.cid + " is back to the classic model")
        return {"FINISHED"}


class VELVET_PT_hd(_Panel, Panel):
    bl_parent_id = "VELVET_PT_main"
    bl_label = "HD people (the game's own characters)"
    bl_options = {"DEFAULT_CLOSED"}

    def draw_body(self, context):
        lay = self.layout
        root = game_root(context)
        if not root:
            lay.label(text="Choose the game folder first", icon="INFO")
            return
        col = lay.column(align=True)
        col.prop(context.scene, "velvet_hd_source", text="Character")
        r = col.row()
        r.scale_y = 1.5
        r.operator("velvet.hd_make", icon="USER")
        _note(lay, "Makes the HD version of a player or referee: the same face and hair on a detailed MPFB body, with eyes "
                   "that turn and a face that moves. Shape it with MPFB's sliders, then press Export in step 4: it replaces "
                   "that character in the game (PEOPLE · HD / CLASSIC in the game's settings switches between them).")
        _files, looks = gamefiles.read_hd(root)
        if looks:
            box = lay.box()
            box.label(text="HD looks in your game", icon="CHECKMARK")
            for cid, look in sorted(looks.items()):
                r = box.row(align=True)
                r.label(text="%s · %s triangles" % (cid, f"{look.get('triangles', 0):,}"))
                r.operator("velvet.hd_remove", text="", icon="TRASH").cid = cid


CLASSES = (VELVET_Preferences, VELVET_PersonSettings, VELVET_OT_choose_folder, VELVET_OT_new_person, VELVET_OT_add_skeleton, VELVET_OT_swap_skeleton,
           VELVET_OT_add_basics, VELVET_OT_outfit, VELVET_OT_export, VELVET_OT_remove_character, VELVET_OT_open_folder, VELVET_OT_select,
           VELVET_OT_hd_make, VELVET_OT_face_moves, VELVET_OT_hd_remove,
           VELVET_PT_main, VELVET_PT_person, VELVET_PT_look, VELVET_PT_game, VELVET_PT_export, VELVET_PT_hd, VELVET_PT_library, VELVET_PT_help)


def register():
    for c in CLASSES:
        bpy.utils.register_class(c)
    bpy.types.Object.velvet = PointerProperty(type=VELVET_PersonSettings)
    bpy.types.Scene.velvet_hd_source = EnumProperty(name="Character", items=hd_sources,
                                                    description="Which of the game's characters to rebuild in HD")


def unregister():
    del bpy.types.Scene.velvet_hd_source
    del bpy.types.Object.velvet
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)
