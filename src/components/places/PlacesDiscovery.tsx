"use client";

import { DiscoverySurface } from "@/components/discovery/DiscoverySurface";
import { DestinationCard } from "@/components/place-detail/DestinationCard";
import type { Place } from "@/lib/data/types";

/**
 * Places, on the shared discovery shell.
 *
 * **Everything Place-specific lives here**, and it is deliberately small: the
 * card, the facet, the wording, and the sort. `DiscoverySurface` supplies the
 * count, the chips, the grid, the empty state and the selection state, and
 * never reads a Place field.
 *
 * ## Why the facet is `placeType` and nothing else
 *
 * `/discovery` filters on `seasons`, `companions`, `energyLevel`, `priceLevel`
 * and `duration`, and `atlasMapper` supplies all five as identical constants
 * for every place — so those controls answer questions with invented data, and
 * one of them tells a traveller Ellison Park is not pet-friendly when its Atlas
 * record confirms `Pets on leash`. `placeType` is on the record and came from
 * the source, so it is the one axis that can be answered honestly.
 *
 * The vocabulary is left as the corpus states it: `park` and `provincial park`
 * sit side by side because two publishers said two different things, and
 * collapsing them would assert an equivalence no source stated (ADR 017's
 * reasoning, applied to a filter). `unknown` is shown for the same reason —
 * sixteen places genuinely have no stated type, and hiding that would make the
 * corpus look better than it is.
 */
export function PlacesDiscovery({
  places,
}: {
  readonly places: readonly Place[];
}) {
  return (
    <DiscoverySurface
      items={places}
      keyOf={(place) => place.id}
      title="Places"
      intro="Everywhere Atlas currently knows about in the Okanagan. Filter by the kind of place it is, then open one to see what Atlas has learned."
      noun={{ one: "place", many: "places" }}
      facet={{
        label: "Filter by place type",
        valuesOf: (place) => [placeTypeOf(place)],
      }}
      emptyMessage="Nothing of that type. Atlas holds no place it can describe that way yet."
      compare={(a, b) => a.name.localeCompare(b.name)}
      // The card the detail page's nearby rails already use — one visual
      // definition of "here's a real place worth going", and it already falls
      // back to a placeholder when Atlas holds no photograph, which is true for
      // 42 of the 65. An `EventCard` will look nothing like this, and should
      // not have to.
      renderItem={(place) => (
        <DestinationCard place={place} caption={placeTypeOf(place)} />
      )}
    />
  );
}

/** A missing or blank type is `unknown` — the same word Atlas itself stores. */
function placeTypeOf(place: Place): string {
  const trimmed = (place.placeType ?? "").trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}
