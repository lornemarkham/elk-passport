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

export interface SourceOpportunity {
  readonly publisher: string;
  readonly what: string;
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
      publisher: "Freshwater Fisheries Society of BC",
      what: "Stocked-lake records and where-to-fish listings",
      url: "https://www.gofishbc.com/where-to-fish/",
      urlVerified: false,
      why: "Publishes the province's stocking data lake by lake — the closest thing to an authoritative register of fishable water.",
    },
    {
      publisher: "Province of British Columbia",
      what: "Freshwater Fishing Regulations Synopsis, Region 8 tables",
      url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/region_8_okanagan.pdf",
      urlVerified: true,
      verifiedOn: VERIFIED_ON,
      why: "Names individual waters in the Okanagan with their management unit — a real list of lakes, published by the regulator.",
    },
    {
      publisher: "OpenStreetMap",
      what: "Named water bodies with geometry",
      urlVerified: false,
      why: "Broad coverage of named lakes. Community-maintained rather than authoritative, so useful for discovering candidates, not for asserting facts.",
    },
  ],
  trails: [
    {
      publisher: "Recreation Sites and Trails BC",
      what: "Provincial trail and recreation site listings",
      urlVerified: false,
      why: "The provincial body that designates and maintains these trails, so its list is definitionally complete for the ones it manages.",
    },
    {
      publisher: "BC Parks",
      what: "Trails inside provincial parks",
      urlVerified: false,
      why: "Covers the trails Recreation Sites and Trails does not, which is most of the well-known ones.",
    },
  ],
  campgrounds: [
    {
      publisher: "Recreation Sites and Trails BC",
      what: "Recreation site listings, facilities and seasonal fees",
      urlVerified: false,
      why: "Publishes site-by-site detail — number of campsites, boat launches, fee periods — that no aggregator reproduces accurately.",
    },
    {
      publisher: "BC Parks",
      what: "Provincial park campgrounds and reservations",
      urlVerified: false,
      why: "The other half of BC's public camping inventory.",
    },
  ],
  food: [
    {
      publisher: "Regional destination marketing organisation",
      what: "Member directories for the region",
      urlVerified: false,
      why: "A tourism body's member list is one of the few places that states which businesses belong to a region — the evidence class that would unlock automatic membership.",
    },
  ],
  accommodation: [
    {
      publisher: "Regional destination marketing organisation",
      what: "Accommodation member listings",
      urlVerified: false,
      why: "Same reason as food and drink: a membership list is a regional claim, not an inference from a map.",
    },
  ],
  activities: [
    {
      publisher: "Province of British Columbia",
      what: "Freshwater Fishing Regulations Synopsis",
      url: "https://www2.gov.bc.ca/assets/gov/sports-recreation-arts-and-culture/outdoor-recreation/fishing-and-hunting/freshwater-fishing/pw_regulations_guide.pdf",
      urlVerified: true,
      verifiedOn: VERIFIED_ON,
      why: "Turns fishing from a vague activity into something with rules, seasons and named waters — the detail that makes a Passport page worth trusting.",
    },
  ],
  parks: [
    {
      publisher: "BC Parks",
      what: "Provincial parks, conservancies and protected areas",
      urlVerified: false,
      why: "The authority that designates them, so its list is the register.",
    },
  ],
  viewpoints: [
    {
      publisher: "BC Geographical Names",
      what: "Official names and locations of natural features",
      urlVerified: false,
      why: "The provincial naming authority — the right source for whether a peak or waterfall exists and what it is actually called.",
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
