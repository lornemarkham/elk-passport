import "server-only";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * Research Missions, from the app's side.
 *
 * ## What a mission means on this screen
 *
 * The Entity Workspace has always rendered *"What Atlas doesn't know yet"*
 * — a list of named gaps with a research action beside each one. Until now
 * those actions were labels. A mission is what happens when one is clicked:
 * a durable record that a human asked, which can be running, can come back
 * empty, and can be refused.
 *
 * ## Findings are never merged into the view
 *
 * A mission's findings are shown **beside** what Atlas knows, never folded
 * into it. The whole value of the review step evaporates if a proposed fact
 * is indistinguishable from an accepted one — the reviewer would be
 * approving something they cannot see the edges of.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

/**
 * How long an optional admin fetch may block a page render.
 *
 * Server components `await` these, so a fetch with no timeout is a page
 * that never renders — which is exactly what happened: with the Atlas API
 * unreachable in a way that did not refuse the connection, `/admin` simply
 * hung. A blank page for 45 seconds is the least calm thing an interface
 * can do, and it fails in the direction that looks like a crash rather than
 * like missing data.
 *
 * Three seconds is generous for localhost and short enough that a stalled
 * dependency degrades to "Atlas is unreachable" instead of to nothing.
 */
const ADMIN_FETCH_TIMEOUT_MS = 3000;

export type ResearchMissionStatus =
  | "requested"
  | "running"
  | "awaiting-review"
  | "merged"
  | "rejected"
  | "no-findings"
  | "failed";

export interface ResearchFinding {
  readonly label: string;
  readonly value: string;
  readonly category?: string;
  readonly sourceRecordId?: string;
}

export interface ResearchMedia {
  readonly url: string;
  readonly kind: "image" | "video" | "document";
  readonly thumbnailUrl?: string;
  readonly caption?: string;
}

export interface ResearchMission {
  readonly id: string;
  readonly entityId: string;
  readonly topic: string;
  readonly status: ResearchMissionStatus;
  readonly runId?: string;
  readonly summary?: string;
  readonly findings?: {
    readonly keyFacts?: readonly ResearchFinding[];
    readonly media?: readonly ResearchMedia[];
    readonly conflicts?: readonly {
      field: string;
      existing: string;
      incoming: string;
    }[];
    readonly unsupported?: readonly string[];
    readonly sourceRecordIds?: readonly string[];
  };
  readonly requestedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly reviewedAt?: string;
}

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) throw new Error("ADMIN_TOKEN is not configured for this app.");
  return fetch(`${ATLAS_BASE_URL}${path}`, {
    ...init,
    headers: atlasAuthHeaders({
      "x-admin-token": token,
      "Content-Type": "application/json",
      ...((init?.headers ?? {}) as Record<string, string>),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(ADMIN_FETCH_TIMEOUT_MS),
  });
}

/**
 * Every mission Atlas holds.
 *
 * Returns `[]` rather than throwing when Atlas is unreachable. A workspace
 * page that renders everything Atlas knows should not go blank because an
 * optional panel could not load — the knowledge is the point, missions are
 * an addition to it.
 */
export async function loadResearchMissions(): Promise<
  readonly ResearchMission[]
> {
  try {
    const response = await adminFetch("/admin/research-missions");
    if (!response.ok) return [];
    return (await response.json()) as ResearchMission[];
  } catch {
    return [];
  }
}

/**
 * The topics Atlas holds a profile for.
 *
 * Fetched rather than duplicated: a button drawn for a topic Atlas cannot
 * research is a button that 400s on click. Returns [] when Atlas is
 * unreachable, and the caller falls back to its own list — so the failure
 * mode is a missing button, never a broken one.
 */
export async function loadResearchTopics(): Promise<readonly string[]> {
  try {
    const response = await adminFetch("/admin/research-topics");
    if (!response.ok) return [];
    const topics = (await response.json()) as { id: string }[];
    return topics.map((t) => t.id);
  } catch {
    return [];
  }
}

export async function loadMissionsForEntity(
  entityId: string,
): Promise<readonly ResearchMission[]> {
  return (await loadResearchMissions()).filter((m) => m.entityId === entityId);
}

/** Records that a curator asked. Does not fetch, extract or merge — `npm run run-missions` does that. */
export async function requestResearchMission(
  entityId: string,
  topic: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await adminFetch("/admin/research-missions", {
      method: "POST",
      body: JSON.stringify({ entityId, topic }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        error: body.error ?? `Atlas returned ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Records a human's decision on findings. The entity is unchanged either way in Phase 1. */
export async function reviewResearchMission(
  missionId: string,
  decision: "accept" | "reject",
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await adminFetch("/admin/research-missions", {
      method: "PATCH",
      body: JSON.stringify({ missionId, decision }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        error: body.error ?? `Atlas returned ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** A mission still owed a human decision. */
export function awaitsReview(mission: ResearchMission): boolean {
  return mission.status === "awaiting-review";
}

/** Open in the machine's sense — asked for, not yet settled. */
export function isOpen(mission: ResearchMission): boolean {
  return mission.status === "requested" || mission.status === "running";
}

/** How a status reads to a person. `no-findings` is phrased as an answer, because it is one. */
export function statusLabel(status: ResearchMissionStatus): string {
  const labels: Record<ResearchMissionStatus, string> = {
    requested: "Requested — waiting to run",
    running: "Researching now",
    "awaiting-review": "Findings ready for review",
    merged: "Accepted",
    rejected: "Declined",
    "no-findings": "Nothing published on this",
    failed: "Failed",
  };
  return labels[status];
}
