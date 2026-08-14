/**
 * Experiment 05 — Christmas Passport. Ported from the original standalone
 * prototype (`app/public/labs/discovery-space/christmas-passport.html`,
 * Phase 7.15) into a real Next.js route, matching every other ELK Labs
 * sandbox's structure: this `content.ts`, a client component built from
 * `../components` (`ActShell`/`BigLine`/`Reveal`), and a thin `page.tsx`.
 * The original file is left in place, unlinked, rather than deleted — see
 * `docs/content-model/future.md` for the reasoning on both delivery
 * patterns and why this one is now the canonical, linked version.
 *
 * Everything below is invented, disclosed content, same discipline as
 * every ELK Labs sandbox — nothing here is a real Atlas listing.
 */

export const DAY_LABELS: readonly string[] = [
  "Morning",
  "Mid Morning",
  "Afternoon",
  "Evening",
];

export interface ChristmasMood {
  readonly id: string;
  readonly emoji: string;
  readonly name: string;
  readonly day: readonly string[];
}

export const CHRISTMAS_MOODS: readonly ChristmasMood[] = [
  {
    id: "cozy",
    emoji: "🎄",
    name: "Cozy Christmas",
    day: [
      "Slow morning, fresh coffee, snow outside",
      "A short walk, just to feel the cold",
      "Fireplace, a book, cinnamon rolls in the oven",
      "Early to bed, candles still lit",
    ],
  },
  {
    id: "romantic",
    emoji: "❤️",
    name: "Romantic Christmas",
    day: [
      "Coffee for two, no rush",
      "A walk under the lights, hand in hand",
      "Dinner somewhere small and warm",
      "Fondue, fireplace, a movie neither of you has seen",
    ],
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    name: "Family Christmas",
    day: [
      "Family breakfast, everyone still in pajamas",
      "The Christmas market, hot chocolate all around",
      "Cookie decorating, more frosting on the counter than the cookies",
      "Board games until someone falls asleep",
    ],
  },
  {
    id: "magic",
    emoji: "🎅",
    name: "Christmas Magic",
    day: [
      "Wake up to fresh snow",
      "Visit Santa, just to see the kids' faces",
      "A horse carriage ride through the lights",
      "Hot chocolate, snow still falling",
    ],
  },
  {
    id: "adventure",
    emoji: "⛷️",
    name: "Adventure Christmas",
    day: [
      "Early start, gear packed the night before",
      "A morning on the ski hill or snowshoe trail",
      "Lunch at the lodge, boots still on",
      "Hot springs, aching legs, completely worth it",
    ],
  },
  {
    id: "giving",
    emoji: "🎁",
    name: "Giving Christmas",
    day: [
      "Morning at the food bank",
      "An afternoon buying gifts from local artisans",
      "Wrapping presents for someone who won't expect them",
      "Delivering cookies, door to door",
    ],
  },
  {
    id: "coffeebook",
    emoji: "☕",
    name: "Coffee & Book Christmas",
    day: [
      "Slow start, the good mug",
      "A bookstore, no plan to buy anything (you will)",
      "A window seat, snow outside, a new chapter",
      "Tea, a blanket, the day just ending itself",
    ],
  },
  {
    id: "music",
    emoji: "🎶",
    name: "Music Christmas",
    day: [
      "Carols on, coffee brewing",
      "A church choir concert, just to sit and listen",
      "Live music at a local pub",
      "Driving home with the windows barely cracked, music low",
    ],
  },
  {
    id: "dog",
    emoji: "🐶",
    name: "Dog Christmas",
    day: [
      "A walk before anyone else is awake",
      "The dog in the snow, completely losing it",
      "A photo nobody will ever delete",
      "Curled up by the fire, dog included",
    ],
  },
  {
    id: "movies",
    emoji: "🎥",
    name: "Christmas Movie Marathon",
    day: [
      "Pajamas stay on all day, no apologies",
      "Popcorn, blankets, the good couch spots claimed early",
      "One movie becomes four",
      "Falling asleep before the credits, every time",
    ],
  },
];

export const CHRISTMAS_CHALLENGE_LIST: readonly string[] = [
  "🎄 Find the biggest Christmas tree.",
  "🍪 Eat the best gingerbread cookie.",
  "☕ Try three local hot chocolates.",
  "🎁 Buy one gift from a local artisan.",
  "⭐ Find the oldest Christmas decoration in town.",
  "🎅 Spot Santa.",
  "🦌 Find a reindeer decoration.",
  "📷 Take a family Christmas photo.",
  "❄️ Catch a snowflake.",
  "🎶 Listen to live Christmas music.",
  "🎄 Decorate a tiny tree.",
  "🧣 Wear the ugliest Christmas sweater.",
  "🍿 Watch a Christmas movie.",
  "🍷 Drink mulled wine.",
  "🥣 Donate food.",
  "🧸 Donate toys.",
  "❤️ Perform one anonymous act of kindness.",
];

export const WONDER_METER_EXTRA_IDEAS: readonly string[] = [
  "Drive through Christmas lights",
  "Call someone you miss",
  "Watch the snow fall",
  "Make hot chocolate",
  "Bake cookies",
];

export const ATLAS_DISCOVERY_CHIPS: readonly string[] = [
  "Christmas markets",
  "Tree lightings",
  "Outdoor skating",
  "Christmas concerts",
  "Church choirs",
  "Craft fairs",
  "Holiday theatre",
  "Outdoor movies",
  "Santa events",
  "Local bakeries",
  "Christmas trains",
  "Winter hikes",
  "Snowshoe trails",
  "Cross-country skiing",
  "Ski hills",
  "Fireplaces",
  "Lookouts",
  "Hot springs",
  "Winter cabins",
];

export interface ChristmasMovie {
  readonly name: string;
  readonly tags: string;
}

export const CHRISTMAS_MOVIES: readonly ChristmasMovie[] = [
  {
    name: "HOME ALONE",
    tags: "Neighborhood. Pizza. Lights. Ice cream. Chaos.",
  },
  {
    name: "CHRISTMAS VACATION",
    tags: "Family. Ridiculous decorations. Eggnog. Laughter.",
  },
  { name: "THE HOLIDAY", tags: "Bookstores. Coffee. Snow. Slow romance." },
  { name: "ELF", tags: "Childlike wonder. Candy. Joy." },
  { name: "POLAR EXPRESS", tags: "Magic. Kids. Hot chocolate. Snow." },
  { name: "KLAUS", tags: "Kindness. Giving. Tradition." },
];

export const FAMILY_MEMORY_LINES: readonly string[] = [
  "Three years ago you built a snowman.",
  "You always make Nana's cookies.",
  "You watched Home Alone every Christmas Eve.",
  "You always visit the Christmas lights.",
];

export const FAMILY_MEMORY_DISCLOSURE =
  "Illustrative only — Passport has no real memory of you yet. This is what it could feel like once it does, not a claim about what it knows today.";

export interface ChristmasWeather {
  readonly id: string;
  readonly label: string;
  readonly line: string;
}

export const CHRISTMAS_WEATHER: readonly ChristmasWeather[] = [
  {
    id: "snowsoon",
    label: "Snow in 45 min",
    line: "Perfect excuse. Go outside before it starts.",
  },
  {
    id: "clear",
    label: "Clear tonight",
    line: "Perfect for Christmas lights.",
  },
  {
    id: "freshsnow",
    label: "Fresh snow tomorrow",
    line: "Build a snowman before anyone else touches it.",
  },
  {
    id: "fog",
    label: "Fog tonight",
    line: "Christmas feels a little more magical when you can't see everything.",
  },
];

export const COUNTDOWN_EXAMPLE_EVENTS: readonly string[] = [
  "🎄 Christmas market opens Friday",
  "🌟 Tree lighting tonight",
  "🎅 Santa arrives Saturday",
  "🎶 Choir concert tomorrow",
  "🎭 Outdoor theatre starts next week",
  "❄️ Fresh snow expected",
];

export const PHOTO_MOMENT_CHIPS: readonly string[] = [
  "Family portrait",
  "Dog in the snow",
  "Coffee by the fire",
  "The tree",
  "The lights",
  "Skating",
  "Cookies, mid-mess",
  "Grandparents",
  "Friends",
];

export const LITTLE_MOMENT_CHIPS: readonly string[] = [
  "Candy canes",
  "Warm socks",
  "Fresh evergreen",
  "Peppermint mocha",
  "Wrapping presents",
  "Reading by the fire",
  "Watching the snow",
  "Lighting candles",
  "Christmas music while driving",
];

export const CRAFT_CHIPS: readonly string[] = [
  "Cookie decorating",
  "Ornaments",
  "Paper snowflakes",
  "DIY wreaths",
  "Christmas cards",
  "Wrapping presents",
  "Kids' crafts",
  "Nature crafts",
  "Pinecone decorations",
  "Orange slices",
  "Cinnamon sticks",
];

export const GIVING_CHIPS: readonly string[] = [
  "Volunteer",
  "Toy drive",
  "Food bank",
  "Buy local",
  "Support artisans",
  "Write a thank-you card",
  "Visit grandparents",
  "Phone someone lonely",
  "Deliver cookies",
];

export const GIVING_LINE =
  "Small acts matter. Passport should celebrate kindness as much as it celebrates a good day out.";

export const SOUND_CHIPS: readonly string[] = [
  "Fireplace",
  "Gentle piano",
  "Snow",
  "Wind",
  "Church bells",
  "Children laughing, far away",
  "Pages turning",
  "Coffee shop ambience",
  "Soft jazz",
  "Choir",
];

export const SOUND_DESIGN_NOTE =
  "Optional. Soft. Warm. Nothing harsh — this should feel like home. The toggle plays a real, synthesized fireplace-and-wind ambience, honestly built with the Web Audio API — no recorded piano, choir, or church bells exist in this prototype yet.";

export const ATLAS_PROVIDES = "Places, weather, events, hours, knowledge.";
export const PASSPORT_CREATES =
  "Wonder, traditions, connection, anticipation, joy, meaning, memory.";
export const PRINCIPLES_CLOSING_LINE =
  "Passport is not about travel. Passport is about helping people create meaningful days.";

export const ENDING_LINE =
  "Whatever today looks like — I hope it becomes one you'll remember.";
export const ENDING_FINAL_LINE = "Merry Christmas.";
export const ENDING_DISCLOSURE = "Because Christmas is never just one day.";

export const LAB_NOTES_LINE =
  "KEEP, CHANGE, COMBINE, or TRASH — same rule as every ELK Labs experiment. This one tests whether Passport can hold Christmas's actual feeling, not just its calendar.";
