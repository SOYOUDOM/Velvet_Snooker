# VELVET — 3D snooker

An offline 3D snooker game that runs in the browser (three.js), from your disk, with no server or install. It has real ball physics, bot opponents and tournaments, live commentary and a referee who calls the game. It has several venues, among them the World Championship Arena, and broadcast-style cameras and replays. VELVET Studio lets you dress the people and objects. Version 6.7 adds HD players and referees whose faces move.

## Play

Open `velvet/index.html` in Chrome, Edge or Firefox. On Windows you can also double-click `velvet/start-windows.bat`; on Linux or macOS, run `velvet/start-linux-macos.sh`. The player's guide and the full change log are in [`velvet/README.md`](velvet/README.md).

To get a single-file version of the game, build it (it is about 70 MB, so it is not kept in git):

```
python3 tools/build.py standalone velvet
```

This writes `velvet/Velvet_Snooker_3D_Physics_Studio_Standalone.html`, which reads the big character files (`characters/*.js`) from beside it.

## What is where

| Path | What it is |
|---|---|
| `velvet/` | The game, ready to play: pages, `js/`, `css/`, `characters/` (people, their pictures and motions, `hd/` for the HD people), `objects/`, `blender/` (the add-on as an installable zip and its guide) |
| `step7_game.js`, `step7_index.html`, `step7_style.css`, `newcode/` | The game's source. The build assembles `velvet/js/game.js`, `velvet/index.html` and `velvet/css/style.css` from them; `newcode/` holds the newer parts (camera, players, replays, commentary, TV, settings, objects, faces) |
| `tools/` | Build, packing and test scripts (Python 3), with helper scripts for Node in `tools/node/` |
| `sfx/` | Sound sources for `tools/gen_sfx.py` |
| `blender/` | VELVET Character Maker add-on source (Blender 5.3 + MPFB 2) and `build_hd_people.py`, which rebuilds the HD players and referees |

## Build

Edit the source, not `velvet/js/game.js` (it is generated). Then:

```
python3 tools/assemble8.py && python3 tools/assemble9.py && python3 tools/assemble10.py
node --check velvet/js/game.js
```

Always run the three steps in this order: each builds on the one before.

Other builds:

- `python3 tools/pack_characters.py velvet` packs the people into `characters/characters-pack.js` (needed for opening the game from disk).
- `python3 tools/build.py standalone velvet` builds the single-file version.

## Tests

The tests drive the game in headless Chrome with Playwright:

```
python3 tools/build.py testcopy velvet /tmp/vt
python3 -I tools/test_hd_people.py /tmp/vt/index.html
```

Other tests include `test_players.py`, `test_replay.py`, `test_venues.py`, `test_commentary.py`, `test_controls.py <page> <label>` and `test_studio_objects.py <page> <image> <video>`. The first lines of each file say what it checks and how to run it.

## HD people

The players and referees are rebuilt in Blender on MPFB 2 bodies, with their own photo face, hair and eye colour carried over, and twelve face shapes for blinks and expressions.

- **By hand:** install `velvet/blender/VELVET_Character_Maker_2.0.0.zip` in Blender 5.3 (with MPFB 2). Use the **HD people** panel to make one, then reshape and export. See [`velvet/blender/README.md`](velvet/blender/README.md).
- **All at once:** run the batch script, then compress the models.

  ```
  blender --background --python blender/build_hd_people.py -- velvet player_01 player_02 referee
  python3 tools/hd_pack.py velvet
  ```

  `hd_pack.py` needs [gltfpack](https://github.com/zeux/meshoptimizer) (`npm i -g gltfpack`).

## Not in the repository

These are left out because they are large and can be downloaded or rebuilt:

- the text-to-speech voice models the commentary was generated with (`tools/tts_engines.py` explains where they come from)
- the Rocketbox source conversions
- Node packages (`npm install` in `tools/node`)
- the single-file standalone build

## Credits

Rocketbox people (MIT), MakeHuman / MPFB 2 (CC0 assets) and three.js (MIT), among others. See the Credits section of [`velvet/README.md`](velvet/README.md) and `velvet/licenses/`.
