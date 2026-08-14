/**
 * The living content of /about/vision — the Secret Passport Creative
 * Studio. Same discipline as `../content.ts`: nothing here should
 * require touching a component to extend. Add a track, a cut, a sound
 * world, a film, or a vault entry by pushing onto the relevant array.
 */

export interface MusicTrack {
  readonly act: 1 | 2 | 3 | 4 | 5;
  readonly actLabel: string;
  readonly artist: string;
  readonly song: string;
  readonly note: string;
  /** A real, verified YouTube video id — only set this once someone has
   * actually confirmed it's the right video. Leave undefined and the
   * track renders a search link instead of guessing. Never fabricate an
   * id here; a wrong embed is worse than no embed. */
  readonly youtubeId?: string;
}

export interface MusicCut {
  readonly slug: string;
  readonly title: string;
  readonly tracks: readonly MusicTrack[];
}

const ACT_LABELS = [
  "Anticipation",
  "The Drive",
  "Discovery",
  "BOOM",
  "Afterglow",
] as const;

/**
 * Six five-song "cuts" — the same five-act emotional story (Anticipation
 * → Drive → Discovery → BOOM → Afterglow), told by six different casts
 * of music. Not a playlist to finish — a set of auditions. Add a
 * seventh cut the same shape as these; nothing else needs to change.
 */
export const MUSIC_CUTS: MusicCut[] = [
  {
    slug: "one-hell-of-a-day",
    title: "Cut 01 — One Hell of a Day",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Max Richter",
        song: "On the Nature of Daylight",
        note: "The truck isn't packed yet. Something's coming.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Moby",
        song: "Porcelain",
        note: "Windows down. Nobody's said anything for a while and it's fine.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "Clint Mansell",
        song: "Leaving Earth",
        note: "The lake nobody's seen before comes into view.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "Mick Gordon",
        song: "BFG Division",
        note: "The jump. Chaos. Everyone alive at once.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "M83",
        song: "Outro",
        note: "Fire's dying down. Nobody wants to be the one to say it's time to go in.",
      },
    ],
  },
  {
    slug: "tomorrow-starts-here",
    title: "Cut 02 — Tomorrow Starts Here",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Nils Frahm",
        song: "Says",
        note: "Coffee. Dark driveway. The build before the build.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Underworld",
        song: "Rez",
        note: "The road opens up and everyone feels it at the same time.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "Jóhann Jóhannsson",
        song: "Flight From the City",
        note: "Somewhere new, and it's bigger than anyone expected.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "Pendulum",
        song: "Witchcraft",
        note: "Full speed. No hesitation left in anyone.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "Ólafur Arnalds",
        song: "Near Light",
        note: "Everyone quiet, replaying it without saying so.",
      },
    ],
  },
  {
    slug: "neon-highway",
    title: "Cut 03 — Neon Highway",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Trent Reznor & Atticus Ross",
        song: "Hand Covers Bruise",
        note: "Something a little darker in the anticipation this time.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Orbital",
        song: "Halcyon + On + On",
        note: "Night driving. Headlights and nothing else.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "Jon Hopkins",
        song: "Light Through the Veins",
        note: "The unexpected place. Nobody planned this stop.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "Carpenter Brut",
        song: "Turbo Killer",
        note: "Engines. Dust. Nothing slow about this act.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "Brian Eno",
        song: "An Ending (Ascent)",
        note: "The comedown that makes the whole day make sense.",
      },
    ],
  },
  {
    slug: "cold-lake-warm-sun",
    title: "Cut 04 — Cold Lake / Warm Sun",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Hania Rani",
        song: "Glass",
        note: "Soft, early, a little uncertain still.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Tycho",
        song: "Awake",
        note: "Sun's fully up now. Everyone's actually awake.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "The Cinematic Orchestra",
        song: "Arrival of the Birds",
        note: "The view that shuts everyone up for a second.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "HEALTH & Nine Inch Nails",
        song: "ISN'T EVERYONE",
        note: "Cold water, all at once, everyone screaming.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "Max Richter",
        song: "November",
        note: "Towels out. Sun going down slow.",
      },
    ],
  },
  {
    slug: "hackers-bloodline",
    title: "Cut 05 — Hackers Bloodline",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Clint Mansell",
        song: "First Dream Called Ocean",
        note: "Reckless energy before anyone's left the driveway.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Underworld",
        song: "Cowgirl",
        note: "Everyone in the truck losing it a little.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "Orbital",
        song: "Halcyon + On + On",
        note: "Somewhere between discovery and déjà vu.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "The Prodigy",
        song: "Voodoo People",
        note: "Pure chaos. The good kind.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "Massive Attack",
        song: "Protection",
        note: "Everyone quiet, watching the fire instead of talking.",
      },
    ],
  },
  {
    slug: "the-road-home",
    title: "Cut 06 — The Road Home",
    tracks: [
      {
        act: 1,
        actLabel: ACT_LABELS[0],
        artist: "Dustin O'Halloran",
        song: "We Move Lightly",
        note: "Barely awake, already excited.",
      },
      {
        act: 2,
        actLabel: ACT_LABELS[1],
        artist: "Bonobo",
        song: "Kerala",
        note: "Long stretch of road, nowhere else to be.",
      },
      {
        act: 3,
        actLabel: ACT_LABELS[2],
        artist: "Moby",
        song: "God Moving Over the Face of the Waters",
        note: "The water, wide and unbothered by anyone.",
      },
      {
        act: 4,
        actLabel: ACT_LABELS[3],
        artist: "Celldweller",
        song: "End of an Empire",
        note: "Last big push before the light goes.",
      },
      {
        act: 5,
        actLabel: ACT_LABELS[4],
        artist: "Explosions in the Sky",
        song: "Your Hand in Mine",
        note: "Sunset through the windshield, headed home, nobody talking, nobody needing to.",
      },
    ],
  },
];

export interface SoundWorld {
  readonly name: string;
}

/** A reference wall, not a definitive list — the emotional territories
 * worth keeping in mind, not a genre list. Add a name the moment it
 * earns its place. */
export const SOUND_WORLDS: SoundWorld[] = [
  { name: "Max Richter" },
  { name: "Clint Mansell" },
  { name: "Kronos Quartet" },
  { name: "Trent Reznor & Atticus Ross" },
  { name: "Jóhann Jóhannsson" },
  { name: "Nils Frahm" },
  { name: "Ólafur Arnalds" },
  { name: "Hania Rani" },
  { name: "Hans Zimmer" },
  { name: "Moby" },
  { name: "Orbital" },
  { name: "Underworld" },
  { name: "Leftfield" },
  { name: "Massive Attack" },
  { name: "Bonobo" },
  { name: "Tycho" },
  { name: "Jon Hopkins" },
  { name: "M83" },
  { name: "Brian Eno" },
  { name: "Mick Gordon" },
  { name: "HEALTH" },
  { name: "Nine Inch Nails" },
  { name: "Celldweller" },
  { name: "Blue Stahli" },
  { name: "Carpenter Brut" },
  { name: "Perturbator" },
  { name: "Dance With The Dead" },
  { name: "Pendulum" },
  { name: "Gunship" },
  { name: "The Algorithm" },
  { name: "The Prodigy" },
  { name: "The Cinematic Orchestra" },
  { name: "Explosions in the Sky" },
];

export interface FilmIdea {
  readonly title: string;
  readonly beats: readonly string[];
}

export const FILM_IDEAS: FilmIdea[] = [
  {
    title: "TRUCK DAY",
    beats: [
      "dirt bike in back",
      "lake",
      "friends",
      "cliff jump",
      "underwater silence",
      "drone shot",
      "BBQ",
      "campfire",
      "dusk",
    ],
  },
  {
    title: "FIRST LIGHT",
    beats: [
      "dark driveway",
      "coffee",
      "truck loading",
      "ignition",
      "sunrise",
      "anticipation",
    ],
  },
  {
    title: "ONE MORE",
    beats: [
      "fear before the jump",
      "silence",
      "friends waiting",
      "leap",
      "splash",
      "laughter",
    ],
  },
  {
    title: "THE ROAD HOME",
    beats: [
      "tired",
      "dirty",
      "sunset through windshield",
      "footage replaying on phone",
      "quiet satisfaction",
    ],
  },
  {
    title: "WINTER VERSION",
    beats: [
      "snow",
      "breath in cold air",
      "truck lights",
      "sled / snowshoe / cabin",
      "fire",
      "silence",
    ],
  },
];

/**
 * The Raw Idea Vault. Deliberately a flat, unstructured list — quotes,
 * unfinished copy, story fragments, camera shots, strange thoughts,
 * whatever. Nothing here is polished on purpose; sanitizing this list is
 * the one thing not to do to it. Add to the bottom whenever something
 * shows up worth keeping, half-formed or not.
 */
export const RAW_IDEA_VAULT: string[] = [
  "Opening shot: nobody's face. Just hands packing a cooler in the dark.",
  "What if the app's loading state IS the anticipation, not something to hide.",
  "A whole cut scored entirely in near-silence — foley only, no music, until the jump.",
  "\"You checked the weather three times. That's how we know you're excited.\"",
  "Camera never shows the destination until the group does. No spoilers, even to the viewer.",
  "Winter Version but the fire is the only warm color in the whole frame.",
  "Idea: a Passport page that just shows tonight's sunset time for wherever you are. Nothing else on it.",
  '"Some places don\'t need a review. They need a Tuesday."',
  "What does the 90-year-old's version of BOOM look like. Don't answer that with a stereotype.",
  "Shot list: burnt marshmallow, someone's bad parking job, a dog that won't get in the truck.",
  "The group chat screenshot IS the first frame of the film. Not the truck. The chat.",
  "\"We didn't plan this. That's the whole point.\"",
  "A version of the sound section where two cuts get mashed into one and it somehow works better.",
  "Product thought: what if Passport can tell when you have 2 free hours and just... doesn't say anything unless you ask.",
  'Line: "Go see. Stay a little longer. Take the wrong turn."',
  "Someone's phone battery dies mid-adventure and nobody cares. That's a scene, not a problem.",
];
