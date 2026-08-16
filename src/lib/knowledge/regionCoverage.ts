import "server-only";
import type { PickerEntity } from "@/components/admin/entities/EntityPicker";

/**
 * **How complete is this region? — asked honestly, which means mostly
 * answered "unknown".**
 *
 * ## The question that has no denominator
 *
 * "How many lakes are in the Okanagan?" is the question a coverage
 * measure has to answer, and **Atlas cannot answer it**. It knows how many
 * lakes it *holds*. Nothing it holds says how many exist.
 *
 * This module therefore reports:
 *
 * | | |
 * |---|---|
 * | `known` | entities of this category in the region. A count of records. **Real.** |
 * | `expected` | how many exist in the world. **`null`, always, today.** |
 * | `coverage` | `known / expected`. **`null` while `expected` is `null`.** |
 *
 * A third of the interface is deliberately empty, and says why. That is
 * the honest rendering, and it is the whole point:
 *
 * > **A coverage bar with an invented denominator is worse than no
 * > coverage bar.** "62% covered" is a claim about the world; Atlas would
 * > be making it up, and a curator would plan around it.
 *
 * This is also why the entity-knowledge figure elsewhere on the page is
 * labelled *"knowledge is X% complete"* rather than *"X% coverage"* — that
 * number is the mean of four dimension scores over records Atlas holds, a
 * statement about **completeness of what is held**, never about the share
 * of the Okanagan that has been captured.
 *
 * ## Where a real denominator would come from
 *
 * Not from an estimate, and not from a model. From an **authoritative
 * register** — a body that publishes the list and is definitionally
 * complete for its own domain. BC's Freshwater Fisheries Society publishes
 * the stocked lakes. Recreation Sites and Trails BC publishes the
 * recreation sites. A municipality publishes what is inside it.
 *
 * That is the same finding as the membership gate: **Atlas gets smarter by
 * reading better sources, not by estimating harder.** `sourceOpportunities`
 * is the list of registers worth reading, and closing that loop is what
 * would make this section meaningful.
 *
 * ## Categories come from what Atlas actually recorded
 *
 * The buckets below match against the free-text `subtype` a source used,
 * because ADR 017 keeps a source's own words rather than normalising them.
 * An entity matching no bucket lands in **Uncategorised**, which is
 * reported rather than dropped — a category list that silently loses
 * entities would make the region look tidier than it is.
 */

export interface CoverageCategory {
  readonly id: string;
  readonly label: string;
  /** Entities of this category currently in the region. A real count. */
  readonly known: number;
  /**
   * How many exist in the region in reality. `null` — Atlas holds no
   * authoritative register for any category. Never estimated.
   */
  readonly expected: number | null;
  /** `known / expected`. `null` whenever `expected` is. */
  readonly coverage: number | null;
  /** The register that would answer this, named but not yet read. */
  readonly wouldNeed: string;
}

export interface RegionCoverage {
  readonly categories: readonly CoverageCategory[];
  readonly uncategorised: number;
  readonly total: number;
  /** True when no category has a denominator — currently always. */
  readonly noDenominators: boolean;
}

/**
 * Category → the substrings that mean it, in the vocabulary sources
 * actually use. Deliberately generous: a miss lands in Uncategorised,
 * which is visible, rather than in the wrong bucket, which is not.
 */
const CATEGORIES: readonly {
  id: string;
  label: string;
  match: readonly string[];
  wouldNeed: string;
}[] = [
  {
    id: "lakes",
    label: "Lakes",
    match: ["lake", "reservoir", "pond"],
    wouldNeed:
      "A provincial water register, or the Freshwater Fisheries Society's stocked-lake listing.",
  },
  {
    id: "trails",
    label: "Trails",
    match: ["trail", "hike", "hiking", "path"],
    wouldNeed: "Recreation Sites and Trails BC's trail listing.",
  },
  {
    id: "campgrounds",
    label: "Campgrounds & rec sites",
    match: ["campground", "camping", "recreation site", "campsite"],
    wouldNeed:
      "Recreation Sites and Trails BC, plus BC Parks for provincial campgrounds.",
  },
  {
    id: "food",
    label: "Food & drink",
    match: [
      "restaurant",
      "cafe",
      "café",
      "coffee",
      "pub",
      "bar",
      "brewery",
      "winery",
      "bakery",
      "dining",
    ],
    wouldNeed:
      "A municipal business licence register, or a regional tourism directory.",
  },
  {
    id: "accommodation",
    label: "Accommodation",
    match: ["hotel", "motel", "lodge", "inn", "resort", "accommodation", "b&b"],
    wouldNeed: "A destination marketing organisation's accommodation listing.",
  },
  {
    id: "activities",
    label: "Activities",
    match: [
      "activity",
      "skiing",
      "ski",
      "fishing",
      "boating",
      "biking",
      "tour",
    ],
    wouldNeed:
      "No register publishes what there is to *do* in a region. This category may never have a denominator, and saying so is more useful than guessing one.",
  },
  {
    id: "parks",
    label: "Parks & protected areas",
    match: ["park", "protected", "conservation", "ecological"],
    wouldNeed: "BC Parks, plus regional and municipal park listings.",
  },
  {
    id: "viewpoints",
    label: "Viewpoints & landmarks",
    match: [
      "viewpoint",
      "lookout",
      "landmark",
      "waterfall",
      "mountain",
      "peak",
    ],
    wouldNeed:
      "The BC Geographical Names register for named features; nothing authoritative lists viewpoints.",
  },
];

export function regionCoverage(rows: readonly PickerEntity[]): RegionCoverage {
  const claimed = new Set<string>();

  const categories = CATEGORIES.map((c) => {
    let known = 0;
    for (const row of rows) {
      if (claimed.has(row.id)) continue;
      const haystack = `${row.subtype ?? ""} ${row.name}`.toLowerCase();
      if (c.match.some((m) => haystack.includes(m))) {
        known += 1;
        claimed.add(row.id);
      }
    }
    return {
      id: c.id,
      label: c.label,
      known,
      // Never estimated. See the module docstring.
      expected: null,
      coverage: null,
      wouldNeed: c.wouldNeed,
    };
  });

  return {
    categories,
    uncategorised: rows.length - claimed.size,
    total: rows.length,
    noDenominators: categories.every((c) => c.expected === null),
  };
}
