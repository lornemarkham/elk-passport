import { distanceKm } from "@/lib/environment/geo";

/**
 * **Curated places: a short list Passport states itself, for one city.**
 *
 * `editorial.ts` is Passport saying a real Atlas Thing belongs somewhere. This
 * is the other case: a handful of places an Experience needs *now* — where we
 * eat before the game, where we meet, what is near the conference hall — that
 * it cannot wait for Atlas ingestion to know. Hockey Night and Go Have A
 * Conference are both in downtown Vancouver, so they share one list instead of
 * each inventing its own.
 *
 * ## What "verified" means here, and what it does not
 *
 * Every place carries where its address and coordinates came from
 * (`source.osm`, an OpenStreetMap element, checked on `source.checked`) and,
 * where a web check confirmed it is still trading, `source.web`. Nothing here
 * knows opening hours, prices or tonight's wait. A place that closes is
 * removed by a person, not detected.
 *
 * ## The path to Atlas
 *
 * `atlasId` is empty today. When Atlas holds the place, set it: consumers
 * already prefer the Atlas record (media, description, measured distance) and
 * fall back to this entry only where Atlas has nothing. The OSM reference is
 * what an Atlas ingest would match on. Nothing else about the list changes.
 */

export type CuratedKind =
  "restaurant" | "bar" | "meeting" | "venue" | "activity";

export interface CuratedPlace {
  /** `curated:<city>:<slug>`. Stable: votes and nominations store it. */
  readonly id: string;
  readonly name: string;
  readonly kind: CuratedKind;
  readonly address: string;
  readonly neighbourhood: string;
  /** [lat, lng], as OpenStreetMap places it. */
  readonly at: readonly [number, number];
  /** One honest sentence a person could have an opinion about. */
  readonly blurb: string;
  readonly source: {
    readonly osm: string;
    readonly checked: string;
    readonly web?: string;
  };
  /** Set when Atlas holds the same place. Atlas then wins. */
  readonly atlasId?: string;
}

export interface CuratedNearby {
  readonly place: CuratedPlace;
  readonly km: number;
  /** Straight-line kilometres at 5 km/h. A floor, never a promise. */
  readonly walkMinutes: number;
}

const WALKING_KMH = 5;

export const walkMinutesFor = (km: number): number =>
  Math.max(1, Math.ceil((km / WALKING_KMH) * 60));

/**
 * How far, in words that say it is a straight line and an estimate. Hockey's
 * ballot and Conference's list both carry it, so the caveat travels with it.
 */
export function walkLabel(place: {
  readonly km: number;
  readonly walkMinutes: number;
}): string {
  const distance =
    place.km < 1
      ? `${Math.round((place.km * 1000) / 50) * 50} m`
      : `${place.km.toFixed(1)} km`;
  return `${distance} straight line · ${place.walkMinutes}+ min walk (estimate)`;
}

/** Places of the given kinds within `withinKm` of a point, nearest first. */
export function curatedNear(
  places: readonly CuratedPlace[],
  at: readonly [number, number],
  {
    kinds,
    withinKm = 1.6,
  }: { kinds?: readonly CuratedKind[]; withinKm?: number } = {},
): CuratedNearby[] {
  return places
    .filter((p) => !kinds || kinds.includes(p.kind))
    .map((place) => {
      const km = distanceKm(
        { latitude: at[0], longitude: at[1] },
        { latitude: place.at[0], longitude: place.at[1] },
      );
      return { place, km, walkMinutes: walkMinutesFor(km) };
    })
    .filter((n) => n.km <= withinKm)
    .sort((a, b) => a.km - b.km);
}

/**
 * Whether two names are the same place, loosely: case, punctuation, a
 * leading "The" and trailing venue words do not count. Used only to avoid
 * listing a curated place beside its own Atlas record.
 */
export function sameName(a: string, b: string): boolean {
  const key = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/^\s*the\s+/, "")
      .replace(/\b(restaurant|pub|bar|brewpub|brew pub|cafe)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return key(a) === key(b);
}
