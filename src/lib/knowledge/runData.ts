import "server-only";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * Server-side reads for the Ingestion Observatory.
 *
 * Same discipline as `workspaceData.ts`: a server component that already
 * holds `ADMIN_TOKEN` talks to Atlas's admin API directly rather than
 * hopping through this app's own proxy routes, which exist only to keep
 * the token out of the browser.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

export type IngestionRunStatus = "running" | "completed" | "failed";
export type IngestionOutcome = "ok" | "skipped" | "failed" | "needs-attention";

export interface IngestionRun {
  id: string;
  kind: string;
  label: string;
  trigger: string;
  status: IngestionRunStatus;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface IngestionEvent {
  id: string;
  runId: string;
  sequence: number;
  stage: string;
  outcome: IngestionOutcome;
  at: string;
  subject: string;
  message: string;
  sourceRecordId?: string;
  entityId?: string;
  relationshipId?: string;
  candidateSourceId?: string;
}

export class RunsNotConfiguredError extends Error {}
export class RunsUnreachableError extends Error {}

async function adminGet<T>(path: string): Promise<T> {
  const token = process.env.ADMIN_TOKEN;
  if (!token)
    throw new RunsNotConfiguredError(
      "ADMIN_TOKEN is not configured for this app.",
    );
  let response: Response;
  try {
    response = await fetch(`${ATLAS_BASE_URL}${path}`, {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      // Bounded: the home page awaits this, and an untimed fetch is a
      // page that never renders.
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
  } catch (error) {
    throw new RunsUnreachableError(
      `Atlas is unreachable at ${ATLAS_BASE_URL}: ${(error as Error).message}`,
    );
  }
  if (response.status === 401)
    throw new RunsNotConfiguredError("Atlas rejected ADMIN_TOKEN.");
  if (response.status === 404) {
    // A running Atlas built before Sprint 4.3 has no /admin/runs route.
    // Degrading to "no runs yet" is more honest than a 500 that implies
    // something broke.
    throw new RunsUnreachableError(
      "This Atlas build has no /admin/runs route yet — rebuild and restart the Atlas API to see ingestion runs.",
    );
  }
  if (!response.ok)
    throw new RunsUnreachableError(
      `Atlas returned ${response.status} for ${path}.`,
    );
  return (await response.json()) as T;
}

export async function loadRuns(): Promise<IngestionRun[]> {
  return adminGet<IngestionRun[]>("/admin/runs");
}

export async function loadRunEvents(runId: string): Promise<IngestionEvent[]> {
  return adminGet<IngestionEvent[]>(
    `/admin/runs/${encodeURIComponent(runId)}/events`,
  );
}

/** Display order for the pipeline. An unrecognised stage sorts last and is still shown — never hidden. */
export const STAGE_ORDER = [
  "run-started",
  "source-discovered",
  "source-queued",
  "source-fetched",
  "source-verified",
  "knowledge-extracted",
  "entity-created",
  "entity-matched",
  "entity-enriched",
  "entity-rejected",
  "relationship-created",
  "candidate-queued",
  "candidate-resolved",
  "run-completed",
] as const;

/** Curator-facing labels. The pipeline is described the way a person would describe it, not the way the code is structured. */
export const STAGE_LABEL: Record<string, string> = {
  "run-started": "Started",
  "source-discovered": "Discovered",
  "source-queued": "Queued",
  "source-fetched": "Fetched",
  "source-verified": "Verified",
  "knowledge-extracted": "Understood",
  "entity-created": "Created",
  "entity-matched": "Recognised",
  "entity-enriched": "Learned",
  "entity-rejected": "Refused",
  "relationship-created": "Connected",
  "candidate-queued": "Queued to learn",
  "candidate-resolved": "Closed out",
  "run-completed": "Finished",
};

export function stageRank(stage: string): number {
  const index = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return index === -1 ? STAGE_ORDER.length : index;
}
