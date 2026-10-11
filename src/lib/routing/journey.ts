import type { CandidateDistance } from "@/lib/data/types";
import { AREA_POINT_NOTE } from "@/lib/domains/travel/contracts";

/**
 * **How far, measured how, and on whose word** — Passport's side of Atlas ADR
 * 097.
 *
 * Three different facts get called "distance", and they do not collapse:
 *
 * ```
 * straight-line   km between two points. Atlas's `candidate-distance/1`, or
 *                 `distanceKm()` in the browser. No minutes, ever: it is a
 *                 lower bound on the road, not an estimate of it.
 * routed          a routing provider's answer over a real road network:
 *                 minutes AND road km, from Atlas, with the provider named,
 *                 when it was calculated and what it leaves out.
 * no answer       the provider could not route it (`no-route`), the mode is
 *                 not configured (`unsupported`), or nobody asked (`unknown`).
 * ```
 *
 * There is deliberately **no "estimated road distance" derived from a straight
 * line.** Atlas's probe (ADR 097) measured road/straight ratios from 1.12 to
 * 2.75 out of Vernon — Fintry is 22 km across the lake and 61 minutes around
 * it — so any single detour factor is wrong for exactly the places where it
 * matters. Road km exists here only as the provider's `routeKm`.
 *
 * Nothing in this file turns kilometres into minutes. A `straight-line`
 * journey has no `minutes` field to fill, so a caller cannot do it by
 * accident either.
 */

/** Atlas's `TravelMode`, verbatim. Which ones are answered is Atlas's to say. */
export type TravelMode = "driving" | "walking" | "cycling" | "transit";

export const TRAVEL_MODES: readonly TravelMode[] = [
  "driving",
  "walking",
  "cycling",
  "transit",
];

export const isTravelMode = (value: unknown): value is TravelMode =>
  typeof value === "string" && (TRAVEL_MODES as string[]).includes(value);

export type Journey =
  | {
      readonly kind: "straight-line";
      readonly km: number;
      /** `town`: to a town's centre, which can be several km from the door. */
      readonly basis: "coordinates" | "town";
      readonly town?: string;
    }
  | {
      readonly kind: "routed";
      readonly mode: TravelMode;
      /** Whole minutes, rounded up by Atlas. The provider's estimate. */
      readonly minutes: number;
      /** Kilometres along the route the provider found. */
      readonly roadKm: number;
      /** For comparison only. Never a substitute for `roadKm`. */
      readonly straightKm: number;
      readonly provider: string;
      readonly calculatedAt: string;
      readonly limitations: readonly string[];
      /** The route crawls: the point may be inside the site, not its gate. */
      readonly accessCaution?: string;
      /**
       * travel-legs/1: the route ends at a point inside a park, beach or trail
       * (often its centroid) because Atlas holds no way in. The minutes are
       * not the time to the entrance.
       */
      readonly areaPoint?: true;
    }
  | {
      readonly kind: "no-route";
      readonly mode: TravelMode;
      readonly provider: string;
      readonly because: string;
    }
  | {
      readonly kind: "unsupported";
      readonly mode: TravelMode;
      readonly provider: string;
      readonly because: string;
    }
  | { readonly kind: "unknown"; readonly because: string };

/**
 * **Atlas's straight-line reading as a journey**, or nothing where Atlas has
 * no distance to give. `bounded`, `conflicting` and `unknown` readings are not
 * a straight line to anywhere, so they do not become one here.
 */
export function straightLineJourney(
  distance: CandidateDistance | undefined,
): Journey | undefined {
  if (distance?.state !== "measured") return undefined;
  return {
    kind: "straight-line",
    km: distance.km,
    basis: distance.basis,
    ...(distance.basis === "town" && distance.town
      ? { town: distance.town }
      : {}),
  };
}

/**
 * **A routed time that must not decide anything unchecked** (ADR 097): one
 * with an access caution, or one that routes to a point inside an area
 * (`areaPoint`). Shown with its caveat; never in a pill, a total or a "within".
 */
export function isCautioned(journey: Journey | undefined): boolean {
  return (
    journey?.kind === "routed" &&
    (journey.accessCaution !== undefined || journey.areaPoint === true)
  );
}

/** The caution to print beside a cautioned journey, or nothing. */
export function cautionOf(journey: Journey | undefined): string | undefined {
  if (journey?.kind !== "routed") return undefined;
  return (
    journey.accessCaution ?? (journey.areaPoint ? AREA_POINT_NOTE : undefined)
  );
}

/**
 * "Within N minutes": yes, no, or Passport cannot say. Only a routed journey
 * answers; a straight line answers `undefined`, however short it is, and so
 * does a cautioned one — its minutes may be to the middle of a park.
 */
export function withinMinutes(
  journey: Journey | undefined,
  minutes: number,
): boolean | undefined {
  return journey?.kind === "routed" && !isCautioned(journey)
    ? journey.minutes <= minutes
    : undefined;
}

const MODE_WORD: Record<TravelMode, string> = {
  driving: "drive",
  walking: "walk",
  cycling: "ride",
  transit: "by transit",
};

const kmLabel = (km: number): string =>
  km < 1 ? "under 1 km" : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;

const minutesLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/**
 * **A routed journey in a card's few words** — `61 min drive`.
 *
 * Only for a routed journey with no access caution: a flagged estimate needs
 * its caveat beside it, and a pill has no room for one, so the surface shows
 * the straight line instead. Everything else answers `undefined`.
 */
export function routedShort(journey: Journey | undefined): string | undefined {
  if (journey?.kind !== "routed" || isCautioned(journey)) return undefined;
  return `${minutesLabel(journey.minutes)} ${MODE_WORD[journey.mode]}`;
}

/**
 * **The words for a journey**, as a headline and the caveat that must travel
 * with it. One function, so every surface says the same honest thing.
 *
 * A straight line always says "in a straight line" and never names a mode. A
 * routed journey always names its provider. Neither sentence is optional.
 */
export function describeJourney(journey: Journey): {
  readonly headline: string;
  readonly caveat: string;
} {
  switch (journey.kind) {
    case "straight-line":
      return {
        headline:
          journey.basis === "town" && journey.town
            ? `${capitalise(kmLabel(journey.km))} in a straight line to ${journey.town}'s centre`
            : `${capitalise(kmLabel(journey.km))} in a straight line`,
        caveat: "Not a travel time. Roads, lakes and hills are not counted.",
      };
    case "routed": {
      // An area's interior point is not its way in: the headline says where
      // the minutes go, so they are never read as the time to the entrance.
      const mode = `${MODE_WORD[journey.mode]}${journey.areaPoint ? " to a point inside it" : ""}`;
      const headline =
        journey.mode === "transit"
          ? `${minutesLabel(journey.minutes)} ${mode} · ${kmLabel(journey.roadKm)}`
          : `${minutesLabel(journey.minutes)} ${mode} · ${kmLabel(journey.roadKm)} by road`;
      const caution = cautionOf(journey);
      const caveat = [
        `Estimated by ${journey.provider}`,
        ...journey.limitations,
        ...(caution ? [caution] : []),
      ].join("; ");
      return { headline, caveat: `${caveat}.` };
    }
    case "no-route":
      return {
        headline: `No ${journey.mode} route found`,
        caveat: `${capitalise(journey.because)} (${journey.provider}).`,
      };
    case "unsupported":
      return {
        headline: `No ${journey.mode} times available`,
        caveat: `${capitalise(journey.because)}.`,
      };
    case "unknown":
      return {
        headline: "Travel time unknown",
        caveat: `${capitalise(journey.because)}.`,
      };
  }
}

const capitalise = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
