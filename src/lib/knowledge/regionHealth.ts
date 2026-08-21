import type { WorkspaceBundle } from "./workspaceData";

/**
 * How complete Atlas's knowledge is, by the categories a traveller thinks in.
 *
 * ## Why coverage is measured this way
 *
 * "How much of the Okanagan does Atlas know?" is unanswerable — Atlas has
 * no denominator. It cannot know how many restaurants Vernon has, so any
 * percentage claiming to answer that question would be invented.
 *
 * What Atlas *can* measure honestly is **how well it knows what it already
 * knows about**: of the entities it holds, how many trace to their own
 * website, carry an image, and (for places) have coordinates. That is a
 * real number, it moves for real reasons, and improving it is genuinely
 * what makes Passport better.
 *
 * So every percentage here is **completeness of held knowledge**, never
 * coverage of the world. The distinction is stated in the UI too, because
 * a number that quietly means something other than what it appears to mean
 * is the most durable kind of dishonesty.
 *
 * A category with no entities reports `null` — rendered as *"Not yet
 * measurable"* — rather than 0%, which would read as a failing grade for
 * something Atlas has simply never been taught.
 */

export interface CategoryHealth {
  readonly key: string;
  readonly label: string;
  /** What a traveller could ask because of this category. Keeps ingestion pointed at composition. */
  readonly unlocks: string;
  readonly known: number;
  readonly missingFirstPartySource: number;
  readonly missingImage: number;
  readonly missingCoordinates: number;
  /** Completeness of what Atlas holds — never coverage of the world. `null` when nothing is held. */
  readonly completeness: number | null;
  /** Set when Atlas has no way to measure this yet, with the reason. */
  readonly notMeasurable?: string;
}

export interface RegionHealth {
  readonly totalEntities: number;
  readonly completeness: number | null;
  readonly categories: readonly CategoryHealth[];
  readonly weakest: readonly CategoryHealth[];
}

export interface CategoryRule {
  readonly key: string;
  readonly label: string;
  readonly unlocks: string;
  /** Undefined means Atlas cannot yet identify this category at all. */
  readonly matches?: (entity: EntityLike) => boolean;
  readonly notMeasurable?: string;
  /**
   * **What would teach Atlas this, when it holds nothing yet.**
   *
   * The difference between a category that reads `0` and one that reads *"Not
   * taught yet — the OSM sweep would find these"*. The first is a score an
   * operator can only feel bad about; the second is the next piece of work.
   *
   * An empty category is not a failure. It is a part of Atlas nobody has built
   * yet, and naming the publisher that would build it turns the table into a
   * roadmap.
   */
  readonly taughtBy?: string;
}

export interface EntityLike {
  /** Needed to join an entity to its `describes` edges when scoping a domain. */
  readonly id: string;
  readonly kind: string;
  readonly name?: string;
  readonly description?: string;
  readonly placeType?: string;
  readonly organizationType?: string;
  /** A street address. A locating fact in its own right, and one of the four identity signals. */
  readonly address?: string;
  readonly imageUrl?: string;
  readonly geometry?: { type?: string; coordinates?: unknown };
  readonly externalIds?: readonly { system: string }[];
}

const has = (value: string | undefined, ...words: string[]) =>
  !!value && words.some((w) => value.toLowerCase().includes(w));

/**
 * Matches an organization's category on its type **or its description**.
 *
 * Needed because live data proved the type alone insufficient: the six Big
 * White dining venues carry `organizationType: "unknown"` — they were
 * created by directory expansion, which deliberately doesn't guess a type
 * it wasn't told — so a type-only rule reported *"Restaurants: not yet
 * measurable"* while Atlas plainly held six restaurants.
 *
 * Their descriptions say it in the source's own words: *"Family-friendly
 * restaurant and sports bar"*, *"Listed on Big White's Food & Dining
 * directory"*.
 *
 * **Why text matching is acceptable here and nowhere else.** Atlas forbids
 * resolving *identity* by name, because a wrong match silently merges two
 * real things and cannot be undone. This is display grouping: the worst
 * case is a venue counted in the wrong bucket on one panel, which is
 * visible and harmless. Different risk, different rule — and worth stating
 * plainly so the exception is never mistaken for a softening of the
 * identity rule.
 */
const org = (e: EntityLike, ...words: string[]) =>
  has(e.organizationType, ...words) || has(e.description, ...words);

/**
 * The categories a traveller thinks in, not the ones the schema uses.
 *
 * Matching is on the source's own `placeType` / `organizationType` strings,
 * which are deliberately open (no taxonomy is confirmed) — so these rules
 * are pattern matches over real vocabulary rather than a closed mapping.
 * Imperfect on purpose: a wrong bucket is visible and fixable, whereas
 * forcing a taxonomy would quietly discard the source's own words.
 *
 * Categories Atlas genuinely cannot identify yet carry `notMeasurable`
 * instead of a match — planned and visible, never silently absent.
 */
/**
 * Exported so a Knowledge Domain page can scope its numbers to its own entities.
 *
 * A Recreation page reporting corpus-wide corroboration is reporting Food &
 * Drink's evidence under a Recreation heading. These rules are the only
 * domain-shaped entity grouping Atlas has, so they are shared rather than
 * reimplemented — a second matcher would drift from this one immediately.
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  {
    key: "restaurants",
    label: "Restaurants & cafés",
    unlocks: "Where to eat; the ultimate burger road trip",
    matches: (e) =>
      e.kind === "Organization" &&
      org(
        e,
        "restaurant",
        "cafe",
        "café",
        "bar",
        "pub",
        "bakery",
        "dining",
        "food",
      ),
  },
  {
    key: "wineries",
    label: "Wineries & breweries",
    unlocks: "A wine weekend; a tasting route",
    matches: (e) =>
      e.kind === "Organization" &&
      org(e, "winery", "brewery", "cidery", "distillery", "vineyard"),
  },
  {
    key: "parks",
    label: "Parks & protected areas",
    unlocks: "A family day out; camping",
    // `parking` contains `park`. Three OpenStreetMap parking lots were being
    // counted as protected areas, which then put them in the queue for
    // "every park needs a photo". Excluded explicitly rather than by
    // tightening the match, because the source's vocabulary is open and a
    // whole-word rule would drop "provincial park" the moment a publisher
    // wrote "parkland".
    matches: (e) =>
      !has(e.placeType, "parking") &&
      has(e.placeType, "park", "protected", "conservation"),
    taughtBy: "BC Parks — the batch file exists",
  },
  {
    key: "trails",
    label: "Trails & trailheads",
    unlocks: "A hike matched to ability and season",
    matches: (e) => has(e.placeType, "trail", "trailhead", "hike", "path"),
    taughtBy:
      "Blocked — no trail tag in the POI allow list, and no trail publisher wired",
  },
  {
    key: "beaches",
    label: "Beaches & lakeshore",
    unlocks: "A swim; an afternoon by the water",
    matches: (e) => has(e.placeType, "beach", "lakeshore", "swimming"),
    taughtBy: "The OpenStreetMap sweep — natural=beach",
  },
  {
    key: "campgrounds",
    label: "Campgrounds & recreation sites",
    unlocks: "A night outside; a long weekend",
    matches: (e) => has(e.placeType, "camp", "recreation site", "rec site"),
    taughtBy: "The OpenStreetMap sweep — tourism=camp_site",
  },
  {
    key: "water-access",
    label: "Boat launches & marinas",
    unlocks: "A day on the lake",
    matches: (e) =>
      has(e.placeType, "slipway", "boat launch", "marina", "wharf", "dock"),
    taughtBy: "The OpenStreetMap sweep — leisure=slipway",
  },
  {
    key: "viewpoints",
    label: "Viewpoints & picnic areas",
    unlocks: "A stop worth making on the way somewhere",
    matches: (e) => has(e.placeType, "viewpoint", "lookout", "picnic"),
    taughtBy: "The OpenStreetMap sweep — tourism=viewpoint",
  },
  {
    key: "cycling",
    label: "Cycling & bike parks",
    unlocks: "A ride matched to ability",
    matches: (e) => has(e.placeType, "bike", "cycling", "pump track"),
    taughtBy: "Trailforks — licensing not established",
  },
  {
    key: "winter",
    label: "Winter recreation",
    unlocks: "Nordic trails, snowshoeing, sledding hills",
    matches: (e) =>
      has(e.placeType, "nordic", "snowmobile", "snowshoe", "skating"),
    taughtBy: "No publisher identified",
  },
  {
    key: "climbing",
    label: "Climbing",
    unlocks: "A crag matched to grade",
    matches: (e) => has(e.placeType, "climb", "crag", "boulder"),
    taughtBy: "No publisher identified",
  },
  {
    key: "golf",
    label: "Golf",
    unlocks: "A round; a golf weekend",
    matches: (e) => has(e.placeType, "golf"),
    taughtBy: "No publisher identified",
  },
  {
    // `beach` deliberately moved to its own Recreation category. A lake is a
    // water feature Geography is responsible for; a beach is somewhere you go,
    // which is Recreation's. Leaving it here counted the same entity under two
    // domains, so the two would never sum to the corpus.
    key: "water",
    label: "Lakes, rivers & waterfalls",
    unlocks: "A waterfall photography tour; a swim",
    matches: (e) => has(e.placeType, "lake", "river", "waterfall", "creek"),
    taughtBy: "BC Freshwater Atlas, through Discovery",
  },
  {
    key: "lodging",
    label: "Lodging",
    unlocks: "Where to stay; a corporate retreat",
    matches: (e) =>
      e.kind === "Organization" &&
      org(e, "hotel", "lodge", "hostel", "accommodation"),
  },
  {
    key: "resorts",
    label: "Ski & mountain resorts",
    unlocks: "A ski weekend; summer on the mountain",
    matches: (e) => has(e.placeType, "resort", "mountain", "ski"),
    taughtBy: "The operator's own website",
  },
  {
    key: "museums",
    label: "Museums & culture",
    unlocks: "Rainy days; quiet mornings",
    matches: (e) =>
      e.kind === "Organization" &&
      org(e, "museum", "gallery", "theatre", "theater", "cultural"),
  },
  {
    /**
     * **Not a Recreation category, and no longer treated as one.**
     *
     * An Activity is a thing you can *do* at a place, not a kind of place.
     * Counting it beside parks and trails was measurably wrong: Recreation
     * reported 66 entities of which 49 were Activities, so corroboration and
     * Passport readiness were mostly statements about Activity records — and
     * an Activity has no coordinates and no image, so it sat permanently in
     * *needs enrichment* and made the parks look unpresentable.
     *
     * The rule stays, because the region page's coverage table still wants a
     * line for it. What changed is that no Knowledge Domain claims it as one
     * of its categories; Recreation counts it separately, through `alsoHolds`.
     */
    key: "activities",
    label: "Things to do",
    unlocks: "Things to actually do",
    matches: (e) => e.kind === "Activity",
    taughtBy: "Extraction, from whatever page describes the place",
  },
  {
    key: "sports",
    label: "Sports",
    unlocks: "A hockey tournament weekend; a dirt bike adventure",
    notMeasurable:
      "No source has taught Atlas about sports organizations or facilities yet.",
  },
  {
    key: "events",
    label: "Events & festivals",
    unlocks: "A weekend built around something happening",
    notMeasurable:
      "Events are time-bound and Atlas has no temporal model yet (ADR 018).",
  },
  {
    key: "wonder",
    label: "Wonder",
    unlocks:
      "Meteor showers, aurora, blooms, salmon runs — the reasons to travel",
    notMeasurable: "Wonder is almost entirely temporal. Blocked on ADR 018.",
  },
  {
    key: "hidden-gems",
    label: "Hidden gems",
    unlocks: "What locals actually recommend",
    notMeasurable:
      "Requires Signals — repeated independent agreement, not single sources (ADR 020).",
  },
  {
    key: "accessibility",
    label: "Accessibility",
    unlocks: "Trips that work for everyone",
    notMeasurable:
      "Only OpenStreetMap reports this today, and Atlas holds no OSM sources yet.",
  },
];

export function computeRegionHealth(
  bundle: WorkspaceBundle | null,
): RegionHealth {
  const entities = ((bundle?.entities ?? []) as unknown as EntityLike[]).filter(
    (e) => e.kind !== "SourceRecord",
  );

  const categories = CATEGORY_RULES.map((rule): CategoryHealth => {
    if (!rule.matches) {
      return {
        key: rule.key,
        label: rule.label,
        unlocks: rule.unlocks,
        known: 0,
        missingFirstPartySource: 0,
        missingImage: 0,
        missingCoordinates: 0,
        completeness: null,
        notMeasurable: rule.notMeasurable,
      };
    }

    const matched = entities.filter(rule.matches);
    const missingFirstPartySource = matched.filter(
      (e) => !hasFirstParty(e),
    ).length;
    const missingImage = matched.filter((e) => !e.imageUrl).length;
    const missingCoordinates = matched.filter(
      (e) => e.kind === "Place" && !hasPoint(e),
    ).length;

    return {
      key: rule.key,
      label: rule.label,
      unlocks: rule.unlocks,
      known: matched.length,
      missingFirstPartySource,
      missingImage,
      missingCoordinates,
      completeness: matched.length === 0 ? null : completenessOf(matched),
      notMeasurable:
        matched.length === 0
          ? "Atlas hasn't been taught anything in this category yet."
          : undefined,
    };
  });

  return {
    totalEntities: entities.length,
    completeness: entities.length === 0 ? null : completenessOf(entities),
    categories,
    // Where teaching Atlas would pay off most: real entities, weakest knowledge.
    weakest: categories
      .filter((c) => c.completeness !== null && c.known >= 3)
      .sort((a, b) => (a.completeness ?? 0) - (b.completeness ?? 0))
      .slice(0, 3),
  };
}

/**
 * Completeness of what Atlas holds: the share of the checks that pass
 * across every entity in the group.
 *
 * Three checks, each chosen because a traveller notices when it is
 * missing: can Atlas trace this to its own website, does it have a
 * picture, and (for a place) does it have a location. Coordinates are only
 * counted for Places — an Organization is not a location (ADR 019), so
 * scoring it for missing coordinates would penalise correct modelling.
 */
function completenessOf(entities: readonly EntityLike[]): number {
  let passed = 0;
  let total = 0;
  for (const entity of entities) {
    total += 2;
    if (hasFirstParty(entity)) passed += 1;
    if (entity.imageUrl) passed += 1;
    if (entity.kind === "Place") {
      total += 1;
      if (hasPoint(entity)) passed += 1;
    }
  }
  return total === 0 ? 0 : Math.round((passed / total) * 100);
}

function hasFirstParty(entity: EntityLike): boolean {
  return !!entity.externalIds?.some((x) => x.system === "first-party-url");
}

function hasPoint(entity: EntityLike): boolean {
  const geometry = entity.geometry;
  return (
    geometry?.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length === 2
  );
}
