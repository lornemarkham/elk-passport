import type { Experience } from "@/domain/experience/types";
import { SECTION_PAGES, SECTION_SIZE, type DiscoverySection } from "./compose";
import { distanceKm } from "@/lib/environment/geo";
import type { Point } from "./situation";

/**
 * **What Passport may say about how far away something is.**
 *
 * Measured against the live corpus on 2026-10-10 — 2,683 candidates:
 *
 * ```
 * coordinates stated      496   the only evidence that answers "how far"
 * locality but no coords  370   placeable by a person, not by arithmetic
 * nothing at all        1,813   state: unknown
 * ```
 *
 * So **two candidates in three cannot be placed at all**, and any presentation
 * that sorted by distance would be sorting 18% of the product and silently
 * burying the rest. That is the trap this module exists to avoid.
 *
 * ## Three answers, and the third is not a failure
 *
 * ```
 * near      Atlas states coordinates, and they are within NEAR_KM of the person
 * far       Atlas states coordinates, and they are not
 * unplaced  Atlas states no coordinates. Passport does not know. Full stop.
 * ```
 *
 * `unplaced` is **not** a weaker `far`. The single most tempting mistake here
 * is to treat missing coordinates as evidence of distance — it is evidence of
 * nothing, and 1,813 of the 1,817 unplaced candidates are overwhelmingly local
 * Okanagan organisations that Atlas simply has not placed yet. Ranking them
 * below a located Vancouver concert would make the product actively worse
 * while looking more intelligent.
 *
 * ## Why a locality is not used here
 *
 * 370 candidates state a town and no coordinates. Passport could place them by
 * keeping a table of town positions, or by averaging the coordinates Atlas
 * states for other candidates in the same town. Both are Passport deriving
 * geography, which is Atlas's job and Atlas's evidence to carry — and the
 * corpus already contains `Sparkling Pl Vernon`, `Centre Pl Vernon` and
 * `OTTAWA` as "localities", so the table would be built on parsed addresses.
 *
 * A locality is still *shown* — `whereLine` has always printed it. It just
 * does not earn a distance it has no evidence for. The gap is recorded in
 * `docs/product/atlas-requirements-from-discovery.md` rather than papered over.
 */
export type Placement = "near" | "far" | "unplaced";

/**
 * How far "near you" reaches, in kilometres.
 *
 * A product judgement, not a fact, and stated as one. Fifty kilometres is
 * about forty minutes on the valley highway, which puts Vernon and Kelowna
 * inside each other's reach — correct for a corpus where somebody asking what
 * to do today will happily drive between them, and for the question Discovery
 * is actually answering.
 *
 * Measured at this radius, from coordinates Atlas states:
 *
 * ```
 * a person in Vernon      357 near
 * a person in Kelowna     399 near
 * a person in Vancouver    29 near
 * ```
 */
export const NEAR_KM = 50;

/**
 * The distance between a person and a subject, where **both** are stated.
 *
 * `undefined` wherever either side is missing, which is the whole point: a
 * distance Passport cannot compute is one it must not print.
 */
export function distanceTo(
  experience: Experience,
  origin: Point | undefined,
): number | undefined {
  const coordinates = experience.geography?.coordinates;
  if (!origin || !coordinates) return undefined;
  const [longitude, latitude] = coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }
  return distanceKm(origin, { latitude, longitude });
}

export function placementOf(
  experience: Experience,
  origin: Point | undefined,
  nearKm: number = NEAR_KM,
): Placement {
  const km = distanceTo(experience, origin);
  if (km === undefined) return "unplaced";
  return km <= nearKm ? "near" : "far";
}

export interface PlacementCounts {
  readonly near: number;
  readonly far: number;
  readonly unplaced: number;
}

/**
 * The three numbers, so a surface can state them instead of implying them.
 *
 * Printing "357 near you" beside "Passport does not know where 2,187 of these
 * are" is the difference between a geographic claim and a geographic boast.
 */
export function placementCounts(
  experiences: readonly Experience[],
  origin: Point | undefined,
  nearKm: number = NEAR_KM,
): PlacementCounts {
  let near = 0;
  let far = 0;
  let unplaced = 0;
  for (const experience of experiences) {
    const placement = placementOf(experience, origin, nearKm);
    if (placement === "near") near += 1;
    else if (placement === "far") far += 1;
    else unplaced += 1;
  }
  return { near, far, unplaced };
}

/**
 * The ones Atlas has placed within reach, nearest first.
 *
 * **Only these are ordered by distance**, because only these have a distance.
 * Nothing else on the page moves: the rest of Discovery is composed exactly as
 * it was, so an unplaced candidate keeps whatever position its section gave it
 * rather than being demoted for a fact nobody knows.
 */
export function nearYou(
  experiences: readonly Experience[],
  origin: Point | undefined,
  nearKm: number = NEAR_KM,
): readonly Experience[] {
  if (!origin) return [];
  return experiences
    .map((experience) => ({
      experience,
      km: distanceTo(experience, origin),
    }))
    .filter(
      (row): row is { experience: Experience; km: number } =>
        row.km !== undefined && row.km <= nearKm,
    )
    .sort((a, b) => a.km - b.km)
    .map((row) => row.experience);
}

/**
 * A distance a card can print, in the words a person would use.
 *
 * Rounded hard on purpose. The underlying position is blunted to about a
 * kilometre before it ever leaves the browser, and a straight-line haversine
 * is not a road, so "12 km away" is already a claim at the edge of what the
 * evidence supports and "12.4 km away" would be past it.
 */
export function distanceLabel(km: number | undefined): string | undefined {
  if (km === undefined) return undefined;
  // **Not "right here".** Downtown Vernon put five cards in a row under a
  // kilometre, and five identical "Right here" badges read as a bug rather
  // than a fact. It is also past what the evidence supports: the position was
  // blunted to about a kilometre before it arrived, so sub-kilometre
  // distinctions are rounding noise and the honest claim is the bound.
  if (km < 1) return "Under 1 km away";
  return `${Math.round(km)} km away`;
}

/**
 * **The one section the person's own position earns.**
 *
 * Present only once somebody has shared where they are, and containing only
 * what Atlas has actually placed within reach. Everything below it is composed
 * exactly as it was — this is an addition to the page, never a filter on it,
 * so nothing Atlas could not place is demoted or hidden by its arrival.
 *
 * The note states the gap out loud. For a person in Vancouver this section
 * holds 29 things and the note says Passport cannot place most of what it
 * holds, which is the most useful true sentence Discovery can offer them.
 */
export function nearSection(
  experiences: readonly Experience[],
  origin: Point | undefined,
  nearKm: number = NEAR_KM,
): DiscoverySection | undefined {
  const items = nearYou(experiences, origin, nearKm);
  if (items.length === 0) return undefined;
  const { unplaced } = placementCounts(experiences, origin, nearKm);

  return {
    id: "near-you",
    title: "Near you",
    note:
      `Within ${nearKm} km of where you are, from coordinates Atlas states. ` +
      `Passport does not know where ${unplaced.toLocaleString("en-CA")} of the ` +
      `others are — they are still below, unsorted rather than ruled out.`,
    items: items.slice(0, SECTION_SIZE * SECTION_PAGES),
    size: SECTION_SIZE,
    total: items.length,
    // Timeless rather than dated. Nothing reads `shape` yet; "near you" is
    // genuinely neither an intent nor a time, and inventing a fourth member
    // for a field no presentation consults would be the bigger lie.
    shape: "intent",
  };
}
