/**
 * Data layer for the internal Atlas Content Explorer — kept separate from
 * `atlas-repo.ts` (Discovery's data layer) on purpose. Discovery only ever
 * needs `Place`; the explorer needs every kind, generically, plus
 * source-record and relationship data Discovery has no reason to touch.
 * Mixing the two would mean the traveler-facing path importing types and
 * shapes it doesn't need.
 *
 * Entities (`/places`, `/organizations`, `/activities`, `/events`) are
 * public on Atlas, same as Discovery's own calls — fetched directly.
 * Source records and relationships are admin-gated, so those go through
 * this app's own `/api/admin/*` proxy routes, same reasoning as
 * `admin-repo.ts`: `ADMIN_TOKEN` never reaches the browser.
 */
import {
  AdminNotConfiguredError,
  AtlasUnreachableError,
  type AdminEntity,
  type CompletenessDimension,
  type CompletenessScoreResult,
} from "./admin-repo";

const ATLAS_BASE_URL = "http://localhost:3000";

export interface SourceRecord {
  id: string;
  sourceType: string;
  source: string;
  retrievedAt: string;
  rawContent: unknown;
  imageUrl?: string;
}

export interface Relationship {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
}

export interface MergeRecord {
  id: string;
  kind: string;
  survivingId: string;
  absorbedId: string;
  mergedAt: string;
  reason?: string;
}

export interface FieldProposal {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  sourceRecordId: string;
  sourceLabel: string;
  sourceType: string;
  confidence?: number;
}

export interface FieldOrigin {
  sourceLabel: string;
  sourceType: string;
}

export interface EnrichmentReview {
  entityId: string;
  kind: string;
  name: string;
  fieldProposals: FieldProposal[];
  /** Field name -> which linked source's own value matches what's currently stored, when one could be determined. Missing for a field means "original source" — honest, not guessed. */
  currentValueOrigins: Record<string, FieldOrigin>;
}

export interface ApplyEnrichmentChoice {
  value: unknown;
  sourceRecordId: string;
}

/**
 * Sprint 2 Refinement — one missing field's answer to "how do I actually
 * fix this," combining `CompletenessScore`'s gap with
 * `EnrichmentService.proposeEnrichment`'s real candidates server-side (see
 * `GapImprovementService.buildGapImprovements` in Atlas). Three honest
 * states, never a fourth invented one: a real source-backed candidate
 * ready to apply, a source that exists but doesn't cover this field, or no
 * source at all yet.
 */
export type GapImprovementStatus =
  "candidate-available" | "source-no-candidate" | "no-source";

export interface GapImprovementScoreImpact {
  currentOverallPercent: number;
  projectedOverallPercent: number;
  overallDeltaPercent: number;
  dimension: CompletenessDimension;
  currentDimensionPercent: number | null;
  projectedDimensionPercent: number | null;
}

export interface GapImprovement {
  field: string;
  dimension: CompletenessDimension;
  status: GapImprovementStatus;
  proposedValue?: unknown;
  sourceRecordId?: string;
  sourceLabel?: string;
  sourceType?: string;
  confidence?: number;
  scoreImpact?: GapImprovementScoreImpact;
}

export interface GapImprovementsResult {
  entityId: string;
  score: CompletenessScoreResult;
  improvements: GapImprovement[];
}

async function fetchEntities(path: string): Promise<AdminEntity[]> {
  const response = await fetch(`${ATLAS_BASE_URL}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}.`);
  }
  return response.json();
}

/** Every entity Atlas has, across all four kinds, in one list — the explorer's whole reason for existing is not having to check four endpoints by hand. Active entities only, same as every other consumer of Atlas's public routes (Discovery included) — for archived entities, see `listAllEntitiesIncludingArchived`. */
export async function listAllEntities(): Promise<AdminEntity[]> {
  const [places, organizations, activities, events] = await Promise.all([
    fetchEntities("/places"),
    fetchEntities("/organizations"),
    fetchEntities("/activities"),
    fetchEntities("/events"),
  ]);
  return [...places, ...organizations, ...activities, ...events];
}

/**
 * The Content Explorer's "include archived" toggle — a merged-away entity
 * (an absorbed loser, archived not deleted) is invisible to `listAllEntities`
 * and every other public-route consumer by design, but the explorer's whole
 * job is being the one place that can still find it, to inspect what
 * happened to it and trace its merge lineage. Goes through Atlas's
 * admin-gated `/admin/entities` route rather than the four public ones —
 * this is real internal evidence, not traveler-facing data, so it's gated
 * the same way source records and relationships already are.
 */
export async function listAllEntitiesIncludingArchived(): Promise<
  AdminEntity[]
> {
  const response = await fetch("/api/admin/entities?includeArchived=true", {
    cache: "no-store",
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

async function parseAdminError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  if (body?.code === "ADMIN_TOKEN_MISSING") {
    return new AdminNotConfiguredError(
      body.error ?? "Admin token not configured.",
    );
  }
  // Sprint 2 Refinement — this file's proxy calls (enrichment,
  // gap-improvements) are just as exposed to the cold-start
  // "Atlas isn't up yet" failure as content-health/duplicates already
  // were; recognizing it here too means a curator opening the score panel
  // moments after a fresh start sees the same real "try again" affordance
  // instead of a generic error.
  if (body?.code === "ATLAS_UNREACHABLE") {
    return new AtlasUnreachableError(body.error ?? "Could not reach Atlas.");
  }
  return new Error(
    body?.error ?? `Request failed with status ${response.status}.`,
  );
}

export async function listSourceRecords(): Promise<SourceRecord[]> {
  const response = await fetch("/api/admin/source-records", {
    cache: "no-store",
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

export async function listRelationships(): Promise<Relationship[]> {
  const response = await fetch("/api/admin/relationships", {
    cache: "no-store",
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

export async function listMergeRecords(): Promise<MergeRecord[]> {
  const response = await fetch("/api/admin/merge-records", {
    cache: "no-store",
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/**
 * Re-runs extraction against every source that already describes this
 * entity and reports where a source's answer differs from what's
 * currently stored — nothing here is applied until `applyEnrichment` is
 * called with an explicit choice per field.
 */
export async function proposeEnrichment(
  entityId: string,
): Promise<EnrichmentReview> {
  const url = `/api/admin/entities/${encodeURIComponent(entityId)}/enrichment`;
  console.log("[enrichment] fetching", url);
  const response = await fetch(url, { cache: "no-store" });
  console.log("[enrichment] fetch settled, status", response.status);
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

export async function applyEnrichment(
  entityId: string,
  chosen: Record<string, ApplyEnrichmentChoice>,
  reason?: string,
): Promise<AdminEntity> {
  const response = await fetch(
    `/api/admin/entities/${encodeURIComponent(entityId)}/enrichment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosen, reason }),
    },
  );
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/**
 * One entity's missing fields, each resolved against real enrichment
 * evidence — the data behind the Knowledge Score panel's "Apply" actions.
 * Reuses Atlas's own `proposeEnrichment` under the hood (see the route's
 * own comment) rather than running any new extraction from this app.
 */
export async function getGapImprovements(
  entityId: string,
): Promise<GapImprovementsResult> {
  const response = await fetch(
    `/api/admin/entities/${encodeURIComponent(entityId)}/gap-improvements`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/**
 * Sprint 3.1 — Source Coverage. A different question from gap-improvements:
 * not "what field is missing and can it be fixed" but "which categories of
 * trusted source has Atlas ever checked for this entity at all." Mirrors
 * Atlas's own `SourceCategory`/`SourceCoverageEntry`/`SourceCoverageResult`
 * (`atlas/src/application/quality/SourceCoverage.ts`) exactly — this is a
 * pure read, no AI call, no ingestion, no recommendation.
 */
export type SourceCategory =
  | "wikipedia"
  | "official-website"
  | "openstreetmap"
  | "tourism-organization"
  | "government"
  | "wikivoyage"
  | "local-knowledge";

export interface SourceCoverageEntry {
  category: SourceCategory;
  label: string;
  sourceRecordIds: string[];
  sourceTypes: string[];
}

export interface SourceCoverageResult {
  entityId: string;
  present: SourceCoverageEntry[];
  missing: SourceCoverageEntry[];
  uncategorized: { sourceRecordId: string; sourceType: string }[];
}

/** One entity's present-vs-missing trusted source categories — the data behind the Source Coverage panel. Reuses the same `describes` relationships every other admin view already reads; never triggers a fetch or an ingestion run. */
export async function getSourceCoverage(
  entityId: string,
): Promise<SourceCoverageResult> {
  const response = await fetch(
    `/api/admin/entities/${encodeURIComponent(entityId)}/source-coverage`,
    {
      cache: "no-store",
    },
  );
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

export interface CreateContainsRequest {
  readonly parentId: string;
  readonly childId: string;
  readonly reason: string;
}

/**
 * Curator-asserted `contains` between two Places
 * (docs/content-model/relationships/contains.md). Enforces the
 * immediate-parent invariant server-side — a child that already has a
 * parent is rejected with a 400, surfaced here as a thrown Error with
 * Atlas's own message, not silently retried or overridden.
 */
export async function createContainsRelationship(
  request: CreateContainsRequest,
): Promise<Relationship> {
  const response = await fetch("/api/admin/relationships/contains", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/** Mirrors Atlas's own EvidenceSignal shape (atlas/src/application/relationships/containmentEvidence.ts) — the evidence snapshot a discovered candidate carries. */
export interface RelationshipCandidateEvidenceSignal {
  readonly kind: string;
  readonly label: string;
}

/**
 * A relationship Atlas *thinks* exists, not one it has confirmed (Phase
 * 5.1; docs/content-model/relationships/contains.md). Produced by a
 * separate, manually triggered discovery pass — never by this app —
 * reviewed here, confirmed or rejected.
 */
export interface RelationshipCandidate {
  readonly id: string;
  readonly type: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly status: "pending" | "confirmed" | "rejected";
  readonly evidence: readonly RelationshipCandidateEvidenceSignal[];
  readonly discoveredAt: string;
  readonly resolvedAt?: string;
  readonly resolvedRelationshipId?: string;
}

/** Every pending candidate, already filtered by Atlas for staleness (a candidate referencing a since-archived entity is never returned). */
export async function listRelationshipCandidates(): Promise<
  RelationshipCandidate[]
> {
  const response = await fetch("/api/admin/relationship-candidates", {
    cache: "no-store",
  });
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/** Confirms a candidate — internally calls the same, unchanged ContainmentService.createContains path manual creation uses. `reason` is the curator-reviewed (and possibly edited) evidence explanation. */
export async function confirmRelationshipCandidate(
  id: string,
  reason: string,
): Promise<Relationship> {
  const response = await fetch(
    `/api/admin/relationship-candidates/${encodeURIComponent(id)}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}

/** Rejects a candidate — no relationship is created, and the candidate is marked resolved so it stops showing up for review. */
export async function rejectRelationshipCandidate(
  id: string,
): Promise<RelationshipCandidate> {
  const response = await fetch(
    `/api/admin/relationship-candidates/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
    },
  );
  if (!response.ok) throw await parseAdminError(response);
  return response.json();
}
