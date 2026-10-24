"use client";

import { useMemo } from "react";
import { Car } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { ItemView } from "@/lib/adventures/store";
import { chainLegs, type LegEnd } from "@/lib/routing/legs";
import { useTravelLegs } from "@/lib/routing/useTravelLegs";
import { describeJourney, type Journey } from "@/lib/routing/journey";
import { distanceKm } from "@/lib/environment/geo";

export const endOf = (
  item: ItemView,
  experiences: Readonly<Record<string, Experience>>,
  names: Readonly<Record<string, string>>,
): LegEnd => {
  const e = item.atlasRef ? experiences[item.atlasRef] : undefined;
  const c = e?.geography?.coordinates;
  return {
    ...(item.atlasRef ? { id: item.atlasRef } : {}),
    name:
      e?.title ??
      item.label ??
      (item.atlasRef ? (names[item.atlasRef] ?? "a stop") : "a stop"),
    ...(c ? { at: { latitude: c[1], longitude: c[0] } } : {}),
  };
};

/**
 * **How far, between two stops** — Atlas's routed journey where it has one
 * (`/travel/legs`, the Day Builder's own), a straight line labelled as one
 * where it does not, and nothing invented where a stop is not placed.
 */
export function Between({
  from,
  to,
  experiences,
  names,
}: {
  readonly from: ItemView;
  readonly to: ItemView;
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly names: Readonly<Record<string, string>>;
}) {
  const legs = useMemo(
    () =>
      chainLegs(undefined, [
        endOf(from, experiences, names),
        endOf(to, experiences, names),
      ]),
    [from, to, experiences, names],
  );
  const { journeys, status } = useTravelLegs(legs, "driving");
  const leg = legs[0]!;
  const words = journeyWords(
    journeys[0],
    leg.from.at && leg.to.at ? distanceKm(leg.from.at, leg.to.at) : undefined,
  );
  return (
    <p
      className="flex items-center gap-2 py-1 text-sm text-[var(--gh-ink-soft)]"
      data-testid="plan-leg"
    >
      <Car className="h-4 w-4 shrink-0" aria-hidden />
      {status === "loading" ? "Asking Atlas how far…" : words}
    </p>
  );
}

function journeyWords(
  journey: Journey | undefined,
  straightKm: number | undefined,
): string {
  if (journey && journey.kind !== "unknown") {
    const { headline, caveat } = describeJourney(journey);
    return `${headline}. ${caveat}`;
  }
  if (straightKm !== undefined) {
    const { headline, caveat } = describeJourney({
      kind: "straight-line",
      km: straightKm,
      basis: "coordinates",
    });
    return `${headline}. ${caveat}`;
  }
  return "Passport can't place one of these, so it can't say how far.";
}

/** The day's driving, summed only over routed legs — "at least" otherwise. */
export function DayTravel({
  items,
  experiences,
}: {
  readonly items: readonly ItemView[];
  readonly experiences: Readonly<Record<string, Experience>>;
}) {
  const legs = useMemo(
    () =>
      chainLegs(
        undefined,
        items.map((i) => endOf(i, experiences, {})),
      ),
    [items, experiences],
  );
  const { journeys, status } = useTravelLegs(legs, "driving");
  if (status !== "ready") return null;
  const routed = journeys.filter(
    (j): j is Extract<Journey, { kind: "routed" }> =>
      j?.kind === "routed" && !j.accessCaution && !j.areaPoint,
  );
  if (routed.length === 0) return null;
  const minutes = routed.reduce((sum, j) => sum + j.minutes, 0);
  const all = routed.length === legs.length;
  return (
    <p className="text-sm font-semibold" data-testid="day-travel">
      {all ? "About" : "At least"} {minutes} min driving between stops
      {all ? "" : ` (${legs.length - routed.length} not measured)`}.
    </p>
  );
}
