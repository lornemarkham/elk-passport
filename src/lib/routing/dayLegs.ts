import type { DayPlanned } from "@/domain/day/build";
import { DRIVE_TIMES_UNKNOWN } from "@/domain/day/build";
import type { TravelStatus } from "./useTravelTimes";
import { chainLegs, type Leg, type LegEnd, type TravelTotal } from "./legs";

/**
 * **The legs of a planned day**, and which leg arrives at which stop.
 *
 * A day built from a town starts there and comes back: the town's centre is
 * the start, which is a public point and still leaves Passport rounded to
 * ~1 km like any start. A day with no town has no start and no way home, so
 * its first stop has no leg arriving at it.
 */
export function dayLegs(day: DayPlanned): {
  readonly legs: readonly Leg[];
  /** `into[i]` is the index in `legs` of the leg arriving at stop `i`. */
  readonly into: readonly (number | undefined)[];
  /** The index of the leg back to the start, when there is one. */
  readonly home?: number;
} {
  const town = day.brief.town;
  const start: LegEnd | undefined = town
    ? {
        name: town.name.replace(/,\s*BC$/, ""),
        at: { latitude: town.latitude, longitude: town.longitude },
      }
    : undefined;
  const stops: LegEnd[] = day.stops.map(({ experience }) => {
    const c = experience.geography?.coordinates;
    return {
      id: experience.id,
      name: experience.title,
      ...(c ? { at: { latitude: c[1], longitude: c[0] } } : {}),
    };
  });
  const legs = chainLegs(start, stops, { returnHome: true });
  const into = stops.map((_, i) => (start ? i : i === 0 ? undefined : i - 1));
  return {
    legs,
    into,
    ...(start && stops.length > 0 ? { home: legs.length - 1 } : {}),
  };
}

/**
 * **"Worth checking before you go", with travel said truthfully.**
 *
 * The builder always lists drive times as unknown, because the builder has no
 * routes. Once Atlas has routed every leg that is no longer true and the line
 * goes; when it routed some, the line names the legs it did not.
 */
export function unknownsWithTravel(
  unknowns: readonly string[],
  status: TravelStatus,
  total: TravelTotal,
): readonly string[] {
  if (status !== "ready" || total.kind === "none") return unknowns;
  return unknowns.flatMap((line) => {
    if (line !== DRIVE_TIMES_UNKNOWN) return [line];
    if (total.kind === "complete") return [];
    return [
      `Travel time for ${total.missing.join("; ")} — no route estimate, only a straight line.`,
    ];
  });
}
