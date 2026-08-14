/**
 * Talks to this app's own /api/admin/* proxy routes, never to Atlas's
 * /admin/* directly — that's what keeps ADMIN_TOKEN server-only (see
 * app/src/app/api/admin/*\/route.ts). Same plain-fetch, throw-on-non-ok
 * style as boards-repo.ts / atlas-repo.ts.
 */

// Deliberately loose, not a closed shape: an admin entity can be a Place,
// Organization, Activity, or Event, each with its own extra fields
// (placeType/organizationType/..., geometry, startTime/endTime, ...).
// This tool renders whatever fields are actually present rather than
// hardcoding per-kind knowledge — see entityFieldFormat.ts.
export interface AdminEntity {
  kind: string;
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  [field: string]: unknown;
}

export interface DuplicateGroup {
  kind: string;
  name: string;
  entities: AdminEntity[];
  /**
   * Curator-facing trust signal from Atlas's DuplicateGroupFinder — "high"
   * means name AND real-world proximity both confirmed the match; "medium"
   * means only the name matched (no location to check, or one record is
   * missing coordinates). Not a developer detail: this is the single most
   * important thing to look at before trusting a group enough to merge it
   * quickly versus reading it carefully.
   */
  confidence: "high" | "medium";
  matchReason: string;
}

export interface DuplicateScanResult {
  groups: DuplicateGroup[];
  scannedAt: string;
  countsByKind: {
    Place: number;
    Organization: number;
    Activity: number;
    Event: number;
  };
}

export interface MergeRequest {
  survivingId: string;
  absorbedIds: string[];
  fieldOverrides?: Record<string, unknown>;
  reason?: string;
}

/** One entity's image, shared with at least one other unrelated entity — see `ImageDuplicateFinder` in Atlas. */
export interface ImageDuplicateGroup {
  imageUrl: string;
  entities: AdminEntity[];
}

export type CompletenessDimension =
  "identity" | "visual" | "sources" | "relationships" | "travelerInfo";

export interface DimensionScore {
  dimension: CompletenessDimension;
  label: string;
  present: number;
  total: number;
  /** `null` means this dimension doesn't apply to this entity's kind — never render it as "0%." */
  percent: number | null;
  /** Specific field names not yet filled in — what `contentGapQuestions.ts` maps into real, traveler-focused questions. */
  missingFields: string[];
}

export interface CompletenessScoreResult {
  entityId: string;
  kind: string;
  name: string;
  overallPercent: number;
  dimensions: DimensionScore[];
}

/** One dimension's fleet-wide average — Sprint 2's Atlas Knowledge Health view. */
export interface DimensionHealth {
  dimension: CompletenessDimension;
  label: string;
  /** `null` when no scored entity had this dimension applicable — never render as "0%." */
  averagePercent: number | null;
  /** How many entities this average is actually drawn from — shown alongside the percentage so a curator can judge how much to trust it. */
  applicableCount: number;
}

export interface KnowledgeHealthSummary {
  /** `null` only when there are no entities to score yet. */
  overallPercent: number | null;
  totalEntities: number;
  dimensions: DimensionHealth[];
}

/**
 * Sprint 1's Knowledge Operations foundation, straight from
 * `ContentHealthService.computeContentHealth()` — one fetch, everything
 * the Content Operations dashboard and the Curator Queue both need. See
 * that class's doc comment for what's honest and provisional about it.
 */
export interface ContentHealthResult {
  scannedAt: string;
  totalEntities: number;
  missingImages: { count: number; entityIds: string[] };
  missingCoordinates: { count: number; entityIds: string[] };
  imageDuplicates: ImageDuplicateGroup[];
  scores: CompletenessScoreResult[];
  /** Sprint 2 — fleet-wide dimension averages, derived from `scores`. */
  knowledgeHealth: KnowledgeHealthSummary;
}

/**
 * Thrown when the proxy route reports `code: "ADMIN_TOKEN_MISSING"` — a
 * distinct, typed signal so the UI can show a real setup screen
 * (AdminSetupNotice) instead of lumping "you haven't configured this yet"
 * in with "Atlas is unreachable" as the same generic error state.
 */
export class AdminNotConfiguredError extends Error {}

/**
 * Thrown when the proxy route reports `code: "ATLAS_UNREACHABLE"` — the
 * real, observed cold-start failure (Sprint 2 Refinement): this app's
 * server can come up before Atlas's own server (or its connection to
 * Supabase) is ready, so the very first admin fetch after a fresh start
 * can fail with a real network error, not an application error. Distinct
 * from `AdminNotConfiguredError` (a setup problem) and from every other
 * `Error` (an unexpected one) — this one is expected to resolve itself
 * within a few seconds, so the UI can offer a real "Try again" instead of
 * a dead-end error screen.
 */
export class AtlasUnreachableError extends Error {}

async function parseAdminError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null);
  if (body?.code === "ADMIN_TOKEN_MISSING") {
    return new AdminNotConfiguredError(
      body.error ?? "Admin token not configured.",
    );
  }
  if (body?.code === "ATLAS_UNREACHABLE") {
    return new AtlasUnreachableError(body.error ?? "Could not reach Atlas.");
  }
  return new Error(
    body?.error ?? `Request failed with status ${response.status}.`,
  );
}

export async function listDuplicateGroups(): Promise<DuplicateScanResult> {
  const response = await fetch("/api/admin/duplicates", { cache: "no-store" });
  if (!response.ok) {
    throw await parseAdminError(response);
  }
  return response.json();
}

export async function getContentHealth(): Promise<ContentHealthResult> {
  const response = await fetch("/api/admin/content-health", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw await parseAdminError(response);
  }
  return response.json();
}

export async function mergeEntities(
  request: MergeRequest,
): Promise<AdminEntity> {
  const response = await fetch("/api/admin/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw await parseAdminError(response);
  }
  return response.json();
}
