import { distanceKm } from "@/lib/environment/geo";

/**
 * **Mountains Passport knows without asking anyone.**
 *
 * A short, curated list of western-Canadian ski areas — a name, a region, an
 * approximate point and the resort's own website. That is *all* it holds, and
 * all of it is **static**: it changes by decade, not by day.
 *
 * What is deliberately NOT here, and must not be added by a well-meaning
 * edit: snow depth, lift or run status, trail counts, terrain splits, ticket
 * prices, opening dates, and any weather. Each of those is either live (and
 * Passport has no feed for it) or a number that goes stale and is then
 * wrong with confidence. `LIVE_FACTS` below names them so the screen can say,
 * truthfully, that it does not know and who does.
 *
 * Atlas is the better source for ski areas and is read first when it is
 * connected (`src/app/snow/_server/atlas.ts`); this list is the floor that
 * keeps the Experience useful when Atlas is not answering, in the spirit of
 * ADR 008 (curated places beside Atlas).
 */
export interface Mountain {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  /** Approximate — good for "how far", not for navigation. */
  readonly latitude: number;
  readonly longitude: number;
  /** The resort's own site, where the real conditions and prices live. */
  readonly site: string;
}

export const MOUNTAINS: readonly Mountain[] = [
  {
    id: "whistler-blackcomb",
    name: "Whistler Blackcomb",
    region: "Sea to Sky, BC",
    latitude: 50.1163,
    longitude: -122.9574,
    site: "https://www.whistlerblackcomb.com",
  },
  {
    id: "cypress",
    name: "Cypress Mountain",
    region: "North Shore, BC",
    latitude: 49.3966,
    longitude: -123.204,
    site: "https://www.cypressmountain.com",
  },
  {
    id: "grouse",
    name: "Grouse Mountain",
    region: "North Shore, BC",
    latitude: 49.3799,
    longitude: -123.0815,
    site: "https://www.grousemountain.com",
  },
  {
    id: "seymour",
    name: "Mount Seymour",
    region: "North Shore, BC",
    latitude: 49.3678,
    longitude: -122.9459,
    site: "https://mtseymour.ca",
  },
  {
    id: "mount-washington",
    name: "Mount Washington",
    region: "Comox Valley, BC",
    latitude: 49.743,
    longitude: -125.301,
    site: "https://www.mountwashington.ca",
  },
  {
    id: "sun-peaks",
    name: "Sun Peaks",
    region: "Thompson-Okanagan, BC",
    latitude: 50.883,
    longitude: -119.886,
    site: "https://www.sunpeaksresort.com",
  },
  {
    id: "silverstar",
    name: "SilverStar",
    region: "Thompson-Okanagan, BC",
    latitude: 50.359,
    longitude: -119.062,
    site: "https://www.skisilverstar.com",
  },
  {
    id: "big-white",
    name: "Big White",
    region: "Thompson-Okanagan, BC",
    latitude: 49.7217,
    longitude: -118.9317,
    site: "https://www.bigwhite.com",
  },
  {
    id: "apex",
    name: "Apex Mountain",
    region: "Similkameen, BC",
    latitude: 49.392,
    longitude: -119.908,
    site: "https://www.apexresort.com",
  },
  {
    id: "revelstoke",
    name: "Revelstoke Mountain Resort",
    region: "Columbia, BC",
    latitude: 51.005,
    longitude: -118.164,
    site: "https://www.revelstokemountainresort.com",
  },
  {
    id: "red-mountain",
    name: "RED Mountain",
    region: "Kootenay, BC",
    latitude: 49.105,
    longitude: -117.845,
    site: "https://www.skiredmtn.com",
  },
  {
    id: "fernie",
    name: "Fernie Alpine Resort",
    region: "Kootenay Rockies, BC",
    latitude: 49.463,
    longitude: -115.088,
    site: "https://www.skifernie.com",
  },
  {
    id: "kicking-horse",
    name: "Kicking Horse",
    region: "Golden, BC",
    latitude: 51.297,
    longitude: -117.048,
    site: "https://kickinghorseresort.com",
  },
  {
    id: "lake-louise",
    name: "Lake Louise Ski Resort",
    region: "Banff National Park, AB",
    latitude: 51.443,
    longitude: -116.162,
    site: "https://www.skilouise.com",
  },
  {
    id: "sunshine",
    name: "Banff Sunshine",
    region: "Banff National Park, AB",
    latitude: 51.078,
    longitude: -115.764,
    site: "https://www.skibanff.com",
  },
];

export function mountainById(id: string | undefined): Mountain | undefined {
  return MOUNTAINS.find((m) => m.id === id);
}

/**
 * **The things a ski day turns on that Passport does not know.**
 *
 * Shown as such, beside where to find out. The wording is the product's
 * promise: no invented snow, no invented lifts.
 */
export const LIVE_FACTS = [
  { key: "snow", label: "Snow conditions" },
  { key: "lifts", label: "Lift status" },
  { key: "trails", label: "Trail & run openings" },
  { key: "tickets", label: "Lift ticket prices" },
] as const;

export type Origin = {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
};

/** Where a crew usually leaves from. Chosen by a person, never guessed. */
export const ORIGINS: readonly Origin[] = [
  {
    id: "vancouver",
    name: "Vancouver",
    latitude: 49.2827,
    longitude: -123.1207,
  },
  { id: "victoria", name: "Victoria", latitude: 48.4284, longitude: -123.3656 },
  { id: "kamloops", name: "Kamloops", latitude: 50.6745, longitude: -120.3273 },
  { id: "kelowna", name: "Kelowna", latitude: 49.888, longitude: -119.496 },
  { id: "calgary", name: "Calgary", latitude: 51.0447, longitude: -114.0719 },
];

export interface MountainFilter {
  readonly from?: { latitude: number; longitude: number };
  /** Straight-line kilometres at most. */
  readonly withinKm?: number;
  readonly query?: string;
}

export interface MountainRow extends Mountain {
  /** Straight-line distance, when an origin is known. Not a drive time. */
  readonly km?: number;
}

/** Nearest first when an origin is known, otherwise as listed. */
export function findMountains(
  list: readonly Mountain[],
  filter: MountainFilter = {},
): MountainRow[] {
  const q = filter.query?.trim().toLowerCase();
  return list
    .map((m): MountainRow => {
      const km = filter.from
        ? Math.round(distanceKm(filter.from, m))
        : undefined;
      return km === undefined ? m : { ...m, km };
    })
    .filter((m) => !q || `${m.name} ${m.region}`.toLowerCase().includes(q))
    .filter(
      (m) =>
        filter.withinKm === undefined ||
        m.km === undefined ||
        m.km <= filter.withinKm,
    )
    .sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
}
