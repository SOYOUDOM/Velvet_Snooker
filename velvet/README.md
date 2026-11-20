# VELVET 7.2 — Every Pro in Their Own Body, a Steadier Camera, A New Camera, Touch Controls, Squirt, Throw, Nap and Miscues, Replays with Ball Paths, Lip-Sync, Full-Quality People with Face Shapes, Real Rests, Your Own Sounds, Soy "The Titan" Oudom, Championship Arena, Commentary Team, Human Bot, Broadcast Presentation

An offline 3D snooker game written in **HTML, CSS and JavaScript**. It is rendered with **Three.js (WebGL 2)** and the people are realistic rigged characters with motion-captured animation. It needs no internet connection.

## Start

- Extract the ZIP, then open `index.html` in desktop Chrome or Edge with hardware acceleration enabled. Keep the `js`, `css`, `assets` and `characters` folders next to it.
- Or open `Velvet_Snooker_3D_Physics_Studio_Standalone.html` on its own. The engine, the people, textures and sounds are all embedded in that one file (about 124 MB, mostly the people and voices).
- Choose **Solo Practice**, **Play the Bot**, **Local Two Player** or **Tournament** and a **Venue**, then click **Enter the Room**. For **Play the Bot**, pick the opponent and level under **Opponent · Level**. The referee and audience appear a second or two after the table.
- Sound starts after your first click or key press, as most browsers require.

## Changes in version 7.2 (every pro in their own body; a steadier camera)

- **Every pro has a model file of their own, with their own build.** The fifteen pros shared eight bodies, all the same slim-to-average build (Shaun Murphy and Luca Brecel were the same model; so were Judd Trump, Kyren Wilson and Jack Lisowski). Each now has `characters/models/pros/<name>.glb`.
  - **Builds** are taken from how they look at the table today: Shaun Murphy and Mark Williams heavy, with a round belly; John Higgins short and stocky; Stuart Bingham and Barry Hawkins solid; Mark Selby, Ding Junhui, Kyren Wilson and Mark Allen (after losing six stone) in between; Neil Robertson, Judd Trump and Luca Brecel trimmer; Ronnie O'Sullivan lean; Zhao Xintong and Jack Lisowski slim.
  - A heavier build is more than a belly. The waist, seat, chest, upper back, arms, legs, neck and jaw line fill out with it, and the waistcoat, shirt and collar fill out with the body, so nothing shows through. A belly settles a little over the belt, and hangs as he bends over the table.
  - The skeleton is unchanged, so every animation, the stance, the cue and the rest, the faces and the lip-sync work as before. Checked down on the shot: no body goes into the table.
  - **Heights** come from published figures where there are any; the others are estimated. They run from Zhao Xintong (1.70 m) and John Higgins (1.73 m) to Mark Williams (1.85 m) and Jack Lisowski (1.86 m).
  - **Faces of their own.** Eight pros shared a face with another pro, or with you. Now each has their own: a different Rocketbox person's head, with its face shapes, full-size textures and hair, on the suit body, with their own waistcoat colour. They are Murphy, Brecel, Wilson, Lisowski, Allen, Hawkins, Bingham and Zhao. The faces are Rocketbox people chosen for hair and age, not likenesses.
  - Soy "The Titan" Oudom has his own file too. His body is as it was.
  - The pros are read when first needed (the opponent you pick, your next match in a tournament), not all at the start, so they take no memory until then. A match waits a moment for its players.
  - Size: each pro's model is about 0.2 MB and each new face about 2 MB, so the game is about 19 MB bigger (`characters/characters-pack.js` 80 MB, the single-file build 124 MB).
  - With **PEOPLE · HD** the pros keep their own models.
  - Tools: `tools/make_pros.py` builds them. It uses `tools/node/body_shape.mjs`, which reshapes a body to a build (a waist-to-height ratio, how much of it is belly) and measures the waist like a tape, and `tools/node/swap_body.mjs`, which puts a head on the suit body.
- **The camera no longer moves by itself when the mouse moves.**
  - The picture used to slide sideways whenever the mouse crossed a side panel or brought the scoreboard back, and the overhead view zoomed in and out with it. The framing followed how see-through the panels were; it now follows only where they are.
  - In the aiming view, moving the mouse turns the aim only over the table. On the way to the controls, or over the crowd, the aim and the camera stay where they are.
  - New in ⚙: **AIM · HOLD THE BUTTON** turns the aim only while the left button is held. A click still aims at the spot.
  - The aiming view keeps its framing through small turns of the aim. It re-frames only when the shot needs it (another ball, a much longer or shorter shot), not after every pause.
  - Camera labels are written only when they change. Before, they were rewritten on every movement of the mouse during a drag.
- New checks in `tools/test_camera_views.py`:
  - the mouse round the screen again and again: no view moves or slides;
  - the aiming view, with the mouse off the table and over it;
  - hold to aim;
  - small turns keeping the framing.

## Changes in version 7.1 (the camera, touch, the feel of the balls, replays and lip-sync)

- **One camera controller, four views.** AIM (behind the cue ball along your aim: the view to play from), TOP (the whole table from above, fitted to the screen and turned upright on a tall one), TV (the broadcast angles: ◀ ▶) and FREE (orbit any point). The buttons are under the camera name; **C** goes through the views (Shift + C back), **P** returns to AIM, **Home** resets the view.
  - The aiming view frames the whole shot and holds that framing while you turn, so it no longer pumps in and out as the aim crosses other balls; it turns as one piece round the cue ball, and never away from your aim by itself. The wheel brings it closer or wider; a right drag raises it or swings it round a little (the aim itself never moves).
  - **AUTO CAM** (the top-bar button, or **A**) is now the shot follow: at the strike the view stays as it was; if the shot will carry the play out of it, one smooth move to the broadcast angle the balls run away from (a high side angle when they run across the table), drifting a little towards the play, then back to your view when the balls have stopped. A hand on the camera during a shot takes over until they stop. Off, the camera stays on your view through every shot.
  - Changes of view are one smooth move (along an arc that lifts over the table, turning by quaternions, eased in and out); everything else is eased by the frame time, so the camera moves the same at 30 or 144 frames a second, with no drift when you stop.
  - The camera keeps out of the table (it rides over the rails and the cloth), the floor and the stands, walls, boards and chairs of every arena (measured once per arena); zooming out comes in along its line like a spring arm instead. The referee and the players fade while they stand between the camera and the play, or when the camera is inside them.
  - **Mouse:** the left button aims (FREE: it turns the camera, and a click aims); the right button moves the camera; the middle button or Alt + drag turns it; Ctrl / ⌘ + drag also moves it; the **wheel zooms** (to the pointer from above); Shift makes any of it fine; Shift + click picks a focus point; double-click a ball to focus on it. Over the shot power the wheel still sets the power; ↑ / ↓ too. (V stays the rail fade and R the practice re-rack, so the aiming view is P and the reset Home.)
  - **Camera settings** (⚙ next to the views): turn, zoom and move sensitivity, smoothing, the length of a change of view, AUTO CAM on shots, inverted vertical, reset view and default settings. They are kept for next time.
- **Touch.** One finger aims (a tap on a ball aims at it; with FREE it turns the camera); a pinch zooms and two fingers move the camera (in AIM they raise it or swing it round). A **FINE AIM** strip for small turns, and a cue at the side to **pull down for the power: let go to strike**, slide it back to cancel. A bigger spin pad. On small screens the scene director folds into its title (tap it) and the camera buttons sit above the shot controls.
- **Sharper on phones.** The picture is drawn at up to the screen's own pixel density within the number of pixels a laptop draws at the same quality, so a phone is no longer stretched up from a third of its sharpness; the people's textures are filtered for viewing at an angle (8× instead of 4×).
- **The feel of the balls.**
  - **Squirt:** side pushes the white a little off the line, away from the side struck (about 1.6° with full side). The aiming guide shows it, and the bot allows for it.
  - **Throw:** the grip between the balls now depends on how fast they slide on each other, as measured on real balls, so a slow cut is thrown more than a fast one.
  - **The nap:** a slow ball rolling across the table drifts a few centimetres towards the black; more on the club cloths, less in the championship arenas.
  - **Miscues:** struck right at the edge of the white the tip can slip, more likely the harder the hit, with a click; the spin pad's marker turns red there. Not a foul by itself.
- **Replays.** A remarkable shot is shown twice: close and slow (the strike, the key ball, the pocket), then from high above at nearly full speed. The paths of the white and the balls that mattered are drawn on the cloth in their colours as they run.
- **Hands.** The bridge hand's thumb is now cocked up beside the cue, so the cue lies in the V it makes with the first knuckle; the fist stays closed round the butt.
- **Lip-sync.** The referee's mouth takes the shapes of what he says, read from his voice as it plays (vowels, S and SH, closed lips as a word starts). The players mouth their reactions: YES!, NO, COME ON.
- New tests: `tools/test_camera_views.py` (every view; the cue ball framed by every cushion and pocket; no pumping; smooth view changes; rapid zooming; the arena edges; 30 against 144 frames a second; the shot follow; touch; resizing; saved settings), `tools/test_physics_feel.py` and `tools/test_lipsync.py`.

## Changes in version 7.0 (the people at the table at full quality)

- **The nine players and three referees at full Rocketbox quality.** The crowd is as it was.
  - Faces and bodies use the library's full-size textures (2048 pixels: four times as many as before), with its real normal maps on faces and hands and its shine maps on faces. Lips, nose and forehead catch the light; the rest of the skin stays soft.
  - The outfits are the same. Each waistcoat, shirt and bow tie was raised to the new size with the cloth detail of the original texture put back into it, and given relief at that size.
  - Hair is cut out properly. Six people (pro_m08, pro_m07, pro_m03, pro_b02 and the referees referee_m2 and referee_f1) had lost the cut-out and wore solid blocks of hair; they now have real hair cards, in their own hair colour.
  - The same mesh, skeleton and size as before (checked to the millimetre), so every animation, the cue, the rest and the walking work as they did.
- **Faces made with face shapes.** Expressions use the face shapes Rocketbox ships for these heads (the 52 ARKit shapes) instead of moving face bones. Smiles reach the cheeks and eyes, brows lift and knit, the lids close over the eyes, and the female referee's lashes blink with her lids. The 15 speech shapes are there for lip-sync.
- **Eyes that look at what they watch.** The eyes were aimed by the face's own axes, which tip about 19 degrees up on these heads, so they looked well below their target. They are now aimed by where each cornea points.
- **Smooth heads with their face shapes.** The smoothing at load (every triangle becomes four) now carries the face shapes along.
- **Soy "The Titan" Oudom** keeps his own face and outfit, now on the full-quality player body with its face shapes, real relief and shine. His 1.82 m athletic build is made when the game loads.
- **Memory.** At each new match, the players and referees who are not at the table give their textures back to the graphics card. They come back by themselves when needed.
- **The referee never walks into a player.** A player the camera hides (your own body in the player view, or one the camera is very close to) was treated as gone, so the referee, the other player and the paths ignored him, and the referee could walk straight through a player down on a shot by a pocket he had to clear. A hidden player now still takes up room, and the referee steps round anyone in his way, away from the table (in a 4-minute bot match he now never comes closer than 0.46 m, centre to centre).
- **Size and memory.** Each person at the table takes about 2.4 MB instead of 1 MB, so the game is about 21 MB bigger (`characters/characters-pack.js` 52 MB, the single-file build 94 MB). It opens as fast as before. On the graphics card a match takes about 440 MB of textures instead of about 210 MB, and it stays there however many opponents you play, because the ones who leave the table give theirs back (in 6.9 every new opponent added his).
- **Tools.** `tools/full_people.py` rebuilds the twelve from the Rocketbox originals (with `tools/node/full_avatar.mjs`, `shape_names.mjs` and `bind_boxes.mjs`). `tools/test_people.py` checks the face shapes, the eyes, the textures and the memory release. `tools/make_normals.py` makes the same relief at any texture size.

## Changes in version 6.9 (people who move like people, real rests, your own sounds)

- **People never walk through each other or the furniture.** Paths are planned on a map of the floor (A*), round the table, both chairs and the legs of whoever sits in one, the drinks table, the trophy, the TV cameras and objects placed in VELVET Studio. Walkers look ahead and steer round each other (by the right when they meet head on). Someone standing in the way steps aside, and the referee stands off and waits while a player crosses. What overlap is left is pushed apart.
- **No more spinning round before a shot.** Turns always go the short way, and while you swing the aim round your player waits for it to settle instead of chasing it round the table.
- **Getting up and sitting down.** A player leans forward over his feet and pushes up off the arm of the chair, the cue steadying him; he sits down the same way in reverse.
- **Getting down on a shot.** Feet first, then the cue arm and bridge hand as the back bends, the head last. The bridge hand's V and the cue hand's fist are measured every frame and moved onto the cue, so the cue lies in the bridge and runs through the fist on every body.
- **The cue in his hand.** Carried, the hand turns to hold the cue, so cue and hand move as one in the same frame: no lag, no flips. The tip addresses the cue ball where the spin is set (high for top, low for screw, to the side for side). Down on your shot the cue feathers more the harder you set the power, and changing the power draws it back as far as that power will take it.
- **The rest and the butt extension.** When the cue ball is out of reach the player asks for the rest; the referee fetches it from its hooks under the baulk end, walks it over and hands it to him (both reach for it), and takes it back afterwards. For long shots the player takes a screw-on extension from his pocket and screws it onto the butt (and off again).
- **More life between shots.** Players chalk their cues, lean on them, rub their chins, look round the room. The bot sometimes chalks before getting down. Reactions after a shot now actually play (they never did before). Walk-on greetings and replay celebrations are chosen fresh each time (a wave, a bow, the cue raised to the room, a fist pump, a nod), and the walk-on cameras vary.
- **The crowd.** Idle and clapping motions loop without jumping back to their first pose. A cheer plays once and runs on into clapping, eased in and out. Every reaction (replays included) picks who reacts, how soon, how long, which motion and how fast, fresh each time.
- **Faces.** Eyelids follow the eyes down only a little, so a player looking at the table no longer seems to have his eyes shut.
- **See-through done cleanly.** A person fading out of the way (the referee between the camera and a ball, a player the camera is too close to) and the smart rail fade now lay down their depth first and blend their colour over it: evenly see-through, never the inside of a coat or the far side of a rail, and no more dotted dither.
- **The panels keep clear of the balls.** Every overlay (scoreboard, match panel, controls, dock, captions, the SKIP button, hints) fades almost away while any ball is behind it, and the picture is framed in the space between the side panels.
- **Camera: pan like Blender.** Shift + middle drag or Shift + left drag moves the camera sideways and up or down; Ctrl + middle drag zooms. A Shift + click that does not move still picks a focus point.
- **Snookers required.** The match panel says how many (each forced foul is worth at least four, or the value of the ball on when only colours are left), and a message tells the player at the table.
- **Tournaments are drawn at random** from all the players there are (opponents and players made in VELVET Studio), with you anywhere in the draw.
- **Commentary with feeling.** Big shots, big breaks and frames won come quicker, higher, louder and brighter, often after a quick "Oh, yes!" or "Superb!"; a fluke more so; a miss, a ball in the jaws or an in-off comes lower, slower and duller, often after an "Ooh..." or "Oh dear."; tense moments are hushed.
- **Your own sounds.** SOUNDS in the scene controls: replace any sound effect (ball on ball, cue, cushion, pocket, three kinds of applause, the crowd's "ooh", the arena murmur) with a file of your own. It is kept in this browser only; RESET brings back the built-in sound.
- **Pockets with chrome ball-return rails.** Under each pocket a wire basket drops the ball onto a chrome rail that turns along the side of the table and runs down to a U-bend, where the balls wait in a line. Real contact physics, as before; the referee takes colours off the rail.
- **Relief on every person.** Each body and face now has a normal map made from its own texture (folds and creases, seams, buttons, the weave of a waistcoat), so clothes catch the light instead of looking printed on.
- **Tools.** `tools/make_normals.py` makes the normal maps; `tools/test_people.py` and `tools/test_tournament.py` check the new behaviour.

## Changes in version 6.8 (the classic people are back, with faces that move)

- **The classic players and referees are back by default.** Next to the original models, the MPFB bodies from 6.7 looked plain and boxy. They are now an option: **PEOPLE · CLASSIC / MPFB** in the settings (CLASSIC unless you switch). The game only reads `characters/hd.js` when MPFB is on, so it also starts faster.
- **Faces that move, on the classic people.** The players and the referee use the face bones the classic models already have:
  - The eyelids swing round the eyeball to blink, squint or open wide, and they follow the eyes when they look down at the ball or up.
  - The brows go up, down or worried. The mouth corners smile or frown. The lips press, pucker or sneer, and the jaw opens.
  - Everything from 6.7 still happens: blinking, eyes following the play, focus on a shot, a face for every reaction, the winner's smile, and the referee's mouth following his voice.
- **Smoother bodies.** When the game loads, every triangle of the players and referees becomes four. Each new point sits on the curved surface the model describes. Heads, shoulders and arms are rounder, and the textures and clothes are unchanged. The crowd stays as it was.
- **Cleaner outfits.**
  - **Lighting.** Six opponents and two referees were lit in flat, blotchy facets. Their models carried a one-pixel stand-in normal map, and the game now ignores it.
  - **Waistcoats.** The leftover specks of the old suits are gone. The V-necks of player_01, pro_m03, pro_m07, pro_m08, pro_m13 and pro_b02 now close above the first button.
- **Tools.** `tools/clean_textures.py` made the texture changes, and `tools/test_people.py` checks all of the above.

## Changes in version 6.7 (HD people: detailed players and referees with faces that move)

*Since 6.8 these are optional (PEOPLE · MPFB); the classic people are the default.*

- **HD people.** The nine players and three referees at the table are rebuilt in Blender on MPFB 2 bodies (the free MakeHuman for Blender). Each has about 90,000 triangles instead of about 10,000: smooth heads, real fingers and a tailored snooker outfit.
  - **The same people.** Each keeps his own photo face, hair, eye colour and waistcoat colour, so you still know who is at the table. Soy Oudom keeps his own face.
  - **How the face is made.** MPFB's face sliders are fitted to the old head's shape: eyes, nose, mouth, jaw and skull. The photo is then painted onto the new skin, with the hair painted onto the scalp.
- **Faces that move.** Twelve face shapes come from MPFB's FACS-style expression units: blink, squint, wide eyes, brows up, brows down, worried brows, smile, frown, pressed lips, open mouth, pucker and sneer. The eyelashes, teeth and tongue move with the face.
  - They blink at natural intervals, sometimes twice.
  - Their eyes follow the play with small saccades, and never turn further than eyes can; the head does the rest.
  - On a shot they narrow their eyes, lower their brows and press their lips.
  - Every body reaction brings its face: a fist pump smiles, anger lowers the brows, disbelief opens the eyes and mouth, a sigh worries the brows.
  - After a frame or a match, the winner smiles and the loser shows it.
  - The referee's mouth moves with his voice: it follows the loudness of each call.
- **PEOPLE · HD / CLASSIC** (in the settings, next to COMMENTARY) switches between the HD people and the original models (since 6.8: **PEOPLE · CLASSIC / MPFB**). It reloads the game; during a match it applies next time.
  - A character you changed in VELVET Studio keeps your version.
  - The crowd stays as it was.
- **Files.** `characters/hd/*.glb` holds one compressed model per character, each 0.6–0.9 MB (meshopt, like the other people). `characters/hd.js` lists them and packs them for opening the game from your disk.
- **VELVET Character Maker 2.0 (Blender add-on, in `blender/`)** makes and edits HD people:
  - **HD people** panel: pick a player or referee, press **Make HD person**, reshape him with MPFB's sliders, then **Export**. He replaces that character in the game.
  - **Add a face that moves** gives your own MPFB people the same face shapes. MakeHuman's eyebrows and eyelashes follow the skin they sit on.
  - Eyes are now fitted after the body is shaped.

## Changes in version 6.6 (VELVET Studio: objects and textures)

- **A second workspace in VELVET Studio: OBJECTS & TEXTURES.** Open it in any of three ways:
  - the OBJECTS & TEXTURES tab in VELVET Studio
  - the STUDIO button in the game's top bar
  - `index.html#studio`

  It runs inside the game engine, so you work on the real arena, table and people and see every change at once.
  - The list holds every object, in groups:
    - **People:** players, referees, audience
    - **Table:** the table, the pocket nets, the lamp
    - **Balls & cue**
    - **Venue:** the whole venue, the seat model, the trophy, the TV cameras
    - **Props:** players' chairs and glasses
    - **Your objects**
  - Click an object in the list or in the view. Drag to turn, right-drag to move, wheel to zoom.
- **Pictures on everything.** Each object lists its pictures, one per material.
  - IMAGE / VIDEO puts in your own image or video. You can also drop the file on it.
  - TINT, TILE and GLOW change the picture. ↺ puts it back.
  - SAVE PICTURE gives you the current picture to paint over. On a person, that is the way to make your picture fit the model.
  - Videos play muted on a loop, so an LED board, an arena screen or a banner becomes a digital banner.
- **Your own objects.** + MODEL adds a .glb model. + BANNER adds a flat screen for an image or a video.
  - Move them with the arrows in the view, or type the position, turn and size.
  - Show each one in every venue or in one venue only.
- **To Blender and back.** EXPORT .GLB saves any object, or a whole venue, as a .glb file. Invisible markers named `VX_…` go with it; the studio's VX MARKERS ? button explains them:
  - `VX_TABLE`: the table's box. Models line up by it.
  - `VX_SEAT`: a spectator sits here, looking along the arrow.
  - `VX_ENTRANCE`: where the players walk on.
  - `VX_TROPHY`, `VX_TVCAM`: the trophy's spot and the TV cameras.
  - `VX_SCREEN_LIVE`: shows the live picture.
  - `VX_CLOTH`: behaves like cloth.
  - `VX_POCKET_…`, `VX_CUE_TIP`, `VX_LIGHT`.
  - `VX_KEEP_CLEAR`: the players' walking space.

  In Blender, use File › Import › glTF 2.0. When you have finished, use File › Export › glTF 2.0 (.glb) with +Y Up. One unit is one metre.
  - YOUR MODEL replaces the look of the table, the nets, the lamp, the trophy or the seat model. The physics never change: the balls still roll on the official table.
  - + VENUE turns a venue .glb into a new venue in the VENUE menu.
    - The crowd sits at its `VX_SEAT` markers.
    - The players walk on from `VX_ENTRANCE`.
    - `VX_SCREEN_LIVE` screens show the match.
- **The nets move like cloth.** A ball in a pocket net now stretches the net around it. Any mesh marked `VX_CLOTH` does the same, in your own table models too.
- **Saving.**
  - SAVE writes `objects/objects.js` and `objects/media/` into the game folder. Chrome and Edge ask for the folder once; other browsers download `objects.js` for you to put in the `objects` folder.
  - EXPORT and IMPORT share everything as one `.velvetobjects` file.
  - Undo and redo with Ctrl+Z and Ctrl+Y.
  - To go back to the original look, delete `objects/objects.js`.
  - The single-file version also reads `objects/objects.js` when it sits in the game folder.

## Changes in version 6.5 (World Championship Arena)

- **A new venue: the World Championship Arena.** Pick it from VENUE on the start screen. All the other venues are unchanged.
  - Steep stands rise on three sides and meet at lit corner stairways. There are aisles with gold step lights, private boxes lit red above each side, and a front row behind the cameras.
  - Three giant LED screens hang behind the far end. The middle one shows the championship graphic. The two side screens take turns showing their graphic and the live picture with the score.
  - Over the table hangs a lighting rig: an octagon edged in red neon with twelve white panels. Trusses of white and blue lamps hang above it.
  - Around the stage are LED boards with red neon top and bottom, TV cameras on tripods, the trophy on its plinth, and blue and red light on the crowd.
  - The players walk on through a lit players' entrance at the front corner.
  - The same table, physics, players, referee and controls are used. When the camera looks down from high up, the rig is hidden so it never covers the table.
- **The arena has its own branding.** It uses a crown in a red hexagon and WORLD CHAMPIONSHIP. It does not use the WST logos from the reference photo or the VELVET mark.
  - The scoreboard, the replays, tournaments and the opening titles name the WORLD CHAMPIONSHIP.
  - The MC welcomes you to the World Championship Arena.
  - The game itself is still VELVET.
- **The venue card.** Under VENUE, each venue now shows a render of itself, a short description, its lighting and its crowd.
- **Switching venues** rebuilds only the arena, without reloading the game, and frees the old venue's models and pictures.
  - Fixed: leaving the Championship Stage no longer breaks its live screens when you come back.
  - Fixed: each switch used to leave the old crowd's skeleton data on the graphics card. It is now freed, so switching back and forth no longer uses up memory.

## Changes in version 6.4 (a more human game)

- **The camera frames your shot by itself.** While you aim, it stands behind the cue ball and fits the cue ball, the ball you will hit and the pocket it is heading for into one view. You no longer need to drag the view to check a shot.
  - It zooms in for short shots and pulls back for long ones. When no pocket is in line, it shows the first part of the object ball's path.
  - Captions move to the right while you aim, so they never cover the cue ball.
  - Dragging, zooming and the camera presets still work as before.
- **The bot plays like a person, not a calculator.**
  - It misjudges shots: sometimes it goes for a pot that is too hard, and sometimes it turns down an easy one.
  - Its mood changes with the score. It takes on more when it is behind, and plays safe when it is well ahead.
  - It has a pre-shot routine. It looks along the shot from behind the cue ball, gets down, and settles its aim. On hard shots it sometimes stands up and starts again.
  - Its feathering is uneven, and it sometimes takes a long time over a shot.
  - Its misses are human ones: thin or thick on cuts, not random. Its gold aiming line is gone, so you see only its cue.
- **The commentators talk to each other.** There are 51 short two-person conversations: one commentator starts, the other answers. They also react the moment something happens: "Shot!" on a long pot, "Ooh!" when a ball rattles in the jaws, "Oh dear." when the white goes in.
  - The voices rise on big moments and drop when a player is down on a shot.
  - Long silences while a player thinks get filled.
- **Many more movements.**
  - Players rub their chin, touch their brow, adjust their collar and rest a hand on the hip while they wait, standing or seated.
  - Players react in more ways: a facepalm, hands on the hips, a look up, a shrug, a headshake and a nod.
  - Thirty-seven new motion clips cover how people sit, stand, clap and cheer. Each spectator gets their own habits and their own way of reacting, so the crowd never moves together.
  - The crowd gasps at near-misses. The referee shifts his weight and changes position between shots.

## Changes in version 6.3 (a new player: Soy "The Titan" Oudom)

- **A new opponent: Soy "The Titan" Oudom**, from Cambodia. Choose him from the opponents list.
  - He has his own face and outfit (with the name badge), on the Rocketbox player body.
  - He is 1.82 m tall, with an athletic build.
  - His model was `characters/models/soy_oudom_the_titan.glb`, with the textures inside it. From 7.0 he uses the full-quality player body (`player_01.glb`) with his own textures, and his build is made when the game loads. It uses the same Rocketbox skeleton as the other players, so every animation in the game works with it.
- **How he plays:** balanced and tactical. He is accurate and positions the cue ball well, plays strong safety, and has a medium, deliberate tempo.
- **His cue:** a dark walnut shaft, an ebony butt, brass fittings and a leather tip.
- **How he reacts:**
  - easy pot: calm; hard pot: a nod.
  - miss: brief disappointment.
  - winning a frame: a small fist pump.
  - century, and after the match: a raised hand to the crowd.
- **Walk-on:**
  - The name strap reads SOY "THE TITAN" OUDOM · CAMBODIA.
  - The MC announces him "representing Cambodia, standing at one metre eighty-two". He uses a shorter announcement when the opening is set to short.
- **Referee:** "Soy Odom" before his break score, "Frame to Soy Odom." and "Frame and match, Soy Odom."
- **Commentary:** all twenty commentators can say his name, and each has six lines of his own: an introduction, a long pot, a safety, a century, a rare miss and the match win. His name is spoken as "Soy OH-dom".
- **New options** for your own characters:
  - in `characters/characters.js`: `muscle`, `roughness` and `cue`.
  - in `js/opponents.js`: `nick`, `country` and `react: 'composed'`.

## Changes in version 6.2 (new commentary voices)

- **A new commentary team of twenty voices**, chosen by ear in the voice audition. It replaces the old team of thirteen.
- Most of the voices are British: from Cumbria, Yorkshire, Birmingham and the South of England, plus an Irish voice and RP voices. There are also American and neutral voices, and seven of the twenty are women.
- The voices come from three offline speech models: Supertonic 3, Kokoro and Piper.
- Commentators slow down when it gets tense, at frame ball, match ball or a maximum on, and quicken at the big moments: long pots, flukes, centuries and clearances.
- Each line is recorded by more of the commentators than before, so any pair drawn for a match still has plenty to say.
- The voice credits and licences are listed under Credits. One voice, Prue Adair, may only be used non-commercially.

## Changes in version 6.1 (a new Championship arena)

- The **Championship Stage** is now a complete round arena, not a restyled room. The table sits in the middle of a bowl of 17 stepped tiers in 14 sections, with lit aisle steps between the sections.
- The players walk out of a lit **players' tunnel** cut through the lower tiers.
- The two front rows are animated spectators; the upper tiers are filled by a crowd drawn as one batch of cut-out people, so the full house costs little to draw.
- Overhead are a hanging lamp ring, a dark roof with rings of stage lights, a lit sponsor fascia round the top of the bowl and coloured washes on the crowd.
- The front wall of the bowl stands clear of the first row, so seated legs no longer show through it.
- A 360° view of the arena, rendered in the game, is included as `VELVET_Championship_Stage_360.jpg`. Any 360 photo viewer opens it.

## Changes in version 6.0 (realism and presentation)

**Table and balls**
- **Real pockets.** The old capture circle is gone. Corner mouths are 88 mm and middle mouths 100 mm, measured between rounded knuckles. The facings narrow toward the back of the pocket. A ball drops only when its centre passes over the fall (the slate's edge) behind the jaws. A ball cut into a jaw rattles and stays out; a slow ball can hang on the edge. Jaw hits are resolved at the moment of contact, so even a full-power shot cannot slip through a jaw. `tools/test_pockets.py` measures how wide each pocket plays at each angle.
- **The table is rebuilt.** It now has polished dark mahogany rails, a brass inlay and name plates on the frieze, and eight turned, fluted gold legs. Tan stitched leather shoulders wrap each pocket. The cushions end exactly where the physics jaws are.
- **See-through pockets with nets and rod catchers.** The slate is cut at every pocket, so you can see down into a white net. The net lies in a cradle of black rods with a brass ring and end plate, which replaces the old ball-return rails and tray. Potted balls drop in and roll to the end with real contact physics. The referee takes colours out of the pocket they fell into, and empties a pocket when it fills with reds.
- **Textured balls.** Every ball has faint phenolic-resin marbling and flecks under a clear coat, so you can see a ball roll and spin.
- **A new cue.** It has a domed tip, a brass ferrule, an ash shaft with its grain and a pro taper, a brass joint, a hand-spliced butt with four ebony points, an ebony butt, a brass cap and a rubber bumper.

**Venue**
- **Championship Stage**, a new venue: a round stage with a red light rim; a curved barrier of LED boards; a hanging light ring; two big screens showing the live picture from their own camera, with a score bar; a trophy on its plinth; broadcast cameras on tripods; and a full crowd all round. It carries VELVET's own branding.

**Players**
- **Each pro has a look of his own.** Six more bodies were tailored into snooker dress (waistcoats in different colours, white shirts and sleeves, bow ties, black trousers and shoes). Each pro gets a body chosen by general traits such as build, hair and skin. These are not likenesses of the real players.
- **Shot motion.** The body stays still on the shot and only the cue arm and cue move. The stroke is a backswing, a pause, then the cue accelerating through the ball, and the ball is struck when the tip arrives. The cue follows through after the strike. The bot feathers the cue while it settles. The idle sway that made the arms twitch in the stance is gone.
- **Cue in the hand.** A carried cue now sits in the hollow of the fist instead of floating beside it.
- **Reactions.** After a miss or a foul a player may hang his head, look up at the lights, stare at the pocket or sigh; after a fine pot he may nod. Each player avoids repeating his last reaction.
- **A real walk-on.** The MC welcomes the arena and announces each player in turn, with nicknames for the pros. Each player walks out, with the camera starting on his shoes and rising to his face, and acknowledges the crowd at the table before going to his chair. The referee is introduced, then the MC calls quiet please. Name straps appear on screen. Click or press any key to skip.

**Opponent**
- **The bot plays like a person.** Its cueing error grows with a thin cut, pace, side, a long pot, a white on or near a cushion, a long stretch or the rest, cueing over a ball, and pressure. It has occasional lapses, and its pace control is looser on hard shots. It plans with the same error model, so it avoids shots a person would avoid. It thinks longer over hard shots.
- **SKIP:** BOT TURN · WATCH / SKIP in the scene panel, or **S** to skip the opponent's thinking and walk-up once.

**Voices**
- **A commentary team.** Two of twenty commentators are drawn for each match. They talk about what really happens: long pots, thin cuts, flukes, position, misses, balls in the jaws, safeties, snookers, fouls, breaks as they build, a maximum on, frame and match ball, and results. No line is used twice in a match, and they never talk over the referee. Turn them off with COMMENTARY · ON/OFF. Captions show who is speaking.
- **Referee calls by name.** When a break of 15 or more ends, the referee calls it with the player's name ("Shaun Murphy, twenty-four"). He also says "Players, please", "Quiet, please", "Snookers required", "Ball in hand", "Play again", "Replace the balls" and the colours. Two more referees, one of them a woman, share the matches, and a different one is drawn each session.

**Presentation**
- **TV CAMERAS (T).** A broadcast director takes the opponent's turn and every shot. It cuts close on the player thinking, down the line behind the cue ball, to the wide and the overhead while the balls run, to the reaction, the opponent in his chair, the referee, the crowd and the arena. Your own turn always stays in your hands.
- **The opening.** On the first launch, a 45-second title sequence runs in real time. The arena comes out of the dark and the camera runs along the table, cushions, leather, nets, catchers, balls and legs. Then come the referee, a player's walk to the table, and a break-off played with the real physics on a copy of the rack (put back exactly afterwards), before the camera rises over the arena into the menu. Later launches get a 5-second version. **SKIP INTRO**, Esc, a click or a tap skips it. INTRO · AUTO / FULL / SHORT / OFF and ▶ WATCH INTRO are in the scene panel.
- **Settings:** WALK-ON · ON/OFF, MOTION · FULL/REDUCED (reduced turns off the opening, the walk-on and TV cuts, and follows your system's reduced-motion setting), and an audio mix with separate volumes for the table, crowd, referee and commentary.

Not included: background music (no music files ship with the game). The referee takes balls from the pockets, but there is no racking-the-triangle animation, because the characters have no hand animation for it.

## Changes in version 5.10 (people made in Blender)

The new **VELVET Character Maker** add-on for **Blender 5.3** makes realistic people for the game, with a real 3D body, face, hair and clothes. It uses the free **MPFB** (MakeHuman for Blender). The add-on and its step-by-step guide are in the **`blender`** folder (`blender/README.md`).

- Press **New man** or **New woman**, shape the person with MPFB's sliders, add eyes, hair and clothes, then press **Export to VELVET**. The add-on fits the person to the game's skeleton, so walking, the shot stance, sitting, cheering and clapping all work.
- **Dress in a snooker outfit** tailors real 3D clothes to the body, in your colours: shirt with collar and cuffs, waistcoat with buttons, pockets and a satin back, pressed trousers, socks, shoes and a bow tie.
- Make **players, referees or audience**. Audience members take seats in the stands straight away. In VELVET Studio, a player made in Blender can be your body, player two's or an opponent's, and a referee can referee the matches.
- VELVET Studio marks them **made in Blender**. In the studio you set their name, role, profile, shape and cue. Their face, hair and clothes change in Blender: press **Export again**.
- They are saved in `characters/blender.js` (with the models in `characters/blender`), apart from the studio's `characters/studio.js`. The single-file version reads it too when it sits in the game folder. Deleting `characters/blender.js` takes them all out.

## Changes in version 5.9 (VELVET Studio: your own players, faces and characters)

Open **`VELVET Studio.html`** (next to `index.html`) to edit the people of the game. It works offline like the game, with the same 3D engine and character loader, so a character looks the same in the studio as in a match. Chrome or Edge is best.

**Characters and players (left list):**

- **You & Player two:** your name, short name (scoreboard) and nickname (walk-on), and the body you play with. Player two is for 2-player games.
- **Opponents:** the 15 pros, the Club Bot and your own opponents. Edit the full name, short name, nickname, body and playing style (potting, long pots, attacking, positional play, safety, speed). Your own opponents can enter tournaments: the 15 best-rated players make the 16-player draw with you.
- **Player bodies, referees, audience:** add (**+ NEW**), copy, rename, delete or hide anyone. **New → Opponent** makes a body and a player profile in one go. Every character starts from one of the game's 15 bodies.

**Character tab:** name, role (player body, referee, audience), body, seated as man or woman, height, head size and belly, who plays with this body (you, player two, an opponent), match referee, and how often an audience member gets a seat.

**Look tab:**

- **Outfit colours:** press **Pick a part** and click the clothes on the model (the waistcoat, the shirt, the trousers). Shift+click adds more; the **＋** and **−** brushes add to or take away from the part. Pick a colour from the chips or the colour box. "That colour everywhere" picks every part of that colour on the body.
- **Skin colour** (face, ears, neck and hands) and **hair colour**.
- **Cue:** shaft wood, butt colour, fittings (brass, silver, gold, black) and tip. Each player carries and plays with his own cue in the game.

**Face tab:**

- **Face from a photo:** load (or drop) a photo, then drag the three dots onto the eyes and the mouth. The photo is laid onto the head from the front and blended into the skin; the ears, neck and hands are matched to the photo's skin colour. Sliders: face width and height, soft edge, even out light (softens shadows on one side), photo brightness. The model keeps its own eyeballs, so the eyes still move.
- **Touch-up brushes on the model:** paint, restore (brings back the original under the brush) and blur. `[` and `]` change the brush size.
- **Stickers:** moustache, glasses, sunglasses, clown nose, blush, heart, star, war paint, scar, sponsor patch and text. Click the model to place one, drag to move it, then set its colour, size and turn.

**Viewing:** front, side, back, face and game-view cameras; poses (standing still for editing, idle, walking, sitting on a chair, cheering, clapping); studio or arena light; a slow turn. Drag to turn, right-drag to move, wheel to zoom. **Undo/redo** with Ctrl+Z / Ctrl+Y.

**Saving and sharing:**

- **SAVE** writes everything into `characters/studio.js`. In Chrome or Edge you choose the game folder once and the studio writes straight into it. Other browsers download `studio.js`: move it into the game's `characters` folder. Reload the game to see your characters.
- The single-file version (`Velvet_Snooker_3D_Physics_Studio_Standalone.html`) also reads `characters/studio.js` when it sits in the game folder.
- Your edits live only in `characters/studio.js`; `characters/characters.js` and `js/opponents.js` are never changed. **Save ▾ → Reset all** (then save), or deleting `characters/studio.js`, brings back the original characters.
- **TEST IN GAME** opens the game straight into a one-frame match against the selected player (he breaks), with your unsaved changes. For a referee or audience member it starts a match with them as the referee or the whole crowd.
- **EXPORT** saves one character (with his face, look and player profile) as a `.velvetchar` file. A friend presses **IMPORT** (or drops the file on the studio) to add him to their own game.

**In the game:** each opponent's body takes the chair at the start of a match (and when you pick him in the menu), with his own cue. Your short name shows on the scoreboard and full names with nicknames on the walk-on, e.g. SAM “THE ROCKET” LEE. A player you made has no recorded name, so the referee says just "Frame." for him.

## Changes in version 5.8 (players carry their cue)

- Each player has his own cue. He carries it in his right hand as he walks round the table, tip forward and up, and holds it upright with the butt on the floor while he sits.
- As he gets down on the shot, the cue comes down onto the line in the same movement. It is the cue you see striking, and it comes back up with him as he stands. In replays it lifts with him after the shot.
- In the player view, where your own body is hidden, the aiming cue is drawn as before.

## Changes in version 5.7 (players walk round the table; only what you see is drawn)

**The players move like people.** A player no longer slides or fades between his chair and the table:

- He stands up out of his chair, walks round the table along a lane (never through it), turns on the spot and gets down on the shot. After the shot he stands up, watches the balls run, then walks to his next shot, or back to his chair to sit down.
- Every change of motion (sit, stand up, walk, stop, turn, get down, stand up, sit down) is a timed, eased blend. The walk plays at the speed he moves, so the feet don't skate.
- Down on the shot, his feet stay planted. When you move the aim, one foot at a time steps to its new place; a big change of aim sends him round to the new spot.
- The player coming to the table waits for the other to get back to his chair. The two never walk through each other, and the referee steps back out of their way.
- The opponent strikes only once his player is down on the shot. If you shoot before your player has reached his spot, he is put straight down on it.
- The chairs are a little further back, to leave a walkway in front of them.
- When the opponent lines up, the camera shows the shot side-on, so you see him and the shot together.

**Only what the camera sees is drawn.**

- People out of shot are skipped. Each body has a generous box round it, so nobody loses an arm at the edge of the picture.
- Spectators out of shot also stop animating (they cast no shadows) and carry on where they were when they come back into view.
- Each stand's seats and back-row figures are a separate batch, so a stand behind the camera is skipped as a whole. The ball-return rails are merged into two pieces.
- Physics, rules, sound, the referee, the bot and replays don't depend on what is drawn, so nothing else changes.
- Measured in The Velvet Room on High quality:

| View | Draw calls | Triangles | Spectators animated |
|---|---|---|---|
| TV main | 616 → 383 | 1.11 M → 0.72 M | 93 → 43 |
| Low side view | 524 → 198 | 1.06 M → 0.37 M | 93 → 6 |
| Pocket close-up | 441 → 201 | 1.04 M → 0.48 M | 93 → 25 |
| Wide arena | 633 → 457 | 1.11 M → 0.88 M | 93 → 63 |

**Your own `cue` animation works.** A player entry in `characters.js` that names a `cue` clip now plays it when he gets down on the shot, instead of the computed pose. (In 5.6 this was described but not wired up.)

## Changes in version 5.6 (replays, players at the table, ball return)

**The players are at the table.** Both players are now 3D characters in waistcoat and bow tie. The one at the table gets down on every shot:

- the bridge hand rests flat on the cloth;
- the chin is over the cue;
- the cue hand grips the butt and swings from the elbow with your stroke.

The pose is worked out live for any aim, cue ball position and stroke. Shots out of normal reach are played with the rest and an extension. The other player waits in their chair. When you use the player view, your own player is hidden so he does not block the picture.

**Replays.** Every shot is recorded. After a remarkable one, the broadcast cuts to a slow-motion replay with a tag such as **FLUKE**, **PLANT**, **DOUBLE**, **LONG POT**, **2 BALLS IN ONE SHOT**, **3-CUSHION ESCAPE** or **IN-OFF**. The replay shows:

1. the player down on the shot, from the side;
2. a camera following the key ball;
3. the pocket camera as the ball drops;
4. the player's reaction.

The frame-winning pot is replayed as **FRAME BALL** (or **MATCH BALL**) before the end screen. Press **Y** or click **REPLAY** to see the best shot of the frame again. Click or press any key to skip a replay.

**Walk-on.** A match opens with both players walking out to their chairs to applause, with the event and the names on screen. Click or press any key to skip it.

**Ball return.** Potted balls no longer vanish into an invisible net. Each pocket has a leather drop tube onto a pair of chrome rails under the cushions. The ball rolls down the slope and around the baulk end into a tray, where the balls queue up against each other. This is real contact physics, not an animation: gravity, rolling on the rails, and ball-against-ball knocks with their sound. In testing, balls potted at any pace into all six pockets ended up in the tray every time. The referee walks to the tray, waits for a colour to arrive, takes it and re-spots it.

**Characters.** The people data file now has a third role, `player`; the game uses the first two `player` entries. A player model on the Rocketbox skeleton is posed at the table automatically. A different model can bring its own `cue` animation in `clips`. A `cheer` motion was added for the players' reactions.

## Changes in version 5.5 (cameras, venues, characters, fairer bot)

**Player view and a real auto director.** A new **PLAYER VIEW** camera stands behind the cue ball and looks along your aim, the way a player sees the shot. Move the mouse left or right to turn the aim (hold Shift for fine adjustment), or click a ball to aim straight at it. Ctrl + mouse wheel zooms any camera.

**AUTO CAM** now changes with the play:

- the player view while you aim;
- a view of the D and the table when the white is in hand;
- a view along the opponent's line while it gets down on its shot;
- a high TV angle while the balls are running.

The picture is framed in the space above the shot controls, so the near end of the table is no longer hidden behind them.

**See-through.** The referee fades out when he stands between the camera and a ball. The scoreboard, match panel, scene controls and shot controls fade when a ball is behind them. Point at a panel to bring it back. The cushions fade the same way as before.

**Five venues.** Choose one under **VENUE** on the start screen; the arena changes behind the menu as you pick. Each has its own seating, colours, lighting, LED boards and scoreboard:

| Venue | Style |
|---|---|
| The Velvet Room | the original arena |
| The Theatre | intimate and steep |
| The Palace | a grand hall |
| Grand Arena | big and modern, with a crowd on four sides |
| Dragon Dome | red and gold |

The front rows are animated spectators; bigger venues fill the rows behind with simple seated figures. A tournament is played in the venue it was started in, and the event takes the venue's name.

**Your own characters.** The people are now ordinary files in the `characters` folder:

- a `.glb` model for each person, in `characters/models`;
- their textures as separate images in `characters/textures` (for example `referee_head.jpg` is the referee's face);
- the people data file, `characters/characters.js`, which lists them.

To change a face, edit or replace the image. To use a better model, point an entry at your `.glb`. To add someone, add an entry: role `referee`, `player` or `audience`, gender, the model, its textures and an optional height in metres. Models built on the Rocketbox skeleton share the included motions. Other models can bring their own animations and name them in `clips` (idle, walk, take, sit, clap, cheer, and cue for a player).

When you open the game by double-clicking `index.html`, browsers do not let it read loose files. After changing characters, open **Pack Characters.html** once and choose the game folder. It rebuilds `characters/characters-pack.js`, which the game reads. With a local web server, or when the game is online, the files are read directly and no packing is needed. A broken or missing character is skipped with a note in the browser console; the game still runs.

**Escape line on request only.** The automatic cushion-path line is gone; the aim line now stops at the first cushion. When you are snookered, the game says so. You can ask for **ESCAPE HINT** (or press **E**) once per match. It finds an escape, lines you up on it and shows the white's path round the cushions for that shot. In two-player mode each player gets one.

The bot has the same allowance: once per match it may use its exact escape planner. For its other escapes it judges the angle by eye, with its level's margin of error. In testing it escaped onto a full pack of reds about half the time on Easy and almost always on Medium and above; single-ball snookers are missed more often. A failed escape is a foul, and usually a miss, as for a player.

**A more natural bot.**

- **Clean pots only.** The bot only plays pots where the white strikes the chosen ball first and that ball runs straight into the chosen pocket. It no longer plays shots that brush past other balls or rely on kisses.
- **Plainer shot choice.** It takes on thin cuts, very long pots, heavy side and power shots less readily.
- **More misses.** Every level misses more, long pots are harder, and now and then a stroke is simply a poor one.

In testing from random positions, single pots went in about 55% of the time on Easy and 85–93% on Medium to Very Hard (it still chooses the easiest pot available). Average breaks were about 3 (Easy), 10 (Medium), 20 (Hard) and 23 (Very Hard).

## Changes in version 5.4 (tournaments)

**Tournament mode** is a 16-player knockout in the style of a WST ranking event: last 16, quarter-finals, semi-finals and final.

**The draw.** The top eight players are seeded and kept apart in the draw, the way real seeding works. You and the other seven unseeded players are drawn against them.

**Playing.** You play your own matches at the table against the drawn professional, with their playing style at the level you choose. Every other match is played out frame by frame from the players' strengths, so upsets happen.

**Formats.** Each format sets the match length for each round, as real events lengthen towards the final:

| Format | Last 16 | Quarter-finals | Semi-finals | Final |
|---|---|---|---|---|
| Quick | best of 1 | best of 1 | best of 3 | best of 3 |
| Standard | best of 3 | best of 3 | best of 5 | best of 7 |
| Pro | best of 5 | best of 7 | best of 9 | best of 11 |

**The tournament screen** shows the whole draw with frame scores and your next match.

**Prize money:**

| Result | Prize |
|---|---|
| Lose in the last 16 | £5,000 |
| Lose in the quarter-finals | £10,000 |
| Lose in the semi-finals | £20,000 |
| Runner-up | £40,000 |
| Champion | £100,000 |

Your career record (events, titles, finals and earnings) is kept across tournaments.

**Saving.** The draw and the score of your current match are saved after every frame. Close the game and come back later, and **Continue match** picks up at that frame score. If you are knocked out, the rest of the event is played out and the champion is shown. **New tournament** asks you to click twice before it discards an event in progress.

**More pros.** Brecel, Hawkins, Bingham and Lisowski join the field, so there are 15 professionals, and the referee calls the frame for each of them.

## Changes in version 5.3 (sound)

**Table sounds are modelled on the physics of the real thing.** No usable recordings were available offline, so every table sound is generated from a physical model:

- **Ball clicks:** a 0.3 ms contact between two 52.5 mm resin balls, so harder hits sound brighter and sharper.
- **Cue strike:** the softer, longer contact of a leather tip, plus the ring of the cue.
- **Cushions:** a rubber cushion and wooden rail, a dull thud.
- **Pockets:** the ball hits the leather fall, then drops into the pocket. Some takes include a knock on the jaw or a click against a ball already in the pocket.

There are several takes at each strength, so repeated sounds are not identical. Each sound is picked by the real impact speed and panned to where it happens on screen. Part of it goes through the arena's reverb.

**The crowd:**

- **Applause** is built from about 70 to 190 individual spectators. Each claps at their own pace and with their own hand sound, in a reverberant arena. A good pot gets polite applause, a great shot gets a big round, and a frame win gets a long ovation.
- **Misses and in-offs** get a crowd "ooh", made from about 40 layered voices.
- **The arena murmur** is made from dozens of quiet conversations. It is audible before the match and between frames, and drops to near silence while a frame is in progress, as in a real arena.

The old synthesized beeps for scores and fouls are gone, because the referee calls them. All sounds are in `js/table-sounds.js` (about 1.3 MB) and are rebuilt by `tools/gen_sfx.py`.

## Changes in version 5.2 (bot levels and pro opponents)

**Four levels.** Easy, Medium, Hard and Very Hard set how accurately the bot cues, how often it misjudges pace and spin, and how far ahead it thinks:

- **Easy** aims at the object ball with no allowance for throw and does not play for position.
- **Medium** plays some position and simple safeties.
- **Hard** compares several weights and spins for position, and plays real safeties.
- **Very Hard** examines every option. Its break-off returns to baulk.

From random positions, average breaks in testing were about 4 (Easy), 16 (Medium), 24 (Hard) and 33 (Very Hard).

**How the bot thinks.** For each pot it tries the shot on a copy of the table with the game's own physics. This includes the throw on the object ball and the real pocket opening. It keeps the power and spin that pots the ball and leaves the best chance on the next one. Safeties are tried the same way, and it keeps the one that leaves you the least, with a bonus for a snooker. The planning runs in small slices, so the game does not stutter while it thinks.

**Pro opponents.** Pick the Club Bot or one of 15 professionals by name (no characters are shown): O'Sullivan, Trump, Selby, Higgins, Williams, Ding, Robertson, Zhao, Murphy, Allen, Wilson, Brecel, Hawkins, Bingham and Lisowski. Each pro has a playing style on top of the level:

- O'Sullivan plays quickly and fluently.
- Selby is slow and tactical.
- Trump is the most attacking and a fine long potter.
- The others fall between these.

Choosing a pro sets Very Hard, but you can change it. The referee calls "Frame to O'Sullivan" and so on, and the scoreboard, HUD and decision dialogs use the opponent's name. Edit `js/opponents.js` to change names or styles. Your last choice is remembered.

**Physics fix.** Ball-to-ball contacts are now resolved at the exact moment of touch rather than after the balls have overlapped within a physics step. Before, a firm cut could send the object ball several degrees off line depending on speed. Now cuts go where the geometry says, plus a small realistic throw, for you and the bot alike.

## Changes in version 5.1 (full rules and referee voice)

**Fouls.** Every foul scores the correct value: 4 minimum, or the value of the ball on or the ball involved, whichever is higher. A no-contact, wrong ball first, wrong ball potted, in-off or push shot (moving a touching ball) is a foul.

**Foul and a miss.** The referee calls a miss when the ball on is not hit and either there was a clear full-ball line to it, or the escape attempt was poor (the white never came within about 6 cm of a ball on). It is never called when the striker needed snookers before the shot. Three misses with a clear line forfeit the frame, and the referee warns you after the second.

**The choice after a foul.** The non-offender decides to:
- play from where the balls lie
- make the offender play again
- after a miss, have the balls replaced so the offender plays again from the original position

A dialog asks you. The bot makes its own choice: it takes a free ball, plays on if it has a good pot, and otherwise asks for the balls back or puts you in again.

**Free ball.** After a foul, if you cannot hit both edges of any ball on in a straight line, the referee calls "free ball". Any ball can then be played as the ball on, scoring as the ball on, and a potted free ball is re-spotted.

**Touching ball.** The referee calls it. You must play away, and moving the touching ball is a push foul. Playing away from a touching ball on needs no further contact.

**Re-spotting by the book.** A colour goes on its own spot. If that is covered, it goes on the highest-value free spot. If every spot is covered, it goes as close as possible to its own spot toward the top cushion. Higher colours are spotted first.

**Re-spotted black.** If the scores are level after the last black, the black is re-spotted. A random toss decides who plays first, with the ball in hand, and the next score or foul ends the frame.

**Matches.** Choose 1 frame or best of 3, 5 or 7 for bot and two-player games. The break-off alternates each frame, and frames are shown on the scoreboards. Concede from the menu; the bot concedes when the frame is out of reach. The panel shows the points remaining and who needs snookers.

**Referee voice.** Pre-recorded with Kokoro-82M, an open neural speech model (Apache-2.0), in a calm British male voice ("bm_george"), with a light hall reverb. It is embedded, so it works offline in every browser. The referee calls:
- the break as it builds ("…thirty-two")
- "Foul, four", or "Foul and a miss, five"
- "Free ball", "Touching ball" and "Re-spotted black"
- the three-miss warning
- "Frame to …" and "Frame and match"

The voice is muted together with the speaker button.

## Changes in version 5 (broadcast arena)

**New 3D engine.** The hand-written renderer was replaced by Three.js, bundled in `js/three.bundle.js` so it still works offline. It gives physically based materials, real shadows and reflections, ACES tone mapping, and anti-aliasing with a gentle bloom on HIGH quality.

**Television lighting.** The table sits under a bright lamp canopy and the arena is in shadow, as in a televised match. A soft shadow falls under every ball. The lamp is reflected as a rectangle in each ball, and a soft contact shadow sits under each one.

**Tournament table.** Cushions have the real profile, with an undercut face and a rounded nose at about 64% of ball height. The ends are angled into the pockets like real jaws. The polished rail has the pockets cut through it, with leather pocket shields. The table also has an apron and eight legs, and stands at regulation height. The cloth is tournament green with a woven texture. The baulk line, the D and the spots are chalk white.

**Real-looking people.** The referee and about 90 spectators are rigged human characters from the Microsoft Rocketbox library.
- The referee's waistcoat, bow tie and white gloves were painted onto the character for this game.
- The audience sits in tiered stands, breathes and shifts. Heads follow the cue ball, and the moving balls during a shot.
- Spectators applaud good pots, and give bigger applause for great ones.
- After a colour or the cue ball is potted, the referee walks to that pocket and takes the ball out. He then walks to the spot (or the D) and places it, before returning to his position.

**The arena.** Tiered seating on three sides, players' chairs with a small table and water glasses, and a scoreboard over the far stand that shows the live score.

**TV cameras.** The auto director uses a main camera high behind the baulk end. It cuts to the reverse camera when the cue ball is up at the black end. It cuts between turns and never swings around during a turn. Presets: TV MAIN, OVERHEAD, TV REVERSE, SIDE VIEW, THREE-QUARTER, HIGH ANGLE.

**Aiming guide that follows the cushions.** The FULL guide runs the game's own physics on a copy of the cue ball. The line therefore follows the real path off the cushions, including the curve that spin and roll put on it, up to the first ball the cue ball will touch. Tests show the predicted contact point is within a few millimetres of where the shot really makes contact.
- **Green ring:** a legal first contact.
- **Red ring:** a foul, or an in-off.
- **Small ring:** where the cue ball would stop short.

This makes it a tool for escaping snookers. It works for both players, and the bot's planned shot is drawn in **gold** while it lines up.

**Bot snooker escapes.** When no ball on can be hit directly, the bot sweeps every angle with the same physics. It picks the widest window of aims that makes a legal first contact (one, two or three cushions), so a small cueing error still finds the ball.

**Quality setting.** The QUALITY button cycles HIGH, MEDIUM and LOW. LOW suits laptops: fewer spectators, no shadows and no bloom. If the first seconds of play run slowly, the game steps down one level by itself until you choose a level yourself.

**Smart rail fade.** The near rail now dissolves only when the camera is low and a ball is actually close to that cushion.

## Changes in version 4.1 (fair play)

- **Separate shot settings.** You, the bot and player two each keep your own power and spin. The bot's choices never stay on your controls.
- **Locked controls.** Shot controls lock during the opponent's turn and while balls move. The dock shows whose settings are on screen, and the bot's are view-only. The camera can still be moved at any time.
- **Practice-only re-rack.** R re-racks in practice only.

## Physics (from version 4)

The simulation steps at a fixed 180 Hz, using a spherical moment of inertia, sliding and rolling friction, decaying sidespin, impulse ball-to-ball collisions and quaternion ball rotation. Pockets capture a ball only at the opening. Inside, balls fall under gravity into a simulated net. This is a good approximation, not an accredited physics engine.

## Controls

| Action | Input |
| --- | --- |
| Aim | In the AIM view: move the mouse left / right over the table (Shift = fine), or click a ball; with ⚙ AIM · HOLD THE BUTTON, hold the left button and move. In TOP and TV: move the mouse over the table. In FREE: click where to aim. ← / → fine-tune. Touch: drag, tap a ball, or the FINE AIM strip |
| Strike | Space / TAKE SHOT; touch: pull the cue at the side down and let go |
| Shot power | ↑ / ↓, the slider, the wheel over the slider; touch: the pull-down cue |
| Spin | Spin pad |
| Place the white in the D | Drag it inside the D |
| Nominate a colour | Aim at it (automatic) or click it; keys 2–7 |
| Camera views | AIM / TOP / TV / FREE buttons, C (Shift + C back), P for AIM, ◀ ▶ for the TV angles, Home to reset the view, ⚙ for the camera settings |
| AUTO CAM (follow each shot) | A / AUTO CAM |
| Camera focus | F / PICK FOCUS, Shift+click, CUE BALL, RESET |
| Move / turn / zoom the camera | Right drag moves it (AIM: raises it or swings it round); FREE: left drag turns it; middle drag or Alt + drag turns it; Ctrl / ⌘ + drag moves it; the wheel zooms; Shift = fine; double-click a ball to focus on it. Touch: pinch to zoom, two fingers to move (FREE: one finger turns) |
| Aim guide: full / short / off | G / AIM GUIDE |
| Escape hint when snookered (once per match) | E / ESCAPE HINT |
| Replay the best shot of the frame | Y / REPLAY |
| Skip a replay, the walk-on or the opening | Click or any key (SKIP INTRO button) |
| Skip the opponent's thinking | S / SKIP |
| TV cameras (broadcast cuts) | T / TV CAMERAS |
| Venue | VENUE on the start screen |
| Graphics quality | QUALITY button |
| Show or hide the audience | CROWD ON |
| Fade the near rail | V / SMART RAIL FADE |
| Pin the scoreboard | H |
| New rack (practice only) / menu | R / Esc |
| Match length | MATCH LENGTH on the start screen |
| Concede a frame | Menu · CONCEDE THIS FRAME |

## Files

- `index.html` — the page and its controls
- `css/style.css` — styles
- `js/three.bundle.js` — Three.js r187 and add-ons (MIT)
- `characters/characters.js` — the people data file: which models and textures are used, and their roles
- `characters/models`, `characters/textures`, `characters/animations` — the people as .glb models, texture images (with a `_normal` relief map for each body and face, a `_shine` map for each face at the table and `_hair` cut-outs) and motion clips
- `characters/characters-pack.js` — the same files packed, for opening the game straight from disk
- `Pack Characters.html` — rebuilds the pack after you change or add characters by hand in characters.js
- `VELVET Studio.html`, `js/studio.js`, `js/studio-tex.js`, `css/studio.css` — the character studio
- `characters/studio.js` — everything you made in the studio (empty until you save there)
- `js/studio-merge.js` — applies `characters/blender.js` and `characters/studio.js` on top of the original characters and opponents
- `objects/objects.js`, `objects/media/`: what you made in the studio's OBJECTS & TEXTURES workspace. The file is empty until you save there.
- `characters/blender.js`, `characters/blender/` — the people you exported from Blender (empty until you export one)
- `characters/hd.js`, `characters/hd/` — the MPFB people (players and referees rebuilt in Blender), used only when PEOPLE · MPFB is on in the settings
- `blender/` — the VELVET Character Maker add-on for Blender 5.3 (`VELVET_Character_Maker_2.0.0.zip`) and its guide
- `js/people.js` — loads the characters from the data file, applies their textures, fits each animation to each body and spawns animated copies
- `js/referee-voice.js` — the referee's calls (MP3, embedded)
- `js/commentary-voice.js` — the commentary team and the MC (Ogg Opus, embedded)
- `js/opponents.js` — the pro opponents' names, spoken names and playing styles
- `js/table-sounds.js` — table and crowd sounds (embedded)
- `js/game.js` — physics, rules, bot, audio, cameras, the players, replays, the ball return and the 3D arena
- `assets/` — cloth, wood and leather textures (also embedded in game.js) and the crowd GIFs
- `licenses/` — licence texts for the third-party parts
- `Velvet_Snooker_3D_Physics_Studio_Standalone.html` — single-file build

## Credits and licences

- **People:** [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), © 2020 Microsoft, MIT licence. Fifteen avatars and fifty animations were converted to compressed glTF. The crowd's textures were resized for the browser; the twelve people at the table use the facial versions of their avatars, with the library's full-size textures, normal and shine maps and face shapes. The referee's outfit was painted onto the *Business_Male_06* texture, and the players' waistcoats and bow ties onto *Business_Male_01* and *Business_Male_03*, for this game. Licence: `licenses/Microsoft-Rocketbox-LICENSE.md`.
- **3D engine:** [three.js](https://threejs.org), MIT licence (`licenses/three.js-LICENSE.txt`). Mesh decompression uses meshoptimizer by Arseny Kapoulkine, MIT licence (`licenses/meshoptimizer-LICENSE.md`).
- **Referee and MC voices:** generated with [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0) through kokoro-onnx (MIT).
- **Commentary voices:** the twenty voices picked in the voice audition, pre-recorded offline:
  - Kokoro-82M (Apache-2.0): George Ashby, Felix Rowe, Arthur Penn, Lewis Hale and Bella Quinn.
  - Supertonic 3 by Supertone (model under the OpenRAIL-M licence): Grant Mercer, Nora Blake, Claire Holden and Maya Ellis.
  - Piper voices, run with piper-tts:
    - "Alan", the voice of Alan Pope from the Mimic 3 voices (CC BY-SA 4.0): Alan Marsh.
    - "Cori", "John" and "Bryce", by Bryce Beattie from public-domain LibriVox recordings: Corinne Shaw, Johnny Calder and Bryce Holt.
    - "Jenny (Dioco)", from the Jenny TTS dataset by Dioco: Jenny Doyle.
    - "Semaine" (Prudence), from the DFKI SEMAINE data (CC BY-NC-SA 4.0, **non-commercial only**): Prue Adair. Swap her out before selling the game.
    - The VCTK corpus, University of Edinburgh (CC BY 4.0), speakers p227, p232, p256 and p270: Tom Kendal, Oliver Kent, Danny Wren and Harry Ackroyd.
    - LibriTTS-R (CC BY 4.0), speaker 4335: Wade Turner.
  - The commentators' names are made up. All voices are synthetic.
- **HD people:** bodies, face shapes and expression units from MakeHuman / [MPFB 2](https://static.makehumancommunity.org/mpfb.html): the base mesh, targets, rigs, skin masks and the eye texture are CC0. Each face and hair picture is the Rocketbox character's own (MIT, above), carried over in Blender by the VELVET Character Maker.
- **Blender add-on:** the VELVET Character Maker is GPL-3.0-or-later and works with [MPFB](https://static.makehumancommunity.org/mpfb.html) (GPL). MakeHuman's assets are CC0, so the people you make are yours to use.
- Game code, table textures and crowd GIFs belong to this project.

## Limits

The game looks like a good PC sports game rather than real TV footage. Faces in extreme close-up still look like game characters. Performance depends on the graphics card: use MEDIUM or LOW quality on laptops. The table sound effects are physically modelled rather than recorded. The players' cueing pose is computed, not motion-captured, so fingers and the rest are simplified up close.

VELVET Studio changes the skin of the head, not its shape: a photo face keeps the body's nose, jaw and haircut, so pick the closest body and use head size. One front photo covers the front of the face; the sides and back of the head keep the body's skin and hair. A face looks best from a straight-on, evenly lit photo with a neutral expression and no glasses. The studio does not make new hairstyles, clothes or animations; for new bodies, faces, hair and clothes use the Blender add-on. People made in Blender use the game's animations, not poses made in Blender, and their skin and clothes are baked into simple colour textures.
