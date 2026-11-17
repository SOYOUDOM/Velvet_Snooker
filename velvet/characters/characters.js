/* VELVET — CHARACTERS (the people data file)
   ============================================================================
   Every person in the arena is listed here: a .glb model plus its texture
   images. Edit this file to swap, re-skin or add characters.

   PATHS are relative to index.html.

   EACH ENTRY
     id        unique name
     role      'referee' (the first referee in the list walks the table),
               'player' (the first two are the two players at the table: you
               and your opponent) or 'audience' (sits in the stands)
     gender    'male' or 'female' (picks the matching seated motions)
     model     the .glb file
     textures  images painted onto the model's materials, by material name:
               a key matches a material whose name ends with (or equals) it.
               The Rocketbox people use  body / head / opacity (hair, lashes).
               Replace characters/textures/<id>_head.jpg to change a face.
     normals   optional normal maps, same keys
     height    optional, metres: scales a model to this standing height
     muscle    optional, 0..1: a fuller chest, shoulders and arms and a leaner waist
     roughness optional, by material key: 0 (glossy) .. 1 (matte), e.g. {head: .8}
     cue       optional cue colours: {tip, shaft, butt, metal: 'brass'|'silver'|'gold'|'black'}
     clips     optional, for models that bring their own animations:
               { idle:'..', walk:'..', take:'..', sit:'..', clap:'..', cheer:'..' }
               (players are posed over the table by the game itself when a
               model has no 'cue' clip; a 'cue' clip of your own is used as is)
               (names of animations inside the .glb). Without it the model
               must use the Rocketbox skeleton (bones named "Bip01 ...") and
               shares the motions listed under 'animations' below.
     weight    optional, how often an audience model is used (default 1)

   THE EASY WAY: open "VELVET Studio.html" next to index.html. It makes new
   characters from these bodies (faces from photos, outfit colours, height,
   your own opponents) and saves them in characters/studio.js; this file
   stays as it is.

   ADDING YOUR OWN (by hand)
     1. Put the .glb (and any texture images) in characters/models and
        characters/textures.
     2. Add an entry below.
     3. If you open the game by double-clicking index.html (no web server),
        open "Pack Characters.html" once and choose the game folder: browsers
        do not let a page read loose files from disk, so the characters are
        packed into characters/characters-pack.js. With a web server (or
        when the game is online) step 3 is not needed.
   Models must be glTF 2.0 (.glb or .gltf); meshopt compression is fine,
   Draco is not supported. Feet at the origin, facing +Z, metres.

   The included people are Microsoft Rocketbox avatars (MIT licence); the
   referee's outfit was painted for this game. */
window.VELVET_CHARACTERS = {
  // Motion clips shared by every Rocketbox-skeleton character.
  animations: {
    m_idle_neutral_01: 'characters/animations/m_idle_neutral_01.glb',
    // more Rocketbox motion (MIT): idles, habits and reactions for the players, referee and audience
    f_cheer_02: 'characters/animations/f_cheer_02.glb',
    f_claphands_01: 'characters/animations/f_claphands_01.glb',
    f_sit_chair_gestic_shrug_01: 'characters/animations/f_sit_chair_gestic_shrug_01.glb',
    f_sit_chair_idle_neutral_02: 'characters/animations/f_sit_chair_idle_neutral_02.glb',
    f_sit_chair_idle_roll_head: 'characters/animations/f_sit_chair_idle_roll_head.glb',
    f_sit_chair_idle_scratch_head: 'characters/animations/f_sit_chair_idle_scratch_head.glb',
    f_sit_chair_idle_touch_face: 'characters/animations/f_sit_chair_idle_touch_face.glb',
    f_sit_chair_idle_touch_hair: 'characters/animations/f_sit_chair_idle_touch_hair.glb',
    f_sit_chair_idle_waiting_01: 'characters/animations/f_sit_chair_idle_waiting_01.glb',
    f_sit_chair_idle_yawn: 'characters/animations/f_sit_chair_idle_yawn.glb',
    m_cheer_03: 'characters/animations/m_cheer_03.glb',
    m_claphands_02: 'characters/animations/m_claphands_02.glb',
    m_gestic_listen_accept_02: 'characters/animations/m_gestic_listen_accept_02.glb',
    m_gestic_listen_deny_02: 'characters/animations/m_gestic_listen_deny_02.glb',
    m_gestic_shrug_01: 'characters/animations/m_gestic_shrug_01.glb',
    m_idle_angry_01: 'characters/animations/m_idle_angry_01.glb',
    m_idle_breathe_01: 'characters/animations/m_idle_breathe_01.glb',
    m_idle_dust_01: 'characters/animations/m_idle_dust_01.glb',
    m_idle_look_around_01: 'characters/animations/m_idle_look_around_01.glb',
    m_idle_nervous_01: 'characters/animations/m_idle_nervous_01.glb',
    m_idle_neutral_02: 'characters/animations/m_idle_neutral_02.glb',
    m_idle_neutral_03: 'characters/animations/m_idle_neutral_03.glb',
    m_idle_neutral_04: 'characters/animations/m_idle_neutral_04.glb',
    m_idle_roll_head_01: 'characters/animations/m_idle_roll_head_01.glb',
    m_idle_scratch_head_01: 'characters/animations/m_idle_scratch_head_01.glb',
    m_idle_touch_face_01: 'characters/animations/m_idle_touch_face_01.glb',
    m_idle_waiting_01: 'characters/animations/m_idle_waiting_01.glb',
    m_sit_chair_gestic_shrug_01: 'characters/animations/m_sit_chair_gestic_shrug_01.glb',
    m_sit_chair_idle_cough: 'characters/animations/m_sit_chair_idle_cough.glb',
    m_sit_chair_idle_nervous_01: 'characters/animations/m_sit_chair_idle_nervous_01.glb',
    m_sit_chair_idle_neutral_02: 'characters/animations/m_sit_chair_idle_neutral_02.glb',
    m_sit_chair_idle_roll_head: 'characters/animations/m_sit_chair_idle_roll_head.glb',
    m_sit_chair_idle_scratch_head: 'characters/animations/m_sit_chair_idle_scratch_head.glb',
    m_sit_chair_idle_touch_face: 'characters/animations/m_sit_chair_idle_touch_face.glb',
    m_sit_chair_idle_touch_hair: 'characters/animations/m_sit_chair_idle_touch_hair.glb',
    m_sit_chair_idle_waiting_01: 'characters/animations/m_sit_chair_idle_waiting_01.glb',
    m_sit_chair_idle_yawn: 'characters/animations/m_sit_chair_idle_yawn.glb',
    m_walk_neutral_01: 'characters/animations/m_walk_neutral_01.glb',
    m_cheer_01: 'characters/animations/m_cheer_01.glb',
    m_documents_take: 'characters/animations/m_documents_take.glb',
    m_claphands_01: 'characters/animations/m_claphands_01.glb',
    m_sit_chair_idle_neutral_01: 'characters/animations/m_sit_chair_idle_neutral_01.glb',
    m_sit_chair_idle_relaxed_01: 'characters/animations/m_sit_chair_idle_relaxed_01.glb',
    m_sit_chair_idle_look_around: 'characters/animations/m_sit_chair_idle_look_around.glb',
    m_sit_chair_breathe_01: 'characters/animations/m_sit_chair_breathe_01.glb',
    m_sit_chair_gestic_thoughtful: 'characters/animations/m_sit_chair_gestic_thoughtful.glb',
    f_sit_chair_idle_neutral_01: 'characters/animations/f_sit_chair_idle_neutral_01.glb',
    f_sit_chair_breathe_01: 'characters/animations/f_sit_chair_breathe_01.glb',
    f_sit_chair_idle_look_around: 'characters/animations/f_sit_chair_idle_look_around.glb'
  },
  people: [
    {id: 'player_01',
     role: 'player',
     gender: 'male',
     model: 'characters/models/player_01.glb',
     textures: {body: 'characters/textures/player_01_body.jpg', head: 'characters/textures/player_01_head.jpg', opacity: 'characters/textures/player_01_opacity.png'},
     normals: {head: 'characters/textures/player_01_head_normal.jpg', body: 'characters/textures/player_01_body_normal.jpg'}},
    {id: 'player_02',
     role: 'player',
     gender: 'male',
     model: 'characters/models/player_02.glb',
     textures: {body: 'characters/textures/player_02_body.jpg', head: 'characters/textures/player_02_head.jpg', opacity: 'characters/textures/player_02_opacity.png'},
     normals: {head: 'characters/textures/player_02_head_normal.jpg', body: 'characters/textures/player_02_body_normal.jpg'}},
    {id: 'pro_m08',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_m08.glb',
     textures: {body: 'characters/textures/pro_m08_body.jpg', head: 'characters/textures/pro_m08_head.jpg', opacity: 'characters/textures/pro_m08_opacity.png'},
     normals: {body: 'characters/textures/pro_m08_body_normal.jpg', head: 'characters/textures/pro_m08_head_normal.jpg'}},
    {id: 'pro_m07',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_m07.glb',
     textures: {body: 'characters/textures/pro_m07_body.jpg', head: 'characters/textures/pro_m07_head.jpg', opacity: 'characters/textures/pro_m07_opacity.png'},
     normals: {body: 'characters/textures/pro_m07_body_normal.jpg', head: 'characters/textures/pro_m07_head_normal.jpg'}},
    {id: 'pro_m03',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_m03.glb',
     textures: {body: 'characters/textures/pro_m03_body.jpg', head: 'characters/textures/pro_m03_head.jpg', opacity: 'characters/textures/pro_m03_opacity.png'},
     normals: {body: 'characters/textures/pro_m03_body_normal.jpg', head: 'characters/textures/pro_m03_head_normal.jpg'}},
    {id: 'pro_b04',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_b04.glb',
     textures: {body: 'characters/textures/pro_b04_body.jpg', head: 'characters/textures/pro_b04_head.jpg'},
     normals: {body: 'characters/textures/pro_b04_body_normal.jpg', head: 'characters/textures/pro_b04_head_normal.jpg'}},
    {id: 'pro_b02',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_b02.glb',
     textures: {body: 'characters/textures/pro_b02_body.jpg', head: 'characters/textures/pro_b02_head.jpg', opacity: 'characters/textures/pro_b02_opacity.png'},
     normals: {body: 'characters/textures/pro_b02_body_normal.jpg', head: 'characters/textures/pro_b02_head_normal.jpg'}},
    {id: 'pro_m13',
     role: 'player',
     gender: 'male',
     model: 'characters/models/pro_m13.glb',
     textures: {body: 'characters/textures/pro_m13_body.jpg', head: 'characters/textures/pro_m13_head.jpg'},
     normals: {body: 'characters/textures/pro_m13_body_normal.jpg', head: 'characters/textures/pro_m13_head_normal.jpg'}},
    // Soy "The Titan" Oudom (Cambodia): his own face and outfit on the player_01 body. The .glb has his
    // textures inside and the 1.82 m athletic build already made (built with muscle 0.8 from player_01.glb);
    // the texture files below are the same images, listed so you can edit them.
    {id: 'pro_oudom',
     role: 'player',
     gender: 'male',
     model: 'characters/models/soy_oudom_the_titan.glb',
     textures: {body: 'characters/textures/pro_oudom_body.jpg', head: 'characters/textures/pro_oudom_head.jpg', opacity: 'characters/textures/pro_oudom_opacity.png'},
     normals: {body: 'characters/textures/pro_oudom_body_normal.jpg', head: 'characters/textures/pro_oudom_head_normal.jpg'},
     height: 1.82, roughness: {head: 0.8, opacity: 0.95},
     cue: {tip: '#7b5236', shaft: '#5a3a23', butt: '#140f0c', metal: 'brass'}},
    {id: 'referee',
     role: 'referee',
     gender: 'male',
     model: 'characters/models/referee.glb',
     textures: {body: 'characters/textures/referee_body.jpg', head: 'characters/textures/referee_head.jpg'},
     normals: {body: 'characters/textures/referee_body_normal.jpg', head: 'characters/textures/referee_head_normal.jpg'}},
    {id: 'referee_m2',
     role: 'referee',
     gender: 'male',
     model: 'characters/models/referee_m2.glb',
     textures: {body: 'characters/textures/referee_m2_body.jpg', head: 'characters/textures/referee_m2_head.jpg', opacity: 'characters/textures/referee_m2_opacity.png'},
     normals: {body: 'characters/textures/referee_m2_body_normal.jpg', head: 'characters/textures/referee_m2_head_normal.jpg'}},
    {id: 'referee_f1',
     role: 'referee',
     gender: 'female',
     model: 'characters/models/referee_f1.glb',
     textures: {body: 'characters/textures/referee_f1_body.jpg', head: 'characters/textures/referee_f1_head.jpg', opacity: 'characters/textures/referee_f1_opacity.png'},
     normals: {body: 'characters/textures/referee_f1_body_normal.jpg', head: 'characters/textures/referee_f1_head_normal.jpg'}},
    {id: 'business_male_02',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/business_male_02.glb',
     textures: {body: 'characters/textures/business_male_02_body.jpg', head: 'characters/textures/business_male_02_head.jpg', opacity: 'characters/textures/business_male_02_opacity.png'},
     normals: {body: 'characters/textures/business_male_02_body_normal.jpg', head: 'characters/textures/business_male_02_head_normal.jpg'}},
    {id: 'business_male_04',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/business_male_04.glb',
     textures: {body: 'characters/textures/business_male_04_body.jpg', head: 'characters/textures/business_male_04_head.jpg'},
     normals: {body: 'characters/textures/business_male_04_body_normal.jpg', head: 'characters/textures/business_male_04_head_normal.jpg'}},
    {id: 'male_adult_03',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/male_adult_03.glb',
     textures: {body: 'characters/textures/male_adult_03_body.jpg', head: 'characters/textures/male_adult_03_head.jpg', opacity: 'characters/textures/male_adult_03_opacity.png'},
     normals: {body: 'characters/textures/male_adult_03_body_normal.jpg', head: 'characters/textures/male_adult_03_head_normal.jpg'}},
    {id: 'male_adult_04',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/male_adult_04.glb',
     textures: {body: 'characters/textures/male_adult_04_body.jpg', head: 'characters/textures/male_adult_04_head.jpg', opacity: 'characters/textures/male_adult_04_opacity.png'},
     normals: {body: 'characters/textures/male_adult_04_body_normal.jpg', head: 'characters/textures/male_adult_04_head_normal.jpg'}},
    {id: 'male_adult_07',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/male_adult_07.glb',
     textures: {body: 'characters/textures/male_adult_07_body.jpg', head: 'characters/textures/male_adult_07_head.jpg', opacity: 'characters/textures/male_adult_07_opacity.png'},
     normals: {body: 'characters/textures/male_adult_07_body_normal.jpg', head: 'characters/textures/male_adult_07_head_normal.jpg'}},
    {id: 'male_adult_08',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/male_adult_08.glb',
     textures: {body: 'characters/textures/male_adult_08_body.jpg', head: 'characters/textures/male_adult_08_head.jpg', opacity: 'characters/textures/male_adult_08_opacity.png'},
     normals: {body: 'characters/textures/male_adult_08_body_normal.jpg', head: 'characters/textures/male_adult_08_head_normal.jpg'}},
    {id: 'male_adult_13',
     role: 'audience',
     gender: 'male',
     model: 'characters/models/male_adult_13.glb',
     textures: {body: 'characters/textures/male_adult_13_body.jpg', head: 'characters/textures/male_adult_13_head.jpg'},
     normals: {body: 'characters/textures/male_adult_13_body_normal.jpg', head: 'characters/textures/male_adult_13_head_normal.jpg'}},
    {id: 'business_female_01',
     role: 'audience',
     gender: 'female',
     model: 'characters/models/business_female_01.glb',
     textures: {body: 'characters/textures/business_female_01_body.jpg', head: 'characters/textures/business_female_01_head.jpg', opacity: 'characters/textures/business_female_01_opacity.png'},
     normals: {body: 'characters/textures/business_female_01_body_normal.jpg', head: 'characters/textures/business_female_01_head_normal.jpg'}},
    {id: 'business_female_03',
     role: 'audience',
     gender: 'female',
     model: 'characters/models/business_female_03.glb',
     textures: {body: 'characters/textures/business_female_03_body.jpg', head: 'characters/textures/business_female_03_head.jpg', opacity: 'characters/textures/business_female_03_opacity.png'},
     normals: {body: 'characters/textures/business_female_03_body_normal.jpg', head: 'characters/textures/business_female_03_head_normal.jpg'}},
    {id: 'female_adult_04',
     role: 'audience',
     gender: 'female',
     model: 'characters/models/female_adult_04.glb',
     textures: {body: 'characters/textures/female_adult_04_body.jpg', head: 'characters/textures/female_adult_04_head.jpg', opacity: 'characters/textures/female_adult_04_opacity.png'},
     normals: {body: 'characters/textures/female_adult_04_body_normal.jpg', head: 'characters/textures/female_adult_04_head_normal.jpg'}},
    {id: 'female_adult_09',
     role: 'audience',
     gender: 'female',
     model: 'characters/models/female_adult_09.glb',
     textures: {body: 'characters/textures/female_adult_09_body.jpg', head: 'characters/textures/female_adult_09_head.jpg', opacity: 'characters/textures/female_adult_09_opacity.png'},
     normals: {body: 'characters/textures/female_adult_09_body_normal.jpg', head: 'characters/textures/female_adult_09_head_normal.jpg'}},
    {id: 'female_adult_13',
     role: 'audience',
     gender: 'female',
     model: 'characters/models/female_adult_13.glb',
     textures: {body: 'characters/textures/female_adult_13_body.jpg', head: 'characters/textures/female_adult_13_head.jpg', opacity: 'characters/textures/female_adult_13_opacity.png'},
     normals: {body: 'characters/textures/female_adult_13_body_normal.jpg', head: 'characters/textures/female_adult_13_head_normal.jpg'}}
  ]
};
