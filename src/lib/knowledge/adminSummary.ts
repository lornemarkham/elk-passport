import "server-only";
import { loadRuns } from "./runData";

/**
 * The live numbers the Atlas home page puts on its rows.
 *
 * ## Every metric degrades on its own
 *
 * Each returns `null` when it cannot be established, and the page **omits
 * the metric** rather than showing a zero. A `0` is a claim about the
 * corpus; `null` is a claim about the fetch, and rendering the first when
 * the second is true is how a page states something it has not verified.
 *
 * This already happened once: the home page showed `0 entities` beside
 * `167 unplaced`.
 *
 * ## Nothing here may block the page
 *
 * Server components `await` their data, so an untimed fetch is a page that
 * never renders. Every call is bounded and every failure resolves to
 * `null` — a missing number is a small loss; a blank screen is a total one.
 */

const ATLAS_BASE_URL = "http://localhost:3000";
const TIMEOUT_MS = 3000;

/**
 * How many ingestion runs started today.
 *
 * "Today" is the operator's local day as the server sees it. Deliberately
 * not "in the last 24 hours" — an operator asking *what has Atlas been
 * doing* means since they sat down, not a rolling window.
 */
export async function runsToday(): Promise<number | null> {
  try {
    const runs = await loadRuns();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return runs.filter((run) => new Date(run.startedAt) >= startOfDay).length;
  } catch {
    return null;
  }
}

/**
 * How many duplicate groups are waiting on a human.
 *
 * Fetched separately from everything else because the scan compares every
 * entity against every other and is the most expensive read in the admin.
 * On the front door it is a number on a row, so if it is slow it simply
 * does not appear.
 */
export async function duplicateGroupCount(): Promise<number | null> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch(`${ATLAS_BASE_URL}/admin/duplicates`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const result = (await response.json()) as { groups?: unknown[] };
    return Array.isArray(result.groups) ? result.groups.length : null;
  } catch {
    return null;
  }
}
