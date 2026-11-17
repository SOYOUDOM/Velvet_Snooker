"""VELVET commentary: what the commentators and the MC can say.

Every line is original. Lines avoid names and pronouns where they can, so any
player fits; a commentator can lead in with a player's name (recorded on its
own) when the game knows it. Categories are picked by the game from what
really happened on the table (see js/commentary.js).
"""

LINES = {
    # ------------------------------------------------------------------ the start
    'welcome': [
        "Good evening, and welcome to what promises to be a terrific contest.",
        "Hello and welcome. A full house in here tonight, and the atmosphere is electric.",
        "Welcome along. Two fine players, one table, and plenty at stake.",
        "Good evening. The conditions look perfect, so let's hope for some quality snooker.",
        "Welcome to the arena. The players are ready, the crowd is ready, and so are we.",
        "Evening, everyone. This one has all the makings of a classic.",
        "Hello again. The table has been ironed and the balls polished, so no excuses tonight.",
        "Welcome. It's a lovely table, a lovely crowd, and a big occasion.",
        "Good evening from the arena. Let's settle in and enjoy this.",
        "Welcome to the match. Form says this could go either way.",
        "Good evening. There's a real buzz around the venue tonight.",
        "Hello and welcome. Big match, big crowd, big expectations.",
    ],
    'frame_start': [
        "Fresh frame, fresh start.",
        "Here we go again, a brand new frame.",
        "New frame. Everything to play for.",
        "Let's see who settles first in this one.",
        "The balls are racked and we're ready to go.",
        "Another frame, and another chance to take control.",
        "Right, a clean slate in this frame.",
        "Plenty of snooker still to be played in this match.",
    ],
    'break_off': [
        "Here we go, then.",
        "A tidy break-off, that. Nothing on.",
        "Good break-off. The cue ball's back in baulk.",
        "Textbook break-off. That should keep things tight.",
        "Nice and controlled from the break.",
        "That's a solid start. Hard to see a red on.",
        "A safe break-off. Over to the opponent.",
        "Lovely weight on that break-off.",
        "A thin contact on the pack, and back to baulk. Perfect.",
        "That's how you break off.",
    ],
    'break_off_poor': [
        "Hmm, a bit heavy on that break-off.",
        "That's left a red or two showing.",
        "Not the cleanest break-off. There might be a chance here.",
        "The cue ball's come too far up the table, I'm afraid.",
        "That break-off has opened a few doors.",
        "Oh, that's a loose start. There's something on.",
    ],
    # ------------------------------------------------------------------ safety
    'safety_good': [
        "Superb safety.",
        "That's a really good safety shot.",
        "Tight on the baulk cushion. Very little on there.",
        "Lovely touch. That leaves next to nothing.",
        "Classic safety. The cue ball is tucked up nicely.",
        "Excellent. Right on the cushion.",
        "That's put the opponent under real pressure.",
        "A proper safety shot. Nothing easy left.",
        "Beautifully weighted. That's a tough one to follow.",
        "That's the kind of safety that wins frames.",
        "Clever shot. Nothing to aim at from there.",
        "Lovely, the cue ball's frozen to the cushion.",
        "Very good. That's a test of nerve now.",
        "Perfectly judged. The reds are all covered.",
        "That will take some answering.",
        "Exquisite safety. Just glances the red and back to the cushion.",
        "Quality safety. A long way from anything.",
        "A real tactician's shot, that one.",
        "Nothing to go at there. Well played.",
        "A delicate touch, and it's left the table very awkward.",
    ],
    'safety_poor': [
        "Oh, that's left a chance.",
        "Not the best safety. There's a red on.",
        "Hmm, came off the cushion a bit too far.",
        "That's a little loose.",
        "The weight was wrong there. A red is showing.",
        "That could be costly.",
        "Overhit that safety, I'm afraid.",
        "That's an opening, if the opponent wants it.",
        "Not quite tight enough.",
        "The cue ball's drifted out into the open.",
        "That's given something away.",
        "A rare loose safety. There's a pot on here.",
        "The red's come off the cushion. A chance now.",
        "That safety hasn't really worked out.",
    ],
    'safety_exchange': [
        "A real tactical battle developing here.",
        "This is chess on a snooker table.",
        "Lots of safety in this frame. Neither player giving an inch.",
        "Patience is the name of the game at the moment.",
        "Cat and mouse, this.",
        "Somebody will crack eventually.",
        "The longer this goes on, the more pressure there is.",
        "Not a lot between them in this safety exchange.",
        "Hard work, this frame. Every shot matters.",
        "It's a battle of wills out there.",
    ],
    # ------------------------------------------------------------------ pots
    'pot_long': [
        "What a long pot!",
        "Fantastic long red.",
        "Oh, that's a brilliant pot from distance.",
        "Right in the middle of the pocket. From all the way down there!",
        "Stunning long pot.",
        "That's a pot of the very highest quality.",
        "From the baulk cushion, and it never looked like missing.",
        "Superb. You won't see a better long pot than that.",
        "That's what you call taking your chance.",
        "Brave, and brilliantly executed.",
        "A long red, slotted in. Wonderful.",
        "That's a confidence booster, a pot like that.",
        "Long and straight. Couldn't have hit it better.",
        "Pure timing on that long pot.",
        "That's a statement shot.",
        "Down the length of the table and straight in. Majestic.",
    ],
    'pot_cut': [
        "Lovely thin cut.",
        "That's a delicate cut, beautifully played.",
        "Feathered that one in.",
        "A fine, fine cut. Very nicely done.",
        "Wonderful touch on that cut.",
        "Just the faintest contact, and in it goes.",
        "That's a difficult angle, made to look easy.",
        "Sliced in. Lovely.",
        "Thin as you like, and it drops.",
        "Great judgement on that cut.",
        "That's a touch of class.",
        "The angle was tight, but the cueing was perfect.",
        "Cut in with plenty of confidence.",
        "Lovely, the merest kiss on the ball.",
    ],
    'pot_routine': [
        "Nicely done.",
        "No problem there.",
        "In it goes.",
        "Straightforward enough.",
        "That's fine.",
        "Good. Keeps the break going.",
        "Tidy.",
        "No trouble at all.",
        "Steady. Very steady.",
        "Simple, but it still has to be potted.",
        "Neatly done.",
        "That's comfortable.",
        "Good pot, and the cue ball is under control.",
        "One more on the board.",
        "Very assured.",
        "That's the routine one.",
        "Calm and collected.",
        "Nothing fancy, just effective.",
        "Smoothly does it.",
        "Into the heart of the pocket.",
    ],
    'pot_pressure': [
        "A big pot, that one.",
        "Nerves of steel.",
        "That's an important ball, potted under pressure.",
        "The pressure was on, and the pot went in.",
        "That's a crucial pot.",
        "Ice cool under the circumstances.",
        "A huge moment in this frame, and it's delivered.",
        "That's a pot that matters.",
        "Composed. That's what experience gives you.",
        "That could be the shot of the frame.",
    ],
    'pot_double': [
        "Oh, a double! Off the cushion and in.",
        "That's gone in off the cushion. A clever double.",
        "Was that intended? It's a lovely double either way.",
        "A double into the pocket. Very nice.",
        "Across and in. Great double.",
        "Off the cushion and down. Smart thinking.",
    ],
    'pot_fluke': [
        "Oh, that's a fluke!",
        "Well, that wasn't the plan, but it's gone in.",
        "A slice of luck there.",
        "That's a bonus. A ball dropped from nowhere.",
        "The snooker gods are smiling.",
        "Ha, you'll take those.",
        "That's a lucky one, and it might make a difference.",
        "Well, I don't think that was called.",
        "A fortunate pot. Every little helps.",
        "Lady Luck takes a hand.",
    ],
    # ------------------------------------------------------------------ misses
    'miss_easy': [
        "Oh, that's a bad miss.",
        "Missed it. That's a surprise.",
        "Unforced error there.",
        "That was the easy one, as well.",
        "Oh dear. That's a let-off for the opponent.",
        "That will hurt. A simple ball missed.",
        "Rare mistake.",
        "Took the eye off that one.",
        "That's a costly miss.",
        "Ooh, rattled the jaws and stayed out. Should have gone in.",
        "That's one the player will want back.",
        "A real let-off, that.",
        "Concentration lapsed there.",
        "Never looked comfortable on that shot.",
        "That's the sort of miss that can turn a frame.",
        "Oh, that's a shocker.",
    ],
    'miss_hard': [
        "Brave attempt.",
        "Worth a go, but it's missed.",
        "Just off line.",
        "A tough shot, and it hasn't come off.",
        "The right shot to take on, but no luck.",
        "Unlucky. Very nearly.",
        "That was always a difficult one.",
        "Close, but not close enough.",
        "Ambitious, and just missed.",
        "A long shot, and it wobbled.",
        "Hmm, a risky shot, and it's left something.",
        "Fine margins on a pot like that.",
    ],
    'jaws': [
        "In and out!",
        "Rattled in the jaws!",
        "Oh, it's wobbled in the jaws and stayed out.",
        "Wouldn't drop! The jaws are tight on this table.",
        "In the jaws, and out again.",
        "That pocket said no.",
        "It hit the knuckle and stayed out.",
        "Oh, cruel. That's rattled.",
        "Too much pace. It rattled the jaws.",
        "Spat out by the pocket.",
        "That should have gone. The pocket just wouldn't have it.",
        "Hit the far jaw, and out it comes.",
    ],
    # ------------------------------------------------------------------ position
    'position_good': [
        "Perfect position.",
        "Lovely cue ball control.",
        "The cue ball's on a string.",
        "Exactly where it needed to be.",
        "Great position for the next ball.",
        "That's the cue ball doing exactly as it's told.",
        "Textbook position play.",
        "Couldn't ask for better on the next one.",
        "Every ball is setting up the next. Lovely snooker.",
        "Inch-perfect.",
        "The cue ball control is exceptional.",
        "That's lovely. A simple one to follow.",
        "Making it look easy.",
        "The positional play is superb.",
        "That's how you build a break.",
        "Just the right weight, just the right angle.",
    ],
    'position_poor': [
        "Hmm, slightly out of position.",
        "That's left an awkward one.",
        "Run out of position there.",
        "The cue ball's gone a bit too far.",
        "Not ideal for the next ball.",
        "A tricky one to follow now.",
        "That's a bit of a problem.",
        "Hasn't quite got the angle.",
        "The cue ball has drifted. Tough shot next.",
        "That's left a long one.",
        "Lost position, I'm afraid.",
        "It'll need a good one now.",
        "Too straight on the next ball.",
        "That's made life difficult.",
    ],
    # ------------------------------------------------------------------ fouls and snookers
    'in_off': [
        "Oh, in-off!",
        "The cue ball has gone in. That's a foul.",
        "In-off. That's painful.",
        "Oh no, the white's followed it in.",
        "That's a costly in-off.",
        "The cue ball's disappeared down the pocket.",
        "In-off, and ball in hand for the opponent.",
        "That's a nightmare. In-off.",
    ],
    'foul_generic': [
        "That's a foul.",
        "Oh, a foul there. Points away.",
        "Missed the ball on. That's a foul.",
        "Penalty points. Every one could count.",
        "That's given away a few points.",
        "A foul, and that changes the scoreline.",
        "Oh, that's an expensive foul.",
        "Wrong ball first, I think. A foul.",
        "That will be a foul, I'm afraid.",
        "Points conceded there.",
    ],
    'snooker_laid': [
        "That's a snooker!",
        "Oh, a lovely snooker.",
        "Tucked right behind the colour. That's a beauty.",
        "A real test now. Completely snookered.",
        "That's laid a snooker. Points could follow.",
        "Can't see the ball on from there.",
        "Brilliant snooker.",
        "That's a nasty one to get out of.",
        "Snookered! The pressure is right on now.",
        "That's put a real problem on the table.",
        "Excellent snooker. That's going to cost something.",
        "Behind the ball, and nowhere to go.",
    ],
    'escape_good': [
        "Great escape.",
        "Found a way out of that.",
        "Superb escape. Off the cushion and onto the ball.",
        "That's excellent. Not only escaped, but left it safe.",
        "Calculated perfectly.",
        "Got out of jail there.",
        "Lovely escape. The geometry was spot on.",
        "Escaped, and nothing left on. Very good.",
    ],
    'escape_poor': [
        "Escaped, but it's left a chance.",
        "Hit the ball, but that's opened things up.",
        "Got out, but that's a red left over the pocket.",
        "The escape has left something on.",
        "Made contact, but nothing safe about that.",
        "That escape might be costly.",
        "Out of the snooker, into trouble.",
        "Hit it, but that's a gift.",
    ],
    'free_ball': [
        "Free ball. That's a chance.",
        "A free ball here, and that could be crucial.",
        "Free ball. Any colour can be taken as a red.",
        "The referee calls a free ball. An opportunity.",
        "Free ball, and suddenly there's a way back.",
        "That free ball could change everything.",
    ],
    # ------------------------------------------------------------------ breaks and frames
    'break_30': [
        "A useful contribution, this.",
        "Building nicely now.",
        "Into the thirties. Starting to take control.",
        "This is turning into a dangerous break.",
        "Good scoring visit.",
        "The scoreboard is ticking over.",
    ],
    'break_50': [
        "And that's a half century.",
        "Fifty up. Very well played.",
        "A half century, and it's not over yet.",
        "Fifty, and counting.",
        "That brings up the fifty. Lovely break.",
        "A fine half century.",
        "The break passes fifty. Impressive stuff.",
        "That's fifty, and the frame is slipping away from the opponent.",
    ],
    'break_70': [
        "Seventy now, and still going.",
        "This break could win the frame on its own.",
        "Heavy scoring. Very heavy.",
        "The opponent can only sit and watch.",
        "Into the seventies. Magnificent.",
        "A frame-winning break, surely.",
    ],
    'break_100': [
        "And that's a century!",
        "A hundred! Wonderful break.",
        "Century break. Applause all around the arena.",
        "That's the century. Magnificent snooker.",
        "One hundred. Exceptional.",
        "There's the ton. What a break.",
        "A century, and the crowd love it.",
        "That's three figures. Brilliant.",
        "Centuries don't come much better than that.",
        "There's the hundred. Pure class.",
    ],
    'break_big': [
        "This is a huge break now.",
        "Well past the century. Remarkable.",
        "Could this be the highest break of the tournament?",
        "Incredible scoring.",
        "The break just goes on and on.",
        "That's a monster of a break.",
    ],
    'max_on': [
        "Hold on. All the blacks so far. A maximum is on!",
        "Fifteen reds, fifteen blacks? Don't say it too loudly.",
        "The crowd are starting to sense a maximum here.",
        "This could be special. The one four seven is on.",
        "Every red with the black. You can hear a pin drop.",
        "A maximum break is a real possibility now.",
    ],
    'break_end': [
        "And the break comes to an end.",
        "That's the end of a very useful visit.",
        "The break stops there. Valuable points, though.",
        "A good break ends. Back to the safety game.",
        "That's where it finishes. Still a good contribution.",
        "Break over, but it's made a real difference.",
        "It ends there, but the damage is done.",
        "A fine visit comes to a close.",
    ],
    'frame_ball': [
        "This is frame ball.",
        "Frame ball here.",
        "Pot this, and the frame is won.",
        "One more, and it's over.",
        "This ball wins the frame.",
        "Frame ball. A moment of truth.",
        "Here's the frame ball.",
        "Get this, and it's frame over.",
    ],
    'frame_won': [
        "And that's the frame.",
        "Frame over. Well played.",
        "That wraps up the frame.",
        "Frame won, and well deserved.",
        "A well-earned frame.",
        "That frame's in the bag.",
        "Frame secured.",
        "Job done in this frame.",
        "That's the frame. A solid performance.",
        "And the frame is won. Big applause.",
        "That's the end of the frame. A very good one.",
        "Another frame on the scoreboard.",
    ],
    'frame_won_close': [
        "Down to the colours, and it's won. What a frame!",
        "A real nail-biter, that frame.",
        "Could have gone either way. Fantastic frame.",
        "That's a frame they'll be talking about.",
        "Edge of the seat stuff. And it's won.",
        "Right down to the last ball. Gripping.",
        "That frame had everything.",
        "Phew. What a finish to the frame.",
    ],
    'respotted_black': [
        "We have a re-spotted black!",
        "Level on points. It's a re-spotted black.",
        "A re-spotted black. Talk about tension.",
        "One ball, one frame. The black is re-spotted.",
        "It all comes down to the black.",
        "A re-spotted black. Doesn't get any tenser than this.",
    ],
    'needs_snookers': [
        "Snookers are needed now.",
        "It's snookers required.",
        "The frame is slipping away. Snookers needed.",
        "Only snookers can save this frame now.",
        "Need snookers here. A tall order.",
        "This is now a matter of laying snookers.",
        "Behind on the scoreboard, and running out of balls.",
        "Snookers needed, but stranger things have happened.",
    ],
    'pack_split': [
        "The pack has opened up nicely.",
        "Reds are scattered everywhere now.",
        "That's split the pack. Plenty of options.",
        "Lovely. The reds are spread around.",
        "A good shot into the pack. That's opened the table.",
        "The reds are all over the table now. This could be a big break.",
        "That's the cluster broken up.",
        "Into the pack and they've come away nicely.",
    ],
    'clearance': [
        "A total clearance. Superb.",
        "Cleared the table. Magnificent.",
        "Every ball potted. What a visit.",
        "A clearance to win the frame. Fabulous.",
        "That is a brilliant clearance.",
        "From nowhere, a clearance.",
    ],
    'match_ball': [
        "This could be match ball.",
        "Match ball, coming up.",
        "Pot this, and the match is won.",
        "The finishing line is in sight.",
        "One step from victory now.",
        "Here's the chance to close out the match.",
    ],
    'match_won': [
        "And that's the match! What a performance.",
        "Game, set and match. Superbly played.",
        "Victory. A thoroughly deserved win.",
        "That's the match. The crowd are on their feet.",
        "And the match is over. Congratulations.",
        "What a way to finish the match.",
        "A fantastic match comes to an end.",
        "That's the winning frame. Brilliant.",
    ],
    # ------------------------------------------------------------------ scoreline and chatter
    'score_close': [
        "Nothing between them.",
        "This is so tight.",
        "Neck and neck.",
        "Very little to separate them.",
        "Still all to play for.",
        "Couldn't be closer.",
    ],
    'score_lead': [
        "That's a commanding lead now.",
        "Taking control of this match.",
        "The gap is growing.",
        "That lead is starting to look significant.",
        "The momentum is all one way.",
        "Hard to see a way back from here.",
    ],
    'thinking': [
        "Taking a little time over this one.",
        "Plenty of thought going into this shot.",
        "Weighing up the options.",
        "A big decision to make here.",
        "Not an easy choice, this.",
        "Studying the angles carefully.",
        "Is there a pot on, or is it safety?",
        "Every option has a risk.",
    ],
    'crowd': [
        "Listen to that crowd!",
        "The crowd loved that.",
        "That got the audience going.",
        "What a reception.",
        "The arena is buzzing.",
        "Huge applause for that.",
    ],
    'filler': [
        "The conditions are excellent tonight. The table is playing beautifully.",
        "There's a lovely atmosphere in the arena.",
        "The cloth is running quick tonight.",
        "Cue ball control will decide this one.",
        "It's all about taking chances when they come.",
        "The crowd here really know their snooker.",
        "Patience is so important on a table like this.",
        "The pockets are quite tight here. You have to be accurate.",
        "Good preparation shows in matches like this.",
        "The table has been playing true all week.",
        "You can't afford to leave much at this level.",
        "Safety play is underrated, but it wins matches.",
        "The scoring has been very good so far.",
        "It's a long match. No need to panic yet.",
        "Shot selection will be key from here.",
        "The best players make the hard shots look simple.",
        "Every frame counts in a match like this.",
        "Concentration is everything out there.",
        "The arena lights are bright, but it's a great place to play.",
        "This is where the hours on the practice table pay off.",
        "The reds are scattered. There's a frame-winning chance for somebody.",
        "Watch the cue action. Lovely and straight.",
        "So much depends on the next few shots.",
        "There's a real crowd favourite out there tonight.",
        "A cool head is going to win this.",
        "The balls are running nicely for now.",
        "It's been an entertaining match so far.",
        "Long potting has been a feature of this match.",
        "Both players looked sharp in the practice room, I'm told.",
        "Snooker at its very best.",
        "There's a long way to go in this one.",
        "You need a bit of luck too, at this level.",
        "Composure. That's the word tonight.",
        "The tactical side of the game is fascinating to watch.",
        "Big frames coming up.",
        "Pressure does funny things to players.",
        "Some of the positional play tonight has been top class.",
        "The table is in immaculate condition.",
        "A quiet arena, but the tension is building.",
        "Every safety exchange is a mini battle of its own.",
    ],
}

# The second commentator answers the first.
REPLIES = [
    "Absolutely.", "Couldn't agree more.", "No doubt about it.", "It certainly is.", "Spot on.", "Quite right.",
    "Very much so.", "I think that's fair.", "Lovely stuff.", "Exactly that.", "That's the quality, isn't it.",
    "Hmm, we'll see.", "I'm not so sure, myself.", "Indeed.", "You're right.", "Without a doubt.",
    "That's championship snooker.", "Brilliant, really.", "It's a big moment.", "Couldn't have said it better.",
    "Precisely.", "It's hard to argue with that.", "Fair point.", "That's very true.", "I'd go along with that.",
    "Lovely to watch.", "That's experience for you.", "It makes a difference, doesn't it.", "Certainly.", "Too true.",
]

# Categories heard most often get more voices, so the pair in each match has plenty to say.
FREQUENT = {'pot_routine', 'safety_good', 'safety_poor', 'position_good', 'position_poor', 'miss_easy', 'filler',
            'pot_long', 'pot_cut', 'jaws', 'frame_won', 'break_end'}

# Commentators: Kokoro voices (two blends make new ones). The referee is bm_george, the MC am_onyx.
# The commentary team, picked by ear in the voice audition (V numbers there).
# spec: ('ko', Kokoro voice or blend, lang, speed) | ('st', Supertonic 3 voice id, speed) | ('pi', Piper voice, speaker id, speed)
COMMENTATORS = [
    ('grant', ('st', 9, 1.0)), ('nora', ('st', 0, 1.0)), ('claire', ('st', 1, 1.0)), ('maya', ('st', 3, 1.0)),   # V05 V06 V07 V09
    ('george', ('ko', [('bm_george', .6), ('bm_lewis', .4)], 'en-gb', .95)),                                    # V12
    ('felix', ('ko', [('am_echo', .5), ('bm_fable', .5)], 'en-gb', .95)),                                       # V18
    ('arthur', ('ko', [('am_santa', .4), ('bm_george', .6)], 'en-gb', .95)),                                    # V19
    ('lewis', ('ko', 'bm_lewis', 'en-gb', .95)),                                                                # V20
    ('bella', ('ko', [('bf_isabella', .6), ('af_heart', .4)], 'en-gb', .95)),                                   # V26
    ('alan', ('pi', 'en_GB-alan-medium', None, 1.0)), ('corinne', ('pi', 'en_GB-cori-high', None, 1.0)),        # V27 V35
    ('jenny', ('pi', 'en_GB-jenny_dioco-medium', None, 1.0)), ('prue', ('pi', 'en_GB-semaine-medium', 0, 1.0)), # V37 V38
    ('tom', ('pi', 'en_GB-vctk-medium', 82, 1.0)), ('oliver', ('pi', 'en_GB-vctk-medium', 60, 1.0)),            # V39 p227, V40 p232
    ('danny', ('pi', 'en_GB-vctk-medium', 104, 1.0)), ('harry', ('pi', 'en_GB-vctk-medium', 12, 1.0)),          # V42 p256, V44 p270
    ('johnny', ('pi', 'en_US-john-medium', None, 1.0)), ('bryce', ('pi', 'en_US-bryce-medium', None, 1.0)),     # V53 V56
    ('wade', ('pi', 'en_US-libritts_r-medium', 715, 1.0)),                                                      # V58 LibriTTS-R 4335
]
# On-screen names for the commentary pair (made up; not real broadcasters). Jenny keeps her name, as her voice's licence asks.
DISPLAY = {'grant': 'Grant Mercer', 'nora': 'Nora Blake', 'claire': 'Claire Holden', 'maya': 'Maya Ellis', 'george': 'George Ashby',
           'felix': 'Felix Rowe', 'arthur': 'Arthur Penn', 'lewis': 'Lewis Hale', 'bella': 'Bella Quinn', 'alan': 'Alan Marsh',
           'corinne': 'Corinne Shaw', 'jenny': 'Jenny Doyle', 'prue': 'Prue Adair', 'tom': 'Tom Kendal', 'oliver': 'Oliver Kent',
           'danny': 'Danny Wren', 'harry': 'Harry Ackroyd', 'johnny': 'Johnny Calder', 'bryce': 'Bryce Holt', 'wade': 'Wade Turner'}
# Pace: commentators slow down when it gets tense and quicken at the big moments.
TENSE = {'frame_ball', 'match_ball', 'max_on', 'needs_snookers', 'respotted_black', 'thinking', 'score_close'}
EXCITED = {'pot_long', 'pot_double', 'pot_fluke', 'pot_pressure', 'break_100', 'break_big', 'clearance', 'frame_won_close',
           'match_won', 'escape_good', 'crowd', 'live_wow', 'live_ooh'}


def pace(cat):
    cat = cat.split('@')[0]
    return .9 if cat in TENSE else 1.06 if cat in EXCITED else .95


# Lines about one player ('<category>@<opponent id>'), recorded by every commentator; the text is
# what the captions show. SPOKEN says a name the way it is pronounced where the spelling would mislead.
PLAYER_LINES = {
    'oudom': {
        'intro': ["Here comes Soy Oudom, known as The Titan, representing Cambodia. A balanced, intelligent player "
                  "with strong positional and tactical awareness."],
        'pot_long': ["What a tremendous long pot from The Titan! Excellent cue-ball control as well."],
        'safety_good': ["That's a beautifully judged safety from Soy Oudom. He's made this very difficult for his opponent."],
        'break_100': ["A century for The Titan! Brilliantly constructed, with outstanding positional play."],
        'miss_hard': ["A rare mistake from Soy Oudom. He'll be disappointed with that one."],
        'miss_easy': ["A rare mistake from Soy Oudom. He'll be disappointed with that one."],
        'match_won': ["Soy 'The Titan' Oudom takes the match! A composed and thoroughly professional performance "
                      "from the Cambodian player."],
    },
}
SPOKEN = [("Soy 'The Titan' Oudom", 'Soy, The Titan, Odom'), ('Soy Oudom', 'Soy Odom')]


def spoken(text):
    for a, b in SPOKEN:
        text = text.replace(a, b)
    return text


MC_VOICE, MC_LANG, MC_SPEED = 'am_onyx', 'en-us', 0.9
NICKNAMES = {  # walk-on nicknames, as the MC says them
    'osullivan': ("The Rocket", "Ronnie O'Sullivan"), 'trump': ("The Ace in the Pack", "Judd Trump"),
    'selby': ("The Jester from Leicester", "Mark Selby"), 'higgins': ("The Wizard of Wishaw", "John Higgins"),
    'williams': ("The Welsh Potting Machine", "Mark Williams"), 'ding': ("The Dragon", "Ding Junhui"),
    'robertson': ("The Thunder from Down Under", "Neil Robertson"), 'zhao': ("The Cyclone", "Jow Shin Tong"),
    'murphy': ("The Magician", "Shaun Murphy"), 'allen': ("The Pistol", "Mark Allen"), 'wilson': ("The Warrior", "Kyren Wilson"),
    'brecel': ("The Belgian Bullet", "Luca Bressel"), 'hawkins': ("The Hawk", "Barry Hawkins"),
    'bingham': ("Ball-Run", "Stuart Bingham"), 'lisowski': ("Jackpot", "Jack Lisowski"), 'club': ("the house champion", "the Club Bot"),
}
MC_LINES = {
    'mc_welcome': "Ladies and gentlemen, welcome to the Velvet Arena!",
    'mc_players': "Please welcome your players!",
    'mc_referee': "And tonight's referee!",
    'mc_quiet': "Ladies and gentlemen, quiet please. Let's play snooker!",
    'mc_generic1': "Please give a warm welcome to our next player!",
    'mc_generic2': "Ladies and gentlemen, put your hands together!",
    'mc_generic3': "Making the walk to the table, please welcome the challenger!",
}
for key, (nick, full) in NICKNAMES.items():
    MC_LINES['mc_' + key] = f"Please welcome... {nick}... {full}!"
MC_LINES['mc_oudom'] = ("Ladies and gentlemen, representing Cambodia, standing at one metre eighty-two, "
                       "please welcome... Soy 'The Titan' Oudom!")
MC_LINES['mc_oudom_short'] = "Representing Cambodia... Soy 'The Titan' Oudom!"
MC_LINES['mc_welcome_wca'] = "Ladies and gentlemen, welcome to the World Championship Arena!"


# ---- Conversations: one commentator says the first line, the other answers (a third line goes back to
# the first). Each thread is recorded by half the team for its first voice and the other half for the
# answer, so most pairs drawn for a match can hold most of these conversations.
THREADS = {
    'thinking': [
        ["He's having a really good look at this one.", "He has to. Get this wrong and he's handing over the frame."],
        ["What would you do here?", "Honestly? I'd roll up to the red and make it awkward.", "Yes, I think I would too."],
        ["Decisions, decisions.", "There's a pot on, but it's a risky one.", "And the white could go anywhere."],
        ["You can almost see him working out the angles.", "Every point matters at this stage. He knows that."],
    ],
    'safety_exchange': [
        ["This is turning into a real chess match.", "It is. Neither of them wants to blink first."],
        ["Patience is everything in these exchanges.", "Absolutely. One loose shot and it's over.", "And they both know it."],
        ["Back and forth we go.", "I love this part of the game, though. Proper tactical snooker."],
    ],
    'safety_good': [
        ["Oh, that's a lovely bit of safety.", "Beautifully judged. He's left nothing at all."],
        ["That's tight, isn't it?", "Very tight. He'll be scratching his head now."],
    ],
    'snooker_laid': [
        ["Oh, that's a beauty!", "That's a proper snooker. He can't even see half the ball.", "This could be worth a few points."],
        ["Well, look at that.", "Tucked right in behind. Lovely touch."],
    ],
    'escape_good': [
        ["Oh, well escaped!", "Off the cushion, and he's left nothing. Brilliant."],
        ["He's found a way out.", "And not just out. He's put the pressure straight back on."],
    ],
    'escape_poor': [
        ["Well, he's hit it, but...", "But he's left one on. That could be costly."],
    ],
    'miss_easy': [
        ["Oh, no. That's a shocker.", "He'll be furious with himself. He'd pot that ten times out of ten in practice."],
        ["Ooh, how has that stayed out?", "Snatched at it, I think. Just a little bit quick on the cue."],
        ["That's a big let-off.", "A huge one. Now let's see if he gets punished for it."],
    ],
    'miss_hard': [
        ["It was a brave attempt.", "It was the right shot, I think. He just didn't quite catch it."],
        ["Ah, close, but not close enough.", "And he's left a few on, too. That's the danger with going for those."],
    ],
    'pot_long': [
        ["Oh, what a pot!", "Never in doubt! Right in the middle of the pocket.", "Stunning."],
        ["He's absolutely nailed that.", "That's a statement shot, that is."],
        ["Wow. Look at that.", "You don't see many of those. Hit with complete confidence."],
    ],
    'pot_fluke': [
        ["Oh, he'll take that!", "He certainly will. I'm not sure he knew much about it.", "Not a lot, no!"],
        ["Well, that's a stroke of luck.", "It all counts, though. They don't ask how, they ask how many."],
    ],
    'pot_double': [
        ["Oh, he's doubled it! Lovely.", "That's a real touch player's shot."],
    ],
    'break_30': [
        ["He's starting to get going now.", "And the balls are sitting nicely for him, too."],
    ],
    'break_50': [
        ["That's fifty, and he's barely broken sweat.", "So smooth. The cue ball's on a string."],
        ["Here we go. He's in the groove now.", "When he plays like this, there's no stopping him."],
    ],
    'break_70': [
        ["Seventy now, and still going.", "Can he go all the way? That's the question."],
    ],
    'break_end': [
        ["Ah, that's the end of the break.", "Still a very useful contribution, though."],
        ["He'll be disappointed to break down there.", "He will. That was a frame-winning chance."],
    ],
    'frame_ball': [
        ["This is the one.", "Pot this, and the frame is his.", "No pressure, then!"],
        ["Big moment, this.", "Huge. You could hear a pin drop in here."],
    ],
    'match_ball': [
        ["This ball for the match.", "Deep breath. Everything he's worked for comes down to this."],
    ],
    'frame_won': [
        ["And that's the frame.", "Thoroughly deserved, too. He was the better player in that one."],
        ["There it is. Job done.", "Lovely frame of snooker, that. A real pleasure to watch."],
    ],
    'frame_won_close': [
        ["What a finish to the frame!", "Edge of the seat stuff. I could hardly watch!"],
    ],
    'needs_snookers': [
        ["He needs snookers now.", "It's not over yet, though. Stranger things have happened."],
    ],
    'score_close': [
        ["It's so close, this.", "Nothing in it. Whoever holds their nerve takes it."],
    ],
    'frame_start': [
        ["Here we go, then. Next frame.", "A fresh start. Let's see who settles first."],
        ["Plenty of snooker still to be played.", "Plenty. And I've a feeling this one could be close."],
    ],
    'filler': [
        ["The table's playing beautifully tonight.", "It is. The cloth's quick, and the cushions are true."],
        ["Have you ever played in front of a crowd like this?", "Once or twice. Your legs turn to jelly, I promise you.", "I bet they do!"],
        ["What a venue this is.", "Isn't it just? There's nowhere quite like it."],
        ["Concentration is everything out there.", "It really is. You can't let your mind drift for a second."],
        ["He looks very relaxed out there.", "He does. But believe me, the heart will be pounding."],
        ["Who do you fancy in this one?", "Honestly, I can't call it. It's on a knife-edge."],
    ],
    'pack_split': [
        ["Oh, the pack's wide open now!", "Reds everywhere. This could be a big break."],
    ],
    'position_poor': [
        ["Ooh, he's not left himself much there.", "No. He's going to have to work hard for the next one."],
    ],
    'jaws': [
        ["Ohh, in and out!", "Rattled in the jaws. So unlucky."],
    ],
    'in_off': [
        ["Oh, the white's gone in!", "That's careless. Four points away, and ball in hand for his opponent."],
    ],
}
# ---- Quick reactions in the moment, while the balls are still running (every commentator records these).
LIVE = {
    'live_wow': ["Oh, yes!", "Shot!", "Lovely!", "What a pot!", "Superb!", "Oh, beautiful!"],
    'live_ooh': ["Ooh!", "Ohh, so close!", "Oh, rattled!", "Ooh, no!"],
    'live_ohno': ["Oh, no!", "Oh dear.", "Oh, the white's gone in!"],
}
