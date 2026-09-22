/**
 * **A small curated catalogue, authored by hand.**
 *
 * Not a movie database and not trying to become one. Twenty-seven films chosen
 * to span what an October evening can be — a five-year-old's first spooky
 * cartoon through to the ones you regret at 2 a.m. — so the interaction can be
 * physically tested at both ends.
 *
 * Every field here is **authored**, including the lines. Nothing is scraped,
 * nothing is inferred, and there is no availability: whether a film is on a
 * service tonight is a licensing feed Passport does not have, and guessing
 * would be inventing (§20).
 *
 * ## The two axes, and why neither derives from the other
 *
 * ```
 * audience   who is it suitable for?     kids · teens · adults
 * fear       how frightening is it?      cozy · spooky · creepy · nightmare
 * ```
 *
 * These are **independent**, and the catalogue proves it rather than asserting
 * it: `Coraline` is rated PG and is genuinely **creepy**; `The Addams Family`
 * is rated PG-13 and is **cozy**. A higher certification does not mean
 * scarier, and a film a child may watch can still frighten that child. Any
 * code that computes one of these from the other is wrong.
 *
 * ## Certifications are not universal, and this says so
 *
 * `certification` records a rating **as published, with the system named** —
 * these are the US MPA codes, which are the ones most widely printed on the
 * films themselves. British Columbia, where this is being built, uses
 * Consumer Protection BC (G · PG · 14A · 18A) and does not always agree.
 *
 * So the certification is shown as evidence and `audience` is **Passport's own
 * three-step**, authored per film by a person who has seen it. Passport filters
 * on `audience` and displays `certification`, and never pretends one country's
 * board speaks for the room.
 */

export type Audience = "kids" | "teens" | "adults";
export type Fear = "cozy" | "spooky" | "creepy" | "nightmare";

/**
 * Why a film works on somebody. Used for the occasional "what got you?" and
 * for one or two chips on a card — never for scoring anything yet.
 */
export type Mechanism =
  | "dread"
  | "the unseen"
  | "jump"
  | "reality-wrong"
  | "isolation"
  | "uncanny"
  | "being watched"
  | "too real"
  | "helplessness"
  | "delight";

export interface Film {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly runtimeMinutes: number;
  /** As published, with the board named. Shown, never filtered on. */
  readonly certification: { readonly system: "MPA"; readonly code: string };
  /** Passport's own ceiling. Filtered on. Authored, never derived from fear. */
  readonly audience: Audience;
  /** How frightening. Authored, never derived from the certification. */
  readonly fear: Fear;
  readonly mechanisms: readonly Mechanism[];
  /** October's one line. Authored. */
  readonly line: string;
}

export const CATALOGUE: readonly Film[] = [
  // ------------------------------------------------------------------ kids
  {
    id: "great-pumpkin",
    title: "It's the Great Pumpkin, Charlie Brown",
    year: 1966,
    runtimeMinutes: 25,
    certification: { system: "MPA", code: "G" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight"],
    line: "Twenty-five minutes. Linus waits in the pumpkin patch for something that never comes, and it is somehow perfect.",
  },
  {
    id: "were-rabbit",
    title: "Wallace & Gromit: The Curse of the Were-Rabbit",
    year: 2005,
    runtimeMinutes: 85,
    certification: { system: "MPA", code: "G" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight"],
    line: "A monster movie where the monster is a rabbit and the stakes are a vegetable competition.",
  },
  {
    id: "nightmare-before-christmas",
    title: "The Nightmare Before Christmas",
    year: 1993,
    runtimeMinutes: 76,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight", "uncanny"],
    line: "Skeletons, a song every ten minutes, and nothing that will keep anybody up.",
  },
  {
    id: "hocus-pocus",
    title: "Hocus Pocus",
    year: 1993,
    runtimeMinutes: 96,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight"],
    line: "Three witches, one talking cat, and absolutely no intention of being frightening.",
  },
  {
    id: "casper",
    title: "Casper",
    year: 1995,
    runtimeMinutes: 100,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight"],
    line: "A ghost story where the ghost would just like a friend.",
  },
  {
    id: "corpse-bride",
    title: "Corpse Bride",
    year: 2005,
    runtimeMinutes: 77,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["uncanny", "delight"],
    line: "The land of the dead has better music than the land of the living. That's the whole joke.",
  },
  {
    id: "scooby-doo",
    title: "Scooby-Doo",
    year: 2002,
    runtimeMinutes: 86,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "cozy",
    mechanisms: ["delight"],
    line: "It was a person in a mask. It was always a person in a mask.",
  },
  {
    id: "monster-house",
    title: "Monster House",
    year: 2006,
    runtimeMinutes: 91,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "spooky",
    mechanisms: ["dread", "jump"],
    line: "The house across the road eats things. Genuinely tense for about twenty minutes, then it lets you go.",
  },
  {
    id: "paranorman",
    title: "ParaNorman",
    year: 2012,
    runtimeMinutes: 92,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "spooky",
    mechanisms: ["uncanny", "delight"],
    line: "A boy who sees the dead, in a town that would rather he didn't. Kinder than it looks.",
  },
  {
    id: "beetlejuice",
    title: "Beetlejuice",
    year: 1988,
    runtimeMinutes: 92,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "spooky",
    mechanisms: ["uncanny", "delight"],
    line: "Loud, strange, and funnier than it is frightening — though the sandworms land for some kids.",
  },
  {
    id: "ghostbusters",
    title: "Ghostbusters",
    year: 1984,
    runtimeMinutes: 105,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    fear: "spooky",
    mechanisms: ["jump", "delight"],
    line: "A comedy first. The librarian in the opening scene is the only part anyone remembers being scared by.",
  },
  {
    id: "coraline",
    title: "Coraline",
    year: 2009,
    runtimeMinutes: 100,
    certification: { system: "MPA", code: "PG" },
    audience: "kids",
    // The proof the axes are independent: rated for children, and properly
    // unsettling. Nothing computes this from "PG".
    fear: "creepy",
    mechanisms: ["uncanny", "being watched", "dread"],
    line: "Buttons for eyes. Rated for children and quietly one of the most unsettling films on this list.",
  },

  // ----------------------------------------------------------------- teens
  {
    id: "addams-family",
    title: "The Addams Family",
    year: 1991,
    runtimeMinutes: 99,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    // The other direction: a higher certification that is not remotely scarier.
    fear: "cozy",
    mechanisms: ["delight"],
    line: "Gothic, warm, and about a family that likes each other. The certification is doing the heavy lifting, not the fear.",
  },
  {
    id: "jaws",
    title: "Jaws",
    year: 1975,
    runtimeMinutes: 124,
    certification: { system: "MPA", code: "PG" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["the unseen", "dread", "jump"],
    line: "The shark barely appears. That was a budget problem, and it made the film.",
  },
  {
    id: "poltergeist",
    title: "Poltergeist",
    year: 1982,
    runtimeMinutes: 114,
    certification: { system: "MPA", code: "PG" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["reality-wrong", "helplessness", "jump"],
    line: "A suburban house turns on a family. Rated PG in 1982, which tells you something about 1982.",
  },
  {
    id: "sixth-sense",
    title: "The Sixth Sense",
    year: 1999,
    runtimeMinutes: 107,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["dread", "uncanny"],
    line: "Sad more than frightening, in the end. Watch it with someone who hasn't.",
  },
  {
    id: "signs",
    title: "Signs",
    year: 2002,
    runtimeMinutes: 106,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["the unseen", "isolation", "dread"],
    line: "A farmhouse, a cornfield, and something you mostly don't see. The birthday party footage is the whole film.",
  },
  {
    id: "the-others",
    title: "The Others",
    year: 2001,
    runtimeMinutes: 101,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["dread", "the unseen", "isolation"],
    line: "A big house, a mother, children who cannot be in daylight. Almost nothing is shown. Everything is heard.",
  },
  {
    id: "a-quiet-place",
    title: "A Quiet Place",
    year: 2018,
    runtimeMinutes: 90,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "creepy",
    mechanisms: ["dread", "jump", "helplessness"],
    line: "Ninety minutes where the sound design is the villain. Do not eat crisps.",
  },
  {
    id: "arachnophobia",
    title: "Arachnophobia",
    year: 1990,
    runtimeMinutes: 109,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "spooky",
    mechanisms: ["jump", "too real"],
    line: "It is about spiders and it knows exactly what it is doing. Fine unless it is about spiders for you.",
  },
  {
    id: "the-ring",
    title: "The Ring",
    year: 2002,
    runtimeMinutes: 115,
    certification: { system: "MPA", code: "PG-13" },
    audience: "teens",
    fear: "nightmare",
    // PG-13 and a nightmare. The pair that makes the point in the other
    // direction from Coraline.
    mechanisms: ["reality-wrong", "dread", "being watched"],
    line: "A videotape, seven days, and a green-grey palette you will keep seeing. PG-13, and it will not feel like it.",
  },

  // ---------------------------------------------------------------- adults
  {
    id: "get-out",
    title: "Get Out",
    year: 2017,
    runtimeMinutes: 104,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "creepy",
    mechanisms: ["dread", "too real", "helplessness"],
    line: "The scariest thing in it is a conversation. Funnier than people remember, right up until it isn't.",
  },
  {
    id: "halloween-1978",
    title: "Halloween",
    year: 1978,
    runtimeMinutes: 91,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "creepy",
    mechanisms: ["being watched", "dread", "jump"],
    line: "The one the month is named after. He is standing in the background of shots nobody is looking at.",
  },
  {
    id: "alien",
    title: "Alien",
    year: 1979,
    runtimeMinutes: 117,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "nightmare",
    mechanisms: ["isolation", "the unseen", "helplessness"],
    line: "A haunted house in space, and nobody is coming. Slower than you remember, and better.",
  },
  {
    id: "the-thing",
    title: "The Thing",
    year: 1982,
    runtimeMinutes: 109,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "nightmare",
    mechanisms: ["isolation", "reality-wrong", "dread"],
    line: "Twelve men, one outpost, and no way to know which of them is still a man.",
  },
  {
    id: "the-shining",
    title: "The Shining",
    year: 1980,
    runtimeMinutes: 146,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "nightmare",
    mechanisms: ["isolation", "uncanny", "dread"],
    line: "Corridors that are the wrong shape. Nothing chases anybody for an hour and it is unbearable.",
  },
  {
    id: "the-witch",
    title: "The Witch",
    year: 2015,
    runtimeMinutes: 92,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "nightmare",
    mechanisms: ["dread", "isolation", "the unseen"],
    line: "A family alone at the edge of a wood in 1630. Almost no jumps. Ninety minutes of something closing in.",
  },
  {
    id: "hereditary",
    title: "Hereditary",
    year: 2018,
    runtimeMinutes: 127,
    certification: { system: "MPA", code: "R" },
    audience: "adults",
    fear: "nightmare",
    mechanisms: ["dread", "reality-wrong", "helplessness"],
    line: "Grief as a horror film. It goes somewhere in the first half hour that you will not be ready for.",
  },
];

/** Broadest first: an adults evening may watch anything. */
const AUDIENCE_ALLOWS: Record<Audience, readonly Audience[]> = {
  kids: ["kids"],
  teens: ["kids", "teens"],
  adults: ["kids", "teens", "adults"],
};

export const FEAR_ORDER: readonly Fear[] = [
  "cozy",
  "spooky",
  "creepy",
  "nightmare",
];

/**
 * Films suitable for the room. Audience only — this never touches fear.
 */
export function suitableFor(
  audience: Audience,
  catalogue: readonly Film[] = CATALOGUE,
): Film[] {
  const allowed = new Set(AUDIENCE_ALLOWS[audience]);
  return catalogue.filter((f) => allowed.has(f.audience));
}

/**
 * Which fear levels this room can actually be offered.
 *
 * Derived from **what the catalogue holds**, not from the audience. With kids
 * in the room there is no Nightmare film here, so Nightmare is not offered —
 * which is "we have nothing", not "children cannot be frightened". The
 * difference matters: Coraline is in the kids set and is creepy.
 */
export function fearLevelsFor(
  audience: Audience,
  catalogue: readonly Film[] = CATALOGUE,
): Fear[] {
  const available = new Set(
    suitableFor(audience, catalogue).map((f) => f.fear),
  );
  return FEAR_ORDER.filter((level) => available.has(level));
}

/**
 * The shortlist. Three, not twenty — a wall of options is the thing Movie
 * Night exists to replace.
 *
 * Deterministic for a given `(audience, fear, seed)`, so a reload does not
 * reshuffle the evening. `exclude` drops films already reacted to, so "none of
 * these" and a second visit both move on rather than repeating.
 */
export function shortlist(
  audience: Audience,
  fear: Fear,
  options: {
    readonly exclude?: ReadonlySet<string>;
    readonly seed?: number;
    readonly size?: number;
    readonly catalogue?: readonly Film[];
  } = {},
): Film[] {
  const { exclude, seed = 0, size = 3, catalogue = CATALOGUE } = options;

  const pool = suitableFor(audience, catalogue)
    .filter((f) => f.fear === fear)
    .filter((f) => !exclude?.has(f.id));

  if (pool.length <= size) return pool;

  // A stable rotation rather than a shuffle: same evening, same three; a later
  // visit with a different seed moves along the list instead of re-rolling.
  const offset = ((seed % pool.length) + pool.length) % pool.length;
  return Array.from(
    { length: size },
    (_, i) => pool[(offset + i) % pool.length],
  );
}

export const filmById = (id: string): Film | undefined =>
  CATALOGUE.find((f) => f.id === id);
