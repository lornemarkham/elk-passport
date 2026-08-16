import "server-only";
import type { RegionCoverage } from "./regionCoverage";

/**
 * **Where Atlas should read next — a framework, not a crawler.**
 *
 * ## Atlas does not get smarter by guessing
 *
 * Every hard limit found in this workspace has the same shape. Membership
 * cannot be auto-asserted because no source *states* which region a place
 * is in. Coverage has no denominator because no source *lists* what exists.
 * Neither is a reasoning problem, and no amount of scoring, weighting or
 * modelling fixes either one.
 *
 * > **Atlas becomes smart because its evidence becomes richer, not because
 * > its inference becomes cleverer.** A better model over the same corpus
 * > produces more confident wrong answers.
 *
 * So this module answers the only question that actually moves the ceiling:
 * *given what this region is thin on, which publisher would fix it?*
 *
 * ## Nothing here fetches anything
 *
 * No API calls, no crawling, no queueing. It is a **reading list**,
 * assembled from what the coverage model says is thin. Acting on it stays
 * a curator's decision, and the ingestion path it would feed is the
 * existing candidate-source queue — not a new pipeline.
 *
 * ## Why some entries have no link
 *
 * A URL Atlas has not fetched is a URL Atlas is guessing at, and this
 * project does not construct URLs (ADR: evidence over invention). Entries
 * carry `urlVerified` accordingly:
 *
 * - **`true`** — fetched successfully from this workspace on the date
 *   shown. Safe to queue.
 * - **`false`** — the *publisher* is real and named, the address is not
 *   yet confirmed by Atlas. A curator finds and confirms it before
 *   queueing.
 *
 * **Naming a real organisation without a link is more useful than a
 * plausible link that 404s**, because the first sends a curator somewhere
 * and the second wastes an ingestion run.
 */

/**
 * What kind of publisher this is — which decides what reading it can and
 * cannot settle.
 *
 * **A register is definitionally complete for its own domain**: the body
 * that designates recreation sites publishes all of them, so reading it
 * yields a denominator. A directory is a curated selection, so it grows
 * the corpus and never bounds it. Conflating the two is how a coverage
 * figure becomes fiction.
 */
export type SourceKind = "register" | "directory" | "reference";

export interface SourceOpportunity {
  readonly publisher: string;
  readonly what: string;
  readonly kind: SourceKind;
  /** Concrete, checkable: what Atlas could do afterwards that it cannot now. */
  readonly unlocks: readonly string[];
  /** Only present when Atlas actually fetched it. */
  readonly url?: string;
  readonly urlVerified: boolean;
  /** When the URL was last fetched from this workspace. */
  readonly verifiedOn?: string;
  /** Why this publisher, for this gap. */
  readonly why: string;
}

export interface CategoryOpportunities {
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly known: number;
  readonly opportunities: readonly SourceOpportunity[];
}

const VERIFIED_ON = "2026-08-15";

/**
 * Candidate publishers per category.
 *
 * Deliberately short. A list of forty sources nobody reads is worse than
 * four somebody queues.
 */
const BY_CATEGORY: Record<string, readonly SourceOpportunity[]> = {
  lakes: [
    {
      publisher: "Province of British Columbia",
      what: "Freshwater Fishing Regulations Synopsis, Region 8 tables",
      kind: "register",
      unlocks: [
        "A published list of named Okanagan waters — the first real denominator on this page",
        "The rules for each one, which a traveller needs before going",
      ],
      url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/region_8_okanagan.pdf",
      urlVerified: true,
      verifiedOn: VERIFIED_ON,
      why: "The regulator names individual waters with their management unit.",
    },
    {
      publisher: "Freshwater Fisheries Society of BC",
      what: "Stocked-lake records and where-to-fish listings",
      kind: "register",
      unlocks: [
        "Which lakes are actually worth fishing, and what is in them",
        "Stocking history — a fact no aggregator reproduces",
      ],
      url: "https://www.gofishbc.com/where-to-fish/",
      urlVerified: false,
      why: "Publishes the province's stocking data lake by lake.",
    },
    {
      publisher: "OpenStreetMap",
      what: "Named water bodies with geometry",
      kind: "reference",
      unlocks: [
        "Candidate lakes Atlas has never heard of",
        "Coordinates for places it holds without any",
      ],
      urlVerified: false,
      why: "Broad but community-maintained — good for finding candidates, not for asserting facts.",
    },
  ],
  trails: [
    {
      publisher: "Recreation Sites and Trails BC",
      what: "Provincial trail and recreation site listings",
      kind: "register",
      unlocks: [
        "A denominator for trails, from the body that designates them",
        "Trailhead access — the fact that decides whether a trip happens",
      ],
      urlVerified: false,
      why: "The provincial body that designates and maintains them.",
    },
    {
      publisher: "BC Parks",
      what: "Trails inside provincial parks",
      kind: "register",
      unlocks: [
        "The well-known trails the provincial rec-site list does not cover",
      ],
      urlVerified: false,
      why: "Covers what Recreation Sites and Trails does not.",
    },
  ],
  campgrounds: [
    {
      publisher: "Recreation Sites and Trails BC",
      what: "Recreation site listings, facilities and seasonal fees",
      kind: "register",
      unlocks: [
        "A denominator for campgrounds",
        "Site counts, boat launches and fee periods — detail aggregators get wrong",
      ],
      urlVerified: false,
      why: "Publishes site-by-site detail nobody else reproduces accurately.",
    },
    {
      publisher: "BC Parks",
      what: "Provincial park campgrounds and reservations",
      kind: "register",
      unlocks: [
        "The other half of BC's public camping",
        "Whether a site can be booked, which changes how a trip is planned",
      ],
      urlVerified: false,
      why: "The other half of the public camping inventory.",
    },
  ],
  food: [
    {
      publisher: "Regional destination marketing organisation",
      what: "Member directories for the region",
      kind: "directory",
      unlocks: [
        "A published statement that a business belongs to this region — the evidence class that would let Atlas place entities without asking",
        "Businesses Atlas has never read about",
      ],
      urlVerified: false,
      why: "A member list is a regional claim, not an inference from a map.",
    },
  ],
  accommodation: [
    {
      publisher: "Regional destination marketing organisation",
      what: "Accommodation member listings",
      kind: "directory",
      unlocks: [
        "Regional membership claims for places to stay",
        "Somewhere to sleep — every multi-day trip needs it and Atlas holds one",
      ],
      urlVerified: false,
      why: "Same regional claim as food and drink.",
    },
  ],
  activities: [
    {
      publisher: "Province of British Columbia",
      what: "Freshwater Fishing Regulations Synopsis",
      kind: "reference",
      unlocks: [
        "Fishing as something with rules, seasons and named waters rather than a vague activity",
        "Licence requirements a first-time visitor would not know to ask about",
      ],
      url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/pw_regulations_guide.pdf",
      urlVerified: true,
      verifiedOn: VERIFIED_ON,
      why: "Turns an activity into something a page can be trusted about.",
    },
  ],
  parks: [
    {
      publisher: "BC Parks",
      what: "Provincial parks, conservancies and protected areas",
      kind: "register",
      unlocks: [
        "A denominator for parks, from the authority that designates them",
      ],
      urlVerified: false,
      why: "The designating authority, so its list is the register.",
    },
  ],
  viewpoints: [
    {
      publisher: "BC Geographical Names",
      what: "Official names and locations of natural features",
      kind: "reference",
      unlocks: [
        "Whether a named feature exists and what it is officially called",
        "A check against duplicates created from informal names",
      ],
      urlVerified: false,
      why: "The provincial naming authority.",
    },
  ],
};

/**
 * Reading list for the categories this region is thinnest on.
 *
 * Ordered by how little Atlas holds, so the first entry is the biggest
 * gap. Categories with no candidate publisher are omitted rather than
 * padded with a plausible-sounding one.
 */
export function sourceOpportunities(
  coverage: RegionCoverage,
  limit = 4,
): readonly CategoryOpportunities[] {
  return coverage.categories
    .filter((c) => (BY_CATEGORY[c.id]?.length ?? 0) > 0)
    .slice()
    .sort((a, b) => a.known - b.known || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => ({
      categoryId: c.id,
      categoryLabel: c.label,
      known: c.known,
      opportunities: BY_CATEGORY[c.id]!,
    }));
}
