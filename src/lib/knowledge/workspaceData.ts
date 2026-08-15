import "server-only";
import type {
  AdminEntity,
  CompletenessScoreResult,
  ContentHealthResult,
} from "@/lib/data/admin-repo";
import type {
  Relationship,
  SourceCoverageResult,
  SourceRecord,
} from "@/lib/data/explorer-repo";

/**
 * Server-side reads for the Entity Workspace.
 *
 * Talks to Atlas's admin API directly rather than hopping through this
 * app's own `/api/admin/*` proxy routes. Those proxies exist for one
 * reason — keeping `ADMIN_TOKEN` out of the browser — which doesn't apply
 * to a server component that already has the token. Going through them
 * from the server would add a same-process HTTP round trip per call for no
 * benefit. Client components still use the proxies, unchanged.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

export class WorkspaceNotConfiguredError extends Error {}
export class WorkspaceUnreachableError extends Error {}

async function adminGet<T>(path: string): Promise<T> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    throw new WorkspaceNotConfiguredError(
      "ADMIN_TOKEN is not configured for this app.",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}${path}`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
    });
  } catch (error) {
    throw new WorkspaceUnreachableError(
      `Atlas is unreachable at ${ATLAS_BASE_URL}: ${(error as Error).message}`,
    );
  }
  if (response.status === 401) {
    throw new WorkspaceNotConfiguredError("Atlas rejected ADMIN_TOKEN.");
  }
  if (!response.ok) {
    throw new WorkspaceUnreachableError(
      `Atlas returned ${response.status} for ${path}.`,
    );
  }
  return (await response.json()) as T;
}

/** One queued learning opportunity, as the admin API returns it. */
export interface WorkspaceCandidateSource {
  id: string;
  url: string;
  sourceType: string;
  status: string;
  aboutEntityId?: string;
  discoveredFromSourceRecordId: string;
  reason: string;
  discoveredAt: string;
}

export interface WorkspaceBundle {
  entities: AdminEntity[];
  sources: SourceRecord[];
  relationships: Relationship[];
  /** Fleet scores — the only place a per-entity Knowledge Score exists today, so it's read once and looked up per entity rather than re-requested. */
  scores: CompletenessScoreResult[];
  /** Sprint 4.2 — pages discovered but deliberately not fetched. Empty when the running Atlas predates the route. */
  candidateSources: WorkspaceCandidateSource[];
}

/** One fetch of everything the workspace needs. Four parallel reads, no caching — the same "always right now" honesty every other admin view already has. */
export async function loadWorkspaceBundle(): Promise<WorkspaceBundle> {
  const [entities, sources, relationships, health, candidateSources] =
    await Promise.all([
      adminGet<AdminEntity[]>("/admin/entities"),
      adminGet<SourceRecord[]>("/admin/source-records"),
      adminGet<Relationship[]>("/admin/relationships"),
      // `/admin/content-health`, not `/admin-health`. The latter was a typo
      // that Atlas has never served, and because this sits inside a
      // `Promise.all`, its 404 failed the whole bundle — so four healthy
      // reads were discarded on account of a missing slash. Every page that
      // caught the rejection then rendered "nothing here". The app's own
      // proxy route has always used the correct path; only this caller
      // disagreed.
      adminGet<ContentHealthResult>("/admin/content-health"),
      // Tolerated failure: a running Atlas built before this route exists
      // should degrade to "no queued sources", not break the whole
      // workspace. An honest empty is better than a 500.
      adminGet<WorkspaceCandidateSource[]>("/admin/candidate-sources").catch(
        () => [] as WorkspaceCandidateSource[],
      ),
    ]);
  return {
    entities,
    sources,
    relationships,
    scores: health.scores ?? [],
    candidateSources,
  };
}

export async function loadSourceCoverage(
  entityId: string,
): Promise<SourceCoverageResult | null> {
  try {
    return await adminGet<SourceCoverageResult>(
      `/admin/entities/${encodeURIComponent(entityId)}/source-coverage`,
    );
  } catch {
    // Coverage is a supporting signal, not the point of the page — a
    // failure here shows the panel as unavailable rather than 500ing the
    // whole workspace.
    return null;
  }
}
