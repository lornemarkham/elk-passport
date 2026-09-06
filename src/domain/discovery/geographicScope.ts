import type { Experience } from "@/domain/experience/types";

/**
 * **Where Passport is currently looking.**
 *
 * ## Two different questions, deliberately not collapsed
 *
 * ```
 * Coordinates        answer   WHERE IS IT?
 * Region membership  answers  WHAT RECOGNISED AREA DOES IT BELONG TO?
 * ```
 *
 * An Atlas Region is a **curated, asserted** thing — the Okanagan is a cultural
 * and touristic destination, not a rectangle anyone agreed on (ADR 025), and
 * membership in it is a claim a person or a publisher made. A radius, a map
 * viewport and a hand-drawn trip area are the other question entirely: pure
 * geometry, decided from coordinates, needing nobody's assertion.
 *
 * The first version of this seam had a single `activeRegionId()`, which quietly
 * asserted that every geographic question Passport could ask was a question
 * about an Atlas Region. It is not. *"Everything within 20 km of here"* and
 * *"everything in this viewport"* are ordinary things for a traveller to want,
 * and neither should require somebody to curate a Region first.
 *
 * So the scope is a union, and the region case is one member of it rather than
 * the shape of the whole thing.
 *
 * ## What is implemented today
 *
 * `atlas-region` only. The coordinate-based kinds are declared because declaring
 * them is what proves the seam holds — every consumer already switches on
 * `kind`, so adding an evaluator later touches this file and nothing else. They
 * are not implemented, and `matchesScope` says so loudly rather than guessing.
 *
 * ## Atlas stays the authority on membership
 *
 * `atlas-region` reads `Experience.regionIds`, which is what Atlas asserted.
 * **Passport never decides region membership from coordinates.** Doing so would
 * be the bounding-box inference ADR 025 rejects, reimplemented one layer up
 * where Atlas could not see it. A coordinate scope answers a coordinate
 * question; it never answers "is this in the Okanagan".
 *
 * ## Fail closed, both ways
 *
 * An entity Atlas placed in no region does not match an `atlas-region` scope —
 * 125 of 187 live candidates are unplaced, and a scope must exclude them rather
 * than adopt them. An entity with no coordinates will not match a coordinate
 * scope either, for the same reason: undecidable is not the same as inside.
 */

/** Every geographic question Passport can currently ask, or will be able to. */
export type GeographicScope =
  /** Membership Atlas asserted. The only kind with an evaluator today. */
  | {
      readonly kind: "atlas-region";
      readonly regionId: string;
      readonly label: string;
    }
  /** Everything within `km` of a point. Not implemented. */
  | {
      readonly kind: "radius";
      readonly centre: readonly [longitude: number, latitude: number];
      readonly km: number;
      readonly label: string;
    }
  /** A map viewport. Not implemented. */
  | {
      readonly kind: "bounding-box";
      readonly southWest: readonly [longitude: number, latitude: number];
      readonly northEast: readonly [longitude: number, latitude: number];
      readonly label: string;
    }
  /** An arbitrary area — a drawn trip area, a hunting management unit. Not implemented. */
  | {
      readonly kind: "polygon";
      readonly ring: readonly (readonly [
        longitude: number,
        latitude: number,
      ])[];
      readonly label: string;
    };

/** The label a traveller sees for the area they are looking at. */
export function scopeLabel(
  scope: GeographicScope | undefined,
): string | undefined {
  return scope?.label;
}

/** Whether this experience is inside the scope. No scope means everywhere. */
export function matchesScope(
  experience: Experience,
  scope: GeographicScope | undefined,
): boolean {
  if (!scope) return true;

  switch (scope.kind) {
    case "atlas-region":
      // Asserted membership, read from Atlas. Never derived here.
      return experience.regionIds.includes(scope.regionId);

    case "radius":
    case "bounding-box":
    case "polygon":
      throw new Error(
        `GeographicScope: "${scope.kind}" is declared but has no evaluator yet. ` +
          "Passport holds no coordinate index and would have to guess, so it refuses rather than " +
          "returning an answer nobody can check. Add the evaluator here — every consumer already " +
          "switches on `kind`, so nothing else changes.",
      );

    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
}

/**
 * Narrow a list to the scope — applied to the whole pool, so browse, search and
 * the default feed all obey one scope rather than three.
 */
export function scopeExperiences(
  experiences: readonly Experience[],
  scope: GeographicScope | undefined,
): Experience[] {
  if (!scope) return [...experiences];
  return experiences.filter((experience) => matchesScope(experience, scope));
}
