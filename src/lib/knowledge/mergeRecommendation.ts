import type { AdminEntity, DuplicateGroup } from "@/lib/data/admin-repo";
import type { Relationship } from "@/lib/data/explorer-repo";

/**
 * **Atlas proposes the merge. The curator reviews the proposal.**
 *
 * The duplicate queue used to hand a curator a group of near-identical records
 * and, in effect, ask them to do Atlas's job: work out which record already
 * existed, which one was already placed, which carried the evidence, which
 * should survive, and what would be lost. Every card looked the same, and the
 * survivor was `group.entities[0]` — whichever record the scan happened to
 * return first. Atlas had no opinion, so the curator had to reconstruct one.
 *
 * That is backwards. **The curator's attention should go on reviewing
 * evidence, not on reassembling reasoning Atlas never did.** So Atlas now
 * states which record it recommends keeping, why, what each of the others
 * contributes, and exactly what happens to them.
 *
 * ## Choosing the survivor without inventing a score
 *
 * A weighted score would be a confidence number wearing a different word, and
 * this codebase does not have one. Instead the survivor is chosen by a
 * **lexicographic order over observable facts** — the first criterion on which
 * the records actually differ decides it, and that criterion is the reason
 * shown to the curator:
 *
 * 1. **Already placed in the region being built.** A curator has already
 *    asserted this record belongs here. Merging into it keeps that assertion;
 *    merging the other way would discard a human decision and require making
 *    it again.
 * 2. **More relationships.** Merging into the best-connected record repoints
 *    the fewest edges, so the least is disturbed.
 * 3. **More sources describing it.** Depth of provenance.
 * 4. **More identity keys.** External identifiers are what let Atlas
 *    recognise this thing again.
 * 5. **More facts recorded.**
 * 6. **Lowest id.** Not a reason — a tie-break, so that two identical records
 *    produce a stable answer instead of an arbitrary one, and it says so.
 *
 * Every step is a fact a curator can check, and the recommendation is
 * reproducible: the same corpus produces the same proposal.
 *
 * ## What each candidate contributes, and nothing it does not
 *
 * A detail view that repeats the shared name six times has told the curator
 * nothing. This computes the **difference only** — the fields the survivor
 * lacks and a candidate has, the fields where the two disagree, the name that
 * becomes an alias.
 *
 * ## Conflicts are reported, never settled
 *
 * Where both records hold a different value for the same field, Atlas keeps
 * the survivor's and says so. *Last source wins* is a decision Atlas has no
 * basis to make — the same rule `mergeEntityKnowledge` follows for ingestion,
 * applied here so a merge cannot quietly overwrite something a curator would
 * have wanted to look at.
 */

/* -------------------------------------------------------------------------
 * What may move, and what may not
 * ---------------------------------------------------------------------- */

/**
 * Fields that say *which thing this is*, and are therefore never carried
 * across by a merge.
 *
 * A record being absorbed does not get to redefine the survivor's identity —
 * that is `mergeEntityKnowledge`'s rule and it holds here for the same reason.
 * `aliases` and `externalIds` are on this list not because they are frozen but
 * because **`MergeService.merge` already accumulates them itself**; sending
 * them as overrides would be a second implementation of a rule Atlas owns.
 */
const IDENTITY_FIELDS = new Set([
  "id",
  "kind",
  "name",
  "aliases",
  "externalIds",
  "geometry",
  "placeType",
  "organizationType",
  "activityType",
  "eventType",
  "archivedAt",
  "mergedIntoId",
]);

/**
 * A human label for a field name, so the curator reads English rather than a
 * key. Named where the split-on-capitals rule would produce something a person
 * would not say — *"image url"* is a field, *"picture"* is the thing.
 */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  imageUrl: "Picture",
  hasActiveFireBan: "Fire ban",
  wheelchairAccessible: "Wheelchair access",
  feeRequired: "Fee",
  keyFacts: "Key facts",
};

function fieldLabel(field: string): string {
  const named = FIELD_LABELS[field];
  if (named) return named;
  const spaced = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** A short, readable rendering of a field value. Never the whole of a long description. */
function preview(value: unknown, limit = 160): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      [...a].map(String).sort().join(" ") ===
        [...b].map(String).sort().join(" ")
    );
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function knowledgeFields(entity: AdminEntity): string[] {
  return Object.keys(entity).filter(
    (field) => !IDENTITY_FIELDS.has(field) && !isEmpty(entity[field]),
  );
}

/* -------------------------------------------------------------------------
 * The shape of a recommendation
 * ---------------------------------------------------------------------- */

/** What Atlas can count about one record, and show as its standing. */
export interface RecordStanding {
  readonly entityId: string;
  readonly name: string;
  readonly placed: boolean;
  readonly relationships: number;
  readonly sources: number;
  readonly identityKeys: number;
  readonly facts: number;
}

export interface AddedFact {
  readonly field: string;
  readonly label: string;
  readonly value: string;
}

export interface ConflictingFact {
  readonly field: string;
  readonly label: string;
  readonly keeping: string;
  readonly setAside: string;
}

export interface CandidateContribution {
  readonly entityId: string;
  readonly name: string;
  readonly standing: RecordStanding;
  /** Fields the survivor does not have and this record does. The reason to merge it. */
  readonly adds: readonly AddedFact[];
  /** Fields both hold differently. Atlas keeps the survivor's and settles nothing. */
  readonly conflicts: readonly ConflictingFact[];
  /** Present when this record's name differs and would be preserved as an alias. */
  readonly aliasGained?: string;
  /** True when this record carries nothing the survivor does not already hold. */
  readonly addsNothing: boolean;
}

export interface MergeRecommendation {
  /** The record Atlas proposes keeping. */
  readonly keep: RecordStanding;
  /** Why this one. The first entry is the fact that decided it. */
  readonly because: readonly string[];
  /** Records proposed for merging into it. */
  readonly merge: readonly CandidateContribution[];
  /** Why Atlas believes these are the same thing at all — the scan's own words. */
  readonly sameness: readonly string[];
  /**
   * What the scan actually checked. `DuplicateGroupFinder`'s own grade, not a
   * number invented here: `name-and-position` means both matched,
   * `name-only` means one record had no position to check against.
   */
  readonly matchBasis: "name-and-position" | "name-only";
  /** Field values carried onto the survivor — gaps filled, never overwrites. */
  readonly fieldOverrides: Readonly<Record<string, unknown>>;
  /** Exactly what survives the merge. Stated so the curator need not fear the button. */
  readonly preserved: readonly string[];
  /** Anything that does not. Empty is a claim, so it is only made when true. */
  readonly setAside: readonly string[];
}

/* -------------------------------------------------------------------------
 * Building it
 * ---------------------------------------------------------------------- */

function standingOf(
  entity: AdminEntity,
  placedIds: ReadonlySet<string>,
  relationships: readonly Relationship[],
): RecordStanding {
  let describes = 0;
  let other = 0;
  for (const edge of relationships) {
    const touchesAsTarget = edge.targetEntityId === entity.id;
    const touches = touchesAsTarget || edge.sourceEntityId === entity.id;
    if (!touches) continue;
    // A `describes` edge pointing at this entity is a source, not a
    // relationship to another entity. Counting it as both would inflate one
    // record's standing over another on the strength of the same evidence.
    if (edge.type === "describes" && touchesAsTarget) describes += 1;
    else other += 1;
  }
  const externalIds = entity.externalIds as readonly unknown[] | undefined;
  return {
    entityId: entity.id,
    name: entity.name,
    placed: placedIds.has(entity.id),
    relationships: other,
    sources: describes,
    identityKeys: Array.isArray(externalIds) ? externalIds.length : 0,
    facts: knowledgeFields(entity).length,
  };
}

/**
 * The lexicographic order. Returns the winner **and the criterion that decided
 * it**, because the reason is the point — a comparator handed to `sort` would
 * throw exactly the useful part away.
 */
function chooseSurvivor(standings: readonly RecordStanding[]): {
  readonly keep: RecordStanding;
  readonly reason: string;
} {
  const criteria: readonly {
    readonly of: (s: RecordStanding) => number;
    readonly reason: (s: RecordStanding) => string;
  }[] = [
    {
      of: (s) => (s.placed ? 1 : 0),
      reason: () =>
        "A curator already placed this record in the region — merging into it keeps that decision instead of asking for it again.",
    },
    {
      of: (s) => s.relationships,
      reason: (s) =>
        `It holds the most relationships (${s.relationships}), so merging into it repoints the fewest edges.`,
    },
    {
      of: (s) => s.sources,
      reason: (s) =>
        `More sources describe it (${s.sources}) than any other record in the group.`,
    },
    {
      of: (s) => s.identityKeys,
      reason: (s) =>
        `It carries the most external identifiers (${s.identityKeys}) — the keys that let Atlas recognise this thing again.`,
    },
    {
      of: (s) => s.facts,
      reason: (s) => `It records the most facts (${s.facts}).`,
    },
  ];

  let remaining = [...standings];
  for (const criterion of criteria) {
    const best = Math.max(...remaining.map(criterion.of));
    const winners = remaining.filter((s) => criterion.of(s) === best);
    if (winners.length === 1) {
      return { keep: winners[0]!, reason: criterion.reason(winners[0]!) };
    }
    // Everyone ties here, so this criterion decides nothing and the next is
    // tried against the same set rather than a narrowed one.
    if (winners.length === remaining.length) continue;
    remaining = winners;
  }

  const keep = [...remaining].sort((a, b) =>
    a.entityId.localeCompare(b.entityId),
  )[0]!;
  return {
    keep,
    reason:
      "These records are indistinguishable on every fact Atlas can count, so it keeps the lowest id — a tie-break, not a reason. Either choice loses the same nothing.",
  };
}

export function buildMergeRecommendation(
  group: DuplicateGroup,
  placedIds: ReadonlySet<string>,
  relationships: readonly Relationship[],
): MergeRecommendation | null {
  if (group.entities.length < 2) return null;

  const standings = group.entities.map((entity) =>
    standingOf(entity, placedIds, relationships),
  );
  const { keep, reason } = chooseSurvivor(standings);
  const survivor = group.entities.find((e) => e.id === keep.entityId)!;
  const standingById = new Map(standings.map((s) => [s.entityId, s]));

  const overrides: Record<string, unknown> = {};
  const merge: CandidateContribution[] = [];

  for (const entity of group.entities) {
    if (entity.id === survivor.id) continue;
    const adds: AddedFact[] = [];
    const conflicts: ConflictingFact[] = [];

    for (const field of knowledgeFields(entity)) {
      const mine = entity[field];
      const theirs = survivor[field];
      if (isEmpty(theirs)) {
        adds.push({ field, label: fieldLabel(field), value: preview(mine) });
        // First candidate to fill a gap wins it. A second candidate filling
        // the same gap differently is a disagreement between candidates, and
        // Atlas settles no disagreements — so it is left rather than
        // overwritten.
        if (!(field in overrides)) overrides[field] = mine;
        continue;
      }
      if (!sameValue(mine, theirs)) {
        conflicts.push({
          field,
          label: fieldLabel(field),
          keeping: preview(theirs),
          setAside: preview(mine),
        });
      }
    }

    merge.push({
      entityId: entity.id,
      name: entity.name,
      standing: standingById.get(entity.id)!,
      adds,
      conflicts,
      aliasGained:
        entity.name.trim().toLowerCase() !== survivor.name.trim().toLowerCase()
          ? entity.name
          : undefined,
      addsNothing: adds.length === 0 && conflicts.length === 0,
    });
  }

  const because = [reason];
  because.push(
    `${keep.sources} source${keep.sources === 1 ? "" : "s"} · ${keep.relationships} relationship${keep.relationships === 1 ? "" : "s"} · ${keep.facts} fact${keep.facts === 1 ? "" : "s"}${keep.placed ? " · already placed in the region" : ""}.`,
  );

  const gained = Object.keys(overrides);
  const aliases = merge.filter((m) => m.aliasGained).length;

  const preserved = [
    "Every absorbed record is archived, not deleted — it stays readable, and each merge is written to the audit trail.",
    `Every relationship and every source moves onto ${survivor.name}.`,
    ...(aliases > 0
      ? [
          `${aliases === 1 ? "The other name is" : `All ${aliases} other names are`} kept as ${aliases === 1 ? "an alias" : "aliases"}, so Atlas still recognises this thing by either.`,
        ]
      : []),
    ...(gained.length > 0
      ? [
          `${gained.length} fact${gained.length === 1 ? "" : "s"} the survivor was missing ${gained.length === 1 ? "is" : "are"} carried across: ${gained.map((f) => fieldLabel(f).toLowerCase()).join(", ")}.`,
        ]
      : []),
  ];

  const conflictCount = merge.reduce((n, m) => n + m.conflicts.length, 0);
  const setAside =
    conflictCount === 0
      ? []
      : [
          `${conflictCount} field${conflictCount === 1 ? " where the records disagree" : "s where the records disagree"}. Atlas keeps ${survivor.name}'s value and settles nothing — “last source wins” is a decision it has no basis to make. The other values stay on the archived record.`,
        ];

  return {
    keep,
    because,
    merge,
    sameness: [
      group.matchReason,
      group.confidence === "high"
        ? "The name and the real-world position both matched."
        : "Only the name matched — one record has no position to check against.",
    ],
    matchBasis: group.confidence === "high" ? "name-and-position" : "name-only",
    fieldOverrides: overrides,
    preserved,
    setAside,
  };
}
