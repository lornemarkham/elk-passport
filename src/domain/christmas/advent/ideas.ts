import { IDEAS, type Idea } from "../ideas";
import type { AdventBudget, Interest, Setting, Who } from "./model";

/**
 * **Adventures that aren't listings** — what a door holds when nothing real
 * near here is on that day, or when an idea fits this family better.
 *
 * Doctrine §10 (2026-11-17): Passport may suggest things to do at home or
 * anywhere, provided each says it is an idea and names no venue, time,
 * price or availability. Every one of these is said as an idea on its card;
 * the ones that go out of the house hand a sentence to the planner, which
 * finds a real place or says it can't (`plan`), or open the lights map.
 *
 * Christmas's own ideas (`ideas.ts`) are carried in whole, by id, with what
 * Advent needs to know about each; the rest are Advent's, most of them for
 * a particular day of the season.
 */
export interface AdventIdea {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly emoji: string;
  readonly setting: Exclude<Setting, "either">;
  /** What it costs a family, roughly: nothing, or a little. Never a price. */
  readonly cost: Exclude<AdventBudget, "any">;
  readonly who: readonly Who[];
  /** `kids`: only with children; `grown`: not with young children. */
  readonly ages?: "kids" | "grown";
  readonly interests: readonly Interest[];
  /** Only on these days of the season (`MM-DD`), when it is about one. */
  readonly on?: readonly string[];
  /** Only from / until these days (`MM-DD`, December before January). */
  readonly from?: string;
  readonly until?: string;
  readonly plan?: string;
  readonly lights?: true;
  readonly careful?: string;
}

const EVERYONE: readonly Who[] = ["family", "friends", "couple", "solo"];

/** What Advent adds to each of Christmas's own ideas. */
const CARRIED: Readonly<
  Record<
    string,
    Omit<AdventIdea, keyof Idea | "setting" | "who"> & {
      who?: readonly Who[];
    }
  >
> = {
  "movie-night": { cost: "free", interests: ["movies"] },
  "chinese-and-games": { cost: "inexpensive", interests: ["food"] },
  cookies: { cost: "inexpensive", interests: ["food"] },
  gingerbread: { cost: "inexpensive", interests: ["food", "crafts"] },
  "cocoa-and-carols": { cost: "inexpensive", interests: ["shows", "food"] },
  "dinner-for-two": {
    cost: "inexpensive",
    interests: ["food"],
    who: ["couple"],
    ages: "grown",
  },
  "games-night": { cost: "free", interests: [], who: ["friends", "family"] },
  "wrap-and-watch": { cost: "free", interests: ["movies", "crafts"] },
  "letters-to-santa": {
    cost: "free",
    interests: ["santa", "crafts"],
    ages: "kids",
    until: "12-20",
  },
  carols: { cost: "free", interests: ["shows"] },
  "lights-drive": { cost: "free", interests: ["lights"] },
  "winter-walk": { cost: "free", interests: ["lights", "outdoors"] },
  "dinner-and-a-movie": {
    cost: "inexpensive",
    interests: ["movies", "food"],
    who: ["couple", "friends"],
  },
  "market-and-cocoa": {
    cost: "inexpensive",
    interests: ["markets", "food"],
    until: "12-24",
  },
  "skating-and-dinner": { cost: "inexpensive", interests: ["outdoors"] },
  sledding: { cost: "free", interests: ["outdoors"] },
  "outdoor-fire": { cost: "free", interests: ["outdoors"] },
};

const FOR: Readonly<Record<string, Who>> = {
  family: "family",
  friends: "friends",
  date: "couple",
  cozy: "solo",
};

const carried: AdventIdea[] = IDEAS.flatMap((idea) => {
  const extra = CARRIED[idea.id];
  if (!extra) return [];
  const { who, ...rest } = extra;
  return [
    {
      id: idea.id,
      title: idea.title,
      line: idea.line,
      emoji: idea.emoji,
      setting: idea.stay === "in" ? "indoor" : "outdoor",
      who: who ?? [...new Set(idea.for.map((f) => FOR[f]!))],
      ...(idea.plan ? { plan: idea.plan } : {}),
      ...(idea.lights ? { lights: true as const } : {}),
      ...(idea.careful ? { careful: idea.careful } : {}),
      ...rest,
    },
  ];
});

const ADVENT_OWN: readonly AdventIdea[] = [
  {
    id: "paper-snowflakes",
    title: "Cut paper snowflakes for the windows",
    line: "Fold, snip, unfold, gasp. No two the same — tape the best ones where the street can see.",
    emoji: "❄️",
    setting: "indoor",
    cost: "free",
    who: ["family", "friends", "solo"],
    interests: ["crafts"],
  },
  {
    id: "build-a-snowman",
    title: "Build a snowman (or a snow-family)",
    line: "Find a carrot, two buttons and a scarf nobody's using. Name it. Photograph it before it leans.",
    emoji: "⛄",
    setting: "outdoor",
    cost: "free",
    who: ["family", "friends", "couple"],
    interests: ["outdoors"],
    careful: "Only if there's snow on the ground — swap it if there isn't.",
  },
  {
    id: "kindness-cookies",
    title: "Bake for a neighbour",
    line: "A plate of cookies, a card, a knock on the door. The best present this week might be yours.",
    emoji: "💝",
    setting: "indoor",
    cost: "inexpensive",
    who: EVERYONE,
    interests: ["giving", "food"],
  },
  {
    id: "food-bank",
    title: "Fill a bag for the food bank",
    line: "Let everyone choose one thing to give. Drop it at a grocery store bin or your local food bank.",
    emoji: "🥫",
    setting: "indoor",
    cost: "inexpensive",
    who: EVERYONE,
    interests: ["giving"],
    until: "12-23",
  },
  {
    id: "thank-you-notes",
    title: "Write thank-you notes to people who help",
    line: "The bus driver, the teacher, the mail carrier. A few kind words go a very long way in December.",
    emoji: "✉️",
    setting: "indoor",
    cost: "free",
    who: ["family", "solo", "couple"],
    interests: ["giving", "crafts"],
  },
  {
    id: "homemade-ornament",
    title: "Make an ornament for the tree",
    line: "Salt dough, pine cones, a photo in a jar lid — date it so it comes out again next year.",
    emoji: "🎄",
    setting: "indoor",
    cost: "free",
    who: ["family", "friends", "couple"],
    interests: ["crafts"],
  },
  {
    id: "pyjama-lights",
    title: "Pyjamas-on lights drive",
    line: "Kids in pyjamas, cocoa in travel mugs, Christmas songs loud. Back home for bed.",
    emoji: "🚙",
    setting: "outdoor",
    cost: "free",
    who: ["family"],
    ages: "kids",
    interests: ["lights"],
    lights: true,
  },
  {
    id: "story-by-the-tree",
    title: "A Christmas story by the tree",
    line: "Lights off except the tree. One book, read aloud, with voices.",
    emoji: "📖",
    setting: "indoor",
    cost: "free",
    who: ["family", "couple"],
    interests: ["crafts", "movies"],
  },
  {
    id: "hot-chocolate-bar",
    title: "Make a hot chocolate bar",
    line: "Marshmallows, peppermint, whipped cream, a sprinkle of everything. Everyone builds their own.",
    emoji: "☕",
    setting: "indoor",
    cost: "inexpensive",
    who: EVERYONE,
    interests: ["food"],
  },
  {
    id: "snow-angels-and-stars",
    title: "Snow angels, then the stars",
    line: "Lie down in the snow, make an angel, stay lying there a minute and look up.",
    emoji: "🌟",
    setting: "outdoor",
    cost: "free",
    who: EVERYONE,
    interests: ["outdoors"],
    careful: "Only if there's snow — swap it if there isn't.",
  },
  {
    id: "christmas-eve-box",
    title: "Open a Christmas Eve box",
    line: "New pyjamas, a film, a hot drink and one small treat. Pack it in the afternoon; open it after dinner.",
    emoji: "📦",
    setting: "indoor",
    cost: "inexpensive",
    who: ["family", "couple"],
    interests: ["movies", "crafts"],
    on: ["12-24"],
  },
  {
    id: "track-santa",
    title: "Track Santa's sleigh",
    line: "Check where he's got to before bed. Cookies and a carrot by the door — then straight to sleep.",
    emoji: "🦌",
    setting: "indoor",
    cost: "free",
    who: ["family"],
    ages: "kids",
    interests: ["santa"],
    on: ["12-24"],
  },
  {
    id: "christmas-morning-walk",
    title: "A Christmas Day walk",
    line: "Between the presents and the dinner, everyone out the door for twenty minutes of fresh air.",
    emoji: "🎁",
    setting: "outdoor",
    cost: "free",
    who: EVERYONE,
    interests: ["outdoors"],
    on: ["12-25"],
  },
  {
    id: "christmas-day-games",
    title: "Christmas Day family games",
    line: "Charades, a new board game from under the tree, and a leftovers sandwich at half-time.",
    emoji: "🎲",
    setting: "indoor",
    cost: "free",
    who: ["family", "friends"],
    interests: [],
    on: ["12-25"],
  },
  {
    id: "boxing-day-leftovers",
    title: "A Boxing Day leftovers picnic",
    line: "The best sandwiches of the year, a flask of something hot, eaten somewhere with a view.",
    emoji: "🥪",
    setting: "outdoor",
    cost: "free",
    who: EVERYONE,
    interests: ["food", "outdoors"],
    on: ["12-26"],
  },
  {
    id: "boxing-day-pyjamas",
    title: "A pyjama day with the new things",
    line: "Nowhere to be. Play the new game, read the new book, build the new Lego.",
    emoji: "🧦",
    setting: "indoor",
    cost: "free",
    who: ["family", "couple", "solo"],
    interests: ["movies", "crafts"],
    on: ["12-26", "12-27"],
  },
  {
    id: "thank-you-drawings",
    title: "Thank-you cards for the presents",
    line: "Draw the present, write one line about it, post it to whoever sent it.",
    emoji: "🖍️",
    setting: "indoor",
    cost: "free",
    who: ["family"],
    ages: "kids",
    interests: ["giving", "crafts"],
    from: "12-26",
  },
  {
    id: "year-in-photos",
    title: "Look back at the year in photos",
    line: "Scroll back to January together. Everyone picks their favourite moment and says why.",
    emoji: "📸",
    setting: "indoor",
    cost: "free",
    who: EVERYONE,
    interests: ["movies"],
    from: "12-27",
  },
  {
    id: "time-capsule",
    title: "Make a 2026 time capsule",
    line: "A drawing, a ticket stub, a note to your future self. Seal it; open it next New Year's Eve.",
    emoji: "⏳",
    setting: "indoor",
    cost: "free",
    who: EVERYONE,
    interests: ["crafts"],
    from: "12-28",
    until: "12-31",
  },
  {
    id: "noon-countdown",
    title: "A family countdown at noon",
    line: "Party hats, a countdown from ten and noisemakers at twelve o'clock — midnight for people who go to bed at eight.",
    emoji: "🎉",
    setting: "indoor",
    cost: "free",
    who: ["family"],
    ages: "kids",
    interests: [],
    on: ["12-31"],
  },
  {
    id: "nye-at-home",
    title: "Ring in 2027 at home",
    line: "Something nice to eat, a playlist of the year's songs, and the countdown on whatever screen you like.",
    emoji: "🥂",
    setting: "indoor",
    cost: "inexpensive",
    who: EVERYONE,
    interests: ["food", "shows"],
    on: ["12-31"],
  },
  {
    id: "wishes-jar",
    title: "Fill a jar of wishes for the new year",
    line: "Everyone writes three hopes for 2027 on slips of paper. Read them out next New Year's Eve.",
    emoji: "🫙",
    setting: "indoor",
    cost: "free",
    who: EVERYONE,
    interests: ["crafts"],
    from: "12-30",
    until: "01-01",
  },
  {
    id: "first-walk",
    title: "The first walk of 2027",
    line: "Out the door before lunch, a new path or an old favourite. Say one thing you want this year to hold.",
    emoji: "🌄",
    setting: "outdoor",
    cost: "free",
    who: EVERYONE,
    interests: ["outdoors"],
    on: ["01-01"],
  },
  {
    id: "new-year-pancakes",
    title: "New Year's Day pancakes",
    line: "A slow breakfast, pancakes in the shape of the new year's numbers, nobody in a hurry.",
    emoji: "🥞",
    setting: "indoor",
    cost: "inexpensive",
    who: EVERYONE,
    interests: ["food"],
    on: ["01-01"],
  },
  {
    id: "puzzle-day",
    title: "Start a big jigsaw",
    line: "A thousand pieces on the table. Anyone passing does five. Done by the time school starts?",
    emoji: "🧩",
    setting: "indoor",
    cost: "free",
    who: EVERYONE,
    interests: ["crafts"],
    from: "12-26",
  },
  {
    id: "winter-picnic",
    title: "A winter picnic",
    line: "Soup in a flask, sandwiches, a blanket on a bench. Twenty minutes outside, a big glow after.",
    emoji: "🧺",
    setting: "outdoor",
    cost: "free",
    who: EVERYONE,
    interests: ["outdoors", "food"],
  },
];

export const ADVENT_IDEAS: readonly AdventIdea[] = [...carried, ...ADVENT_OWN];

/** December first: `12-26` comes before `01-01`. */
const order = (mmdd: string) =>
  mmdd.startsWith("01") ? `13-${mmdd.slice(3)}` : mmdd;

/** Whether an idea belongs to a day of the season (`YYYY-MM-DD`). */
export function ideaOnDay(idea: AdventIdea, date: string): boolean {
  const mmdd = date.slice(5);
  if (idea.on) return idea.on.includes(mmdd);
  if (idea.from && order(mmdd) < order(idea.from)) return false;
  if (idea.until && order(mmdd) > order(idea.until)) return false;
  return true;
}
