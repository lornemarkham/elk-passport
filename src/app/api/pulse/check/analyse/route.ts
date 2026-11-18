import { analyse } from "@/lib/pulse/checkService";
import { checkStore } from "@/lib/pulse/checkStore";
import { guardRequest, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/**
 * Read a claim's own words: figures, dates, places, organisations, the
 * questions it leaves open, where to look, and whether it was checked before.
 * Rules only — nothing is fetched, nothing is decided.
 */
export async function POST(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const body = await readBody(request);
  let checks = null;
  try {
    checks = checkStore();
  } catch {
    // Without the store there is no duplicate search; the reading still works.
  }
  const result = await analyse(checks, body);
  return "error" in result ? json(result, 400) : json(result);
}
