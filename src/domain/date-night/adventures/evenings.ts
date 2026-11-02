import { spokenClock } from "./compose";

/**
 * **The adventures the Markham Adventure opens on — Monday 2 November 2026,
 * from Vernon.**
 *
 * Each one is a short list of stops, not a script: what you do, for how
 * long, how far the drive before it, and whether it has to wait for the
 * sunset. `itinerary.ts` lays them out against the day's real sunset and
 * writes them as the adventure's own day (one item per stop), and every
 * change after that — a tap, a sentence, the other ending — edits that same
 * list. The words are ours. Every fact was checked on 2026-11-01 and says
 * where it came from:
 *
 * - **Sunset** is arithmetic (`sunsetOf`), 5:33 pm on the wall: BC stays on
 *   UTC−7 from 1 November 2026 (`conditions.ts`).
 * - **King Edward Lake** ("King Eddie") is not in Atlas. OpenStreetMap puts
 *   it at 50.1508, −119.2187, about 1,357 m up (Open-Meteo elevation), in
 *   the Central Okanagan regional district south-east of Coldstream. OSRM
 *   routes it 22 km and about 40 minutes from downtown Vernon, the last part
 *   on the King Edward Forest Service Road (gravel). The plan says 50.
 * - **Grouse.** The 2026–2028 Hunting and Trapping Regulations Synopsis:
 *   dusky, ruffed and spruce grouse are open in Region 8 until November 30,
 *   5 a day; no hunting of game from one hour after sunset (6:33 pm on
 *   Monday), general prohibition 38. A hunt needs daylight, which is why
 *   King Eddie leaves at 2:15, not 5.
 * - **Fire.** The BC Wildfire Service lifted the Kamloops Fire Centre's
 *   campfire ban at noon on 3 September 2026; Category 1 campfires have
 *   been allowed since. Nothing here promises tonight: the check says to
 *   look again before lighting.
 * - **Cold water.** Nobody has measured the lake. At 1,357 m in November it
 *   may be near freezing or iced at the edges, so the dip is optional,
 *   short, never alone, and never after dark.
 * - **Crazy Creek Hot Pools** (Malakwa) isn't in Atlas. Its own site
 *   (crazycreekresort.com, read 2026-11-01): open every day 9 am–10 pm,
 *   adults only 9–10, single dip $19.95; no food in November. About 112 km
 *   and 1½ hours by 97A and Highway 1 (OSRM).
 * - **BNA Brewing, Vernon** (1714 Kalamalka Lake Road): Atlas has it open
 *   Sun–Thu 4–10 pm, and BNA's own site said so on 1 November.
 */

export type EveningId =
  "king-eddie" | "crazy-creek" | "cold-water" | "surprise";

/** A real, openly licensed photograph, credited where it's shown. */
export interface Photo {
  readonly src: string;
  readonly alt: string;
  /** Where it was taken, said plainly so nobody mistakes it for tonight. */
  readonly where: string;
  readonly credit: string;
  readonly license: string;
  readonly page: string;
}

/** What a sentence can point at: "more time at the lake", "skip the swim". */
export type StopTag =
  | "leave"
  | "drive"
  | "hunt"
  | "explore"
  | "lake"
  | "swim"
  | "sunset"
  | "fire"
  | "food"
  | "dinner"
  | "stars"
  | "pools"
  | "fun"
  | "home";

/**
 * **One stop of an adventure, before it has a time.** `minutes` is how long
 * the plan gives it; `travel` the drive before it. A `stretch` stop is the
 * one that gives and takes time so a stop that waits for the light (`sunset`)
 * still happens at sunset.
 */
export interface StopTemplate {
  /** Stable within the adventure; how a stored stop finds its rules again. */
  readonly key: string;
  readonly title: string;
  readonly line: string;
  readonly minutes: number;
  /** The least it can shrink to when time runs short. */
  readonly least?: number;
  readonly travel?: number;
  /** Gives or takes time to keep the next sunset stop on time. */
  readonly stretch?: true;
  /** Starts no earlier than this many minutes before sunset. */
  readonly beforeSunset?: number;
  /** Must be over by this many minutes after sunset (it needs the light). */
  readonly byAfterSunset?: number;
  readonly where?: string;
  /** A destination for the maps link. */
  readonly directions?: string;
  readonly atlasRef?: string;
  readonly tags: readonly StopTag[];
  readonly main?: true;
  /** Fine to drop; said so on the stop. */
  readonly optional?: true;
}

/** "Stay wild" or "Warm ending": the same day, finished two ways. */
export interface Ending {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly stops: readonly StopTemplate[];
}

/** One thing to check before going. Short; a link where there is one. */
export interface Check {
  readonly label: string;
  readonly line: string;
  readonly href?: string;
}

export interface Evening {
  readonly id: EveningId;
  readonly title: string;
  /** Older names the adventure may still carry in the database. */
  readonly aliases?: readonly string[];
  /** "Jess's Pick". */
  readonly pick?: string;
  readonly line: string;
  readonly where: string;
  readonly drive: string;
  readonly highlights: readonly string[];
  readonly photo: Photo;
  /** Minutes after midnight the plan leaves home. */
  readonly leaveAt: number;
  readonly stops: readonly StopTemplate[];
  /** Ways to finish it; the first is the default. */
  readonly endings?: readonly Ending[];
  readonly checks: readonly Check[];
  /** Composed from Atlas at the moment it's chosen (`compose.ts`). */
  readonly composed?: true;
}

const KING_EDWARD_LAKE = "50.1508,-119.2187";
const KING_EDWARD_FSR = "50.1912,-119.1766";
const KAL_BEACH = "6931f16a-d8d9-4707-8780-86ba87ed5941";
export const BNA = "0ff70057-6723-47bb-8f05-2c6dec38dead";

const FIRE: Check = {
  label: "Fire",
  line: "Category 1 campfires have been allowed in the Kamloops Fire Centre since 3 September. Check again on the day before you light anything, keep it small, and drown it cold.",
  href: "https://www2.gov.bc.ca/gov/content/safety/wildfire-status/prevention/fire-bans-and-restrictions",
};
const ROADS: Check = {
  label: "Roads",
  line: "Check DriveBC before you go. November roads can ice up after dark.",
  href: "https://www.drivebc.ca/",
};

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const PHOTOS = {
  dusk: {
    src: "/datenight/dusk.jpg",
    alt: "A winter sun going down behind snowy Okanagan hills",
    where: "Rose Valley, West Kelowna",
    credit: "Extemporalist",
    license: "CC0",
    page: `${COMMONS}Winter_sun_sets_over_Rose_Valley.png`,
  },
  backcountry: {
    src: "/datenight/backcountry.jpg",
    alt: "Mist in a steep, dark forest of firs and cedars",
    where: "Monashee forest near Malakwa",
    credit: "Dietmar Rabich",
    license: "CC BY-SA 4.0",
    page: `${COMMONS}Malakwa_(BC,_Canada),_Trans-Canada_Highway_--_2022_--_112701.jpg`,
  },
  crazyCreek: {
    src: "/datenight/crazy-creek.jpg",
    alt: "Crazy Creek Falls pouring white through a green cedar canyon",
    where: "Crazy Creek Falls, Malakwa",
    credit: "Jack Borno",
    license: "CC BY-SA 3.0",
    page: `${COMMONS}Crazy_Falls_-_panoramio_(1).jpg`,
  },
  kalamalka: {
    src: "/datenight/kalamalka.jpg",
    alt: "Kalamalka Lake, deep blue under winter cloud and snowy hills",
    where: "Kalamalka Lake in winter",
    credit: "Jack Borno",
    license: "CC BY-SA 3.0",
    page: `${COMMONS}Winter_Morning_over_Kalamalka_Lake_-_panoramio.jpg`,
  },
  sunset: {
    src: "/datenight/coldstream-sunset.jpg",
    alt: "A pink and gold sunset over the Coldstream hills",
    where: "Coldstream",
    credit: "Ian Spence",
    license: "CC BY 3.0",
    page: `${COMMONS}Coldstream_Sunset_(257216223).jpeg`,
  },
  campfire: {
    src: "/datenight/campfire.jpg",
    alt: "A campfire burning bright in the dark",
    where: "A campfire",
    credit: "Marc-Lautenbacher",
    license: "CC BY-SA 4.0",
    page: `${COMMONS}Campfire_flames_at_night.jpg`,
  },
} as const satisfies Record<string, Photo>;

/** The dinner the warm ending starts from; `say.ts` may swap it. */
export const WARM_DINNER: StopTemplate = {
  key: "dinner",
  title: "Dinner at BNA Brewing",
  line: "Warm, loud in a good way, food and a pint. Open from 4.",
  minutes: 90,
  least: 60,
  travel: 45,
  where: "1714 Kalamalka Lake Rd, Vernon",
  atlasRef: BNA,
  tags: ["dinner", "food"],
};

export const EVENINGS: readonly Evening[] = [
  {
    id: "king-eddie",
    title: "King Eddie Lake",
    aliases: ["Into the Wild"],
    line: "Up the forest road for grouse in the afternoon light, a wander round the lake, a dip if you dare, and the sun going down over the water.",
    where: "King Edward Lake, above Coldstream",
    drive: "40–50 min up the King Edward FSR",
    highlights: [
      "Grouse in the afternoon light",
      "The lake to yourselves",
      "Sunset at the water",
      "Fire & stars, or a warm dinner",
    ],
    photo: PHOTOS.backcountry,
    leaveAt: 14 * 60 + 15,
    stops: [
      {
        key: "leave",
        title: "Leave Vernon",
        line: "Licence, shotgun cased, blaze orange, warm layers, chairs, firewood, the thermos.",
        minutes: 0,
        where: "Home",
        tags: ["leave"],
      },
      {
        key: "grouse",
        title: "Grouse along the King Edward FSR",
        line: "Walk the edges of the cut blocks and the quiet spurs. Slow and sharp-eyed.",
        minutes: 100,
        least: 45,
        travel: 40,
        stretch: true,
        byAfterSunset: 0,
        where: "King Edward Forest Service Road",
        directions: KING_EDWARD_FSR,
        tags: ["hunt", "explore", "drive"],
        main: true,
      },
      {
        key: "lake",
        title: "Explore King Edward Lake",
        line: "Find your spot on the shore. About 1,360 m up, so it's colder than town.",
        minutes: 30,
        least: 15,
        travel: 10,
        where: "King Edward Lake",
        directions: KING_EDWARD_LAKE,
        tags: ["lake", "explore"],
      },
      {
        key: "dip",
        title: "A quick dip, if you dare",
        line: "In together, out in under a minute, straight into dry clothes. Skip it if there's ice.",
        minutes: 10,
        where: "King Edward Lake",
        tags: ["swim", "lake"],
        byAfterSunset: 0,
        optional: true,
      },
      {
        key: "sunset",
        title: "Sunset by the lake",
        line: "Chairs out, thermos open, watch it go.",
        minutes: 20,
        least: 10,
        beforeSunset: 10,
        where: "King Edward Lake",
        tags: ["sunset", "lake"],
      },
    ],
    endings: [
      {
        id: "wild",
        title: "Stay wild",
        line: "Fire, warm food and stars at the lake, then home.",
        stops: [
          {
            key: "fire",
            title: "Fire & warm food by the lake",
            line: "A small fire if it's allowed, the stove if it isn't. Something hot, something sweet.",
            minutes: 75,
            least: 30,
            where: "King Edward Lake",
            tags: ["fire", "food", "lake"],
          },
          {
            key: "stars",
            title: "Stars",
            line: "Fire down, lights off, look up.",
            minutes: 30,
            least: 10,
            where: "King Edward Lake",
            tags: ["stars", "lake"],
          },
          {
            key: "home",
            title: "Home",
            line: "Slowly down the gravel in the dark. Name the best moment.",
            minutes: 0,
            travel: 50,
            where: "Home",
            tags: ["home"],
          },
        ],
      },
      {
        id: "warm",
        title: "Warm ending",
        line: "Drive back down toward Vernon for a cozy dinner.",
        stops: [
          WARM_DINNER,
          {
            key: "home",
            title: "Home",
            line: "Full, warm, slightly smug.",
            minutes: 0,
            travel: 10,
            where: "Home",
            tags: ["home"],
          },
        ],
      },
    ],
    checks: [
      {
        label: "Hunting",
        line: "Grouse is open in Region 8 until November 30, 5 a day. Licence in your pocket, and no hunting from an hour after sunset (6:33 pm Monday). Check the No Shooting Areas near Coldstream.",
        href: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/hunting/regulations-synopsis",
      },
      FIRE,
      {
        label: "The road",
        line: "The King Edward FSR is gravel and the lake is about 1,000 m above town. Snow or ice is possible in November. Turn around early, and tell someone where you're going.",
      },
      {
        label: "Cold water",
        line: "Nobody has checked the water. Never alone, never after dark, no diving, shoes on, a minute at most. Skip it if either of you has a heart condition.",
      },
      {
        label: "Weather",
        line: "Environment Canada's forecast is for Vernon. The lake is about 1,000 m higher and will likely be colder.",
        href: "https://weather.gc.ca/en/location/index.html?coords=50.267,-119.272",
      },
    ],
  },
  {
    id: "crazy-creek",
    title: "Crazy Creek Escape",
    pick: "Jess's Pick",
    line: "A scenic drive past Mara and Shuswap lakes to hot pools in the cedars below Crazy Creek Falls. Dinner to go, a long soak, a cozy drive home.",
    where: "Crazy Creek Hot Pools, Malakwa",
    drive: "About 1½ hours each way",
    highlights: [
      "Two hot pools & a cold plunge",
      "Open till 10 tonight",
      "Adults only from 9",
      "Dinner on the road",
    ],
    photo: PHOTOS.crazyCreek,
    leaveAt: 17 * 60,
    stops: [
      {
        key: "leave",
        title: "Swimsuits on under the sweaters",
        line: "Towels, flip-flops, a thermos of hot chocolate, a toque each.",
        minutes: 0,
        where: "Home",
        tags: ["leave"],
      },
      {
        key: "food",
        title: "Dinner to go in Vernon",
        line: "There's no food at the pools in November. Pick up something good on the way out.",
        minutes: 15,
        least: 10,
        travel: 10,
        where: "Vernon",
        tags: ["food", "dinner"],
      },
      {
        key: "pools",
        title: "Crazy Creek Hot Pools",
        line: "Two hot pools and a cold plunge in the cedars. $19.95 each for a dip. Open till 10.",
        minutes: 120,
        least: 45,
        travel: 90,
        where: "6162 Trans-Canada Hwy, Malakwa",
        directions:
          "Crazy Creek Hot Pools Resort, 6162 Trans-Canada Hwy, Malakwa, BC",
        tags: ["pools", "swim"],
        main: true,
      },
      {
        key: "home",
        title: "Home",
        line: "Hot chocolate for the road. Warm, loose and slightly smug.",
        minutes: 0,
        travel: 95,
        where: "Home",
        tags: ["home"],
      },
    ],
    checks: [
      {
        label: "Pools",
        line: "Their site says every day, 9 am–10 pm, no booking for a dip. Call to be sure: 1-855-836-4097.",
        href: "https://www.crazycreekresort.com/hot-pools",
      },
      {
        label: "Highway",
        line: "Over an hour and a half of it after dark, home. Check DriveBC for 97A and Highway 1, and winter tires.",
        href: "https://www.drivebc.ca/",
      },
    ],
  },
  {
    id: "cold-water",
    title: "Cold Water, Warm Fire",
    line: "A screaming-cold dip in Kal Lake before the sun goes, then dry clothes, hot chocolate, dinner and a fire at home.",
    where: "Kal Beach, Coldstream",
    drive: "Minutes from home",
    highlights: [
      "A dip in Kalamalka Lake",
      "Sunset from the beach",
      "Dinner at BNA",
      "A fire & marshmallows",
    ],
    photo: PHOTOS.kalamalka,
    leaveAt: 17 * 60,
    stops: [
      {
        key: "leave",
        title: "Layers on, towels in",
        line: "Swimsuits underneath, water shoes, the big towels, the car heater on.",
        minutes: 0,
        where: "Home",
        tags: ["leave"],
      },
      {
        key: "dip",
        title: "The dip at Kal Beach",
        line: "In together, out in a minute or two. While it's still light.",
        minutes: 15,
        travel: 5,
        atlasRef: KAL_BEACH,
        where: "Kal Beach",
        tags: ["swim", "lake"],
        byAfterSunset: 0,
        main: true,
      },
      {
        key: "sunset",
        title: "Warm up, watch the sun go",
        line: "Dry clothes, hot chocolate from the thermos.",
        minutes: 25,
        least: 10,
        beforeSunset: 10,
        where: "Kal Beach",
        tags: ["sunset", "lake"],
      },
      {
        ...WARM_DINNER,
        travel: 5,
        line: "Five minutes up Kalamalka Lake Road. Open from 4.",
      },
      {
        key: "fire",
        title: "A fire at home",
        line: "If it's allowed. Blanket, marshmallows, the cold-plunge story told twice.",
        minutes: 60,
        least: 20,
        travel: 10,
        where: "Home",
        tags: ["fire", "home"],
      },
    ],
    checks: [
      {
        label: "Cold water",
        line: "Never alone and never after dark. No diving, no drinks first, shoes on. In for a minute or two, then straight into dry clothes. Skip it if either of you has a heart condition.",
      },
      FIRE,
      ROADS,
    ],
  },
  {
    id: "surprise",
    title: "Surprise Us",
    line: "Passport picks the evening from real places near home, open on a Monday night. No peeking.",
    where: "Somewhere near home",
    drive: "Close to home",
    highlights: ["Real places", "Open tonight", "A little mischief"],
    photo: PHOTOS.sunset,
    leaveAt: 17 * 60,
    stops: [],
    checks: [],
    composed: true,
  },
];

export const eveningOf = (id: string | null | undefined): Evening | undefined =>
  EVENINGS.find((e) => e.id === id);

/** Which adventure the night is on: the owner's choice, by its name. */
export const eveningNamed = (
  label: string | null | undefined,
): Evening | undefined =>
  label
    ? EVENINGS.find((e) => e.title === label || e.aliases?.includes(label))
    : undefined;

export function directionsTo(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** "2:15 pm", for a card. */
export const clockSaid = (minutes: number): string =>
  spokenClock(Math.round(minutes / 5) * 5).replace(/(am|pm)$/, " $1");
