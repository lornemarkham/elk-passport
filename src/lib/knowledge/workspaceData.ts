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

/** An optional part of the bundle. Named so a page can say which one is missing. */
export type WorkspacePart = "sources" | "scores" | "candidateSources";

export interface WorkspaceBundle {
  entities: AdminEntity[];
  sources: SourceRecord[];
  relationships: Relationship[];
  /** Fleet scores — the only place a per-entity Knowledge Score exists today, so it's read once and looked up per entity rather than re-requested. */
  scores: CompletenessScoreResult[];
  /** Sprint 4.2 — pages discovered but deliberately not fetched. Empty when the running Atlas predates the route. */
  candidateSources: WorkspaceCandidateSource[];
  /**
   * Which optional parts came back empty **because they failed**, rather
   * than because they are empty.
   *
   * A page rendering `0 sources` or a blank score column has no other way
   * to tell those apart, and rendering the first when the second is true
   * is the fabricated zero this codebase keeps rediscovering.
   */
  unavailable: readonly WorkspacePart[];
}

/**
 * Everything the workspace needs, in one round of parallel reads.
 *
 * ## Essential and optional are decided here, once, and stated
 *
 * This used to be a flat `Promise.all`, which made every read essential by
 * omission. A single mistyped path — `/admin-health` for
 * `/admin/content-health` — therefore discarded four healthy responses and
 * emptied five pages. **The blast radius came entirely from failure
 * handling, not from the typo.**
 *
 * **Essential: `entities` and `relationships`.** They are the graph. No
 * page means anything without them, so their failure rejects and the
 * caller shows an honest error. Degrading them to `[]` would assert that
 * Atlas is empty.
 *
 * **Optional: `sources`, `scores`, `candidateSources`.** Each is an
 * annotation *on* that graph. An annotation that failed to load should
 * grey out its own column, not empty the page — so each is caught
 * individually and named in `unavailable`.
 *
 * That last part is the point. **A tolerated failure nobody can observe is
 * the same bug wearing a `catch`** — the previous version already
 * tolerated `candidateSources` and told no one, so a page could show "no
 * queued sources" for a route that was simply down.
 */
export async function loadWorkspaceBundle(): Promise<WorkspaceBundle> {
  const unavailable: WorkspacePart[] = [];

  /** Optional read: never fails the bundle, always announces that it failed. */
  const optional = <T>(part: WorkspacePart, path: string, fallback: T) =>
    adminGet<T>(path).catch(() => {
      unavailable.push(part);
      return fallback;
    });

  const [entities, relationships, sources, health, candidateSources] =
    await Promise.all([
      // Essential — these two reject, on purpose.
      adminGet<AdminEntity[]>("/admin/entities"),
      adminGet<Relationship[]>("/admin/relationships"),

      optional<SourceRecord[]>("sources", "/admin/source-records", []),
      // `/admin/content-health`, not `/admin-health`. The latter was a typo
      // Atlas has never served; the app's own proxy route always had it
      // right and only this caller disagreed.
      // `null` rather than a hand-built empty ContentHealthResult: the
      // other fields (scannedAt, totalEntities, …) have no honest zero, and
      // inventing them would be the fabricated zero one level down.
      optional<ContentHealthResult | null>(
        "scores",
        "/admin/content-health",
        null,
      ),
      optional<WorkspaceCandidateSource[]>(
        "candidateSources",
        "/admin/candidate-sources",
        [],
      ),
    ]);

  return {
    entities,
    sources,
    relationships,
    scores: health?.scores ?? [],
    candidateSources,
    unavailable,
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
