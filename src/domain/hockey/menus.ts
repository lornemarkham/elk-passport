import type { ConcessionCode } from "./concourse";

/**
 * **What the arena and the press say about food, drink and prices — each
 * with who said it and when.**
 *
 * Nobody publishes Rogers Arena's menus or prices in full. What exists, read
 * on 2026-10-22 (copies in `~/passport/scratch/arena-mode-research/`):
 *
 * - **The arena's food page** (`rogersarena.com/food-and-beverage-options`,
 *   last changed 2026-02-25) lists items *by diet* — vegan, vegetarian, dairy
 *   free, gluten friendly — and which stands sell them, by section. It is
 *   older than the 2026-09-29 map: it still names stands the map doesn't
 *   (Inniskillin Wine Bar, Uno Gelato carts) and its section numbers are
 *   often one off the map's. It is a dietary guide, **not a full menu**, and
 *   the screen says so.
 * - **Prices: no official list.** One dated press report: Daily Hive,
 *   2026-09-25, from the Canucks–Oilers preseason game on Thursday
 *   2026-09-24 — drinks only, no food. Shown as exactly that.
 *
 * Nothing here is inferred. An item appears at a stand only where the arena's
 * page lists it there; a price appears only with its reporter and date.
 */

export const FOOD_PAGE = {
  label: "Rogers Arena — Food & Beverage Options (dietary guide)",
  url: "https://rogersarena.com/food-and-beverage-options/",
  updated: "2026-02-25",
} as const;

export type Diet = "vegan" | "vegetarian" | "dairyFree" | "glutenFriendly";

export const DIET_LABEL: Readonly<Record<Diet, string>> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  dairyFree: "Dairy free",
  glutenFriendly: "Gluten friendly",
};

export interface MenuItem {
  readonly name: string;
  readonly diets: readonly Diet[];
}

export interface StandMenu {
  /** Where the food page says this stand is, in its own words. */
  readonly listedAt: string;
  readonly items: readonly MenuItem[];
}

const i = (name: string, ...diets: Diet[]): MenuItem => ({ name, diets });
const VG: Diet = "vegan";
const V: Diet = "vegetarian";
const DF: Diet = "dairyFree";
const GF: Diet = "glutenFriendly";

/**
 * Item by item, as the food page lists them under each diet heading, gathered
 * by stand. Items it lists only for the club level are left out (the map's
 * public levels are what Arena Mode shows).
 */
export const STAND_MENUS: Partial<Record<ConcessionCode, StandMenu>> = {
  A: {
    listedAt: "Bar: sections 119, 309, 323 (for pretzels)",
    items: [i("Pretzel", V)],
  },
  B: {
    listedAt: "Beer Express: sections 102, 109 (for pretzels)",
    items: [i("Pretzel", V)],
  },
  D: {
    listedAt: "Carve: sections 117, 310; Catch & Carve: section 101",
    items: [
      i("Tofu poke (vegan sauce)", VG),
      i("Tofu poke", V),
      i("Poke", DF),
      i("Carve sandwich, sub gluten-free bun", GF),
      i("Montreal smoked meat with gluten-free bun", GF),
      i("Pulled pork sandwich with gluten-free bun (117, 310)", GF),
      i("Lumberjack sandwich with gluten-free bun", GF),
      i("Philly cheese steak, sub gluten-free bun (310 only)", GF),
    ],
  },
  E: {
    listedAt: "Carve Express: sections 110, 321",
    items: [
      i("Popcorn (no added butter)", VG, DF, GF),
      i("Veggie dog with gluten-free bun (110)", VG),
      i("Veggie dog (110)", V, DF),
      i("Classic hot dog (110)", DF),
      i("Carve sandwich, sub gluten-free bun", GF),
      i("Montreal smoked meat with gluten-free bun", GF),
    ],
  },
  F: {
    listedAt: "Catch & Carve: section 101",
    items: [i("Tofu poke (vegan sauce)", VG), i("Tofu poke", V), i("Poke", DF)],
  },
  G: {
    listedAt: "Cin City: sections 102, 112, 122, 313, 326",
    items: [i("Cotton candy", VG, V, DF, GF), i("Mini donuts", V)],
  },
  H: {
    listedAt: "Crisp: section 111",
    items: [
      i("French fries", VG, V, DF, GF),
      i("Onion rings", VG),
      i("Veggie poutine", V),
      i("Veggie dog with gluten-free bun", VG),
      i("Veggie dog", V, DF),
      i("Classic hot dog", DF),
    ],
  },
  J: {
    listedAt: "Dogs: sections 113, 122, 301, 303, 314, 324",
    items: [
      i("Popcorn (no added butter)", VG, DF, GF),
      i("Veggie dog with gluten-free bun", VG),
      i("Veggie dog", V, DF),
      i("Classic hot dog", DF),
      i("Pretzel", V),
      i("Churro", V),
      i("Nachos", GF),
      i("Deluxe nachos", GF),
    ],
  },
  M: {
    listedAt: "Melt: section 121",
    items: [
      i("Popcorn (no added butter)", VG, DF, GF),
      i("Grilled cheese sandwich", V),
      i("Pretzel", V),
      i("Churro", V),
      i("Nachos", GF),
      i("Deluxe nachos", GF),
    ],
  },
  N: {
    listedAt: "Panago: sections 118, 318",
    items: [
      i("Cheese pizza", V),
      i("Veggie Mediterranean pizza", V),
      i("Panago pizza, sub gluten-free crust", GF),
      i("Popcorn (no added butter)", VG, DF, GF),
      i("Pretzel", V),
      i("Nestlé ice cream", V),
    ],
  },
  O: {
    listedAt: "Popcorn: sections 102, 305",
    items: [
      i("Popcorn (no added butter)", VG, DF, GF),
      i("Pretzel", V),
      i("Churro", V),
      i("Nestlé ice cream (305)", V),
    ],
  },
  P: {
    listedAt: "Santé: sections 109, 122, 326",
    items: [
      i("Fruit plate", VG, V, DF, GF),
      i("Crudité (no dips)", VG, DF, GF),
      i("Crudité", V),
      i("Tofu poke (vegan sauce)", VG),
      i("Tofu poke", V),
      i("Poke", DF),
      i("Greek salad", V, GF),
      i("Cheese & fruit plate", V),
      i("Athlete's salad", DF, GF),
    ],
  },
  S: {
    listedAt: "Steamer's: sections 120, 330",
    items: [
      i("Veggie dog with gluten-free bun", VG),
      i("Veggie dog", V, DF),
      i("Classic hot dog", DF),
      i("Bartley dog with gluten-free bun", GF),
      i("Canucks dog with gluten-free bun", GF),
      i("Chicago dog with gluten-free bun", GF),
      i("Buffalo dog, sub gluten-free bun", GF),
    ],
  },
  T: {
    listedAt: "Swirl: sections 102, 303, 312 (313 elsewhere on the page)",
    items: [i("Soft serve ice cream", V, GF)],
  },
  V: {
    listedAt: "Triple O's: sections 115, 307",
    items: [
      i("French fries", VG, V, DF, GF),
      i("Impossible Burger with gluten-free bun (no sauce)", VG),
      i("Impossible Burger", V, GF),
      i("Veggie burger", V),
      i("Triple O's Original Burger", DF),
      i("Triple O's burger with gluten-free bun", GF),
    ],
  },
};

/** The food page's "Snack 2 Go Carts", which the map draws as snack carts. */
export const CART_MENU: StandMenu = {
  listedAt:
    "Snack 2 Go carts: sections 102, 113, 117, 302, 309, 312, 317, 321, 326",
  items: [
    i("Popcorn (no added butter)", VG, DF, GF),
    i("Maynards / Haribo candy, Twizzlers", VG, V, DF, GF),
    i("Potato chips", V, DF, GF),
    i("Cracker Jacks", VG),
    i("Lifesaver popsicle", VG),
    i("Nestlé ice cream", V),
  ],
};

// ------------------------------------------------------------------ prices

export interface ReportedPrice {
  readonly item: string;
  /** Canadian dollars, as printed. */
  readonly price: string;
  readonly cents: number;
}

export interface PriceReport {
  readonly by: string;
  readonly author: string;
  readonly url: string;
  readonly published: string;
  readonly seen: string;
  readonly official: false;
  readonly prices: readonly ReportedPrice[];
}

/**
 * The only dated 2026–27 prices found: drinks seen at one preseason game. No
 * stand is named, so none is attached to a stand.
 */
export const PRICE_REPORTS: readonly PriceReport[] = [
  {
    by: "Daily Hive",
    author: "Daniel Wagner",
    url: "https://dailyhive.com/vancouver/beer-costs-canucks-games-rogers-arena",
    published: "2026-09-25",
    seen: "Canucks–Oilers preseason game, Thursday 2026-09-24",
    official: false,
    prices: [
      { item: "Molson Canadian, 12 oz", price: "$10.00", cents: 1000 },
      { item: "Coors Original, 12 oz", price: "$11.00", cents: 1100 },
      { item: "Granville Island, 12 oz", price: "$12.00", cents: 1200 },
      { item: "Molson Canadian, 24 oz", price: "$19.50", cents: 1950 },
      { item: "Water, bottle", price: "$6.25", cents: 625 },
      { item: "Minute Maid juice", price: "$7.50", cents: 750 },
      { item: "Medium soft drink", price: "$8.00", cents: 800 },
      { item: "Powerade", price: "$8.50", cents: 850 },
    ],
  },
];

/** The cheapest beer anybody published a price for, with who and when. */
export function cheapestReportedBeer():
  { report: PriceReport; price: ReportedPrice } | undefined {
  let best: { report: PriceReport; price: ReportedPrice } | undefined;
  for (const report of PRICE_REPORTS) {
    for (const price of report.prices) {
      if (!/molson|coors|granville|beer/i.test(price.item)) continue;
      if (!best || price.cents < best.price.cents) best = { report, price };
    }
  }
  return best;
}

// ------------------------------------------------------------------ drinking

/**
 * What the arena says about drinking, buying and paying — shown wherever
 * Arena Mode talks about beer, so a quest about beer comes with the rules.
 */
export const DRINK_RULES: readonly {
  readonly text: string;
  readonly source: string;
  readonly url: string;
}[] = [
  {
    text: "Cashless: debit, Visa, Mastercard, Amex, Google Pay and Apple Pay.",
    source: "Rogers Arena event page, 2026-10-13",
    url: "https://rogersarena.com/event/detroit-red-wings-at-vancouver-canucks-thu-oct-22/",
  },
  {
    text: "Look 30 or younger? Bring two pieces of ID to buy alcohol.",
    source: "Rogers Arena FAQ",
    url: "https://rogersarena.com/frequently-asked-questions/",
  },
  {
    text: "Being intoxicated is against the arena's code of conduct. It asks guests to drink responsibly.",
    source: "Rogers Arena Code of Conduct, 2025-01-03",
    url: "https://rogersarena.com/code-of-conduct/",
  },
  {
    text: "Problem nearby? Text Fan Services at 604-765-3267 with your section, row and seat.",
    source: "Rogers Arena Fan Text Service",
    url: "https://rogersarena.com/fan-texting-service/",
  },
];

/** Soft drinks the Canucks' new beverage partner pours (2026-10-09). */
export const SOFT_DRINKS = {
  text: "Coke, Diet Coke, Sprite, Fanta, Canada Dry, iced tea and water.",
  source: "Canucks — Coke Canada Bottling partnership, 2026-10-09",
  url: "https://www.nhl.com/canucks/news/canucks-sports-entertainment-welcomes-coke-canada-bottling-as-new-official-beverage-partner",
} as const;

export const BEER_ON_TAP = {
  text: "Molson Canadian, Coors Light and Madrí Excepcional at Molson Hockey House; Granville Island is the official craft beer.",
  source: "Canucks — Six big changes coming to Rogers Arena, 2024-09-24",
  url: "https://www.nhl.com/canucks/news/six-big-changes-coming-to-rogers-arena",
} as const;
