import { SOURCES, type ArenaLevel } from "./arena";

/**
 * **What is on Rogers Arena's concourses, as the arena's own map draws it.**
 *
 * One source: the directory map the arena published on 2026-09-29
 * (`SOURCES.map`, 4500 × 8000 px). Every entry below was read off that image
 * by eye on 2026-10-22 and placed **beside the section the map draws it
 * next to** — to the nearest section, or between two where the map puts it
 * between two. That is all the position anything here has:
 *
 * - **No coordinates, no distances, no indoor routes.** The map is a
 *   schematic. "Three sections along the concourse" is the only kind of
 *   nearness Passport claims (`sectionsApart`), and it says it in those words.
 * - **No menus or prices here.** The map names brands, not what they sell or
 *   for how much. What the arena or anyone else says about food lives in
 *   `menus.ts`, with its own source and date.
 * - **Shaded areas stay shaded.** The map draws the Shelter Point Club and RBC
 *   Landing, by Gate 10, cross-hatched, and does not say who may go in. Things
 *   drawn there say so.
 * - **Levels 100 and 300 only.** Those are the two public concourses. Level
 *   200 (clubs) is not drawn; 400 and 500 are lounges and suites.
 *
 * This is a Passport-held stand-in for venue knowledge Atlas owns
 * (`docs/product/hockey/ARENA-MODE.md` → Atlas dependencies), of the same kind
 * as `arena.ts`: small, cited, to be re-read when the arena reprints its map.
 */

export const CONCOURSE_CHECKED = "2026-10-22";
export const CONCOURSE_SOURCE = SOURCES.map;

// ------------------------------------------------------------------ sections

/**
 * Each level's sections in the order the map numbers them, which is clockwise
 * seen from above with north up, starting on the west side just north of
 * centre (101 above 122; 301 above 330).
 */
export const RING: Readonly<Record<ArenaLevel, readonly string[]>> = {
  "100": Array.from({ length: 22 }, (_, i) => String(101 + i)),
  "300": Array.from({ length: 30 }, (_, i) => String(301 + i)),
};

export const LEVELS: readonly ArenaLevel[] = ["100", "300"];

export const LEVEL_NAME: Readonly<Record<ArenaLevel, string>> = {
  "100": "Plaza Level 100",
  "300": "Level 300",
};

export const levelOfSection = (section: string): ArenaLevel | undefined =>
  LEVELS.find((l) => RING[l].includes(section));

/**
 * How many sections apart two sections are, going the short way round the
 * same level. `undefined` across levels: there is no honest number for that.
 */
export function sectionsApart(a: string, b: string): number | undefined {
  const level = levelOfSection(a);
  if (!level || levelOfSection(b) !== level) return undefined;
  const ring = RING[level];
  const d = Math.abs(ring.indexOf(a) - ring.indexOf(b));
  return Math.min(d, ring.length - d);
}

// ------------------------------------------------------------------ the legend

/** The map's FOOD & BEVERAGE legend, letter for letter. */
export const CONCESSIONS = {
  A: "Bar",
  B: "Beer Express",
  C: "Bowls",
  D: "Carve",
  E: "Carve Express",
  F: "Catch",
  G: "Cin City",
  H: "Crisp",
  I: "Drizzleberries",
  J: "Hot Dogs",
  K: "Kim Crawford Wine Bar",
  L: "Molson Hockey House",
  M: "Melt",
  N: "Panago",
  O: "Popcorn",
  P: "Santé",
  Q: "Smash by Provisions",
  R: "The Sportsbar",
  S: "Steamer's",
  T: "Swirl",
  U: "Tim Hortons",
  V: "Triple-O's",
} as const;

export type ConcessionCode = keyof typeof CONCESSIONS;

/**
 * The map's ENTERTAINMENT and PREMIUM AREAS numbers that appear on Levels 100
 * and 300. (4–6 are lounges on 400 and 500.)
 */
export const FEATURES = {
  "1": "Legends Locker Room: Interactive Experience, Powered by Rogers",
  "2": "With Glowing Hearts: Olympic Tribute",
  "3": "Fins Family Zone",
  "7": "The Sportsbar",
} as const;

export type FeatureCode = keyof typeof FEATURES;

/**
 * What a thing on the map is. `drink` is a stand whose name is a bar or beer;
 * the map itself does not say what any stand pours.
 */
export type SpotKind =
  | "food"
  | "drink"
  | "snackCart"
  | "store"
  | "washroom"
  | "firstAid"
  | "guestServices"
  | "elevator"
  | "water"
  | "charging"
  | "noAlcohol"
  | "feature";

const DRINK: ReadonlySet<ConcessionCode> = new Set(["A", "B", "K", "L", "R"]);

/** Places the map draws away from the bowl, where "beside section N" would mislead. */
export const ZONES = {
  rbcLanding: "RBC Landing, by Gate 10 (shaded on the map)",
  shelterPoint: "Shelter Point Club, by Gate 10 (shaded on the map)",
  westPlaza: "West concourse, behind sections 101 and 122",
  southPlaza: "South concourse, toward Griffiths Way",
  sportsbar: "By The Sportsbar and Gate 8",
  north300: "North end, by the North Elevator",
  eastPlaza: "East concourse, by the East Elevator",
} as const;

export type ZoneId = keyof typeof ZONES;

export interface Spot {
  /** Stable id: `<level>:<what>:<where>`, e.g. `300:J:304`. A check-in place. */
  readonly id: string;
  readonly level: ArenaLevel;
  readonly kind: SpotKind;
  /** A concession's letter, a feature's number. */
  readonly code?: ConcessionCode | FeatureCode;
  readonly name: string;
  /** The section(s) the map draws it beside. Always on `level`. */
  readonly by: readonly string[];
  /** Drawn out in an open area rather than on the ring. */
  readonly zone?: ZoneId;
  /** Anything the map shows about it beyond its name. */
  readonly note?: string;
}

// ------------------------------------------------------------------ the pins

type Pin =
  | ConcessionCode
  | FeatureCode
  | "cart"
  | "kiosk"
  | "store"
  | "men"
  | "women"
  | "washrooms"
  | "universal"
  | "firstAid"
  | "guest"
  | "water"
  | "charging"
  | "noAlcohol"
  | "elevator-north"
  | "elevator-east"
  | "elevator-south";

const PIN_KIND: Record<string, SpotKind> = {
  cart: "snackCart",
  kiosk: "store",
  store: "store",
  men: "washroom",
  women: "washroom",
  washrooms: "washroom",
  universal: "washroom",
  firstAid: "firstAid",
  guest: "guestServices",
  water: "water",
  charging: "charging",
  noAlcohol: "noAlcohol",
  "elevator-north": "elevator",
  "elevator-east": "elevator",
  "elevator-south": "elevator",
};

const PIN_NAME: Record<string, string> = {
  cart: "Snack cart",
  kiosk: "Canucks Team Store Kiosk",
  store: "Canucks Team Store",
  men: "Washroom (men's symbol)",
  women: "Washroom (women's symbol)",
  washrooms: "Washrooms",
  universal: "Universal restroom",
  firstAid: "First Aid",
  guest: "Guest Services",
  water: "Water fountain",
  charging: "Rogers Charging Zone",
  noAlcohol: "No Alcohol Seating",
  "elevator-north": "North Elevator",
  "elevator-east": "East Elevator",
  "elevator-south": "South Elevator",
};

function spot(
  level: ArenaLevel,
  pin: Pin,
  by: readonly string[],
  extra: { zone?: ZoneId; note?: string } = {},
): Spot {
  const where = extra.zone ?? by.join("-");
  const isConcession = pin in CONCESSIONS;
  const isFeature = pin in FEATURES;
  return {
    id: `${level}:${pin}:${where}`,
    level,
    kind: isConcession
      ? DRINK.has(pin as ConcessionCode)
        ? "drink"
        : "food"
      : isFeature
        ? "feature"
        : PIN_KIND[pin],
    ...(isConcession || isFeature
      ? { code: pin as ConcessionCode | FeatureCode }
      : {}),
    name: isConcession
      ? CONCESSIONS[pin as ConcessionCode]
      : isFeature
        ? FEATURES[pin as FeatureCode]
        : PIN_NAME[pin],
    by,
    ...extra,
  };
}

const SHADED =
  "Drawn inside a shaded area on the map, which doesn't say who can go in.";

/**
 * **Plaza Level 100.** Read clockwise from the north-west, as the map draws
 * it. Stairs are left out; everything else on the level is here.
 */
const LEVEL_100: readonly Spot[] = [
  // North-west corner, 102–104
  spot("100", "I", ["102"]),
  spot("100", "kiosk", ["102", "103"]),
  spot("100", "cart", ["102", "103"]),
  spot("100", "B", ["102", "103"]),
  spot("100", "women", ["102"]),
  spot("100", "noAlcohol", ["102"], {
    note: "The map's No Alcohol Seating symbol is drawn at this section.",
  }),
  spot("100", "3", ["103"]),
  spot("100", "T", ["103"]),
  spot("100", "O", ["103"]),
  spot("100", "men", ["103"]),
  spot("100", "G", ["103", "104"]),
  spot("100", "universal", ["103", "104"]),
  spot("100", "B", ["104"]),
  // North side, 104–108, and what is drawn behind it by Gate 10
  spot("100", "elevator-north", ["104"], {
    note: "By Gate 10. Level 000: Ticketmaster Ticket Centre.",
  }),
  spot("100", "A", ["104", "105"], { zone: "shelterPoint", note: SHADED }),
  spot("100", "firstAid", ["104", "105"], { zone: "shelterPoint" }),
  spot("100", "guest", ["104", "105"], {
    zone: "shelterPoint",
    note: "The arena's accessibility page says Guest Services at section 104 is for club-section ticket holders at hockey games.",
  }),
  spot("100", "charging", ["104", "105"], { zone: "shelterPoint" }),
  spot("100", "water", ["104", "105"], { zone: "shelterPoint" }),
  spot("100", "men", ["105"]),
  spot("100", "Q", ["105", "106"]),
  spot("100", "M", ["106", "107"]),
  spot("100", "F", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "D", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "R", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "P", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "T", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "S", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "A", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "B", ["106"], { zone: "rbcLanding", note: SHADED }),
  spot("100", "water", ["106"], { zone: "rbcLanding" }),
  spot("100", "cart", ["106"], { zone: "rbcLanding" }),
  spot("100", "men", ["107", "108"]),
  // North-east corner, 108–110
  spot("100", "women", ["108", "109"]),
  spot("100", "U", ["109"]),
  spot("100", "P", ["109"]),
  spot("100", "universal", ["109"]),
  spot("100", "men", ["109", "110"]),
  spot("100", "kiosk", ["110"]),
  spot("100", "B", ["110"]),
  spot("100", "E", ["110"], { note: "Drawn by the stairs toward Gate 3." }),
  spot("100", "women", ["110", "111"]),
  // East side, 111–113
  spot("100", "A", ["111"], { note: "Drawn by Gate 16." }),
  spot("100", "H", ["111", "112"]),
  spot("100", "elevator-east", ["112"], {
    note: "By Gate 16. Level 000: Gate 16.",
  }),
  spot("100", "G", ["112"]),
  spot("100", "women", ["113"]),
  spot("100", "cart", ["113", "114"]),
  // South-east corner, 114–115
  spot("100", "B", ["114"]),
  spot("100", "J", ["114"]),
  spot("100", "store", ["114", "115"], {
    note: "The main Canucks Team Store, drawn in the south-east corner toward Gate 6.",
  }),
  spot("100", "guest", ["114", "115"]),
  spot("100", "men", ["115"]),
  spot("100", "B", ["115"]),
  // South side, 116–119
  spot("100", "V", ["116"]),
  spot("100", "women", ["117"]),
  spot("100", "kiosk", ["117"]),
  spot("100", "cart", ["117"]),
  spot("100", "B", ["118"]),
  spot("100", "women", ["118"]),
  spot("100", "N", ["118", "119"]),
  spot("100", "L", ["118", "119"], { zone: "southPlaza" }),
  spot("100", "D", ["118", "119"], { zone: "southPlaza" }),
  spot("100", "F", ["118", "119"], { zone: "southPlaza" }),
  spot("100", "men", ["119"]),
  // South-west corner, 119–121
  spot("100", "S", ["119", "120"]),
  spot("100", "M", ["120"]),
  spot("100", "water", ["120"]),
  spot("100", "elevator-south", ["120"]),
  spot("100", "G", ["120"]),
  spot("100", "2", ["120", "121"]),
  spot("100", "washrooms", ["120", "121"]),
  spot("100", "kiosk", ["121"]),
  spot("100", "U", ["121"]),
  spot("100", "P", ["121"]),
  spot("100", "women", ["121", "122"]),
  // West side, 122–101, and the open concourse behind it
  spot("100", "J", ["122", "101"]),
  spot("100", "C", ["122", "101"], { zone: "westPlaza" }),
  spot("100", "A", ["122", "101"], { zone: "westPlaza" }),
  spot("100", "F", ["122", "101"], { zone: "westPlaza" }),
  spot("100", "K", ["122", "101"], { zone: "westPlaza" }),
  spot("100", "D", ["122", "101"], { zone: "westPlaza" }),
];

/** **Level 300.** Read clockwise from the north-west. */
const LEVEL_300: readonly Spot[] = [
  // West and north-west, 301–305
  spot("300", "J", ["330", "301"]),
  spot("300", "cart", ["302"]),
  spot("300", "C", ["303"]),
  spot("300", "J", ["304"]),
  spot("300", "kiosk", ["305"]),
  spot("300", "B", ["305"]),
  spot("300", "O", ["305", "306"]),
  // North side, 306–310, and the north end
  spot("300", "firstAid", ["305", "306"], { zone: "north300" }),
  spot("300", "water", ["306"], { zone: "north300" }),
  spot("300", "elevator-north", ["306", "307"], { zone: "north300" }),
  spot("300", "A", ["308"], {
    zone: "north300",
    note: "Drawn beside stairs the map marks for club members only.",
  }),
  spot("300", "cart", ["308"], { zone: "north300" }),
  spot("300", "women", ["306", "307"]),
  spot("300", "V", ["307", "308"]),
  spot("300", "kiosk", ["308"]),
  spot("300", "men", ["308", "309"]),
  spot("300", "D", ["309"]),
  spot("300", "F", ["309", "310"]),
  spot("300", "guest", ["310", "311"]),
  // North-east, 311–314
  spot("300", "charging", ["311", "312"]),
  spot("300", "cart", ["312"]),
  spot("300", "T", ["313"]),
  spot("300", "noAlcohol", ["313"], {
    note: "The map's No Alcohol Seating symbol is drawn at this section, beside wheelchair position WC311.",
  }),
  spot("300", "G", ["313", "314"]),
  spot("300", "J", ["314"]),
  // East side, 315–317
  spot("300", "1", ["315"], { zone: "eastPlaza" }),
  spot("300", "elevator-east", ["316"], { zone: "eastPlaza" }),
  spot("300", "kiosk", ["317"]),
  spot("300", "cart", ["317"]),
  spot("300", "noAlcohol", ["317"], {
    note: "The map's No Alcohol Seating symbol is drawn at this section, beside wheelchair position WC317.",
  }),
  // South-east, 318–320
  spot("300", "B", ["318"]),
  spot("300", "charging", ["319"]),
  spot("300", "N", ["319"]),
  spot("300", "3", ["319", "320"], { zone: "eastPlaza" }),
  spot("300", "B", ["320"]),
  spot("300", "P", ["320"]),
  spot("300", "universal", ["320"]),
  spot("300", "washrooms", ["320"], { zone: "eastPlaza" }),
  // South side, 321–326
  spot("300", "cart", ["321"]),
  spot("300", "E", ["321", "322"]),
  spot("300", "C", ["322", "323"]),
  spot("300", "A", ["323", "324"]),
  spot("300", "J", ["324", "325"]),
  spot("300", "cart", ["326"]),
  spot("300", "G", ["326", "327"]),
  // South-west, 327–329, and The Sportsbar by Gate 8
  spot("300", "kiosk", ["327"]),
  spot("300", "elevator-south", ["327", "328"]),
  spot("300", "kiosk", ["328"]),
  spot("300", "charging", ["328"]),
  spot("300", "B", ["329"]),
  spot("300", "7", ["329", "330"], { zone: "sportsbar" }),
  spot("300", "A", ["329", "330"], { zone: "sportsbar" }),
  spot("300", "S", ["329", "330"], { zone: "sportsbar" }),
  spot("300", "washrooms", ["329", "330"], { zone: "sportsbar" }),
];

/**
 * Every spot on both public levels. Two spots with the same id would be the
 * map drawing the same thing twice in the same place, so ids get a `~2`.
 */
export const SPOTS: readonly Spot[] = (() => {
  const seen = new Map<string, number>();
  return [...LEVEL_100, ...LEVEL_300].map((s) => {
    const n = (seen.get(s.id) ?? 0) + 1;
    seen.set(s.id, n);
    return n === 1 ? s : { ...s, id: `${s.id}~${n}` };
  });
})();

export const spotById = (id: string | null | undefined): Spot | undefined =>
  id ? SPOTS.find((s) => s.id === id) : undefined;

export const spotsOn = (level: ArenaLevel): Spot[] =>
  SPOTS.filter((s) => s.level === level);

/** "beside section 304", "between sections 323 and 324", or the zone's words. */
export function whereWords(s: Pick<Spot, "by" | "zone">): string {
  if (s.zone) return ZONES[s.zone];
  return s.by.length === 1
    ? `beside section ${s.by[0]}`
    : `between sections ${s.by[0]} and ${s.by[1]}`;
}

/**
 * Sections along the concourse from a seat's section to a spot: the nearer of
 * the sections it is drawn by. `undefined` on another level.
 */
export function spotDistance(
  fromSection: string,
  s: Pick<Spot, "by">,
): number | undefined {
  const ds = s.by
    .map((b) => sectionsApart(fromSection, b))
    .filter((d): d is number => d !== undefined);
  return ds.length ? Math.min(...ds) : undefined;
}

/** "Right by your seat", "2 sections along", "On Level 300". */
export function distanceWords(
  fromSection: string | undefined,
  s: Pick<Spot, "by" | "level">,
): string | undefined {
  if (!fromSection) return undefined;
  const d = spotDistance(fromSection, s);
  if (d === undefined) {
    return levelOfSection(fromSection)
      ? `On ${LEVEL_NAME[s.level]}`
      : undefined;
  }
  if (d === 0) return "Right by your section";
  return d === 1 ? "1 section along" : `${d} sections along`;
}

/**
 * The nearest spots of some kind to a section, nearest first, on its level.
 * What "near my seat" means here: by the map's section numbers, nothing more.
 */
export function nearest(
  fromSection: string,
  match: (s: Spot) => boolean,
  limit = 3,
): { spot: Spot; apart: number }[] {
  const level = levelOfSection(fromSection);
  if (!level) return [];
  return spotsOn(level)
    .filter(match)
    .map((s) => ({ spot: s, apart: spotDistance(fromSection, s) ?? 99 }))
    .sort((a, b) => a.apart - b.apart || a.spot.name.localeCompare(b.spot.name))
    .slice(0, limit);
}
