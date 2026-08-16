import type { OperationId, OperationSpec } from "./operationCatalogue";

/**
 * **Why this action, and not one of the others.**
 *
 * Replaces the hardcoded `PRIORITY` array in `operationCatalogue.ts`, which
 * ranked four operations in an order somebody typed once. It was right
 * often enough to survive, and it could never explain itself.
 *
 * ## The model does not add the dimensions up
 *
 * A weighted sum needs exchange rates — how many affected entities is
 * "unblocks two other kinds of work" worth? — and **nobody can justify
 * those numbers**, which makes them exactly the arbitrary constants this
 * project refuses. So the dimensions are scored separately, all five are
 * shown, and ranking is **lexicographic**: compare on the first dimension,
 * and only look at the next one when it ties.
 *
 * > **Precedence is a claim you can argue with. A weighted sum is a claim
 * > you can only accept.** "Ranked first because it unblocks three other
 * > kinds of work" is checkable. "Scored 7.4" is not.
 *
 * ## The precedence, and why it is this order
 *
 * 1. **Unlocks** — how much other work becomes possible or trustworthy
 *    afterwards. Read off `UNLOCKS` below, which is derived from what the
 *    code actually computes, not from preference.
 * 2. **Reach** — how many entities it concerns. Already a fact
 *    (`OperationSpec.affected`).
 * 3. **Effort** — decisions the curator must make, per entity. Lower wins.
 * 4. **Reversibility** — at equal value, prefer the action that can be
 *    undone. This is the project's standing rule, applied to ordering
 *    rather than to gating.
 *
 * **Confidence is a gate, not a tiebreak.** An operation Atlas cannot
 * currently succeed at — Grow with an empty queue, duplicates when the
 * scan failed — is not the next best action at any reach. It is filtered
 * out before ranking rather than ranked low, because "recommended fourth"
 * still implies "worth doing".
 *
 * ## Membership ranks first, and that is a structural fact
 *
 * Not a preference. **Every other number on the page is computed over
 * `scope`** — `regionDiagnosis`, coverage, completeness, growth all take
 * `scope.ids`. Placing an entity changes the denominator of every other
 * finding. Reviewing duplicates or fixing types first means doing that
 * work against a region definition that is about to change underneath it.
 *
 * Which exposed the actual bug in the old ranking: **placing entities was
 * not in the catalogue at all.** `PRIORITY` listed four operations and
 * membership was not one of them, so the single highest-value action on
 * the page — 157 unplaced entities against 7 placed — could never be
 * recommended, however obvious it was to a human looking at the screen.
 */

export type PriorityDimensionId =
  "unlocks" | "reach" | "effort" | "reversibility";

export interface PriorityDimension {
  readonly id: PriorityDimensionId;
  readonly label: string;
  /** Small integer. Higher always means "do this sooner". */
  readonly value: number;
  /** The fact this came from. Never a feeling, always checkable. */
  readonly basis: string;
}

export interface ScoredOperation {
  readonly op: OperationSpec;
  readonly dimensions: readonly PriorityDimension[];
  /** The dimension that actually decided this position. */
  readonly decidedBy: string;
}

/**
 * What each operation makes possible or trustworthy afterwards.
 *
 * Every entry is a claim about the code, and is meant to be argued with by
 * reading the code. `unlocks.length` is the dimension value — no separate
 * number to keep in sync.
 */
const UNLOCKS: Record<OperationId, readonly string[]> = {
  // Everything on this page is computed over `scope`. This changes it.
  "place-members": [
    "Every count on this page — all of them are computed over the region's scope",
    "Coverage measurement, which has no denominator until entities are placed",
    "Region-scoped growth, which only reads the queue for entities in scope",
    "Any recommendation Passport builds from the region's shape",
  ],
  // A duplicate is counted twice everywhere until it is merged.
  "review-duplicates": [
    "Accurate counts — a duplicate inflates every figure it appears in",
    "Membership decisions, which would otherwise be made twice for one place",
    "Research, which would run separately against both records",
  ],
  // Type drives layout, completeness rules, research profiles and grouping.
  "fix-types": [
    "The page layout Atlas chooses for each entity",
    "The completeness rules that fit what the entity actually is",
    "Research profiles, which are selected by kind",
    "Grouping and recommending an entity alongside similar ones",
  ],
  // Closing a decision frees the entity for its next question.
  "review-research": [
    "The next research question for that entity, which waits behind this one",
  ],
  "review-relationships": [
    "Exploration paths between places a traveller could follow",
  ],
  "add-source": ["Growth, which can only read sources Atlas has been given"],
  grow: [],
  "add-entity": [],
  activity: [],
};

/**
 * Decisions a curator must make per entity. Lower ranks sooner.
 *
 * Stated as what the interface actually asks for, so it can be checked by
 * using the thing rather than by trusting this table.
 */
const EFFORT: Record<OperationId, { cost: number; basis: string }> = {
  "place-members": {
    cost: 1,
    basis:
      "One decision per entity, and a whole graded band can be placed in a single click.",
  },
  "review-research": {
    cost: 1,
    basis: "Accept or reject one finding Atlas has already prepared.",
  },
  "fix-types": {
    cost: 2,
    basis: "Read the entity, then choose a type from a list.",
  },
  "review-duplicates": {
    cost: 4,
    basis:
      "Compare every field across records, choose a survivor, and write a reason.",
  },
  "review-relationships": {
    cost: 3,
    basis: "Confirm or reject each proposed link.",
  },
  "add-entity": { cost: 5, basis: "Type everything by hand." },
  "add-source": { cost: 3, basis: "Find a URL, then queue and run it." },
  grow: { cost: 0, basis: "Start it and read the receipt afterwards." },
  activity: { cost: 0, basis: "Reading only — nothing to decide." },
};

/** Reversible work ranks above irreversible work at equal value. */
const REVERSIBLE: Record<OperationId, { yes: boolean; basis: string }> = {
  "place-members": {
    yes: true,
    basis: "One relationship. Deleting it undoes the assertion completely.",
  },
  "fix-types": { yes: true, basis: "A field, changeable again at any time." },
  "review-research": {
    yes: true,
    basis: "An accepted finding can be corrected on the entity.",
  },
  grow: {
    yes: true,
    basis: "Adds knowledge; nothing it writes destroys what was there.",
  },
  "review-relationships": { yes: true, basis: "An edge can be removed." },
  "add-entity": { yes: true, basis: "A new record can be deleted." },
  "add-source": { yes: true, basis: "A queued source can be dropped." },
  activity: { yes: true, basis: "Reading only." },
  "review-duplicates": {
    yes: false,
    basis:
      "A merge collapses two records into one. This is the only irreversible action on the page.",
  },
};

function dimensionsFor(op: OperationSpec): readonly PriorityDimension[] {
  const unlocks = UNLOCKS[op.id] ?? [];
  const effort = EFFORT[op.id];
  const reversible = REVERSIBLE[op.id];
  return [
    {
      id: "unlocks",
      label: "Unlocks",
      value: unlocks.length,
      basis:
        unlocks.length === 0
          ? "Nothing else depends on this finishing first."
          : `${unlocks.length} other kinds of work depend on this: ${unlocks.join("; ")}.`,
    },
    {
      id: "reach",
      label: "Reach",
      value: op.affected,
      basis: `Concerns ${op.affected} ${op.affected === 1 ? "entity" : "entities"} right now.`,
    },
    {
      id: "effort",
      // Inverted so higher always means "sooner", like every other row.
      label: "Low effort",
      value: 5 - effort.cost,
      basis: effort.basis,
    },
    {
      id: "reversibility",
      label: "Reversible",
      value: reversible.yes ? 1 : 0,
      basis: reversible.basis,
    },
  ];
}

const PRECEDENCE: readonly PriorityDimensionId[] = [
  "unlocks",
  "reach",
  "effort",
  "reversibility",
];

/**
 * Rank the operations a curator could take right now.
 *
 * Unavailable operations and operations with nothing to act on are removed
 * before ranking — see the confidence note in the module docstring.
 */
export function prioritiseOperations(
  operations: readonly OperationSpec[],
): readonly ScoredOperation[] {
  const candidates = operations
    .filter((op) => op.availability.available && op.affected > 0)
    .map((op) => ({ op, dimensions: dimensionsFor(op) }));

  const valueOf = (s: (typeof candidates)[number], id: PriorityDimensionId) =>
    s.dimensions.find((d) => d.id === id)?.value ?? 0;

  candidates.sort((a, b) => {
    for (const id of PRECEDENCE) {
      const diff = valueOf(b, id) - valueOf(a, id);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  return candidates.map((s, index) => {
    // Which dimension actually separated this from the next one down?
    const next = candidates[index + 1];
    let decidedBy = "Nothing below it to compare against.";
    if (next) {
      const deciding = PRECEDENCE.find(
        (id) => valueOf(s, id) !== valueOf(next, id),
      );
      decidedBy = deciding
        ? `Ranked above "${next.op.label}" on ${
            s.dimensions.find((d) => d.id === deciding)!.label
          } — ${valueOf(s, deciding)} against ${valueOf(next, deciding)}.`
        : `Tied with "${next.op.label}" on every dimension.`;
    }
    return { ...s, decidedBy };
  });
}
