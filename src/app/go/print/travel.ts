import type { RouteOptions, RoutedTravel } from "@/lib/analog/route";
import { attributionFor } from "@/lib/routing/attribution";
import {
  cautionOf,
  type Journey,
  type TravelMode,
} from "@/lib/routing/journey";
import { describeTravelTotal, travelTotal, type Leg } from "@/lib/routing/legs";
import type { TravelStatus } from "@/lib/routing/useTravelTimes";

/**
 * **Maps' answer, in the field guide's terms.** A routed leg is keyed by the
 * stop it arrives at, or `home` — the same keys `legsFor` prints — with its
 * access caution, so a route to the middle of a park is never printed bare.
 */
export function printTravel(
  legs: readonly Leg[],
  journeys: readonly (Journey | undefined)[],
  status: TravelStatus,
  mode: TravelMode,
  /** The plan's own minutes at the stops, so the total can state the day. */
  planned?: number,
): RouteOptions {
  const travel: Record<string, RoutedTravel> = {};
  legs.forEach((leg, i) => {
    const journey = journeys[i];
    if (journey?.kind !== "routed") return;
    const key = leg.home ? "home" : leg.to.id;
    if (!key) return;
    // An area point with no caution of its own still prints one.
    const caution = cautionOf(journey);
    travel[key] = {
      kind: "routed",
      mode: journey.mode,
      minutes: journey.minutes,
      roadKm: journey.roadKm,
      provider: journey.provider,
      ...(caution ? { accessCaution: caution } : {}),
    };
  });
  const words =
    status === "ready"
      ? describeTravelTotal(travelTotal(legs, journeys, mode), planned)
      : undefined;
  const travelNote =
    status === "not-served"
      ? "Atlas does not give travel times between places yet."
      : status === "failed"
        ? "Atlas could not give travel times when this was printed."
        : undefined;
  return {
    travel,
    attribution: attributionFor(journeys),
    ...(words ? { travelTotal: words } : {}),
    ...(travelNote ? { travelNote } : {}),
  };
}
