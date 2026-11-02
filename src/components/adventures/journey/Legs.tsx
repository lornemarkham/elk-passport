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
  const next = leg.to;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-sm text-[var(--gh-ink-soft)]"
      data-testid="plan-leg"
    >
      <span className="inline-flex items-center gap-2 font-semibold text-[var(--gh-ink)]">
        <Car className="h-4 w-4 shrink-0" aria-hidden />
        {status === "loading" ? "Asking Atlas how far…" : words.headline}
      </span>
      {(next.at || next.id) && (
        <a
          href={directionsTo(next)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center font-semibold underline"
        >
          Directions
        </a>
      )}
      {status !== "loading" && words.caveat && (
        <details className="w-full sm:w-auto">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs underline">
            How this is measured
          </summary>
          <p className="text-xs">{words.caveat}</p>
        </details>
      )}
    </div>
  );
}

/** Directions to the next stop: its coordinates where Atlas has them, else its name. */
function directionsTo(end: LegEnd): string {
  const destination = end.at
    ? `${end.at.latitude},${end.at.longitude}`
    : end.name;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * The headline a person reads ("About 20 min drive") and, kept one tap
 * away, how it was measured and whose route it is — the attribution a
 * routed time carries is never dropped, only moved out of the way.
 */
function journeyWords(
  journey: Journey | undefined,
  straightKm: number | undefined,
): { headline: string; caveat?: string } {
  if (journey && journey.kind !== "unknown") return describeJourney(journey);
  if (straightKm !== undefined)
    return describeJourney({
      kind: "straight-line",
      km: straightKm,
      basis: "coordinates",
    });
  return {
    headline: "Passport can't place one of these, so it can't say how far.",
  };
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
