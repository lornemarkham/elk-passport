/**
 * The living content of /about — "Phase Forever."
 *
 * This file exists so the page never has to be touched to add a song, a
 * film idea, a loose line written at midnight, or a brand. Every list
 * below is meant to grow. Adding something is a one-line push, not a
 * redesign. Nothing here needs to be permanent — this is a mood board
 * that happens to be running in production, not a finished spec.
 */

export const FEELING_WORDS = [
  "Anticipation.",
  "Wonder.",
  "Freedom.",
  "Adventure.",
  "Curiosity.",
  "Connection.",
  "Stillness.",
  "Adrenaline.",
  "Music.",
  "Water.",
  "Fire.",
  "Cold air.",
  "Warm sun.",
  "Friends.",
  "Family.",
  "Strangers who become stories.",
];

export interface NotJustExtremeMoment {
  readonly line: string;
}

export const NOT_JUST_EXTREME: NotJustExtremeMoment[] = [
  { line: "A 90-year-old finding a beautiful lakeside walk." },
  { line: "A couple having lunch somewhere they never knew existed." },
  { line: "A grandfather taking his granddaughter fishing." },
  { line: "A quiet coffee overlooking the ocean." },
  { line: "A perfect bookstore." },
  { line: "A garden." },
  { line: "A museum." },
  { line: "A tiny restaurant." },
  { line: "A ferry ride." },
  { line: "A cabin." },
  { line: "A winery." },
  { line: "A sunset." },
  { line: "A road trip." },
  { line: "A first swim of summer." },
  { line: "A family laughing around a table." },
];

export interface SoundReference {
  readonly artist: string;
  readonly territory: string;
  /** A legal way to actually go listen — a search link, never a hosted file. */
  readonly searchUrl: string;
}

/**
 * The emotional territory, not a genre. Every entry here is a reference
 * point for how a moment should *feel* scored, not a licensing decision —
 * nothing is embedded or hosted. Add to this list the moment a song earns
 * its place; nothing here needs permission to grow.
 */
export const SOUND_REFERENCES: SoundReference[] = [
  {
    artist: "Max Richter",
    territory: "Anticipation that aches a little. The drive before the drive.",
    searchUrl: "https://open.spotify.com/search/Max%20Richter",
  },
  {
    artist: "Clint Mansell",
    territory: "The moment right before everything changes.",
    searchUrl: "https://open.spotify.com/search/Clint%20Mansell",
  },
  {
    artist: "Kronos Quartet",
    territory:
      "Strings that make a landscape feel like it's watching you back.",
    searchUrl: "https://open.spotify.com/search/Kronos%20Quartet",
  },
  {
    artist: "Trent Reznor & Atticus Ross",
    territory: "Tension turning into release. The jump.",
    searchUrl:
      "https://open.spotify.com/search/Trent%20Reznor%20Atticus%20Ross",
  },
  {
    artist: "Jóhann Jóhannsson",
    territory: "Stillness that still has a pulse.",
    searchUrl: "https://open.spotify.com/search/Johann%20Johannsson",
  },
  {
    artist: "Nils Frahm",
    territory: "Morning. Coffee. The truck isn't packed yet.",
    searchUrl: "https://open.spotify.com/search/Nils%20Frahm",
  },
  {
    artist: "Hans Zimmer",
    territory: "The drone shot. The reveal.",
    searchUrl: "https://open.spotify.com/search/Hans%20Zimmer",
  },
  {
    artist: "Moby",
    territory: "Wide open roads and windows down.",
    searchUrl: "https://open.spotify.com/search/Moby",
  },
  {
    artist: "Orbital",
    territory: "Motion. Momentum. Something is about to happen.",
    searchUrl: "https://open.spotify.com/search/Orbital",
  },
  {
    artist: "Underworld",
    territory: "The whole group, moving together, alive.",
    searchUrl: "https://open.spotify.com/search/Underworld",
  },
  {
    artist: "Leftfield",
    territory: "Bass in your chest. The engine turning over.",
    searchUrl: "https://open.spotify.com/search/Leftfield",
  },
  {
    artist: "Hackers (soundtrack)",
    territory: "Reckless, young, electric — that specific kind of alive.",
    searchUrl: "https://open.spotify.com/search/Hackers%20soundtrack",
  },
  {
    artist: "The Beach (soundtrack)",
    territory: "Paradise with something underneath it. Water, always water.",
    searchUrl: "https://open.spotify.com/search/The%20Beach%20soundtrack",
  },
  {
    artist: "Mick Gordon",
    territory: "Adrenaline with teeth. For the days that hit hard.",
    searchUrl: "https://open.spotify.com/search/Mick%20Gordon",
  },
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
      "friends",
      "lake",
      "cliff jump",
      "underwater silence",
      "drone reveal",
      "BBQ",
      "campfire",
      "dusk",
    ],
  },
  {
    title: "FIRST LIGHT",
    beats: [
      "coffee",
      "packing",
      "dark driveway",
      "ignition",
      "sunrise",
      "anticipation",
    ],
  },
  {
    title: "ONE MORE",
    beats: [
      "someone afraid to jump",
      "friends waiting",
      "silence",
      "jump",
      "chaos",
      "laughter",
    ],
  },
  {
    title: "THE WAY HOME",
    beats: [
      "tired",
      "dirty",
      "sunset through windshield",
      "footage replaying on someone's phone",
      "quiet satisfaction",
    ],
  },
];

export interface ElkBrand {
  readonly name: string;
  readonly heart: string;
}

export const ELK_BRANDS: ElkBrand[] = [
  {
    name: "ELK Wrench",
    heart: "Confidence. Creation. Building with your hands.",
  },
  { name: "ELK Garden", heart: "Food, nature, learning, family, growth." },
  { name: "ELK Kitchen", heart: "Sharing meals. Memory. Abundance." },
  {
    name: "ELK Wildlife",
    heart: "Wonder. Observation. Connection to the natural world.",
  },
  { name: "ELK Lark", heart: "Adventure, hospitality, connection, stories." },
  { name: "Passport", heart: "Discovery, anticipation, adventure, memory." },
];

/**
 * Loose lines — a mood board, not a finished manifesto. Not all of these
 * need to survive forever. Add new ones at the bottom; the wall is meant
 * to keep growing.
 */
export const LOOSE_LINES: string[] = [
  "Go see.",
  "Stay a little longer.",
  "Take the wrong turn.",
  "Cold water. Warm sun.",
  "Tomorrow can be different.",
  "You're not done yet.",
  "Pack the truck.",
  "Call your friend.",
  "One more jump.",
  "Take the scenic way.",
  "Leave room for something unexpected.",
  "Some places become part of you.",
  "Collect stories.",
  "Remember when?",
  "Feel it.",
  "Look up.",
  "Go.",
  "The love of life is here.",
];

/** Atlas gathers this. Passport turns it into possibility. Kept as a
 * list, not prose, so it's obvious at a glance how much of it there
 * already is — and how much more there will be. */
export const ATLAS_KNOWLEDGE = [
  "places",
  "relationships",
  "history",
  "activities",
  "facilities",
  "weather",
  "accessibility",
  "local knowledge",
  "trails",
  "water",
  "food",
  "events",
  "stories",
  "context",
];
