/* VELVET - opponents you can play. Edit freely: names, short names (HUD), the
   referee's spoken surname ("say") and style. Style values tune the bot on top
   of the chosen level:
     pot      cueing accuracy (lower = more accurate, 1 = level default)
     long     extra accuracy on long shots over 1.2 m (lower = better long potter)
     attack   pot-or-safety threshold (negative = takes on more pots)
     position how hard it works for position (higher = searches more options)
     safety   how many safety options it examines (higher = stronger tactician)
     speed    thinking time (lower = plays faster)
   Optional: nick (walk-on nickname, shown in the name: Soy "The Titan" Oudom), country, and
   react: 'composed' (calm on easy pots, a nod for a hard one, a small fist
   pump for the frame, a raised hand for a century and the match).    The real players' names are used for a personal game only. */
window.VELVET_OPPONENTS = [
  {id: 'club',      name: 'Club Bot',          short: 'CLUB BOT',    say: 'the club bot', style: {}},
  {id: 'osullivan', character: 'pro_osullivan', name: "Ronnie O'Sullivan", short: "O'SULLIVAN",  say: "O'Sullivan",   style: {pot: .78, long: .9,  attack: -.12, position: 1.35, safety: 1.0,  speed: .5}},
  {id: 'trump', character: 'pro_trump',     name: 'Judd Trump',        short: 'TRUMP',       say: 'Trump',        style: {pot: .82, long: .72, attack: -.16, position: 1.15, safety: .9,   speed: .72}},
  {id: 'selby', character: 'pro_selby',     name: 'Mark Selby',        short: 'SELBY',       say: 'Selby',        style: {pot: .88, long: 1.0, attack: .12,  position: 1.1,  safety: 1.45, speed: 1.45}},
  {id: 'higgins', character: 'pro_higgins',   name: 'John Higgins',      short: 'HIGGINS',     say: 'Higgins',      style: {pot: .84, long: .95, attack: .03,  position: 1.35, safety: 1.3,  speed: 1.0}},
  {id: 'williams', character: 'pro_williams',  name: 'Mark Williams',     short: 'WILLIAMS',    say: 'Williams',     style: {pot: .84, long: .74, attack: -.08, position: 1.0,  safety: 1.1,  speed: .8}},
  {id: 'ding', character: 'pro_ding',      name: 'Ding Junhui',       short: 'DING',        say: 'Ding',         style: {pot: .84, long: .9,  attack: 0,    position: 1.25, safety: 1.0,  speed: 1.0}},
  {id: 'robertson', character: 'pro_robertson', name: 'Neil Robertson',    short: 'ROBERTSON',   say: 'Robertson',    style: {pot: .84, long: .74, attack: -.08, position: 1.15, safety: 1.0,  speed: .9}},
  {id: 'zhao', character: 'pro_zhao',      name: 'Zhao Xintong',      short: 'ZHAO',        say: 'Jow',          style: {pot: .86, long: .82, attack: -.12, position: 1.1,  safety: .9,   speed: .75}},
  {id: 'murphy', character: 'pro_murphy',    name: 'Shaun Murphy',      short: 'MURPHY',      say: 'Murphy',       style: {pot: .86, long: .8,  attack: -.06, position: 1.1,  safety: 1.0,  speed: .9}},
  {id: 'allen', character: 'pro_allen',     name: 'Mark Allen',        short: 'ALLEN',       say: 'Allen',        style: {pot: .88, long: .95, attack: .06,  position: 1.05, safety: 1.25, speed: 1.1}},
  {id: 'wilson', character: 'pro_wilson',    name: 'Kyren Wilson',      short: 'K. WILSON',   say: 'Wilson',       style: {pot: .86, long: .85, attack: -.04, position: 1.1,  safety: 1.1,  speed: .95}},
  {id: 'brecel', character: 'pro_brecel',    name: 'Luca Brecel',       short: 'BRECEL',      say: 'Bressel',      style: {pot: .84, long: .8,  attack: -.15, position: 1.1,  safety: .85,  speed: .6}},
  {id: 'hawkins', character: 'pro_hawkins',   name: 'Barry Hawkins',     short: 'HAWKINS',     say: 'Hawkins',      style: {pot: .88, long: .9,  attack: 0,    position: 1.05, safety: 1.15, speed: 1.0}},
  {id: 'bingham', character: 'pro_bingham',   name: 'Stuart Bingham',    short: 'BINGHAM',     say: 'Bingham',      style: {pot: .87, long: .8,  attack: -.05, position: 1.05, safety: 1.1,  speed: .85}},
  {id: 'lisowski', character: 'pro_lisowski',  name: 'Jack Lisowski',     short: 'LISOWSKI',    say: 'Lisowski',     style: {pot: .88, long: .8,  attack: -.12, position: 1.0,  safety: .85,  speed: .7}},
  // Balanced and tactical: accurate, fine positional player, strong safety, medium deliberate tempo.
  {id: 'oudom', character: 'pro_oudom',   name: 'Soy Oudom',  short: 'S. OUDOM', say: 'Soy Odom', nick: 'The Titan', country: 'Cambodia', react: 'composed',
   style: {pot: .84, long: .85, attack: .04, position: 1.3, safety: 1.35, speed: 1.1}}
];
