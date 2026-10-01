/**
 * **The areas a person's October can be in.**
 *
 * Weather needs a point on the earth. Passport already stores `home_area` on
 * `passport_profiles` — "a general area in their own words", never coordinates
 * and never the device's location — and until now **nothing read it**. This
 * turns that dormant field into the thing that answers *where is your October*.
 *
 * ## Why a hand-authored list rather than a geocoder
 *
 * A geocoder would turn any string into a point, which sounds better until you
 * price it: a second external dependency, a second licence, and a product that
 * confidently returns the weather in Vernon, Texas. This product serves one
 * valley. Twenty areas cover it, every coordinate is verified against Wikidata,
 * and an unrecognised area produces **no weather** rather than a plausible
 * wrong one.
 *
 * It is also a better control. A picker that offers Lumby is more useful than
 * a text box that accepts "lumby bc" and silently fails to match.
 *
 * ## Approximate on purpose
 *
 * These are town centroids, good to a kilometre or so. That is the correct
 * precision for *will the sky be clear on Thursday* and this product should not
 * pretend to more. Nobody needs forensic geography to decide whether to drive
 * out and look up.
 */

export interface OctoberPlace {
  /** Stored in `passport_profiles.home_area`. Stable; never re-spelled. */
  readonly id: string;
  /** What a person reads and picks. Also what is stored, for legibility. */
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Verified against Wikidata (P625) on 2026-10-01, not recalled. Ordered
 * roughly north to south through the valley, then the places people actually
 * drive to in order to get away from the light.
 */
export const OCTOBER_PLACES: readonly OctoberPlace[] = [
  {
    id: "revelstoke",
    name: "Revelstoke, BC",
    latitude: 50.9981,
    longitude: -118.196,
  },
  { id: "golden", name: "Golden, BC", latitude: 51.3019, longitude: -116.967 },
  {
    id: "salmon-arm",
    name: "Salmon Arm, BC",
    latitude: 50.7022,
    longitude: -119.2722,
  },
  { id: "enderby", name: "Enderby, BC", latitude: 50.5508, longitude: -119.14 },
  {
    id: "falkland",
    name: "Falkland, BC",
    latitude: 50.5014,
    longitude: -119.5583,
  },
  {
    id: "armstrong",
    name: "Armstrong, BC",
    latitude: 50.4483,
    longitude: -119.196,
  },
  { id: "vernon", name: "Vernon, BC", latitude: 50.267, longitude: -119.272 },
  {
    id: "coldstream",
    name: "Coldstream, BC",
    latitude: 50.22,
    longitude: -119.248,
  },
  { id: "lumby", name: "Lumby, BC", latitude: 50.25, longitude: -118.967 },
  {
    id: "cherryville",
    name: "Cherryville, BC",
    latitude: 50.2333,
    longitude: -118.617,
  },
  {
    id: "lake-country",
    name: "Lake Country, BC",
    latitude: 50.0833,
    longitude: -119.414,
  },
  {
    id: "kelowna",
    name: "Kelowna, BC",
    latitude: 49.8801,
    longitude: -119.4436,
  },
  {
    id: "west-kelowna",
    name: "West Kelowna, BC",
    latitude: 49.8625,
    longitude: -119.583,
  },
  {
    id: "peachland",
    name: "Peachland, BC",
    latitude: 49.7736,
    longitude: -119.7369,
  },
  {
    id: "big-white",
    name: "Big White, BC",
    latitude: 49.7219,
    longitude: -118.929,
  },
  {
    id: "summerland",
    name: "Summerland, BC",
    latitude: 49.6006,
    longitude: -119.6778,
  },
  {
    id: "penticton",
    name: "Penticton, BC",
    latitude: 49.4911,
    longitude: -119.5886,
  },
  { id: "oliver", name: "Oliver, BC", latitude: 49.1828, longitude: -119.551 },
  {
    id: "osoyoos",
    name: "Osoyoos, BC",
    latitude: 49.0325,
    longitude: -119.4661,
  },
  {
    id: "kamloops",
    name: "Kamloops, BC",
    latitude: 50.6761,
    longitude: -120.341,
  },
];

const BY_NAME = new Map(
  OCTOBER_PLACES.map((a) => [a.name.toLowerCase(), a] as const),
);
const BY_ID = new Map(OCTOBER_PLACES.map((a) => [a.id, a] as const));

/**
 * The area a stored `home_area` names, or `undefined`.
 *
 * Tolerant of the two spellings a person could plausibly have left in the
 * free-text field this replaces — "Vernon, BC" and "Vernon" — and of nothing
 * else. **No fuzzy matching:** a near-miss that resolves to the wrong town is
 * the exact failure this whole module is shaped to avoid, and `undefined` is a
 * perfectly good answer that makes October say nothing.
 */
export function placeFrom(
  homeArea: string | null | undefined,
): OctoberPlace | undefined {
  if (!homeArea) return undefined;
  const key = homeArea.trim().toLowerCase();
  if (!key) return undefined;
  return (
    BY_ID.get(key) ?? BY_NAME.get(key) ?? BY_NAME.get(`${key}, bc`) ?? undefined
  );
}

export const placeById = (id: string): OctoberPlace | undefined =>
  BY_ID.get(id);
