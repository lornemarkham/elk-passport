import { entityReadiness } from "@/lib/knowledge/passportReadiness";
import type { DiscoveryCandidate, Place } from "@/lib/data/types";
import type { Experience } from "./types";

/**
 * An Atlas discovery candidate, as Passport presents it.
 *
 * ## What this deliberately no longer does
 *
 * It used to be `placeToExperience(place: Place)` — Place-only by signature,
 * which is why `The BullWheel` (an Organization with 49 photographs and a real
 * containment edge from Big White) could not appear in Discover at all.
 *
 * It also used to *fabricate*: `seasons: ["summer"]`, `companions`,
 * `energyLevel: 2`, `priceLevel: 0`, a 60–90 minute duration, `familyFriendly:
 * true` and `petFriendly: false`, identical for every one of the 65 places —
 * which told a traveller Ellison Park was not pet-friendly while its Atlas
 * record confirmed *Pets on leash*. Those fields still exist on `Experience`
 * for the hand-authored seed content, and this mapper now leaves every one of
 * them empty rather than answering a question Atlas cannot.
 *
 * `tier` is gone entirely. It was fabricated as `3` for every record, nothing
 * read it, and structural depth does not determine discovery significance.
 */
export function candidateToExperience(
  candidate: DiscoveryCandidate,
): Experience {
  return {
    id: candidate.id,
    kind: candidate.kind,
    slug: candidate.name.toLowerCase().replaceAll(" ", "-"),
    title: candidate.name,
    aliases: candidate.aliases ?? [],
    shortDescription: candidate.description,
    description: candidate.description,
    subtype: candidate.subtype,
    context: candidate.context,
    containsCount: candidate.containsCount,
    // Carried, not invented. This is the field Passport used to drop on the
    // floor, which is why region scope had nothing to filter on.
    regionIds: candidate.regionIds ?? [],
    // What Atlas knows about when this is on, for everything that is not an
    // Event. Carried, never derived: the days are Atlas's reading of a
    // publisher's own claim, and a missing day list is not an empty schedule.
    ...(candidate.availability ? { availability: candidate.availability } : {}),
    // The whole this is one part of, when Atlas asserts an `includes` edge.
    // Carried, never guessed: a shared name groups nothing.
    ...(candidate.partOf ? { partOf: candidate.partOf } : {}),
    // Derived here, from the same function the admin surfaces use, so there is
    // one definition of "has enough for its own page". It decides the
    // destination and never whether the candidate appears — a strong Activity
    // is discoverable long before it is page-ready.
    detailReady: entityReadiness({
      id: candidate.id,
      kind: candidate.kind,
      name: candidate.name,
      description: candidate.description,
      imageUrl: candidate.heroUrl,
      geometry: candidate.coordinates
        ? { type: "Point", coordinates: candidate.coordinates }
        : undefined,
    }).ready,
    heroMedia: candidate.heroUrl
      ? { type: "image", src: candidate.heroUrl }
      : undefined,

    // Atlas states none of these. Empty is the honest answer; the filters that
    // read them are answered from real fields or not offered at all.
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,

    location: candidate.coordinates
      ? {
          name: candidate.context?.name ?? candidate.name,
          longitude: candidate.coordinates[0],
          latitude: candidate.coordinates[1],
        }
      : undefined,
    isActive: true,
  };
}

/**
 * The Place-shaped path, kept for callers that still hold a `Place` rather than
 * a candidate. Expressed in terms of `candidateToExperience` so there is one
 * mapping rather than two that can drift.
 */
export function placeToExperience(place: Place): Experience {
  return candidateToExperience({
    id: place.id,
    kind: "Place",
    name: place.name,
    subtype: place.placeType,
    description: place.description,
    heroUrl: place.imageUrl,
    mediaCount: place.imageUrl ? 1 : 0,
    coordinates: place.geometry?.coordinates,
    containsCount: 0,
    regionIds: [],
  });
}
