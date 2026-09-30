import "server-only";
import { atlasAuthHeaders } from "@/lib/data/atlasAuth";

/**
 * Regions, from the app's side.
 *
 * ## The product hierarchy this exists to make truthful
 *
 * ```
 * Atlas  →  Region  →  Entities  →  Entity  →  Passport
 * ```
 *
 * A Region is a `Place` whose `placeType` is `region`; membership is the
 * existing `contains` relationship. Both rules live in Atlas
 * (`domain/shared/region.ts`) and are **served**, not re-derived here — a
 * second implementation of "what counts as a region" would be a second
 * thing to keep correct.
 *
 * ## Unassigned is a first-class result
 *
 * `unassignedIds` is returned and rendered, not filtered away. Today it is
 * nearly the whole corpus: 167 entities exist and almost none has been
 * placed. A Regions page that quietly omitted them would be asserting a
 * tidiness that isn't real — the same defect as a knowledge section hiding
 * a fact nobody wrote a template for.
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
const ADMIN_FETCH_TIMEOUT_MS = 10_000;

/**
 * **Why this one is 10s when the optional metrics are 3s.**
 *
 * The 3s budget was set when every read was a single unbounded query. Paged
 * reads (ADR 027) turned each into several round trips, and `/admin/regions`
 * is the most expensive of them — it walks the whole relationship table
 * *and* four entity tables to answer "which regions, and who is in them".
 * Measured on 2026-08-16: `/admin/entities` alone is ~2.2s, and the
 * composite exceeded 3s often enough that the workspace intermittently
 * claimed Atlas was unreachable while Atlas was answering fine.
 *
 * **A timeout that fires on a healthy system is worse than a slow page**:
 * it produces a confident, wrong claim, which is the failure this file was
 * rewritten to prevent in the first place.
 *
 * So the budget is split by what the read is *for*, the same essential vs
 * optional distinction `loadWorkspaceBundle` already draws. This one is
 * essential — no region page can render without it — and gets room. The
 * optional counts on the admin home keep 3s, because a missing number
 * costs one number while a missing region costs the page.
 *
 * Still bounded, and still far from the 45-second blank page that made
 * timeouts necessary. The real fix is not a bigger number: it is not
 * loading the whole graph to answer a membership question, which is the
 * recorded "query the graph, don't load it" milestone.
 */

export interface RegionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly memberIds: readonly string[];
}

export interface RegionsResult {
  readonly regions: readonly RegionSummary[];
  readonly unassignedIds: readonly string[];
  /**
   * Whether Atlas answered, and if not, why.
   *
   * The load-bearing field. Without it `regions: []` means either *Atlas
   * holds no regions* or *we could not ask*, and callers have no way to
   * tell — so they guess, and the guesses are wrong in the expensive
   * direction. `[regionId]/page.tsx` called `notFound()`, asserting a
   * region does not exist because a 3-second timeout elapsed.
   *
   * Three states rather than two, because the two failures need different
   * words. `no-token` is a setup step and should read like one;
   * `unreachable` is a runtime failure and should not tell someone to go
   * set a token they have already set. **A diagnostic that is confidently
   * wrong is worse than no diagnostic** — Atlas learned that once already,
   * when a permission error was reported as a missing column.
   */
  readonly status: "ok" | "no-token" | "unreachable";
}

/** Atlas was never asked — the app has no token. A setup step. */
const NO_TOKEN: RegionsResult = {
  regions: [],
  unassignedIds: [],
  status: "no-token",
};

/** Atlas was asked and did not answer. Says nothing about what Atlas holds. */
const UNREACHABLE: RegionsResult = {
  regions: [],
  unassignedIds: [],
  status: "unreachable",
};

/**
 * Degrades rather than throwing when Atlas is unreachable — the admin
 * should show "Atlas is not responding", not a stack trace.
 *
 * What it must never do is degrade *silently*. Every failure path says
 * which failure it was, and a missing token counts as one: an app with no
 * `ADMIN_TOKEN` has not discovered that Atlas is empty, it has failed to
 * look.
 */
export async function loadRegions(): Promise<RegionsResult> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return NO_TOKEN;
  try {
    const response = await fetch(`${ATLAS_BASE_URL}/admin/regions`, {
      headers: atlasAuthHeaders({ "x-admin-token": token }),
      cache: "no-store",
      signal: AbortSignal.timeout(ADMIN_FETCH_TIMEOUT_MS),
    });
    // 401 is a token that exists and is wrong — still a setup problem, and
    // the setup notice is the right words for it.
    if (response.status === 401) return NO_TOKEN;
    if (!response.ok) return UNREACHABLE;
    const body = (await response.json()) as Omit<RegionsResult, "status">;
    return {
      regions: body.regions ?? [],
      unassignedIds: body.unassignedIds ?? [],
      status: "ok",
    };
  } catch {
    return UNREACHABLE;
  }
}

export function findRegion(
  result: RegionsResult,
  id: string,
): RegionSummary | undefined {
  return result.regions.find((r) => r.id === id);
}

/** Which region has claimed this entity, if any. Used by the entity page for its breadcrumb. */
export function regionForEntity(
  result: RegionsResult,
  entityId: string,
): RegionSummary | undefined {
  return result.regions.find((r) => r.memberIds.includes(entityId));
}
