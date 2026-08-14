import type { Place, PlaceRelationship } from "@/lib/data/types";
import {
  PLANNING_CATEGORY_BY_PLACE_TYPE,
  type PlanningCategory,
} from "./content";

/**
 * Extracted from `PlaceKeepExploring` (Phase 8.1's original home for this
 * logic) so a second consumer — `PlaceFirstThing` / `PlaceAfterwards`
 * (Phase 7.5) — doesn't need its own copy. One real computation, two
 * different places on the page choose to render different slices of its
 * result: `PlaceKeepExploring` still shows all of it (the full exploration
 * list, repositioned lower); the new decision-first sections each show
 * exactly one category, elevated and framed as a direct answer to one
 * traveler question. Nothing about how `near`/`contains` edges are
 * computed or stored changed — this is presentation-layer grouping only.
 */

export interface DestinationCardData {
  readonly place: Place;
  readonly caption: string;
}

/** A one-line reason a card is here — never the raw relationship type. `near`
 * has no direction that matters to a traveler; `contains` does, so it reads
 * differently depending on which end of the edge the *current* place is on.
 * A future relationship type still gets a real sentence, never a raw graph
 * term, even before anyone writes a specific line for it. */
export function naturalCaption(type: string, currentIsSource: boolean): string {
  if (type === "near") return "Only a few minutes away.";
  if (type === "contains")
    return currentIsSource
      ? "Right here, worth a look."
      : "Part of the same area.";
  return "Worth exploring nearby.";
}

export function excerpt(text: string, max = 90): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export interface GroupedRelatedPlaces {
  readonly grouped: Record<PlanningCategory, DestinationCardData[]>;
  readonly general: DestinationCardData[];
}

/**
 * The one real computation: walk every relationship touching `currentPlace`,
 * resolve each to its full related `Place` record (skipping a stale
 * reference or a related fetch that failed — never breaks the page), and
 * sort each into Before/During/After when it's a `near` edge whose related
 * place's `placeType` is in `PLANNING_CATEGORY_BY_PLACE_TYPE` — everything
 * else (a `contains` edge, or a `near` edge to an unmapped place type)
 * lands in `general` unchanged, the same "never force a category it wasn't
 * confidently mapped to" rule this has always followed.
 */
export function groupRelatedPlaces(
  currentPlace: Place,
  relationships: readonly PlaceRelationship[],
  relatedPlaceDetails: readonly Place[],
): GroupedRelatedPlaces {
  const detailsById = new Map(
    relatedPlaceDetails.map((p) => [p.id, p] as const),
  );

  const grouped: Record<PlanningCategory, DestinationCardData[]> = {
    before: [],
    during: [],
    after: [],
  };
  const general: DestinationCardData[] = [];

  for (const r of relationships) {
    const currentIsSource = r.sourceEntityId === currentPlace.id;
    const otherId = currentIsSource ? r.targetEntityId : r.sourceEntityId;
    const other = detailsById.get(otherId);
    if (!other) continue; // stale reference, or the related fetch failed — skip, don't break the section

    const card: DestinationCardData = {
      place: other,
      caption: naturalCaption(r.type, currentIsSource),
    };
    const category =
      r.type === "near"
        ? PLANNING_CATEGORY_BY_PLACE_TYPE[other.placeType]
        : undefined;
    if (category) {
      grouped[category].push(card);
    } else {
      general.push(card);
    }
  }

  return { grouped, general };
}
