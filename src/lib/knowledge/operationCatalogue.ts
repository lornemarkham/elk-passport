import "server-only";

/**
 * **Every operation Mission Control offers, described once.**
 *
 * ## Why a catalogue rather than copy in each component
 *
 * Each operation has to answer the same five questions *before* a curator
 * clicks it — what it does, why they would, whether it writes, what comes
 * out, how long it takes. Writing those beside each button guarantees they
 * drift: the Grow card and the Grow panel would eventually describe the
 * same operation differently, and a curator would have no way to tell
 * which was right.
 *
 * One record per operation, read by the next-action panel, the operation
 * panel and the workflow cards.
 *
 * ## `mutates` is stated, always
 *
 * A curator deciding whether to press something needs to know whether it
 * changes data. Atlas already separates *proposing* from *applying*
 * everywhere in the pipeline; the interface should make the same
 * distinction visible rather than leaving it to be inferred from a verb.
 *
 * ## Duration comes from measurement or is absent
 *
 * `durationSeconds` is only ever derived from Atlas's own completed runs.
 * There is no fallback estimate, because a plausible number that looks
 * like evidence is the failure mode this codebase keeps rediscovering. The
 * UI says *"no previous run to estimate from"* rather than guessing.
 *
 * ## Availability is honest, and names the real blocker
 *
 * An operation is `available`, or it is `blocked` **with the actual
 * reason** — not a "soon" badge. A curator must be able to tell *"Atlas
 * will never do this"* from *"Atlas cannot do this yet, and here is what
 * is missing."*
 */

export type OperationId =
  | "place-members"
  | "grow"
  | "fix-types"
  | "review-research"
  | "review-duplicates"
  | "activity"
  | "review-relationships"
  | "add-entity"
  | "add-source";

export interface OperationAvailability {
  readonly available: boolean;
  /** Present when unavailable. The real blocker, in the curator's terms. */
  readonly blockedBecause?: string;
  /** What exists today instead. Never left implicit. */
  readonly insteadToday?: string;
}

export interface OperationSpec {
  readonly id: OperationId;
  readonly label: string;
  /** One line: what it does. */
  readonly does: string;
  /** Why a curator would run it, given this region's actual state. */
  readonly why: string;
  /** Does it write to Atlas? Stated, never inferred from the verb. */
  readonly mutates: boolean;
  /** What comes out, concretely. */
  readonly outcome: readonly string[];
  /** Seconds, from Atlas's own history. `null` means unmeasured — say so. */
  readonly durationSeconds: number | null;
  /** How many things this concerns right now. Drives ranking. */
  readonly affected: number;
  readonly availability: OperationAvailability;
}

export interface CatalogueInput {
  readonly regionName: string;
  /** Entities in no region at all. The largest lever on the page. */
  readonly unassignedCount: number;
  /** Of those, how many Atlas holds documentary evidence for. */
  readonly actionableUnassigned: number;
  readonly untypedCount: number;
  readonly waitingCount: number;
  readonly runningCount: number;
  readonly duplicateGroups: number | null;
  readonly isolatedCount: number;
  readonly queuedSources: number;
  readonly growSeconds: number | null;
  readonly hasRun: boolean;
}

export function buildOperationCatalogue(
  input: CatalogueInput,
): Record<OperationId, OperationSpec> {
  const {
    regionName,
    unassignedCount,
    actionableUnassigned,
    untypedCount,
    waitingCount,
    duplicateGroups,
    isolatedCount,
    queuedSources,
    growSeconds,
    hasRun,
  } = input;

  return {
    // Placing entities was missing from this catalogue entirely, which
    // meant the Next Best Action could never recommend the biggest lever
    // on the page however obvious it was on screen. Everything else here
    // is computed over the region's scope; this is the operation that
    // changes it.
    "place-members": {
      id: "place-members",
      label: `Place entities in ${regionName}`,
      does: "Review what Atlas knows about each unplaced entity, and assert the ones that belong.",
      why:
        actionableUnassigned > 0
          ? `${actionableUnassigned} of ${unassignedCount} unplaced entities have documentary evidence tying them to this region — a real page describes them alongside something already here.`
          : `${unassignedCount} entities are in no region, and Atlas holds no documentary evidence for any of them. Placing them is entirely your judgement until ingestion gives Atlas something to read.`,
      mutates: true,
      outcome: [
        "Writes one `contains` relationship per entity — the whole assertion",
        "Widens every count on this page, because they are all computed over the region's scope",
        "Makes coverage measurable, which needs entities before it can mean anything",
        "Brings each placed entity into range of region-scoped growth",
      ],
      durationSeconds: null,
      // Reach is the *actionable* count, not the raw one. Ranking on 157
      // when 32 are tractable overstates the available work fivefold.
      affected: actionableUnassigned,
      availability:
        unassignedCount > 0
          ? { available: true }
          : {
              available: false,
              blockedBecause:
                "Every entity Atlas holds is already in a region.",
            },
    },

    grow: {
      id: "grow",
      label: `Grow ${regionName}`,
      // Precise on purpose. Grow does NOT go looking for new parts of the
      // region — it reads the queue, and the queue only contains pages
      // Atlas found while reading something already in this region's
      // branch. Saying "discovers new places" would promise a capability
      // the runner does not have.
      does: `Reads pages already in Atlas's queue for ${regionName} — never the open web.`,
      why:
        queuedSources > 0
          ? `Atlas knows about ${queuedSources} page${queuedSources === 1 ? "" : "s"} in this region it has not read yet.`
          : `Atlas has read every page in this region's queue. Growth will correctly find nothing until someone gives it a new source to start from — it does not go looking on its own.`,
      mutates: true,
      outcome: [
        "Adds facts to entities already here",
        "Creates entities for things a page lists inside them — a resort's dining directory becomes its restaurants",
        "Records relationships it can establish from what it read",
        "Queues further pages it finds — for the next run, never this one",
        "Finds nothing if the queue is empty, which is a correct result, not a failure",
      ],
      durationSeconds: growSeconds,
      affected: queuedSources,
      availability: { available: true },
    },

    "fix-types": {
      id: "fix-types",
      label: "Fix missing types",
      does: "Set what kind of place each untyped entity is.",
      why: "Type decides which layout a page gets, which facts count as complete, and which research Atlas runs. An untyped entity cannot be improved systematically.",
      mutates: true,
      outcome: [
        "Sets the type on each entity you decide",
        "Records your decision as editorial evidence, not as something a source said",
        "Removes them from this region's untyped count",
      ],
      durationSeconds: null,
      affected: untypedCount,
      availability: { available: true },
    },

    "review-research": {
      id: "review-research",
      label: "Review research",
      does: "Accept or reject what Atlas found but did not write.",
      why: "Atlas proposes and a person decides. Findings left unreviewed are knowledge Atlas has already paid for and cannot use.",
      mutates: true,
      outcome: [
        "Accepting writes the finding to the entity",
        "Rejecting keeps the evidence — Atlas simply does not apply it",
        "Either way the mission closes",
      ],
      durationSeconds: null,
      affected: waitingCount,
      availability: { available: true },
    },

    "review-duplicates": {
      id: "review-duplicates",
      label: "Review duplicates",
      does: "Compare entities Atlas thinks are the same real thing, and merge them if they are.",
      why: "Duplicates split a place's knowledge across two records, so neither page is complete and both look thinner than the corpus really is.",
      mutates: true,
      outcome: [
        "Merging combines both records into one",
        // Plain prose: these strings are rendered as text, not markdown.
        "Merging is not reversible in practice — Atlas proposes, you decide",
        "Skipping leaves both records untouched",
      ],
      durationSeconds: null,
      affected: duplicateGroups ?? 0,
      availability: { available: true },
    },

    activity: {
      id: "activity",
      label: hasRun ? "What Atlas did" : "Activity",
      does: "Every fetch, extraction and merge Atlas performed, in the order it happened.",
      why: "Evidence. When something looks wrong, this is where the actual steps are.",
      mutates: false,
      outcome: ["Shows the run's own events", "Changes nothing"],
      durationSeconds: null,
      affected: 0,
      availability: hasRun
        ? { available: true }
        : {
            available: false,
            blockedBecause:
              "Atlas has not run anything yet, so there is nothing to show.",
            insteadToday: `Grow ${regionName} to create the first run.`,
          },
    },

    "review-relationships": {
      id: "review-relationships",
      label: "Review relationships",
      does: "Confirm or reject connections Atlas proposed between entities.",
      why: "Relationships are how a traveller explores rather than searches. Entities connected to nothing can only be found by name.",
      mutates: true,
      outcome: [
        "Confirming writes the relationship",
        "Rejecting records that it was considered and refused",
      ],
      durationSeconds: null,
      affected: isolatedCount,
      availability: {
        available: false,
        blockedBecause:
          "`RelationshipCandidate` exists and Atlas writes proposals into it, but no region-scoped surface for confirming them has been built.",
        insteadToday:
          "Open an entity — its Relationships panel shows and confirms candidates for that one entity.",
      },
    },

    "add-entity": {
      id: "add-entity",
      label: "Add an entity",
      does: `Place something in ${regionName} yourself, when Atlas has no way to discover it.`,
      why: "Some things are not linked from any page Atlas can reach. A curator has to introduce them.",
      mutates: true,
      outcome: [
        "Creates the entity and places it in this region",
        "Atlas can then start learning about it",
      ],
      durationSeconds: null,
      affected: 0,
      availability: {
        available: false,
        blockedBecause:
          "Atlas requires identity beyond a name — a first-party URL, a canonical id, coordinates, an address, or a deterministic parent. A browser form has to collect and verify one of those, and deciding the minimum is a product decision, not a UI task. Roughly 30 name-only junk entities already reached production this way.",
        insteadToday: `\`npm run define-region -- "${regionName}" --assign "<entity>"\` places an entity that already exists.`,
      },
    },

    "add-source": {
      id: "add-source",
      label: "Add a source",
      does: "Give Atlas a page to read, and let it tell you what it found before committing.",
      why: "Atlas never guesses an organisation's website. When it has read everything it knows about, a new source is the only way it can keep learning.",
      mutates: true,
      outcome: [
        "Atlas fetches and reports what the page appears to describe",
        "You confirm before anything is written",
        "Then it becomes evidence and joins the queue",
      ],
      durationSeconds: null,
      affected: 0,
      availability: {
        available: false,
        blockedBecause:
          "The analyse-then-commit step is not built. `npm run probe-source` does the fetch-and-report half from a terminal, but there is no browser path that inspects a URL without committing it.",
        insteadToday:
          "`npm run probe-source` reports what a URL contains, then `queue-benchmark` seeds known sources.",
      },
    },
  };
}

/**
 * Rank the operations into a work queue.
 *
 * **Ordered by what unblocks the most, not by severity.** A severity scale
 * would be a judgement nobody agreed on; *"concerns six of seven
 * entities"* is a fact.
 *
 * Two rules override the count, and both are product decisions worth
 * stating:
 *
 * 1. **A decision waiting on a human outranks machine work.** Growing
 *    while findings sit unreviewed adds to a queue nobody is draining.
 * 2. **Unavailable operations never rank.** An action a curator cannot
 *    take is not the next best action, however large its number.
 */
export function rankOperations(
  catalogue: Record<OperationId, OperationSpec>,
): readonly OperationSpec[] {
  const PRIORITY: OperationId[] = [
    "review-research",
    "review-duplicates",
    "fix-types",
    "grow",
  ];

  return PRIORITY.map((id) => catalogue[id])
    .filter((op) => op.availability.available && op.affected > 0)
    .sort((a, b) => {
      const rank = (op: OperationSpec) =>
        op.id === "review-research" ? 0 : op.id === "review-duplicates" ? 1 : 2;
      return rank(a) - rank(b) || b.affected - a.affected;
    });
}
