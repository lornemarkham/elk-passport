import type { Adventure, Reading } from "../adventure/contracts";
import { NO_ROUTING, type Leg } from "../adventure/feasibility";
import {
  AREA_POINT_NOTE,
  travelLegsQuestionProblems,
  type LegReading,
  type TravelLegsAnswer,
  type TravelLegsQuestion,
  type TravelMode,
} from "./contracts";

/**
 * **An Adventure's hops, asked of Atlas, and the answers put back on them.**
 *
 * ```
 * legsOf(adventure)                        the hops, straight-line, no minutes
 *   → adventureTravelQuestion(adventure)   Atlas ids in order + a rounded origin
 *   → Atlas GET /travel/legs               (travel-legs/1; not deployed)
 *   → readTravelLegsAnswer(status, body)   one checked reading per hop
 *   → withTravel(legs, answer)             Leg.travelMinutes filled where routed
 *   → assessFeasibility(adventure, legs)   unchanged: it trusts only minutes
 *                                          whose source is `routing`
 * ```
 *
 * Atlas answers one leg per stop after the origin, which is exactly what
 * `legsOf` produces, so the two line up by index. This is the Adventure's half
 * of the seam lane `maps` builds for a `DayPlanned`; it sends nothing itself.
 */

export type AdventureTravelQuestion =
  | { readonly ok: true; readonly question: TravelLegsQuestion }
  | { readonly ok: false; readonly because: readonly string[] };

export function adventureTravelQuestion(
  adventure: Adventure,
  mode: TravelMode,
): AdventureTravelQuestion {
  const stops = adventure.moments.flatMap((m) =>
    m.kind === "subject" ? [m.subject.id] : [],
  );
  const point = adventure.constraints.origin?.point;
  const question: TravelLegsQuestion = {
    stops,
    mode,
    ...(point ? { origin: { lat: point.latitude, lng: point.longitude } } : {}),
  };
  const problems = travelLegsQuestionProblems(question);
  return problems.length > 0
    ? { ok: false, because: problems }
    : { ok: true, question };
}

/**
 * **One Atlas reading as the minutes a hop takes**, in the Adventure's own
 * `Reading` vocabulary.
 *
 * Only an `estimated` reading becomes `known`, sourced to the provider that
 * routed it. One carrying `accessCaution`, or travel-legs/1's `areaPoint` (a
 * point inside a park, not its entrance), does not: ADR 097 says those
 * minutes "should not decide anything unchecked", and feasibility decides.
 * The other states keep apart what M147 found Passport conflating: a route
 * that does not exist, a provider that failed, and a place with no point.
 */
export function travelMinutesReading(
  answer: LegReading | undefined,
): Reading<number> {
  if (!answer) return { state: "unknown", because: NO_ROUTING };
  if (!answer.ok) return { state: "unknown", because: answer.because };
  const reading = answer.reading;
  switch (reading.state) {
    case "estimated":
      if (reading.accessCaution || reading.areaPoint) {
        return {
          state: "unknown",
          because: `Atlas's route may not reach the way in: ${reading.accessCaution ?? AREA_POINT_NOTE}`,
        };
      }
      return {
        state: "known",
        value: reading.minutes,
        source: { by: "routing", provider: reading.provider },
        basis:
          `${reading.routeKm} km by road, estimated ${reading.calculatedAt}. ${reading.limitations.join("; ")}`.trim(),
      };
    case "unavailable":
      return reading.transient
        ? {
            state: "unknown",
            because: `Travel times are temporarily unavailable (${reading.because}); this may change.`,
          }
        : {
            state: "unknown",
            because: `No ${reading.mode} route: ${reading.because}`,
          };
    case "unsupported":
      return { state: "unknown", because: reading.because };
    case "unrouted":
      return {
        state: "unknown",
        because:
          "Atlas holds no point of its own for this place, so it cannot route to it.",
      };
    case "beyond":
      return {
        state: "unknown",
        because: reading.because ?? "Past the distance asked about.",
      };
  }
}

/** The hops, with whatever Atlas could route. Anything but `ready` changes nothing. */
export function withTravel(
  legs: readonly Leg[],
  answer: TravelLegsAnswer,
): Leg[] {
  if (answer.state !== "ready") {
    return legs.map((leg) => ({
      ...leg,
      travelMinutes: { state: "unknown", because: answer.because },
    }));
  }
  if (answer.legs.length !== legs.length) {
    throw new Error(
      `${answer.legs.length} travel readings for ${legs.length} hops`,
    );
  }
  return legs.map((leg, i) => ({
    ...leg,
    travelMinutes: travelMinutesReading(answer.legs[i]),
  }));
}
