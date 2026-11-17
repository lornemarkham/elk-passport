/**
 * **Christmas ideas that aren't listings** — the owner brief's "an
 * experience does not need to be a commercial event" (P0, the
 * experience-first rebuild, 2026-11-17): cookies, a movie on the couch,
 * Chinese food and a board game.
 *
 * Every one of these is **Passport's suggestion, said as one** — the card
 * reads "An idea, not a listing" — and none of them names a venue, a time, a
 * price, a hill or a streaming service. Where an idea goes out of the house,
 * `plan` is a sentence handed to the Christmas planner, which finds a real
 * Atlas place for each part or says it can't (`itinerary.ts`); `lights` sends
 * it to the community lights map. Nothing here is stored or fetched.
 *
 * The future capabilities the brief names (Canadian streaming, showtimes,
 * playlists, recipes, combined adventures) arrive as new sources beside this
 * list, not inside it: this file stays a short, hand-written set.
 */

export type IdeaTag =
  "movies" | "baking" | "food" | "games" | "music" | "outdoors" | "traditions";

/** The ways an idea can belong to (`ways.ts`), minus the two that are listings. */
export type IdeaFor = "date" | "family" | "friends" | "cozy";

export interface Idea {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly emoji: string;
  readonly for: readonly IdeaFor[];
  /** At home, or out of the house. */
  readonly stay: "in" | "out";
  readonly tags: readonly IdeaTag[];
  /** A sentence for the planner, when the idea is an outing it can place. */
  readonly plan?: string;
  /** The idea is the lights map. */
  readonly lights?: true;
  /** Said on the card, plainly, before anyone goes. */
  readonly careful?: string;
}

export const IDEA_TAG_LABEL: Readonly<Record<IdeaTag, string>> = {
  movies: "Movies",
  baking: "Baking",
  food: "Food",
  games: "Games",
  music: "Music",
  outdoors: "Outside",
  traditions: "Traditions",
};

export const IDEAS: readonly Idea[] = [
  {
    id: "movie-night",
    title: "Christmas movie night",
    line: "Blankets, popcorn and a classic everyone can quote. Pick it from the apps you already have.",
    emoji: "🎬",
    for: ["cozy", "date", "family"],
    stay: "in",
    tags: ["movies"],
    careful:
      "We don't list what's streaming where yet — check your own services.",
  },
  {
    id: "chinese-and-games",
    title: "Chinese food, a board game and family time",
    line: "Order in from your favourite spot, clear the table, and let the youngest pick the first game.",
    emoji: "🥡",
    for: ["cozy", "family", "friends"],
    stay: "in",
    tags: ["food", "games"],
  },
  {
    id: "cookies",
    title: "Bake Christmas cookies",
    line: "Sugar cookies to decorate, or the family recipe. The wonky ones are for Santa.",
    emoji: "🍪",
    for: ["cozy", "family", "date"],
    stay: "in",
    tags: ["baking", "traditions"],
  },
  {
    id: "gingerbread",
    title: "Build a gingerbread house",
    line: "One house, too much icing, and a vote on whose roof is still standing.",
    emoji: "🏠",
    for: ["cozy", "family", "friends"],
    stay: "in",
    tags: ["baking", "traditions"],
  },
  {
    id: "cocoa-and-carols",
    title: "Hot chocolate and Christmas music",
    line: "Real chocolate, the carols on, and nothing else to do for an hour.",
    emoji: "☕",
    for: ["cozy", "date"],
    stay: "in",
    tags: ["music", "food"],
  },
  {
    id: "dinner-for-two",
    title: "Cook a Christmas dinner for two",
    line: "Choose the menu together, cook it together, light a candle. Dessert first is allowed.",
    emoji: "🕯️",
    for: ["date", "cozy"],
    stay: "in",
    tags: ["food"],
  },
  {
    id: "games-night",
    title: "A games night with friends",
    line: "Everyone brings a snack and a game. Whoever loses hosts next year.",
    emoji: "🎲",
    for: ["friends", "cozy"],
    stay: "in",
    tags: ["games"],
  },
  {
    id: "wrap-and-watch",
    title: "Wrap presents with a film on",
    line: "Tape, paper, a Christmas film you've seen ten times, and no peeking.",
    emoji: "🎁",
    for: ["cozy", "date"],
    stay: "in",
    tags: ["traditions", "movies"],
  },
  {
    id: "letters-to-santa",
    title: "Write letters to Santa",
    line: "Crayons, a wish list and a stamp. Then watch the mailbox.",
    emoji: "✉️",
    for: ["family", "cozy"],
    stay: "in",
    tags: ["traditions"],
  },
  {
    id: "carols",
    title: "Sing carols together",
    line: "Print the words, pick the songs everyone half-knows, and sing them badly on purpose.",
    emoji: "🎶",
    for: ["cozy", "family", "friends"],
    stay: "in",
    tags: ["music", "traditions"],
  },
  {
    id: "lights-drive",
    title: "Drive around looking at the lights",
    line: "Christmas music on, cocoa in a thermos, and the map choosing the streets.",
    emoji: "🚗",
    for: ["date", "family", "friends", "cozy"],
    stay: "out",
    tags: ["outdoors", "traditions"],
    lights: true,
  },
  {
    id: "winter-walk",
    title: "A winter walk under the lights",
    line: "Bundle up, walk downtown after dark, and finish somewhere warm.",
    emoji: "🧣",
    for: ["date", "family", "friends"],
    stay: "out",
    tags: ["outdoors"],
    plan: "An evening walk to see the Christmas lights, then hot chocolate",
  },
  {
    id: "dinner-and-a-movie",
    title: "Dinner, then a movie",
    line: "The oldest date there is, with a Christmas film if one is showing.",
    emoji: "🍿",
    for: ["date", "friends"],
    stay: "out",
    tags: ["movies", "food"],
    plan: "Dinner and a movie",
  },
  {
    id: "market-and-cocoa",
    title: "A Christmas market and a hot chocolate",
    line: "Wander the stalls, buy one thing you don't need, and hold something warm.",
    emoji: "🎪",
    for: ["date", "family", "friends"],
    stay: "out",
    tags: ["food", "traditions"],
    plan: "Christmas markets and a hot chocolate",
  },
  {
    id: "skating-and-dinner",
    title: "Skating, then dinner",
    line: "A few laps, a few falls, and a big warm meal after.",
    emoji: "⛸️",
    for: ["date", "family", "friends"],
    stay: "out",
    tags: ["outdoors", "food"],
    plan: "Skating, then dinner",
  },
  {
    id: "sledding",
    title: "Go sledding",
    line: "A hill you know is open for it, a spare pair of mittens, and hot chocolate after.",
    emoji: "🛷",
    for: ["family", "friends"],
    stay: "out",
    tags: ["outdoors"],
    careful:
      "We don't list sledding hills yet — choose one you know is safe and open.",
  },
  {
    id: "outdoor-fire",
    title: "Marshmallows round a fire",
    line: "Stories, s'mores and the stars — outside, wrapped up warm.",
    emoji: "🔥",
    for: ["friends", "family", "cozy"],
    stay: "out",
    tags: ["outdoors"],
    careful:
      "Only where fires are allowed: check your local fire rules before you light one.",
  },
];

export const ideaById = (id: string): Idea | undefined =>
  IDEAS.find((i) => i.id === id);
