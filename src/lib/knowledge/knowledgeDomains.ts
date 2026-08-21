/**
 * **The Knowledge Domains Atlas is responsible for.**
 *
 * A Knowledge Domain is a **permanent** responsibility for an area of knowledge
 * — not a publisher, not a job, and not something that finishes. Publishers
 * change beneath it; the domain stays. Geography is the same domain whether the
 * province publishes through a WFS endpoint, a flat file, or something that
 * does not exist yet.
 *
 * A domain owns health, knowledge, publishers, Passport readiness, blockers,
 * opportunities and history. It does not own *today's work* — that is a
 * **Mission**, which is finite and lives in `missions.ts`.
 *
 * ## Why the split exists
 *
 * This file used to carry `expedition`, `nextStep` and `queue`: a finite job,
 * with no finish condition and no way to have more than one. Recreation's read
 * *"Map what there is to do around Ellison and the North Okanagan"* — a remit
 * wearing a mission's clothes. An operator could work at it forever and never
 * complete anything.
 *
 * Those three fields became the `Mission` type. A domain now holds many
 * missions, each small enough to finish, each finishing on conditions evaluated
 * against Atlas's own state rather than on a box somebody ticked.
 *
 * ## Rules this file does not break
 *
 * - **No invented numbers.** No coverage percentage: Atlas has no denominator
 *   for the world. Progress bars measure *capability* against Atlas's own
 *   lists, which is a real denominator and a different claim.
 * - **No unverified commands.** Every command exists in `atlas/package.json`
 *   and points at a file that exists.
 * - **No guessed durations.** `duration` says "Not measured" where it is.
 * - **Failure behaviour is quoted from code**, not memory: `requestTimeout.ts`,
 *   `DiscoveryProvider.ts`, `proposeIdentity.ts`, `overpass.ts`.
 *
 * ## The seam left for later
 *
 * `Operation` describes an executable thing — id, directory, command, expected
 * result, failure modes. A future run API binds to `Operation.id`; run history
 * joins on it. See ADR 041.
 */

export type DomainStatus = "operational" | "ready" | "planning";

export type PublisherStatus =
  "operational" | "ready" | "planned" | "research-candidate";

export const PUBLISHER_STATUS_LABEL: Record<PublisherStatus, string> = {
  operational: "Operational",
  ready: "Ready",
  planned: "Planned",
  "research-candidate": "Research candidate",
};

export const PUBLISHER_STATUS_MEANING: Record<PublisherStatus, string> = {
  operational: "Loader exists. This domain has run through it.",
  ready: "Loader exists. This domain has not run through it.",
  planned: "Worth having. No loader, none being written.",
  "research-candidate": "Access and licensing not established.",
};

export type EntityKind = "Place" | "Organization" | "Activity" | "Event";

/** One thing the domain is trying to learn, and whether Atlas can reach it. */
export interface Subject {
  readonly name: string;
  /** True only when an operational or ready publisher can produce it. */
  readonly reachable: boolean;
  /** How it is reached, or why it cannot be. */
  readonly via: string;
}

/**
 * A publisher, described as something you operate.
 *
 * `onFailure` and `operatorAction` prevent one specific, expensive misreading:
 * a timeout read as *nothing is there*. `DiscoveryProvider.ts` states the rule
 * — `failed` may never be reported as `none-found`.
 */
export interface Publisher {
  readonly name: string;
  /** Why ask this publisher and not another. */
  readonly purpose: string;
  /** The question Atlas puts to it. */
  readonly asks?: string;
  readonly learns: string;
  readonly status: PublisherStatus;
  readonly implementation?: string;
  readonly limitation?: string;
  readonly onFailure?: string;
  readonly operatorAction?: string;
  /**
   * **What to do about this publisher next.** Overrides the default derived
   * from `status` — see `publisherNextAction`.
   *
   * Set it only where the derived answer would be wrong. Most publishers do
   * not need one, and an authored field that merely restates a status is a
   * field that goes stale.
   */
  readonly nextAction?: string;
}

/**
 * The next move on a publisher, derived from its status.
 *
 * Derived rather than authored, because status already carries the answer: a
 * loader that exists gets run, a loader that does not gets written, and a
 * source whose licensing is unread gets read before either. Authoring it
 * per-publisher would be a dozen copies of one rule, drifting apart.
 */
export function publisherNextAction(publisher: Publisher): string {
  if (publisher.nextAction) return publisher.nextAction;
  switch (publisher.status) {
    case "operational":
      return "Run acquisition again — it is wired and has produced entities.";
    case "ready":
      return "Run acquisition — the loader exists and this domain has never gone through it.";
    case "planned":
      return "Wire the loader. Nothing asks this publisher today.";
    case "research-candidate":
      return "Evaluate access and licensing before any code is written.";
  }
}

export interface FailureMode {
  readonly symptom: string;
  readonly meaning: string;
  readonly recovery: string;
}

/** Something an operator can run today. */
export interface Operation {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
  readonly whenToUse: string;
  /** Honest, or "Not measured". Never guessed. */
  readonly duration: string;
  readonly before: readonly string[];
  readonly workingDirectory: string;
  /** Verified against `atlas/package.json` and the files it references. */
  readonly command: string;
  readonly expected: string;
  readonly thenCheck: readonly string[];
  readonly checkHref?: string;
  readonly checkLabel?: string;
  readonly knownFailures: readonly FailureMode[];
  readonly note?: string;
}

export interface KnowledgeDomain {
  readonly slug: string;
  /** Catalogue number. A handle that survives rewording. */
  readonly designation: string;
  readonly name: string;
  readonly purpose: string;
  /** Two sentences. What this domain is responsible for. */
  readonly remit: string;
  readonly status: DomainStatus;
  readonly entityKinds: readonly EntityKind[];
  /**
   * **Which corpus categories belong to this domain.**
   *
   * Keys from `CATEGORY_RULES` in `regionHealth.ts` — the only domain-shaped
   * entity grouping Atlas has. Without this, a Recreation page reports Food &
   * Drink's evidence under a Recreation heading.
   *
   * Empty means this domain cannot be scoped to entities. Organizations is
   * the honest case: it is cross-cutting, matching no single category, and its
   * health says so rather than borrowing someone else's numbers.
   */
  readonly entityCategories: readonly string[];
  /**
   * **Kinds this domain counts alongside its places, never inside them.**
   *
   * An `Activity` is a thing you can *do* at a place, not a kind of place, and
   * mixing the two was measurably wrong: Recreation reported 66 entities of
   * which 49 were Activities, so every scoped figure — corroboration,
   * Passport readiness — was mostly a statement about Activity records. An
   * Activity has no coordinates and no image and never will, so it sat
   * permanently in *needs enrichment* and made the parks look unpresentable.
   *
   * Counted and shown on its own line instead.
   */
  readonly alsoHolds?: {
    readonly kind: EntityKind;
    readonly label: string;
    readonly note: string;
  };
  readonly subjects: readonly Subject[];
  readonly publishers: readonly Publisher[];
  readonly operations: readonly Operation[];
  /** What stands between the domain and its unreachable subjects. */
  readonly blockers: readonly Blocker[];
  readonly batchFiles: readonly string[];
  readonly openQuestions: readonly string[];
}

/** A named obstacle, and what would clear it. */
export interface Blocker {
  readonly what: string;
  /** The specific change that removes it. */
  readonly clearedBy: string;
  /** Whether the operator can clear it, or whether it needs engineering. */
  readonly owner: "operator" | "engineering" | "decision";
  /**
   * **The work, in the imperative.** Required, not optional.
   *
   * A blocker stated as prose and left there is a complaint. The same fact
   * followed by *"Add trail tags to the POI allow list"* is a task somebody can
   * pick up. Making it required is what stops the list drifting back into
   * description: a new blocker cannot be added without saying what to do about
   * it.
   *
   * Authored rather than derived from `owner`, because "needs a code change"
   * is a category and the operator needs the specific change.
   */
  readonly action: string;
}

export const DOMAIN_STATUS_LABEL: Record<DomainStatus, string> = {
  operational: "Operational",
  ready: "Ready",
  planning: "Planning",
};

export const DOMAIN_STATUS_MEANING: Record<DomainStatus, string> = {
  operational: "Has produced real entities from at least one publisher.",
  ready: "Publishers aimed at it. Nothing run through them yet.",
  planning: "No source chosen. Nothing run.",
};

export const ATLAS_DIRECTORY = "~/Businesses/Websites/elk-passport/atlas";

/* -------------------------------------------------------------------------
 * Pipeline — reference
 * ---------------------------------------------------------------------- */

/**
 * The real pipeline, in the vocabulary Atlas records.
 *
 * Stage names are the curator-facing labels in `runData.ts` (`STAGE_LABEL`),
 * which map to the events `RunRecorder` writes. One list, shared by every
 * domain, because there is one pipeline.
 */
export interface AcquisitionStage {
  readonly name: string;
  readonly event?: string;
  readonly atlasDoes: string;
  readonly operatorDoes: string;
  readonly resultsIn: string;
  readonly adminHref?: string;
  readonly adminLabel?: string;
  readonly implementation: string;
}

export const ACQUISITION_STAGES: readonly AcquisitionStage[] = [
  {
    name: "Discovered",
    event: "source-discovered",
    atlasDoes:
      "A page or area is identified as something that could teach Atlas.",
    operatorDoes: "You choose it. Atlas never picks a subject on its own.",
    resultsIn: "Terminal",
    implementation: "ingestion/batches/*.json",
  },
  {
    name: "Fetched",
    event: "source-fetched",
    atlasDoes: "The loader retrieves the page, or queries Overpass.",
    operatorDoes:
      "Nothing. Overpass allows two slots per IP — don't run two sweeps.",
    resultsIn: "Terminal",
    implementation: "ingestion/loaders/",
  },
  {
    name: "Verified",
    event: "source-verified",
    atlasDoes:
      "Checks it found a real content region, not the whole page body.",
    operatorDoes: "Run probe-source before adding a URL to a batch.",
    resultsIn: "Terminal",
    implementation: "ingestion/loaders/WebsiteSourceLoader.ts",
  },
  {
    name: "Understood",
    event: "knowledge-extracted",
    atlasDoes: "OpenAI reads it into candidates; Nominatim resolves addresses.",
    operatorDoes: "Nothing. This is the only stage that costs money.",
    resultsIn: "Terminal",
    implementation: "ingestion/extraction/ExtractionService.ts",
  },
  {
    name: "Reviewed",
    event: "review-completed",
    atlasDoes: "A review gate decides which candidates are approved.",
    operatorDoes:
      "Nothing first. Batch ingestion auto-approves; review happens afterwards.",
    resultsIn: "Review",
    adminHref: "/admin/review",
    adminLabel: "Review",
    implementation: "ingestion/review/ReviewGate.ts",
  },
  {
    name: "Recognised",
    event: "entity-matched",
    atlasDoes:
      "A candidate matching an existing entity is merged into it, not saved twice.",
    operatorDoes:
      "Check duplicates. Name, description, type and geometry are never overwritten.",
    resultsIn: "Duplicates",
    adminHref: "/admin/duplicates",
    adminLabel: "Duplicates",
    implementation: "ingestion/dedup/DuplicateGuard.ts",
  },
  {
    name: "Created",
    event: "entity-created",
    atlasDoes: "A candidate with no match becomes a new entity.",
    operatorDoes: "Confirm the count rose by what you expected.",
    resultsIn: "All entities",
    adminHref: "/admin/entities",
    adminLabel: "All entities",
    implementation: "ingestion/IngestionPipeline.ts",
  },
  {
    name: "Connected",
    event: "relationship-created",
    atlasDoes: "Entities near or containing one another are related.",
    operatorDoes:
      "Run it yourself afterwards. near writes directly; contains only proposes.",
    resultsIn: "Terminal",
    implementation: "application/relationships/",
  },
  {
    name: "Placed",
    atlasDoes: "An entity is asserted to be a member of a region.",
    operatorDoes:
      "You assert it. Atlas never infers membership from coordinates.",
    resultsIn: "Regions",
    adminHref: "/admin/regions",
    adminLabel: "Regions",
    implementation: "explorer/defineRegionCli.ts, explorer/growRegionCli.ts",
  },
  {
    name: "Finished",
    event: "run-completed",
    atlasDoes: "The run closes and its event log becomes readable.",
    operatorDoes:
      "Read the run — except after batch-ingest, which records none.",
    resultsIn: "KnowledgeDomain Control",
    adminHref: "/admin/runs",
    adminLabel: "KnowledgeDomain Control",
    implementation: "application/observability/RunRecorder.ts",
  },
];

/* -------------------------------------------------------------------------
 * Troubleshooting — reference
 * ---------------------------------------------------------------------- */

/**
 * Problems that have actually happened.
 *
 * `notThis` carries the value: each of these has an intuitive reading that is
 * wrong and costs something.
 */
export interface TroubleshootingEntry {
  readonly id: string;
  readonly symptom: string;
  readonly meaning: string;
  readonly notThis: string;
  readonly whatToDo: readonly string[];
  readonly decidedIn: string;
}

export const TROUBLESHOOTING: readonly TroubleshootingEntry[] = [
  {
    id: "publisher-timeout",
    symptom: "A publisher reports failed.",
    meaning:
      "Atlas stopped waiting. 15s for every Discovery publisher, 30s for Overpass. A fact about the request.",
    notThis:
      "Not that the publisher holds nothing. Atlas learned nothing at all about it, and failed may never be reported as none-found.",
    whatToDo: [
      "Rerun. A transient timeout is the common case.",
      "If it fails twice, check the publisher is reachable before concluding anything.",
      "Never record the subject as absent.",
    ],
    decidedIn: "discovery/requestTimeout.ts, discovery/DiscoveryProvider.ts",
  },
  {
    id: "overpass-busy",
    symptom:
      "OpenStreetMap returns 504, or a remark saying the server is busy.",
    meaning:
      "Overpass sheds load. Two slots per IP. Atlas already retried once, after 500–1000ms.",
    notThis:
      "Not a query error and not an empty area. A remark inside a 200 body is a failed query, not an empty one.",
    whatToDo: [
      "Wait a minute and rerun — the automatic retry is spent.",
      "Check no other Atlas command is querying Overpass.",
      "If the query times out server-side, the bounding box is too large.",
    ],
    decidedIn: "ingestion/loaders/overpass.ts",
  },
  {
    id: "ambiguous-identity",
    symptom:
      "Several record sets converge on your search, and Atlas proposes none.",
    meaning:
      "Two or more candidate places genuinely match inside the searched area. Choosing is the decision Atlas is not allowed to make.",
    notThis:
      "Not a failure. A single weak signal must never create an identity; several independent signals may only create a question.",
    whatToDo: [
      "Narrow with --bbox so only the place you mean is inside.",
      "Or confirm with --confirm-identity plus --proposal <key>.",
      "--decline <key> keeps the investigation open and withdraws that proposal.",
    ],
    decidedIn: "discovery/proposeIdentity.ts",
  },
  {
    id: "no-convergence",
    symptom: "Publishers answered, sources listed, no identity proposed.",
    meaning:
      "The bar was not met: two independent publishers, the same normalised name, a canonical id from each, all in scope, and geographic agreement against a published area.",
    notThis:
      "Not disagreement. Usually no publisher returned an area — and two points with no polygon cannot establish that two records are one place.",
    whatToDo: [
      "Check whether BC Freshwater Atlas answered. If it failed, the geographic test was missing.",
      "Rerun once it answers.",
      "The sources found are still real results.",
    ],
    decidedIn: "discovery/proposeIdentity.ts",
  },
  {
    id: "nothing-written",
    symptom: "The investigation succeeded and no entity appeared.",
    meaning:
      "Correct, by design. Discovery finds sources and creates work, never facts.",
    notThis:
      "Not a lost run. Discovery, identity confirmation, ingestion and region placement are four separate workflows.",
    whatToDo: [
      "Discovery finds a source; confirming resolves what it is called.",
      "Ingestion creates the entity — batch-ingest, or reading the queue.",
      "Region membership is asserted separately with define-region or grow-region.",
    ],
    decidedIn: "ADR 031 §2 — Discovery creates work, never facts",
  },
];

/* -------------------------------------------------------------------------
 * The Knowledge Domains
 * ---------------------------------------------------------------------- */

export const KNOWLEDGE_DOMAINS: readonly KnowledgeDomain[] = [
  {
    slug: "geography",
    entityCategories: ["water"],
    designation: "I",
    name: "Geography & Natural Features",
    purpose: "Lakes, rivers, mountains and the named land itself.",
    remit:
      "Establish that a place exists, where it is, and every name it is published under. Settles identity; does not describe.",
    status: "operational",
    entityKinds: ["Place"],
    subjects: [
      { name: "Lakes", reachable: true, via: "OSM, BCGNIS, Freshwater Atlas" },
      { name: "Rivers and creeks", reachable: true, via: "OSM, BCGNIS" },
      { name: "Mountains and peaks", reachable: true, via: "OSM, BCGNIS" },
      { name: "Waterfalls", reachable: true, via: "OSM, BCGNIS" },
      {
        name: "Extent and area",
        reachable: false,
        via: "Freshwater Atlas publishes polygons; nothing writes them to an entity",
      },
    ],
    publishers: [
      {
        name: "OpenStreetMap",
        purpose:
          "The crowd's answer. The only publisher that can be asked about any area.",
        asks: "Is there a feature published under exactly this name in this box?",
        learns: "That the feature exists, and where.",
        status: "operational",
        implementation: "application/discovery/OSMRegionLookup.ts",
        limitation:
          "Exact name match only. A feature under a different name is invisible.",
        onFailure:
          "Returns failed with a receipt, never an empty result. Bounded at 30s. One automatic retry on 502/503/504.",
        operatorAction:
          "Rerun. If it fails twice, wait a minute — Overpass sheds load.",
      },
      {
        name: "BC Geographical Names",
        purpose:
          "The province's official gazetteer. The authority on what a feature is called.",
        asks: "Which officially named features match this name in this area?",
        learns:
          "Official name, feature type, a labelled position, a BCGNIS id.",
        status: "operational",
        implementation: "application/discovery/BCGeographicalNamesLookup.ts",
        limitation:
          "Publishes a point, never an extent. ArcGIS reports failure inside a 200 response — this loader checks for that.",
        onFailure:
          "Returns failed after 15s. Atlas learns nothing about this publisher — not that the name is absent.",
        operatorAction:
          "Rerun. Never record a feature as unnamed by the province on the strength of a timeout.",
      },
      {
        name: "BC Freshwater Atlas",
        purpose:
          "The province's independent second answer for water, and the only publisher that returns an area.",
        asks: "Is there a waterbody polygon with this name here?",
        learns: "Polygons, provincial identifiers, extent.",
        status: "operational",
        implementation: "application/discovery/FreshwaterAtlasLookup.ts",
        limitation:
          "Names span at least four layers; the probe queries one, so a miss is not absence.",
        onFailure:
          "Each layer bounded at 15s. Because it is the only area publisher, its failure also removes identity reconciliation's geographic test — the run then reports no-convergence rather than failed.",
        operatorAction:
          "Rerun before concluding anything about identity. A run where this failed could not have proposed one.",
      },
      {
        name: "Wikipedia",
        purpose: "Prose, where anyone has written any.",
        asks: "Is there a dedicated article, or one the search index ranks for this name?",
        learns: "A description, coordinates, a page you can read.",
        status: "operational",
        implementation:
          "application/discovery/strategies/WikipediaSearchStrategy.ts",
        limitation:
          "Most features have no article. A disambiguation page is never a destination.",
        onFailure:
          "Returns failed after 15s. An unconfirmed constructed URL stays a hypothesis and is never recommended.",
        operatorAction: "Rerun. Nothing about the article was established.",
      },
      {
        name: "Natural Resources Canada — CGNDB",
        purpose:
          "The federal gazetteer, for features the province does not name.",
        learns: "Federally recorded names and identifiers.",
        status: "planned",
      },
    ],
    operations: [
      {
        id: "discover",
        title: "Investigate one named feature",
        purpose:
          "Walks the publisher ladder for one name and reports who has heard of it and whether they converge on one place.",
        whenToUse:
          "First thing for any new subject. Writes nothing, costs nothing.",
        duration: "2–4 min · each publisher bounded at 15s, Overpass at 30s",
        before: [
          "The region must exist, so the search has a bounding box.",
          ".env.local must hold the Supabase credentials.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command: 'npm run discover -- "Hidden Lake" --region "Okanagan"',
        expected:
          "A scope with a bounding box, one line per publisher (found / none-found / failed), readable sources, and either an identity proposal with evidence or a stated reason there is none.",
        thenCheck: [
          "Read the publisher lines first — a failed line invalidates whatever depended on it.",
          "Confirming a proposed identity is irreversible.",
          "Nothing was written. Creating the entity is a separate step.",
        ],
        knownFailures: [
          {
            symptom: "A publisher line says failed.",
            meaning: "Transport, not absence. Atlas learned nothing about it.",
            recovery:
              "Rerun the identical command. Do not treat the subject as absent.",
          },
          {
            symptom: "No Discovery Scope — the run refuses to search.",
            meaning:
              "The region has no derivable bounding box, and an unbounded search would return every same-named lake in BC.",
            recovery:
              "Pass --bbox s,w,n,e, or place entities in the region first.",
          },
          {
            symptom: "Several record sets converge and Atlas proposes none.",
            meaning: "Genuine ambiguity. Choosing is not Atlas's decision.",
            recovery:
              "Narrow with --bbox, or confirm with --confirm-identity --proposal <key>.",
          },
          {
            symptom: "Publishers answered but no identity was proposed.",
            meaning:
              "Usually no publisher returned an area, removing the geographic test.",
            recovery:
              "Check whether BC Freshwater Atlas answered; rerun if it failed.",
          },
        ],
        note: 'Answering a proposal: --confirm-identity "<name>" --proposal <key>, or --decline <key>. The key records which evidence you saw.',
      },
      {
        id: "wikipedia-batch",
        title: "Ingest a prepared Wikipedia batch",
        purpose:
          "Reads each article and creates or enriches the entity it describes.",
        whenToUse:
          "After discovery shows a subject has a real article. This one writes.",
        duration:
          "Not measured · one OpenAI call per entry, 750ms between items",
        before: [
          ".env.local must hold OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
          "Costs money — every entry is an extraction call.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run batch-ingest -- src/ingestion/batches/north-okanagan-batch-1.json",
        expected:
          "One block per entry: candidates proposed, approved, entities persisted, duplicates linked.",
        thenCheck: [
          "New entities are unplaced until you assign them to a region.",
          "A known subject is linked as corroborating evidence, not duplicated.",
        ],
        checkHref: "/admin/entities",
        checkLabel: "All entities",
        knownFailures: [
          {
            symptom: "No run appears in KnowledgeDomain Control.",
            meaning: "Expected. batch-ingest does not use RunRecorder.",
            recovery: "Verify by entity count and by opening an entity.",
          },
          {
            symptom: "Zero persisted, high duplicates linked.",
            meaning:
              "Atlas already knew these subjects and merged any new facts.",
            recovery:
              "Not a failure. Open one entity and confirm it gained something.",
          },
        ],
      },
    ],
    blockers: [
      {
        what: "No write path from a structured record.",
        clearedBy:
          "An OSM relation or Freshwater Atlas polygon cannot become an entity. Needs an ingestion path from structured records.",
        owner: "engineering",
        action: "Implement the structured-record ingestion path",
      },
      {
        what: "Every place is a point.",
        clearedBy: "No publisher Atlas asks returns a storable extent.",
        owner: "engineering",
        action: "Evaluate a publisher that returns extents",
      },
    ],
    batchFiles: [
      "src/ingestion/batches/north-okanagan-batch-1.json",
      "src/ingestion/batches/osm-north-okanagan-batch-1.json",
    ],
    openQuestions: [
      "A feature identified from structured records alone cannot become an entity.",
      "Ways and relations are invisible to the POI sweep, so waterbodies and parks mapped as areas are not enumerated.",
      "Identity reconciliation needs a published area and only one publisher returns one. When it fails, nothing can be proposed.",
    ],
  },

  {
    slug: "recreation",
    entityCategories: [
      "parks",
      "trails",
      "beaches",
      "campgrounds",
      "water-access",
      "viewpoints",
      "resorts",
      "cycling",
      "winter",
      "climbing",
      "golf",
    ],
    alsoHolds: {
      kind: "Activity",
      label: "Things to do",
      note: "An Activity is something you do at a place, not a place. Counted here rather than mixed into the categories above, where it distorted every figure Recreation reported.",
    },
    designation: "II",
    name: "Recreation",
    purpose: "Where people go outdoors, and what they can do there.",
    remit:
      "Teach Atlas where people go outdoors and what they can do there. Access matters as much as existence: a trail with no trailhead is half-known.",
    status: "ready",
    entityKinds: ["Place", "Activity"],
    subjects: [
      {
        name: "Parks and protected areas",
        reachable: true,
        via: "BC Parks, one page at a time",
      },
      { name: "Beaches", reachable: true, via: "OSM sweep — natural=beach" },
      {
        name: "Campgrounds",
        reachable: true,
        via: "OSM sweep — tourism=camp_site",
      },
      {
        name: "Boat launches",
        reachable: true,
        via: "OSM sweep — leisure=slipway",
      },
      {
        name: "Viewpoints",
        reachable: true,
        via: "OSM sweep — tourism=viewpoint",
      },
      {
        name: "Picnic areas",
        reachable: true,
        via: "OSM sweep — tourism=picnic_site",
      },
      {
        name: "Ski and bike areas",
        reachable: true,
        via: "The operator's own website",
      },
      {
        name: "Outdoor activities at a park",
        reachable: true,
        via: "BC Parks publishes a description per activity",
      },
      {
        name: "Trails",
        reachable: false,
        via: "No trail tag in the POI allow list; no trail publisher wired",
      },
      { name: "Trailheads", reachable: false, via: "Same gap as trails" },
      {
        name: "Recreation sites",
        reachable: false,
        via: "Recreation Sites & Trails BC not implemented",
      },
      {
        name: "Climbing areas",
        reachable: false,
        via: "No publisher identified",
      },
    ],
    publishers: [
      {
        name: "BC Parks",
        purpose:
          "The provincial authority on protected areas. The only publisher that describes a park in its own words.",
        asks: "What does the province publish about the park at this slug?",
        learns:
          "Description, location notes, a description per activity, facilities, campfire bans, the province's ORCS id.",
        status: "ready",
        implementation: "ingestion/loaders/BCParksSourceLoader.ts",
        limitation:
          "One park per entry, by slug. Nothing lists the parks in a region, so slugs are chosen by hand.",
        onFailure:
          "Throws a SourceLoadError for that entry. The batch records it as failed and continues.",
        operatorAction:
          "Check the slug on bcparks.ca — a wrong slug and an unreachable service look identical.",
      },
      {
        name: "OpenStreetMap",
        purpose:
          "The only publisher that can sweep an area and return every POI in it.",
        asks: "Which allow-listed tags appear on nodes inside this box?",
        learns:
          "Beaches, campgrounds, picnic sites, boat launches, viewpoints — plus parking, washrooms, drinking water.",
        status: "ready",
        implementation:
          "ingestion/loaders/OSMNearbyPoiLoader.ts, ingestion/loaders/osmPoiAllowList.ts",
        limitation:
          "Nodes only, so polygons are missed. No trail or trailhead tag in the POI allow list, so trails cannot be enumerated.",
        onFailure:
          "Overpass sheds load with a 504, or a remark inside a 200 — a failed query, not an empty area. One automatic retry.",
        operatorAction:
          "Wait a minute and rerun. If the query times out server-side, the box is too large.",
      },
      {
        name: "Operator websites",
        purpose:
          "First-party truth for a ski hill or bike park — hours, terrain, seasons.",
        asks: "What does this operator publish about itself?",
        learns:
          "Anything on the page, verified to a real content region first.",
        status: "operational",
        implementation: "ingestion/loaders/WebsiteSourceLoader.ts",
        limitation:
          "The first official-website batch failed on all nine pages, silently.",
        onFailure:
          "A page with no content region falls back to the whole body and extracts poorly. A bad result, not an error.",
        operatorAction:
          "Run probe-source first. No writes, no AI, no database.",
      },
      {
        name: "Recreation Sites & Trails BC",
        purpose:
          "The province's other recreation authority. Publishes managed sites — closer to what a visitor goes to.",
        learns:
          "Recreation sites and trails outside the park system, with site ids.",
        status: "planned",
        limitation:
          "Site identifiers, not feature identifiers. The relationship must be evidenced, not assumed.",
      },
      {
        name: "Regional and municipal park systems",
        purpose: "Most parks people visit are not provincial.",
        learns: "Local parks, beaches, boat launches, trail networks.",
        status: "planned",
        limitation: "No single endpoint. One publisher per district.",
      },
      {
        name: "Destination BC and tourism boards",
        purpose: "Curated lists of what visitors are directed to.",
        learns: "What is promoted, and the seasonal framing.",
        status: "planned",
        limitation:
          "Promotion is not existence. A directory, not an authority.",
      },
      {
        name: "Trailforks",
        purpose:
          "The most complete mountain-bike trail data for this region, if usable.",
        learns: "Trail networks, difficulty, condition reports.",
        status: "research-candidate",
        limitation:
          "Access terms and licensing unread. Nothing establishes Atlas may use it.",
      },
      {
        name: "AllTrails",
        purpose: "Broad hiking trail coverage, if usable.",
        learns: "Routes, lengths, difficulty.",
        status: "research-candidate",
        limitation:
          "Access terms and licensing unread. Nothing establishes Atlas may use it.",
      },
    ],
    operations: [
      {
        id: "osm-sweep",
        title: "Sweep an area for recreation points of interest (POI)",
        purpose:
          "Queries Overpass for every allow-listed tag in a bounding box and ingests what returns.",
        whenToUse:
          "To find what exists rather than confirm what you know. The only enumerating operation this domain has.",
        duration:
          "Not measured · one Overpass query, then one OpenAI call for the document",
        before: [
          ".env.local must hold OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
          "The shipped bounding box covers Ellison Provincial Park. Change it for another area.",
          "Overpass allows two slots per IP. Don't start a second sweep.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run batch-ingest -- src/ingestion/batches/osm-poi-ellison-batch-1.json",
        expected:
          "Many distinct entities from one document — campgrounds, picnic sites, boat launches, viewpoints, and the parking and washrooms beside them.",
        thenCheck: [
          "Check duplicates. A sweep near known entities is the likeliest source of near-matches.",
          "Nothing is placed in a region by this command.",
        ],
        checkHref: "/admin/duplicates",
        checkLabel: "Duplicates",
        knownFailures: [
          {
            symptom: "504, or a remark saying the server is busy.",
            meaning: "Overpass shed load. The automatic retry is spent.",
            recovery: "Wait a minute and rerun.",
          },
          {
            symptom: "Far less returned than expected.",
            meaning:
              "Nodes only — polygon beaches and parking areas are invisible.",
            recovery:
              "Not recoverable today. Needs a change to OSMNearbyPoiLoader.",
          },
        ],
        note: "For another area, copy the batch file and change bbox and areaLabel. Cover the surroundings, not just the park.",
      },
      {
        id: "run-queue",
        title: "Read the pages Atlas has already discovered",
        purpose:
          "Reads queued candidate sources and applies what each teaches to the entity it names.",
        whenToUse:
          "When an entity has discovered pages nobody has read. This is enrichment of things Atlas already holds, not discovery of new ones.",
        duration: "Not measured · one fetch and one OpenAI call per page",
        before: [
          ".env.local must hold OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
          "Always start with --dry-run. It costs nothing and prints exactly what a real run would attempt.",
          "The run is bounded by budgets stated up front. Nothing here runs on a timer.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command: "npm run run-queue",
        expected:
          "Each queued page is fetched, extracted, and its facts applied to the entity named in expectedTargets. A page Atlas cannot attribute is refused rather than guessed at.",
        thenCheck: [
          "Return to this page and press Refresh status — the entity's queued count is re-read from Atlas.",
          "A page that failed stays queued and is listed under the entity as needing attention.",
        ],
        checkHref: "/admin/runs",
        checkLabel: "Mission Control",
        knownFailures: [
          {
            symptom: "A page reports a fetch failure.",
            meaning:
              "Transport, not identity. The candidate stays queued and nothing was written for it.",
            recovery:
              "Re-run the queue. Persistent failures need the URL checked by hand.",
          },
          {
            symptom: "A page is read but nothing is learned.",
            meaning:
              "Extraction produced nothing Atlas could attribute to the entity. That is an evidence problem, not a transport one.",
            recovery:
              "Acquire a different kind of source. Reading the same page again will not change it.",
          },
        ],
        note: "Bounded by --max and --extractions. `npm run run-queue -- --branch <entityId>` restricts it to one entity and anything it contains.",
      },
      {
        id: "bcparks",
        title: "Ingest provincial park pages",
        purpose:
          "Reads each park's BC Parks record and creates or enriches its entity.",
        whenToUse:
          "When you know which parks you want. The richest source this domain has.",
        duration: "Not measured · one OpenAI call per park",
        before: [
          ".env.local must hold OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
          "Add slugs to the batch file yourself — nothing lists them.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run batch-ingest -- src/ingestion/batches/bcparks-north-okanagan-batch-1.json",
        expected:
          "A park already known from Wikipedia is recognised, not duplicated, and gains activities and facilities in the province's own words.",
        thenCheck: [
          "Open one park and confirm the activity descriptions are the province's words, not a summary.",
        ],
        checkHref: "/admin/entities",
        checkLabel: "All entities",
        knownFailures: [
          {
            symptom: "One entry reports a source load error.",
            meaning: "Wrong slug, or BC Parks unreachable. Both look the same.",
            recovery: "Check the slug on bcparks.ca and rerun just that park.",
          },
        ],
      },
      {
        id: "probe",
        title: "Probe a website before trusting it",
        purpose:
          "Fetches a URL and runs the real extraction cascade — no writes, no AI, no database.",
        whenToUse: "Before adding any URL to a batch. Always.",
        duration: "Seconds · one fetch, no AI call",
        before: ["None. No side effects, no cost."],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run probe-source -- https://www.bigwhite.com/summer/hiking-trails",
        expected: "A named content region and a plausible amount of text.",
        thenCheck: [
          "whole-body, or a tiny region, means the page is wrong for a batch file.",
        ],
        knownFailures: [
          {
            symptom: "whole-body extraction.",
            meaning:
              "No content region. The extraction would be noise, and would fail quietly.",
            recovery: "Find a more specific page, or leave the URL out.",
          },
        ],
      },
      {
        id: "operator-site",
        title: "Ingest an operator's own pages",
        purpose:
          "Reads a resort or park operator's site — the only first-party source for hours and terrain.",
        whenToUse: "Once every URL in the batch has been probed.",
        duration: "Not measured · one OpenAI call per page",
        before: [
          "Probe every URL first.",
          ".env.local must hold OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run batch-ingest -- src/ingestion/batches/bigwhite-official-batch-1.json",
        expected:
          "Existing entities gain first-party facts — hours, contact details, images.",
        thenCheck: [
          "Disagreements do not resolve themselves. Atlas keeps what it had and raises a conflict.",
        ],
        checkHref: "/admin/runs",
        checkLabel: "KnowledgeDomain Control",
        knownFailures: [
          {
            symptom: "Pages ingest but nothing changes on the entity.",
            meaning:
              "Whole-body extraction — candidates carry nothing attributable.",
            recovery:
              "Probe the URLs and replace the ones reporting whole-body.",
          },
        ],
      },
      {
        id: "connect",
        title: "Relate what is near what",
        purpose: "Derives near relationships across every Place Atlas holds.",
        whenToUse: "After new places are added. Not before.",
        duration: "Not measured · pure computation over existing entities",
        before: [
          "Run after ingesting.",
          ".env.local must hold the Supabase credentials.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command: "npm run compute-near-relationships",
        expected:
          "Counts of active places and existing near edges, then a table of genuinely new pairs.",
        thenCheck: ["Safe to rerun. It only proposes pairs that do not exist."],
        knownFailures: [
          {
            symptom: "No new relationships to create.",
            meaning: "Everything derivable is derived.",
            recovery: "Nothing to do. This is the steady state.",
          },
        ],
      },
      {
        id: "place",
        title: "Place new entities in a region",
        purpose: "Asserts that named entities are members of a region.",
        whenToUse:
          "After ingestion. New entities stay unplaced until you do this.",
        duration: "Seconds · one relationship write per entity",
        before: [
          "Membership is an assertion. Atlas will not infer it from coordinates.",
          "Names are matched exactly — copy them from All entities.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          'npm run define-region -- "Okanagan" --assign "Ellison Provincial Park"',
        expected:
          "The region's count rises by exactly what you assigned. Nothing else changes.",
        thenCheck: [
          "Unplaced entities are counted separately on All entities.",
        ],
        checkHref: "/admin/regions",
        checkLabel: "Regions",
        knownFailures: [
          {
            symptom: "The named entity is not found.",
            meaning: "Matched by exact name or id, never fuzzily.",
            recovery: "Copy the exact name from All entities and rerun.",
          },
        ],
      },
    ],
    blockers: [
      {
        what: "Trails and trailheads cannot be acquired at all.",
        clearedBy:
          "Add trail tags to the POI allow list (osmPoiAllowList.ts), or wire a trail publisher. This one change moves three subjects to reachable.",
        owner: "engineering",
        action: "Add trail tags to the POI allow list",
      },
      {
        what: "The sweep queries nodes only.",
        clearedBy: "Widen OSMNearbyPoiLoader to ways and relations.",
        owner: "engineering",
        action: "Widen the sweep to ways and relations",
      },
      {
        what: "Non-provincial recreation sites have no publisher.",
        clearedBy:
          "Evaluate Recreation Sites & Trails BC — access and identifiers.",
        owner: "decision",
        action: "Evaluate Recreation Sites & Trails BC",
      },
    ],
    batchFiles: [
      "src/ingestion/batches/osm-poi-ellison-batch-1.json",
      "src/ingestion/batches/bcparks-north-okanagan-batch-1.json",
      "src/ingestion/batches/bigwhite-official-batch-1.json",
    ],
    openQuestions: [
      "Trails and trailheads — the most requested thing in this domain — cannot be acquired.",
      "Recreation Sites & Trails BC is the obvious answer for non-provincial sites and has not been evaluated.",
      "The sweep queries nodes only, so polygons are silently missed.",
      "batch-ingest records no run, so the only evidence a sweep happened is the entities it created.",
    ],
  },

  {
    slug: "food-and-drink",
    entityCategories: ["restaurants", "wineries"],
    designation: "III",
    name: "Food & Drink",
    purpose: "Wineries, breweries, restaurants and cafés.",
    remit:
      "Places that serve, and the organisations behind them. The first domain where the thing and its operator are routinely different entities.",
    status: "operational",
    entityKinds: ["Place", "Organization"],
    subjects: [
      {
        name: "Restaurants and cafés",
        reachable: true,
        via: "The operator's page; an OSM sweep would enumerate them",
      },
      {
        name: "Breweries and wineries",
        reachable: true,
        via: "OSM sweep — craft=brewery, craft=winery",
      },
      {
        name: "Menus, hours, contact",
        reachable: true,
        via: "The operator's website",
      },
      {
        name: "Seasonal closures",
        reachable: false,
        via: "Atlas has no model of a fact that expires",
      },
    ],
    publishers: [
      {
        name: "Operator websites",
        purpose:
          "First-party truth. The only source accountable for its own hours.",
        asks: "What does this business publish about itself?",
        learns: "Hours, menus, contact details, images, its own description.",
        status: "operational",
        implementation: "ingestion/loaders/WebsiteSourceLoader.ts",
        limitation:
          "Disagreements are left for a curator. Atlas keeps what it had.",
        onFailure:
          "A page with no content region falls back to the whole body and extracts poorly. Conflicts are raised, not resolved.",
        operatorAction:
          "Probe first. Resolve conflicts in KnowledgeDomain Control.",
      },
      {
        name: "OpenStreetMap",
        purpose:
          "Enumeration — the only way to find places nobody has named to Atlas.",
        asks: "Which food and drink tags appear inside this box?",
        learns: "Restaurants, cafés, breweries, wineries across an area.",
        status: "ready",
        implementation: "ingestion/loaders/OSMNearbyPoiLoader.ts",
        limitation:
          "Nodes only, and a name at best. Detail comes from the operator's page.",
        onFailure: "504 or a remark inside a 200. One automatic retry.",
        operatorAction: "Wait a minute and rerun.",
      },
      {
        name: "BC Wine Institute and regional associations",
        purpose: "Membership directories — a curated list of who exists.",
        learns: "Which wineries are in a region, and their official sites.",
        status: "planned",
      },
      {
        name: "Restaurant review platforms",
        purpose: "Coverage of places with no website.",
        learns: "Existence, category, rough location.",
        status: "research-candidate",
        limitation:
          "Licensing unread, and review content is a different kind of claim from a fact.",
      },
    ],
    operations: [
      {
        id: "queue",
        title: "Read a bounded slice of the queue",
        purpose: "Fetches and extracts a limited number of queued sources.",
        whenToUse:
          "Any time the queue has grown. Turns queued work into knowledge.",
        duration: "Not measured · roughly one OpenAI call per source read",
        before: [
          "Always start with --dry-run. Costs nothing, prints exactly what a real run would attempt.",
          ".env.local must hold the OpenAI and Supabase credentials.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command: "npm run run-queue -- --max 10 --dry-run",
        expected:
          "A plan naming each candidate. Without --dry-run, a recorded run with entities read, enriched and learned.",
        thenCheck: [
          "Drop --dry-run once the plan looks right.",
          "Conflicts and ambiguous extractions are decisions for you, not failures.",
        ],
        checkHref: "/admin/runs",
        checkLabel: "KnowledgeDomain Control",
        knownFailures: [
          {
            symptom: "Several sources report failed.",
            meaning:
              "The pages could not be read. The run continues; candidates stay queued.",
            recovery:
              "Probe the failing URLs. A failed source is not removed from the queue.",
          },
        ],
      },
      {
        id: "directory",
        title: "Expand a directory page into its children",
        purpose:
          "Reads a page listing places, creates each child, queues its detail page. Fetches none of them.",
        whenToUse: "When one page lists many places you want.",
        duration:
          "Not measured · one fetch and one extraction for the directory page",
        before: [
          "You supply the parent entity id — that is what guarantees containment cannot invert.",
          ".env.local must hold the OpenAI and Supabase credentials.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run expand-directory -- <parentEntityId> https://www.bigwhite.com/explore/food-dining official-website",
        expected:
          "Children created, contains edges written, one queued source per child.",
        thenCheck: [
          "Children know nothing yet — their pages are queued, not read.",
        ],
        checkHref: "/admin/runs",
        checkLabel: "KnowledgeDomain Control",
        knownFailures: [
          {
            symptom: "No repeated name-and-link units detected.",
            meaning: "The page is not a directory in the shape this detects.",
            recovery: "Ingest the individual pages directly instead.",
          },
        ],
      },
    ],
    blockers: [
      {
        what: "Nothing decides when a fact has gone stale.",
        clearedBy: "Hours and menus drift silently. Needs a freshness model.",
        owner: "engineering",
        action: "Design a freshness model",
      },
      {
        what: "The OSM sweep has never been run for this domain.",
        clearedBy:
          "It would enumerate restaurants across a whole area. A batch file away.",
        owner: "operator",
        action: "Write the batch file and run the sweep",
      },
    ],
    batchFiles: ["src/ingestion/batches/bigwhite-official-batch-1.json"],
    openQuestions: [
      "Hours, seasons and menus change faster than Atlas re-reads, and nothing marks a fact stale.",
      "A winery and its tasting room are one point in OpenStreetMap and two entities in Atlas.",
      "The POI sweep would enumerate restaurants and has never been run here.",
    ],
  },

  {
    slug: "accommodation",
    entityCategories: ["lodging"],
    designation: "IV",
    name: "Accommodation",
    purpose: "Where a visitor sleeps.",
    remit:
      "Hotels, lodges, bookable campgrounds, and their operators. Distinct from Recreation: a campground you can book is accommodation; the same ground for an afternoon is recreation.",
    status: "planning",
    entityKinds: ["Place", "Organization"],
    subjects: [
      {
        name: "Hotels and lodges",
        reachable: false,
        via: "Their websites would work; nothing is pointed at them",
      },
      {
        name: "Bookable campgrounds",
        reachable: false,
        via: "No publisher configured",
      },
      {
        name: "Availability and price",
        reachable: false,
        via: "Out of scope until the boundary is drawn",
      },
    ],
    publishers: [
      {
        name: "Operator websites",
        purpose: "The same first-party route every other domain uses.",
        asks: "Nothing yet — no URL has been aimed at this domain.",
        learns: "Rooms, seasons, contact details, the operator's own words.",
        status: "ready",
        implementation: "ingestion/loaders/WebsiteSourceLoader.ts",
        limitation: "Nothing points it at accommodation. No batch file exists.",
        onFailure:
          "As everywhere: no content region means whole-body, which extracts poorly.",
        operatorAction:
          "Probe before ingesting, once there is something to ingest.",
      },
      {
        name: "BC Parks camping reservations",
        purpose: "The authority on bookable provincial campsites.",
        learns: "Which parks have sites, and how many.",
        status: "planned",
      },
      {
        name: "Large booking platforms",
        purpose: "Broad coverage of commercial accommodation.",
        learns: "Existence, category, location.",
        status: "research-candidate",
        limitation: "Commercial licensing unread. Assume nothing is permitted.",
      },
    ],
    operations: [],
    blockers: [
      {
        what: "The describe-versus-quote boundary is undrawn.",
        clearedBy: "An ADR. Nothing should be ingested before it exists.",
        owner: "decision",
        action: "Write the ADR",
      },
      {
        what: "Commercial licensing terms are unread.",
        clearedBy: "Read them for each candidate platform.",
        owner: "decision",
        action: "Review the licensing terms",
      },
    ],
    batchFiles: [],
    openQuestions: [
      "No publisher is configured. The obvious candidates carry unread commercial licensing terms.",
      "Availability and price are not knowledge Atlas should hold; the boundary is undrawn.",
    ],
  },

  {
    slug: "events",
    entityCategories: ["events"],
    designation: "V",
    name: "Events",
    purpose: "Things that happen once, or every year.",
    remit:
      "Festivals, markets, races and seasons. The only domain whose subject expires, which breaks Atlas's assumption that a fact stays true.",
    status: "planning",
    entityKinds: ["Event", "Organization"],
    subjects: [
      {
        name: "Festivals and markets",
        reachable: false,
        via: "Blocked on a temporal model, not a publisher",
      },
      {
        name: "Races and seasonal openings",
        reachable: false,
        via: "Same block",
      },
    ],
    publishers: [
      {
        name: "Municipal and tourism event calendars",
        purpose: "Where events are actually published.",
        learns: "What is on, when, and where.",
        status: "planned",
        limitation:
          "Wiring one before Atlas can represent expiry would fill the corpus with facts that quietly become false.",
      },
    ],
    operations: [],
    blockers: [
      {
        what: "Atlas has no concept of a fact that expires.",
        clearedBy:
          "A temporal model in the domain. Everything in this domain waits on it.",
        owner: "engineering",
        action: "Design the temporal model",
      },
    ],
    batchFiles: [],
    openQuestions: [
      "An event that has passed is not wrong and not current, and nothing in the model can say so.",
      "No publisher is configured, and configuring one is the wrong next move.",
    ],
  },

  {
    slug: "organizations",
    entityCategories: [],
    designation: "VI",
    name: "Organizations & Communities",
    purpose: "The people and bodies that run, steward and represent places.",
    remit:
      "Municipalities, First Nations, chambers of commerce, clubs, trail societies. Most of what is worth knowing about a region is held by someone, and the holder is a fact about the place.",
    status: "operational",
    entityKinds: ["Organization"],
    subjects: [
      {
        name: "Operators and businesses",
        reachable: true,
        via: "Their own sites, one URL at a time",
      },
      {
        name: "Clubs and societies",
        reachable: true,
        via: "Their own sites, if you know the URL",
      },
      {
        name: "Who stewards a place",
        reachable: false,
        via: "Stewardship has no representation in the relationship model",
      },
      {
        name: "Every organisation in a region",
        reachable: false,
        via: "No enumerating source",
      },
    ],
    publishers: [
      {
        name: "Official websites",
        purpose: "The organisation speaking for itself.",
        asks: "What does this organisation publish about itself?",
        learns:
          "Anything on the page, verified to a real content region first.",
        status: "operational",
        implementation: "ingestion/loaders/WebsiteSourceLoader.ts",
        limitation:
          "One URL at a time. Nothing lists the organisations in a region.",
        onFailure:
          "No content region means whole-body, which extracts poorly and quietly.",
        operatorAction: "Probe the URL before adding it to any batch or queue.",
      },
      {
        name: "BC corporate registry",
        purpose: "The authoritative list of who legally exists.",
        learns: "Registered names, status, addresses.",
        status: "planned",
        limitation:
          "A registry entry is not evidence an organisation is worth knowing about.",
      },
      {
        name: "First Nations and band council sites",
        purpose: "First-party for the communities whose territory this is.",
        learns: "How a nation describes itself, and what it stewards.",
        status: "planned",
        limitation:
          "Requires care no other publisher here does. Not a scraping target.",
      },
    ],
    operations: [
      {
        id: "directory",
        title: "Expand a directory page into its children",
        purpose:
          "Reads a page listing organisations, creates each one, queues its page.",
        whenToUse: "The only thing resembling enumeration this domain has.",
        duration:
          "Not measured · one fetch and one extraction for the directory page",
        before: [
          "You supply the parent entity id, so containment cannot invert.",
          ".env.local must hold the OpenAI and Supabase credentials.",
        ],
        workingDirectory: ATLAS_DIRECTORY,
        command:
          "npm run expand-directory -- <parentEntityId> <directoryUrl> official-website",
        expected:
          "One child per listed entry, each with a contains edge and a queued source.",
        thenCheck: ["Children know nothing until their own pages are read."],
        checkHref: "/admin/runs",
        checkLabel: "KnowledgeDomain Control",
        knownFailures: [
          {
            symptom: "No repeated name-and-link units detected.",
            meaning: "The page is not a directory in the shape this detects.",
            recovery: "Read the individual pages one at a time.",
          },
        ],
      },
    ],
    blockers: [
      {
        what: "No enumerating source.",
        clearedBy:
          "Organisations can be read but never listed. Needs a registry, or accept one URL at a time.",
        owner: "decision",
        action: "Decide: a registry, or one URL at a time",
      },
      {
        what: "Stewardship is unrepresentable.",
        clearedBy: "A stewardship relationship type in the model.",
        owner: "engineering",
        action: "Add a stewardship relationship type",
      },
    ],
    batchFiles: [],
    openQuestions: [
      "No enumerating source. Organisations can be read one URL at a time but not listed.",
      "Stewardship — who looks after a place — has no representation in the relationship model.",
    ],
  },
];

export function findDomain(slug: string): KnowledgeDomain | undefined {
  return KNOWLEDGE_DOMAINS.find((domain) => domain.slug === slug);
}

export function publishersByStatus(
  domain: KnowledgeDomain,
  status: PublisherStatus,
): readonly Publisher[] {
  return domain.publishers.filter((p) => p.status === status);
}

/**
 * Publishers this domain could use today.
 *
 * *Usable*, not *used* — a loader that exists and would work counts whether or
 * not anyone has aimed it here.
 */
export function usablePublisherCount(domain: KnowledgeDomain): number {
  return domain.publishers.filter(
    (p) => p.status === "operational" || p.status === "ready",
  ).length;
}
