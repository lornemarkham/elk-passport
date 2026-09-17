import { groupRelatedPlaces } from "./relatedPlaceGrouping";
import { DestinationCard } from "./DestinationCard";
import type { PlaceSectionProps } from "./types";

/**
 * Phase 7.6 — a horizontal-scroll row, not a grid — deliberately different
 * rhythm from `PlaceKeepExploring`'s fixed grid further down the page,
 * even though both render the exact same `DestinationCard` off the exact
 * same `groupRelatedPlaces` computation (the "after" bucket: restaurant,
 * brewery, winery). "Continue the adventure" framing over a literal
 * "Afterwards" label — matching this page's move away from documentation
 * headings toward something that reads like a recommendation, not a
 * form field.
 *
 * Returns `null` when there's no real "after" data yet.
 */
export function PlaceAfterwards({
  place,
  relationships,
  relatedPlaceDetails,
  relatedPlaces,
}: PlaceSectionProps) {
  const { grouped } = groupRelatedPlaces(
    place,
    relationships,
    relatedPlaceDetails,
    relatedPlaces,
  );
  const after = grouped.after;

  if (after.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">
        Continue the adventure
      </h2>
      <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1">
        {after.map((card) => (
          <div key={card.place.id} className="w-40 shrink-0 sm:w-48">
            <DestinationCard {...card} />
          </div>
        ))}
      </div>
    </section>
  );
}
