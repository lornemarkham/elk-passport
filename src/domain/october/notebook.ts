/**
 * **The notebook.** What October is turning out to be.
 *
 * The sketchbook next door holds *rooms* — scenes and the readings of them.
 * This holds the material those rooms are made of: who she is, the things she
 * says, the rules nobody explained, the numbers, and the sound.
 *
 * Written down verbatim wherever there is a line worth keeping, because a
 * paraphrase of *"I only get October."* is a character brief and loses the one
 * thing that made anybody sit up.
 *
 * Nothing here is settled. Several of these contradict each other.
 */

/* ------------------------------------------------------------------ OCTOBER */

/**
 * **She is not a horror character.** That is the whole discovery, and the
 * thing most likely to get flattened by anyone who arrives late.
 */
export const SHE_IS = [
  "childlike",
  "lonely",
  "strange",
  "funny",
  "frightening",
  "still discovering what she is",
] as const;

/** Said by October. Kept exactly as they arrived. */
export interface Fragment {
  readonly lines: readonly string[];
  /** Roughly where in her arc this sits, when that is known. */
  readonly when?: string;
  /** Loud. Most of her is not. */
  readonly enormous?: boolean;
}

export const OCTOBER_SAYS: readonly Fragment[] = [
  { lines: ["I was always here.", "You just never looked."] },
  {
    lines: ["October…", "October…", "October…", "OCTOBER."],
    when: "her name, arriving from somewhere else",
  },
  { lines: ["Is that my name?"] },
  {
    lines: [
      "10 is me.",
      "12 brings me back.",
      "31, then everything goes black.",
    ],
  },
  { lines: ["I was lost, but I am found."] },
  { lines: ["I AM FOUND."], enormous: true },
  {
    lines: ["I AM OCTOBER."],
    enormous: true,
    when: "the climax, and the only place she is huge",
  },
  {
    lines: [
      "You get summer.",
      "You get winter.",
      "You get spring.",
      "You get to grow.",
      "I only get October.",
    ],
    when: "the saddest thing she has said",
  },
  { lines: ["I wish I was you."] },
];

/* -------------------------------------------------------------------- RULES */

/**
 * Not lyrics. Rules for surviving somewhere whose logic nobody has explained,
 * whispered by something that already knows them.
 *
 * The reason they work is that none of them is ever explained. The moment one
 * gets a reason, it becomes a mechanic.
 */
export const RULES = [
  "keep your hand against the wall",
  "something waits beneath the floor",
  "something hears you when you call",
  "count the doorways in the dark",
  "stay awake",
  "do not turn",
  "there is breathing in the room",
  "there is ash beneath your tongue",
] as const;

/* ----------------------------------------------------------- 10 / 12 / 31 */

export const NUMBERS = [
  {
    n: "10",
    means: "October. Her. The month and the name are the same thing.",
  },
  {
    n: "12",
    means: "She comes back every twelve months. She has no say in it.",
  },
  { n: "31", means: "The end. Everything goes black." },
] as const;

/* -------------------------------------------------------------------- SOUND */

export interface Track {
  /** The file as it actually sits in `public/sounds`, spaces and all. */
  readonly file: string;
  readonly title: string;
  /** Seconds, measured off the file rather than guessed. */
  readonly seconds: number;
  /** Marks the two that are versions of each other. */
  readonly variantOf?: string;
  /**
   * What we were trying. Deliberately empty — nobody has written these yet,
   * and inventing a description of a piece of music is worse than a blank.
   */
  readonly note?: string;
}

export const TRACKS: readonly Track[] = [
  { file: "Do Not Turn.m4a", title: "Do Not Turn", seconds: 330 },
  { file: "I Am October.m4a", title: "I Am October", seconds: 149 },
  {
    file: "I Am Octoberv1.m4a",
    title: "I Am October — v1",
    seconds: 313,
    variantOf: "I Am October",
  },
  {
    file: "Subterranean Pressure.m4a",
    title: "Subterranean Pressure",
    seconds: 119,
  },
  {
    file: "Subterranean Pressure (1).m4a",
    title: "Subterranean Pressure (1)",
    seconds: 120,
    variantOf: "Subterranean Pressure",
  },
];

/**
 * **The shape we are chasing.** Not a song — a journey with a floor that keeps
 * dropping. The voice stays quiet for almost all of it.
 */
export const PROGRESSION = [
  "almost nothing",
  "something is wrong",
  "being followed",
  "moving faster",
  "running",
  "being chased",
  "overwhelming",
  "BOOM",
  "absolute silence",
] as const;

export const SOUND_NOTES = [
  "The best pieces are not conventional songs. They work with dread, ritual, repetition, enormous low-frequency pressure, silence, whispers, and eventual overwhelming escalation.",
  "We are chasing a very deep sustained subterranean VROOOOM rather than ordinary drums or trailer booms. Pressure, not impact.",
  "October stays quiet for most of the journey. Only near the climax does she become enormous.",
] as const;

/* ----------------------------------------------------------------- CONCEPTS */

export interface Concept {
  readonly id: string;
  readonly title: string;
  readonly hook: string;
  readonly beats: readonly string[];
  /** The line it is all built towards, if there is one. */
  readonly landsOn?: string;
  readonly open?: string;
}

export const CONCEPTS: readonly Concept[] = [
  {
    id: "witching-hour",
    title: "Witching Hour",
    hook: "The site and your phone react to a composition that will not stop growing.",
    beats: [
      "Near darkness.",
      "Tiny movements.",
      "Numbers appearing.",
      "Whispers.",
      "10 / 12 / 31, increasingly obsessive.",
      "Progressively more overwhelming.",
      "Then absolute silence.",
    ],
    open: "The escalation is the easy half. The silence at the end is the part that has to be earned, and we do not know yet what earns it.",
  },
  {
    id: "escape-room",
    title: "The Escape Room",
    hook: "Start somewhere completely adult and alive. A packed metal club.",
    beats: [
      "Live band. People drinking. Sweaty room. Lights. Noise. Fun.",
      "The band hits a huge moment.",
      "BLACK. Everything stops.",
      "Emergency lighting returns. Everyone is gone.",
      "Drinks, instruments, jackets — all still there, as though the room emptied seconds ago.",
      "The exit is locked. The club is the escape room.",
      "October may eventually offer you another way out.",
    ],
    landsOn:
      "You escape, and the band, the lights and the crowd return on exactly the beat they vanished on. Nobody else experienced the missing time. October: “you took forever.”",
    open: "Everything rests on the disappearance being convincing in a browser. If that read is cheap, the whole thing is a gimmick.",
  },
];

/* ------------------------------------------------------------- FOR BRYAN */

/** Left open on purpose. Answering these here would be the mistake. */
export const QUESTIONS = [
  "What does October actually look like — if we ever see her at all?",
  "Should she exist mostly through movement, shadow, typography, sound and the room changing around you?",
  "How could 10 / 12 / 31 become an animation language rather than three numbers?",
  "How should the music physically affect the page?",
  "What happens visually during the enormous low-frequency pulses?",
  "How little can we show and still make someone feel she is present?",
  "Could the metal-club disappearance be done convincingly in-browser?",
  "What visual idea have we not thought of yet?",
] as const;

/* --------------------------------------------------------------- DISCARDED */

/**
 * Things we actually tried and dropped, with the reason.
 *
 * Real ones only. A fake graveyard is worse than no graveyard — the point of
 * showing these is so nobody spends an evening rediscovering them, and one
 * of them has already come back from the dead.
 */
export const DISCARDED: readonly {
  readonly idea: string;
  readonly why: string;
  readonly revived?: boolean;
}[] = [
  {
    idea: "October looks at the scariest room in your house and says something completely banal. “Lovely. Have you thought about the corn maze?”",
    why: "It made us laugh, which is how we knew it was a different product.",
  },
  {
    idea: "The photograph comes back subtly altered.",
    why: "Image-analysis theatre wearing a hat. The moment she proves she looked, she stops being a presence and becomes a party trick.",
  },
  {
    idea: "October describes a detail you did not photograph.",
    why: "Fake omniscience, and cheap. A claim that can be checked can be wrong.",
  },
  {
    idea: "The Secret Room as an escape room.",
    why: "Written off as “one option and probably the least interesting one.” It is now the strongest thing on this page.",
    revived: true,
  },
];
