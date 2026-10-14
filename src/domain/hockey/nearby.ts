import { normaliseSubtype } from "@/domain/discovery/defaultFeed";
import { intentByKey } from "@/domain/discovery/intents";
import { distanceKm } from "@/lib/environment/geo";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Somewhere to argue about before the game.**
 *
 * The lab's README named this as the single highest-value Atlas request: "three
 * to five real places near the anchor, with a walking time, one honest
 * sentence, and enough for someone to have an opinion" — and was precise that
 * it is *not* a ranked recommendation. It is a set of options that will start
 * an argument. Passport offers; the group chooses, by the vote the lab already
 * built.
 *
 * Nothing here is a new place database. The candidates are Discovery's own
 * (`discoveryCandidates()`), "food" means exactly what Discovery's **Eat &
 * drink** intent means (`intents.ts`), and distance comes from Atlas where it
 * measured one and otherwise from the place's own observed coordinates.
 *
 * ## What the distance is, said every time
 *
 * There is no routing anywhere in Passport — no walking network, no transit,
 * nothing that knows Rogers Arena has a parking structure in the way. So every
 * figure is a **straight line**, and the walking time is a straight line at an
 * ordinary walking pace, which a real walk can only be longer than. The label
 * says both. A place whose position Atlas only *derived* (a town centre, a
 * venue it is "at") is not measured at all: "0.4 km" from a town centroid is
 * a fiction with a decimal point.
 */

export interface NearbyPlace {
  readonly atlasId: string;
  readonly name: string;
  readonly subtype?: string;
  readonly blurb?: string;
  readonly heroUrl?: string;
  readonly km: number;
  /** Straight-line kilometres at 5 km/h. A floor, never a promise. */
  readonly walkMinutes: number;
  readonly basis: "straight-line";
}

const EAT = new Set([...intentByKey("eat").subtypes].map(normaliseSubtype));
const WALKING_KMH = 5;

/** The words an option carries onto the vote, so the estimate travels with it. */
export function walkLabel(
  place: Pick<NearbyPlace, "km" | "walkMinutes">,
): string {
  const distance =
    place.km < 1
      ? `${Math.round((place.km * 1000) / 50) * 50} m`
      : `${place.km.toFixed(1)} km`;
  return `${distance} straight line · ${place.walkMinutes}+ min walk (estimate)`;
}

function measured(
  candidate: DiscoveryCandidate,
  venue: readonly [number, number],
): number | undefined {
  const d = candidate.distance;
  if (d?.state === "measured" && d.basis === "coordinates") return d.km;
  const geo = candidate.geography;
  if (geo?.coordinates && geo.coordinatesBasis === "observed") {
    const [lng, lat] = geo.coordinates;
    return distanceKm(
      { latitude: venue[0], longitude: venue[1] },
      { latitude: lat, longitude: lng },
    );
  }
  return undefined;
}

export function nearbyFood(
  candidates: readonly DiscoveryCandidate[],
  venue: readonly [number, number],
  { withinKm = 1.6, limit = 12 }: { withinKm?: number; limit?: number } = {},
): NearbyPlace[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => EAT.has(normaliseSubtype(c.subtype)))
    .flatMap((c) => {
      const km = measured(c, venue);
      if (km === undefined || km > withinKm || seen.has(c.id)) return [];
      seen.add(c.id);
      return [
        {
          atlasId: c.id,
          name: c.name,
          subtype: c.subtype,
          blurb: c.description?.split(/(?<=\.)\s/)[0]?.slice(0, 140),
          heroUrl: c.heroUrl,
          km,
          walkMinutes: Math.max(1, Math.ceil((km / WALKING_KMH) * 60)),
          basis: "straight-line" as const,
        },
      ];
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
