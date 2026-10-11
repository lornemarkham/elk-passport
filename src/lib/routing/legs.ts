import { distanceKm } from "@/lib/environment/geo";
import type { Journey, TravelMode } from "./journey";

/**
 * **The journeys between the stops of a day, and what they add up to.**
 *
 * A day is a chain: from where it starts, to each stop in turn, and — when it
 * starts somewhere — back again. Each link of that chain is a `Leg`, and each
 * leg is answered on its own: Atlas's routed estimate where it has one, and a
 * straight line, labelled as one, where it does not.
 *
 * ```
 * Vernon ──► Davison Orchards ──► O'Keefe Ranch ──► back to Vernon
 *        leg 1               leg 2              leg 3
 * ```
 *
 * ## The total never fills a gap
 *
 * Minutes are summed **only** over routed legs. A day where one leg has no
 * travel time does not get one invented from its kilometres; it gets a total
 * that says *at least*, and names the leg it is missing. Missing legs can
 * only add time, so "at least" is true whatever they turn out to be.
 */

export interface LegPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** One end of a leg. A stop is an Atlas subject; a start is not. */
export interface LegEnd {
  /** The Atlas subject id. Absent for a start point — a town, or a person. */
  readonly id?: string;
  readonly name: string;
  /** Absent when Atlas has not placed it: such a leg cannot be measured. */
  readonly at?: LegPoint;
}

export interface Leg {
  readonly from: LegEnd;
  readonly to: LegEnd;
  /** Whether this leg returns to where the day started. */
  readonly home?: boolean;
}

/** A leg both of whose ends are placed: the only kind worth asking about. */
export type PlacedLeg = Leg & {
  readonly from: LegEnd & { readonly at: LegPoint };
  readonly to: LegEnd & { readonly at: LegPoint };
};

export const isPlaced = (leg: Leg): leg is PlacedLeg =>
  leg.from.at !== undefined && leg.to.at !== undefined;

/**
 * **The legs of a day, in order.** From `start` to the first stop (when there
 * is a start), between each pair of stops, and back to `start` when
 * `returnHome` is set and there is somewhere to return to.
 */
export function chainLegs(
  start: LegEnd | undefined,
  stops: readonly LegEnd[],
  { returnHome = false }: { readonly returnHome?: boolean } = {},
): readonly Leg[] {
  const ends = start ? [start, ...stops] : [...stops];
  const legs: Leg[] = [];
  for (let i = 1; i < ends.length; i += 1) {
    legs.push({ from: ends[i - 1]!, to: ends[i]! });
  }
  if (start && returnHome && stops.length > 0) {
    legs.push({ from: stops[stops.length - 1]!, to: start, home: true });
  }
  return legs;
}

/**
 * **A straight line between the two ends of a leg**, or nothing when either
 * end is unplaced. Two stated points and arithmetic; never minutes.
 */
export function straightLeg(leg: Leg): Journey | undefined {
  if (!isPlaced(leg)) return undefined;
  const km = Math.round(distanceKm(leg.from.at, leg.to.at) * 10) / 10;
  return { kind: "straight-line", km, basis: "coordinates" };
}

/**
 * **What a leg is shown as.** Atlas's routed journey wins. A leg Atlas
 * answered without a route (no road, mode not offered, unreadable) keeps that
 * answer, because "no route found" is information a straight line would hide.
 * With no answer at all, the straight line, labelled.
 */
export function shownLeg(
  leg: Leg,
  answer: Journey | undefined,
): Journey | undefined {
  return answer ?? straightLeg(leg);
}

export type TravelTotal =
  | {
      /** Every leg is routed: the sum is the provider's estimate of the day. */
      readonly kind: "complete";
      readonly mode: TravelMode;
      readonly minutes: number;
      readonly roadKm: number;
      readonly legs: number;
    }
  | {
      /** Some legs are routed. `minutes` is a floor: the rest can only add. */
      readonly kind: "partial";
      readonly mode: TravelMode;
      readonly minutes: number;
      readonly routed: number;
      readonly legs: number;
      /** "Fintry Provincial Park → Vernon", for each leg with no time. */
      readonly missing: readonly string[];
    }
  | { readonly kind: "none"; readonly legs: number };

/**
 * **The day's travel, summed only from what was routed.**
 *
 * `answers[i]` is Atlas's journey for `legs[i]`, or `undefined` where there is
 * none. A routed answer in a different mode than asked is not counted: a
 * walk's minutes are not a drive's.
 */
export function travelTotal(
  legs: readonly Leg[],
  answers: readonly (Journey | undefined)[],
  mode: TravelMode,
): TravelTotal {
  let minutes = 0;
  let roadKm = 0;
  let routed = 0;
  const missing: string[] = [];
  legs.forEach((leg, i) => {
    const answer = answers[i];
    if (answer?.kind === "routed" && answer.mode === mode) {
      minutes += answer.minutes;
      roadKm += answer.roadKm;
      routed += 1;
    } else {
      missing.push(`${leg.from.name} → ${leg.to.name}`);
    }
  });
  if (legs.length === 0 || routed === 0) {
    return { kind: "none", legs: legs.length };
  }
  if (routed === legs.length) {
    return {
      kind: "complete",
      mode,
      minutes,
      roadKm: Math.round(roadKm * 10) / 10,
      legs: legs.length,
    };
  }
  return { kind: "partial", mode, minutes, routed, legs: legs.length, missing };
}

const MODE_NOUN: Record<TravelMode, string> = {
  driving: "driving",
  walking: "walking",
  cycling: "cycling",
  transit: "transit",
};

/** `95` → `1 h 35 min`. Shared with the leg lines so a day reads one way. */
export const durationLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/**
 * **The words for a day's travel.** A headline and the caveat that must go
 * with it, as `describeJourney` does for one leg.
 *
 * `planned` is the plan's own minutes at the stops, when the caller wants the
 * whole day stated: the plan's arithmetic plus the provider's estimate, each
 * named as what it is.
 */
export function describeTravelTotal(
  total: TravelTotal,
  planned?: number,
): { readonly headline: string; readonly caveat: string } | undefined {
  if (total.kind === "none") return undefined;
  const noun = MODE_NOUN[total.mode];
  const legs = (n: number) => (n === 1 ? "1 leg" : `${n} legs`);
  const whole = (prefix: string) =>
    planned === undefined
      ? ""
      : ` With ${durationLabel(planned)} at the stops, that is ${prefix}${durationLabel(planned + total.minutes)} in all.`;
  if (total.kind === "complete") {
    return {
      headline: `${durationLabel(total.minutes)} of ${noun} across ${legs(total.legs)}`,
      caveat: `Each leg's routed estimate, added up.${whole("about ")}`,
    };
  }
  const without = total.legs - total.routed;
  return {
    headline: `At least ${durationLabel(total.minutes)} of ${noun}`,
    caveat: `${capitalise(legs(total.routed))} of ${total.legs} routed; ${without === 1 ? "this one has" : "these have"} no travel time: ${total.missing.join("; ")}.${whole("at least ")}`,
  };
}

const capitalise = (s: string): string =>
  s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
