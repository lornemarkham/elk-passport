import { describeJourney, type Journey } from "@/lib/routing/journey";
import type { Leg } from "@/lib/routing/legs";

/**
 * **How one leg of a day gets travelled, in the fewest true words.**
 *
 * `journey` is what the leg is shown as (`shownLeg`): Atlas's routed answer,
 * Atlas's reason it has none, or a straight line. Each says what it is — a
 * routed time names its provider, a straight line says it is not a travel
 * time. The provider's full limitations are said once, under the day's
 * total, rather than repeated under every leg.
 */
export function LegLine({
  leg,
  journey,
  first,
}: {
  readonly leg: Leg;
  readonly journey: Journey | undefined;
  /** The first leg of a day that has no start point is not shown at all. */
  readonly first?: boolean;
}) {
  const where = leg.home
    ? `back to ${leg.to.name}`
    : first
      ? `from ${leg.from.name}`
      : "from the last stop";

  if (!journey) {
    return (
      <span
        data-testid="leg-line"
        data-journey="none"
        className="text-black/45"
      >
        No distance {where}: Atlas has not placed{" "}
        {leg.from.at ? leg.to.name : leg.from.name}
      </span>
    );
  }

  const words = describeJourney(journey);
  const aside =
    journey.kind === "routed"
      ? `estimated by ${journey.provider}${journey.accessCaution ? "; check the route, the point may be inside the site" : ""}`
      : journey.kind === "straight-line"
        ? "not a travel time"
        : words.caveat.replace(/\.$/, "");

  return (
    <span
      data-testid="leg-line"
      data-journey={journey.kind}
      title={words.caveat}
    >
      {words.headline} {where}{" "}
      <span className="font-normal text-black/40">({aside})</span>
    </span>
  );
}
