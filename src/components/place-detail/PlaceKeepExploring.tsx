import { SectionShell } from "./SectionShell";
import { PLANNING_CATEGORY_LABEL, type PlanningCategory } from "./content";
import { groupRelatedPlaces } from "./relatedPlaceGrouping";
import { DestinationCard } from "./DestinationCard";
import type { PlaceSectionProps } from "./types";

const CATEGORY_ORDER: readonly PlanningCategory[] = [
  "before",
  "during",
  "after",
];

/**
 * "Keep Exploring" — Atlas's relationship graph, rendered as destination
 * cards instead of a linked list. Was `PlaceRelationships` (Phase 7.0);
 * rebuilt for Phase 7.2, not duplicated alongside it — a traveler never
 * needed to see "contains" and "near" as separate labeled groups, they
 * needed a reason to click, and a card with a photo does that better
 * than a bare link ever did.
 *
 * Phase 8.1: `near` cards whose related place has a `placeType` covered
 * by `PLANNING_CATEGORY_BY_PLACE_TYPE` (`content.ts`) are additionally
 * grouped into Before You Go / While You're Here / Afterwards.
 *
 * Phase 7.5: the grouping computation itself moved to the shared
 * `groupRelatedPlaces` (`relatedPlaceGrouping.ts`) — `PlaceFirstThing` and
 * `PlaceAfterwards` now compute the exact same categories to answer their
 * own, narrower traveler questions higher up the page. This section is
 * the one place that still shows *all* of it — the full exploration list,
 * repositioned lower as "facts support decisions, they're not the
 * experience" — not a duplicate of the new sections, a complete view
 * alongside their curated ones.
 *
 * Needs `relatedPlaceDetails` (full Place records — image, description,
 * type), not just `relatedPlaces` (id/name only) — see
 * `PlaceSectionProps`'s own comment for why that's a page-level fetch
 * using an existing, unchanged Atlas route, not a new one.
 */
export function PlaceKeepExploring({
  place,
  relationships,
  relatedPlaceDetails,
}: PlaceSectionProps) {
  if (relationships.length === 0 || relatedPlaceDetails.length === 0)
    return null;

  const { grouped, general } = groupRelatedPlaces(
    place,
    relationships,
    relatedPlaceDetails,
  );

  const hasGrouped = CATEGORY_ORDER.some(
    (category) => grouped[category].length > 0,
  );
  if (!hasGrouped && general.length === 0) return null;

  return (
    <SectionShell title="Keep Exploring">
      <div className="flex flex-col gap-8">
        {hasGrouped &&
          CATEGORY_ORDER.filter((category) => grouped[category].length > 0).map(
            (category) => (
              <div key={category}>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {PLANNING_CATEGORY_LABEL[category]}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {grouped[category].map((card) => (
                    <DestinationCard key={card.place.id} {...card} />
                  ))}
                </div>
              </div>
            ),
          )}

        {general.length > 0 && (
          <div>
            {hasGrouped && (
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                More to Explore
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {general.map((card) => (
                <DestinationCard key={card.place.id} {...card} />
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
