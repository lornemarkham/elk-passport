import { writeDayQuery } from "@/lib/domains/integration/dayQuery";
import { spokenClock } from "./compose";
import type { NightDay } from "./types";

/**
 * **Three evenings and a surprise — Monday 2 November 2026, leaving about 5.**
 *
 * The Markham Adventure opens on choices, not a questionnaire (mission 485).
 * Each evening is a short, honest shape for the night: leave, pick up food,
 * the drive, the main thing, something warm, home. The words are ours. Every
 * fact was checked on 2026-11-01, and says where it came from:
 *
 * - **Sunset** is arithmetic (`sunsetOf`), 5:33 pm on the wall: BC stays on
 *   UTC−7 from 1 November 2026 (`conditions.ts`). Each evening is laid out
 *   around it, so the outdoor part happens in the light.
 * - **Grouse.** The 2026–2028 Hunting and Trapping Regulations Synopsis:
 *   dusky, ruffed and spruce grouse open Sept 10 – Nov 30 in MUs 8-1 to 8-15
 *   and 8-21 to 8-26 (Vernon is 8-26), 5 a day; game may not be hunted from
 *   one hour after sunset (6:33 pm on Monday). Civil twilight ends about
 *   6:05, so a 5 pm start can only scout. Hunting needs a 2:30 start; that's
 *   said, not planned.
 * - **Crazy Creek Hot Pools** (Malakwa) isn't in Atlas. Its own site
 *   (crazycreekresort.com, read 2026-11-01): hot pools and cold plunge open
 *   every day of the year, 9 am–10 pm, adults only 9–10 pm, single dip
 *   $19.95. The food truck runs May long weekend to Thanksgiving, so in
 *   November dinner comes with you. About 112 km and 1½ hours from Coldstream
 *   by 97A and Highway 1 (OSRM, 2026-11-01).
 * - **BNA Brewing, Vernon** (1714 Kalamalka Lake Road): Atlas has it open
 *   Sun–Thu 4–10 pm, and BNA's own site said so on 1 November.
 * - **Fires** are never promised: the Kamloops Fire Centre's restrictions
 *   decide, and the evening says to check.
 *
 * Choosing one is an ordinary change to the shared adventure (ADR 012):
 * the owner's `PATCH` names it (`destinationLabel`), and the Atlas places it
 * uses become the day through `POST /api/adventures/[id]/days`, so the
 * journey, directions, travel legs and printable guide all carry on.
 */

export type EveningId =
  "into-the-wild" | "crazy-creek" | "cold-water" | "surprise";

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

export interface Beat {
  /** Minutes after local midnight. */
  readonly at: number;
  readonly title: string;
  readonly line: string;
  /** The Atlas place this beat is at, when it's one. */
  readonly atlasRef?: string;
  /** A destination for the maps link. */
  readonly directions?: string;
  /** The main event: the timeline makes it bigger. */
  readonly main?: true;
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
  /** "Jess's Pick". */
  readonly pick?: string;
  readonly line: string;
  readonly drive: string;
  readonly highlights: readonly string[];
  readonly photo: Photo;
  /** Atlas places the shared day keeps, in order. Empty: none in Atlas. */
  readonly stops: readonly string[];
  readonly beats: (sunset: number) => readonly Beat[];
  readonly checks: readonly Check[];
  /** The other way to do it, when there is one worth saying. */
  readonly otherwise?: (sunset: number) => string;
}

export const LEAVE = 17 * 60;

const SILVER_STAR_FOOTHILLS = "65c5da2d-099f-4ffb-a4cd-d5ab79c12701";
const KAL_BEACH = "6931f16a-d8d9-4707-8780-86ba87ed5941";
const BNA = "0ff70057-6723-47bb-8f05-2c6dec38dead";

const FIRE: Check = {
  label: "Fire",
  line: "A fire only if the Kamloops Fire Centre allows it tonight. Otherwise the stove does the cooking.",
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

export const EVENINGS: readonly Evening[] = [
  {
    id: "into-the-wild",
    title: "Into the Wild",
    line: "Snacks, a full tank and the forest roads above the valley. Last light, a camp-stove dinner somewhere beautiful, hot chocolate and stars.",
    drive: "15 min to the first view",
    highlights: [
      "Last light at the Foothills",
      "Scout the grouse country",
      "Dinner on the camp stove",
      "Hot chocolate & stars",
    ],
    photo: PHOTOS.backcountry,
    stops: [SILVER_STAR_FOOTHILLS],
    beats: (sunset) => [
      {
        at: LEAVE,
        title: "Load up and go",
        line: "Stove, kettle, cocoa, chairs, headlamps, the warm jackets.",
      },
      {
        at: LEAVE + 5,
        title: "Grab food & snacks",
        line: "Whatever cooks on one burner. Something sweet for later.",
      },
      {
        at: Math.min(LEAVE + 25, sunset - 10),
        title: "Last light at the Silver Star Foothills",
        line: `Sun's down at ${spokenClock(sunset)}. Be at the view for it.`,
        atlasRef: SILVER_STAR_FOOTHILLS,
        main: true,
      },
      {
        at: sunset + 15,
        title: "Backroad scouting",
        line: "Up the forest roads, slowly. Where's the snow line, which gates are open, where the grouse cover looks good for a daylight trip.",
      },
      {
        at: sunset + 75,
        title: "Dinner somewhere beautiful",
        line: "A safe pull-out with a view. Camp stove, headlamps, the good snacks.",
      },
      {
        at: sunset + 120,
        title: "Hot chocolate & stars",
        line: "Engine off, lights off, look up.",
      },
      {
        at: sunset + 180,
        title: "Home",
        line: "A fire if it's allowed. Name the best moment.",
      },
    ],
    otherwise: (sunset) =>
      `Grouse is the point? Leave at 2:30 instead. The season's open in Region 8 until November 30, but legal hunting ends at ${spokenClock(sunset + 60)}, an hour after sunset, and it's too dark to see a bird well before that. A 5 o'clock start is for scouting.`,
    checks: [
      {
        label: "Hunting",
        line: "Hunting licence in your pocket and the 2026–2028 synopsis for Region 8. No hunting from an hour after sunset.",
        href: "https://www2.gov.bc.ca/gov/content/sports-culture/recreation/fishing-hunting/hunting/regulations-synopsis",
      },
      FIRE,
      {
        label: "Access",
        line: "Forest roads can be gated, rutted or snowed in. Turn around early, and tell someone where you're going.",
      },
      ROADS,
    ],
  },
  {
    id: "crazy-creek",
    title: "Crazy Creek Escape",
    pick: "Jess's Pick",
    line: "A scenic drive past Mara and Shuswap lakes to hot pools in the cedars below Crazy Creek Falls. Dinner to go, a long soak, a cozy drive home.",
    drive: "About 1½ hours each way",
    highlights: [
      "Two hot pools & a cold plunge",
      "Open till 10 tonight",
      "Adults only from 9",
      "Dinner on the road",
    ],
    photo: PHOTOS.crazyCreek,
    stops: [],
    beats: (sunset) => [
      {
        at: LEAVE,
        title: "Swimsuits on under the sweaters",
        line: "Towels, flip-flops, a thermos of hot chocolate, a toque each.",
      },
      {
        at: LEAVE + 10,
        title: "Dinner to go in Vernon",
        line: "There's no food at the pools in November. Pick up something good on the way out.",
      },
      {
        at: LEAVE + 20,
        title: "The drive north",
        line: `97A past Enderby and Mara Lake, then east on Highway 1 from Sicamous. Sunset's at ${spokenClock(sunset)}, somewhere along the lake.`,
      },
      {
        at: LEAVE + 110,
        title: "Crazy Creek Hot Pools",
        line: "Two hot pools and a cold plunge in the cedars. $19.95 each for a dip. Open till 10.",
        directions:
          "Crazy Creek Hot Pools Resort, 6162 Trans-Canada Hwy, Malakwa, BC",
        main: true,
      },
      {
        at: 20 * 60 + 45,
        title: "Hot chocolate for the road",
        line: "Or stay for the adults-only hour, 9 to 10, and get home late.",
      },
      {
        at: 22 * 60 + 15,
        title: "Home",
        line: "Warm, loose and slightly smug.",
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
        line: "Two hours of it after dark, home. Check DriveBC for 97A and Highway 1, and winter tires.",
        href: "https://www.drivebc.ca/",
      },
    ],
  },
  {
    id: "cold-water",
    title: "Cold Water, Warm Fire",
    line: "A screaming-cold dip in Kal Lake before the sun goes, then dry clothes, hot chocolate, dinner and a fire at home.",
    drive: "2 min to the lake",
    highlights: [
      "A dip in Kalamalka Lake",
      "Sunset from the beach",
      "Dinner at BNA",
      "A fire & marshmallows",
    ],
    photo: PHOTOS.kalamalka,
    stops: [KAL_BEACH, BNA],
    beats: (sunset) => [
      {
        at: LEAVE,
        title: "Layers on, towels in",
        line: "Swimsuits underneath, water shoes, the big towels, the car heater on.",
      },
      {
        at: LEAVE + 5,
        title: "The dip at Kal Beach",
        line: "In together, out in a minute or two. While it's still light.",
        atlasRef: KAL_BEACH,
        main: true,
      },
      {
        at: LEAVE + 20,
        title: "Warm up, watch the sun go",
        line: `Dry clothes, hot chocolate from the thermos, sunset at ${spokenClock(sunset)}.`,
      },
      {
        at: sunset + 20,
        title: "Dinner at BNA Brewing",
        line: "Five minutes up Kalamalka Lake Road. Open from 4.",
        atlasRef: BNA,
        directions: "BNA Brewing, 1714 Kalamalka Lake Road, Vernon, BC",
      },
      {
        at: sunset + 120,
        title: "A fire at home",
        line: "If it's allowed. Blanket, marshmallows, the cold-plunge story told twice.",
      },
    ],
    checks: [
      {
        label: "Cold water",
        line: "Never alone and never after dark. No diving, no drinks first, shoes on. In for a minute or two, then straight into dry clothes. Skip it if either of you has a heart condition.",
      },
      FIRE,
    ],
  },
  {
    id: "surprise",
    title: "Surprise Us",
    line: "Passport picks the evening from real places near home, open on a Monday night. No peeking.",
    drive: "Close to home",
    highlights: ["Real places", "Open tonight", "A little mischief"],
    photo: PHOTOS.sunset,
    stops: [],
    beats: () => [],
    checks: [],
  },
];

export const THREE = EVENINGS.filter((e) => e.id !== "surprise");

export const eveningOf = (id: string | null | undefined): Evening | undefined =>
  EVENINGS.find((e) => e.id === id);

/** Which evening an adventure is on: the owner's choice, by its name. */
export const eveningNamed = (
  label: string | null | undefined,
): Evening | undefined => EVENINGS.find((e) => e.title === label);

/** The shared day for an evening with places in Atlas. */
export function eveningQuery(evening: Evening, day: NightDay): string | null {
  if (evening.stops.length === 0) return null;
  const query = writeDayQuery({
    stops: [...evening.stops],
    say: `${evening.title.toLowerCase()}, an evening for the two of us, leave at ${spokenClock(LEAVE)}`,
    at: day.townId,
    on: day.on,
    mins: {},
    rain: {},
  });
  return `${query}&evening=${evening.id}`;
}

export function directionsTo(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
