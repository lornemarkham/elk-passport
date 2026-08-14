import type { AdminEntity } from "@/lib/data/admin-repo";
import type { Relationship, SourceRecord } from "@/lib/data/explorer-repo";

/**
 * Pure evidence scoring for `contains` suggestions
 * (docs/content-model/relationships/contains.md). Deliberately isolated
 * from any component: every function here takes plain data already loaded
 * by Content Explorer and returns plain data — no fetch, no AI, nothing
 * asynchronous. Extending this later (a new evidence type, as Atlas gains
 * richer signals) means adding one detection block in `scoreCandidate` and
 * one entry in `WEIGHT` — nothing else in this file or its consumers needs
 * to change shape.
 *
 * Ranking, highest to lowest confidence, per the approved Product
 * Direction:
 *   1. same-source        — child and candidate share an identical SourceRecord
 *   1. text-mention        — one's own source text literally names the other
 *   2. existing-relationship — any other direct relationship already connects them
 *   3. shared-external-id  — same {system, id} external identifier
 *   4. near                — geographically close; weak hint ONLY, see WEIGHT
 *
 * `near` deliberately carries zero qualifying weight. It can appear
 * alongside a real signal as supporting context, but must never by itself
 * make a candidate "qualify" as a suggestion — the whole point of ranking
 * it last is that proximity is not evidence of containment.
 */

export type EvidenceKind =
  | "same-source"
  | "text-mention"
  | "existing-relationship"
  | "shared-external-id"
  | "near";

export interface EvidenceSignal {
  readonly kind: EvidenceKind;
  readonly label: string;
}

export interface ScoredCandidate {
  readonly candidate: AdminEntity;
  readonly signals: readonly EvidenceSignal[];
  /** True only if at least one non-`near` signal fired. The one thing every consumer of this module must respect: a candidate with only a `near` signal is not a suggestion. */
  readonly qualifies: boolean;
}

export interface ContainmentEvidenceContext {
  readonly relationships: readonly Relationship[];
  readonly sourceRecords: readonly SourceRecord[];
}

// Sort weight only — never shown to the curator. `near` is 0 on purpose:
// see the "must never be sufficient by itself" rule in the module doc above.
const WEIGHT: Record<EvidenceKind, number> = {
  "same-source": 100,
  "text-mention": 90,
  "existing-relationship": 50,
  "shared-external-id": 40,
  near: 0,
};

// Curator-facing labels for each EvidenceKind badge — the raw kebab-case
// identifier is an internal detail (used for WEIGHT/sorting), never shown
// directly, the same discipline entityFieldFormat.ts's fieldLabel() already
// applies to raw field names elsewhere in this admin UI.
const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  "same-source": "Same source",
  "text-mention": "Mentioned in source text",
  "existing-relationship": "Existing relationship",
  "shared-external-id": "Shared external ID",
  near: "Nearby",
};

export function evidenceKindLabel(kind: EvidenceKind): string {
  return EVIDENCE_KIND_LABELS[kind];
}

function namesToMatch(entity: AdminEntity): readonly string[] {
  const aliases = Array.isArray(entity.aliases)
    ? entity.aliases.filter((a): a is string => typeof a === "string")
    : [];
  // Names under 3 characters are excluded — too likely to match unrelated
  // text and produce a false "mentioned in source content" signal.
  return [entity.name, ...aliases].filter(
    (n) => typeof n === "string" && n.trim().length > 2,
  );
}

function describingSourceIds(
  entityId: string,
  relationships: readonly Relationship[],
): Set<string> {
  return new Set(
    relationships
      .filter((r) => r.type === "describes" && r.targetEntityId === entityId)
      .map((r) => r.sourceEntityId),
  );
}

function rawContentText(record: SourceRecord): string {
  return typeof record.rawContent === "string"
    ? record.rawContent
    : JSON.stringify(record.rawContent ?? "");
}

function mentionsAnyName(text: string, names: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return names.some((n) => lower.includes(n.toLowerCase()));
}

function externalIdKey(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null) return undefined;
  const { system, id } = entry as { system?: unknown; id?: unknown };
  if (typeof system !== "string" || typeof id !== "string") return undefined;
  return `${system}:${id}`;
}

function externalIdKeys(entity: AdminEntity): Set<string> {
  const raw = entity.externalIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.map(externalIdKey).filter((k): k is string => k !== undefined),
  );
}

function directlyRelated(
  aId: string,
  bId: string,
  relationships: readonly Relationship[],
  excludeTypes: readonly string[],
): Relationship | undefined {
  return relationships.find(
    (r) =>
      !excludeTypes.includes(r.type) &&
      ((r.sourceEntityId === aId && r.targetEntityId === bId) ||
        (r.sourceEntityId === bId && r.targetEntityId === aId)),
  );
}

/** Scores exactly one candidate parent against one child. */
function scoreCandidate(
  child: AdminEntity,
  candidate: AdminEntity,
  { relationships, sourceRecords }: ContainmentEvidenceContext,
): ScoredCandidate {
  const signals: EvidenceSignal[] = [];

  const childSourceIds = describingSourceIds(child.id, relationships);
  const candidateSourceIds = describingSourceIds(candidate.id, relationships);

  // Tier 1 — same trusted source: an identical SourceRecord describes both.
  if ([...childSourceIds].some((id) => candidateSourceIds.has(id))) {
    signals.push({
      kind: "same-source",
      label: "Both places are described by the same source.",
    });
  }

  // Tier 1 — mentioned in source content: the candidate PARENT's own
  // source text names the child. Deliberately one direction only — a
  // container's own text naming something within it is real, trustworthy
  // evidence (every actual case this project has: Ellison's own BC Parks
  // page names Otter Bay and Sandy Beach); the reverse ("does the child's
  // text happen to mention the candidate's name") is not, and checking it
  // was a real bug in this file's Atlas-side counterpart — it let a park
  // itself be proposed as a *child* of one of its own named sub-places,
  // because the park's own descriptive text naturally names what's inside
  // it. Nothing in Atlas's real data today demonstrates the reverse
  // direction as genuine evidence; if that changes, this can be revisited
  // with real evidence then, not assumed safe now.
  const childNames = namesToMatch(child);
  const candidateSourceRecords = sourceRecords.filter((sr) =>
    candidateSourceIds.has(sr.id),
  );
  if (
    candidateSourceRecords.some((sr) =>
      mentionsAnyName(rawContentText(sr), childNames),
    )
  ) {
    signals.push({
      kind: "text-mention",
      label: `${candidate.name}'s own source text mentions "${child.name}".`,
    });
  }

  // Tier 2 — existing Atlas relationship (any type but describes/contains/
  // near), one hop only — no multi-hop graph traversal. `near` is
  // deliberately excluded here too, not just given its own zero weight
  // below: without this exclusion, a near-only pair was counted twice —
  // once correctly as the zero-weight `near` signal, and once incorrectly
  // as a full-weight `existing-relationship` signal, silently letting
  // proximity alone qualify a candidate through the back door.
  const related = directlyRelated(child.id, candidate.id, relationships, [
    "describes",
    "contains",
    "near",
  ]);
  if (related) {
    signals.push({
      kind: "existing-relationship",
      label: `Already connected by an existing "${related.type}" relationship.`,
    });
  }

  // Tier 3 — shared external identifier (same system, same id).
  const sharedKey = [...externalIdKeys(child)].find((key) =>
    externalIdKeys(candidate).has(key),
  );
  if (sharedKey) {
    signals.push({
      kind: "shared-external-id",
      label: `Both share the external identifier ${sharedKey}.`,
    });
  }

  // Tier 4 — near, weak supporting hint only (see WEIGHT — contributes 0).
  const nearRelationship = directlyRelated(
    child.id,
    candidate.id,
    relationships.filter((r) => r.type === "near"),
    [],
  );
  if (nearRelationship) {
    signals.push({
      kind: "near",
      label: "Also geographically nearby — a weak supporting hint only.",
    });
  }

  const qualifies = signals.some((s) => WEIGHT[s.kind] > 0);
  return { candidate, signals, qualifies };
}

function totalWeight(scored: ScoredCandidate): number {
  return scored.signals.reduce((sum, s) => sum + WEIGHT[s.kind], 0);
}

/** Every candidate, scored and sorted best-to-worst. Includes non-qualifying candidates — callers that only want a suggestion should check `.qualifies` (see `pickBestContainsSuggestion`). */
export function scoreContainsCandidates(
  child: AdminEntity,
  candidates: readonly AdminEntity[],
  context: ContainmentEvidenceContext,
): ScoredCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(child, candidate, context))
    .sort((a, b) => totalWeight(b) - totalWeight(a));
}

/**
 * The single best candidate, or undefined if nothing clears the evidence
 * bar. This is the one function the UI should call to decide whether to
 * show a suggestion at all — it never returns a `near`-only candidate.
 */
export function pickBestContainsSuggestion(
  child: AdminEntity,
  candidates: readonly AdminEntity[],
  context: ContainmentEvidenceContext,
): ScoredCandidate | undefined {
  const [best] = scoreContainsCandidates(child, candidates, context);
  return best?.qualifies ? best : undefined;
}

/** The editable, pre-filled reason text shown when a curator clicks Confirm — a starting point, never submitted without the curator seeing and being able to change it. */
export function composeSuggestionReason(scored: ScoredCandidate): string {
  return `Suggested based on: ${scored.signals.map((s) => s.label).join(" ")}`;
}
