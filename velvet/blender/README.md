# VELVET Character Maker — a Blender add-on

Make realistic people in Blender, with a real 3D body, face, hair and clothes, and put them into VELVET as players, referees or audience. The bodies come from **MPFB** (MakeHuman for Blender, free). This add-on fits each person to the game's skeleton, so every walk, shot stance, sit, cheer and clap in the game works on them.

Needs **Blender 5.3.0** or newer.

## Install (once)

1. **MPFB:** in Blender, *Edit › Preferences › Get Extensions*. Allow online access if Blender asks, search **MPFB** and press **Install**.
2. **MakeHuman's system assets** (eyes, eyebrows, eyelashes, teeth; free): in the 3D view press **N**, open the **MPFB** tab, then *Start here*. Press **Get system assets**, which opens the download page in your browser. Download the zip, then press **Install pack from zip** and choose it. Leave the zip zipped.
3. **This add-on:** *Edit › Preferences › Add-ons*. Open the **⌄** menu at the top right, choose **Install from Disk…** and pick `VELVET_Character_Maker_2.0.0.zip` (it is in this folder).
4. In the 3D view press **N** and open the **VELVET** tab. Click the folder button and choose your VELVET game folder (the one with `index.html`).

The top box of the tab shows a tick for the game folder, MPFB and the system assets, so you can see that everything is ready.

## Make a person

Work down the VELVET tab, from step 1 to step 4.

**1 Person:** press **New man** or **New woman** and type a name. Shape the body and face in the MPFB tab under *Model*: age, muscle, weight, height and proportions, then the face and body detail sliders. A person you made with MPFB works too: select it, then press **Add the game skeleton** (no skeleton yet) or **Swap for the game skeleton** (a different one).

**2 Face, hair & clothes:**
- **Add eyes, eyebrows, eyelashes & teeth** adds whatever is missing, in one go.
- **Hair, beards and clothes:** MPFB tab, *Apply assets*. The MakeHuman site has more free packs (hair, clothes, skins); install them the same way as the system assets.
- **Dress in a snooker outfit** tailors real 3D clothes to this body, in the colours you pick: a shirt with a turn-down collar, cuffs and a button strip; a waistcoat with a V neck, five buttons, welt pockets, pointed front and a satin back with a strap; pressed trousers with a waistband and straight legs; socks; shoes with a sole and heel; and a bow tie. The clothes drape over the body like fabric instead of copying the skin, so they fit any shape, man or woman, slim or heavy. Press **Dress again** after you change the body.

**3 In the game:**
- **Role:** *Player* (you, player two or an opponent), *Referee* or *Audience*.
- **How often** (audience only): how often this person gets a seat.
- **Seated as:** which seated motions the person uses in the stands.
- **Detail:** *High* for players at the table, *Light* for the crowd.

**4 Check & export:** every line shows a tick or a warning, for example *No eyes (step 2)*. Fix the warnings, then press **Export to VELVET**. It takes about 10 seconds to a minute. Your scene stays as it is, because the export works on a copy.

Then reload the game or VELVET Studio:
- An **audience** member takes seats in the stands straight away.
- A **player**: in VELVET Studio, make him your body, player two's, or an opponent with his own name and playing style. **Test in game** starts a match against him.
- A **referee**: in VELVET Studio, tick *Referees the matches*.

## HD people: the game's own players and referees (new in 2.0)

The game's players and referees come as HD people. Each has a detailed MPFB body with his own photo face, hair and eye colour, eyes that turn, and a face that moves: blink, squint, wide eyes, brows up, down and worried, smile, frown, pressed lips, open mouth, pucker and sneer. To change one, or to remake him:

1. Open the **HD people** panel in the VELVET tab, pick the **Character** and press **Make HD person**. It takes about half a minute and does the following:
   - It reads that character's model and pictures from your game folder.
   - It shapes an MPFB body to his height and build.
   - It sets MPFB's face sliders to match his head: eyes, nose, mouth, jaw and skull.
   - It paints his photo face onto the new skin, with his hair on the scalp, and gives the eyes his iris colour.
   - It adds the face's movements and dresses him (white gloves for referees).
2. Change what you like: MPFB's sliders (*Model*, face and body detail) or the outfit colours in step 2. The face picture stays on the face as you reshape it.
3. Press **Export** in step 4. He goes into `characters/hd/` and `characters/hd.js` and replaces that character in the game. The panel lists the HD looks in your game; the bin icon gives a character his classic model back.

In the game, **PEOPLE · CLASSIC / MPFB** in the settings switches between the original models (the default) and these HD people: switch it to MPFB to see what you exported. A character you changed in VELVET Studio keeps your version.

**Your own people can have a face that moves too:** press **Add a face that moves** (step 2) before you export. MakeHuman's eyebrows, eyelashes and beards follow the skin they sit on. If MakeHuman's eyelashes or teeth are missing, they come from MPFB's own helper shapes.

## Change or remove

- Change the person in Blender, then press **Export again**. It replaces the same character in the game.
- **Characters in your game** (in the VELVET tab) lists everyone you exported. The bin button removes a character from the game.
- Save your `.blend` file so you can come back and change people later.

## Good to know

- The export writes `characters/blender/<id>/model.glb` and `characters/blender.js` in the game folder. The `.js` file carries the models packed, so the game still opens straight from disk. Deleting `characters/blender.js` takes all Blender characters out of the game.
- **Size:** a *High* person is about 45,000 triangles and 2 MB, a *Light* one about 20,000 triangles and 1 MB. Many High people make the game load more slowly.
- **Hair** must be mesh hair, like MakeHuman's hair assets. Blender's curve and particle hair are not exported; the check list warns you about them.
- The game uses its own animations. Poses and animation you make in Blender are not exported; the face is exported as it is shaped.
- Skin and clothes are baked into simple colour textures for the browser, so they look a little flatter than in Blender's renders.
- **Licences:** this add-on is GPL-3.0-or-later. MPFB is GPL, and MakeHuman's assets are CC0, so the people you make are yours to use.
