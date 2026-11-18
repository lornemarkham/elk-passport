import { readEvidence, readOrigin } from "@/lib/pulse/checkService";
import { guardRequest, json, readBody } from "@/lib/pulse/http";
import { pulseKey } from "@/lib/pulse/store";

export const dynamic = "force-dynamic";

/**
 * Open one public page. `as: "origin"` reads where the claim was seen, to help
 * write it out; `as: "evidence"` copies what a source says about the claim
 * and seals it so it can be published exactly as read.
 */
export async function POST(request: Request) {
  const refused = guardRequest(request, "evidence");
  if (refused) return refused;
  const body = await readBody(request);
  if (body.as === "origin") return json(await readOrigin(body.url));
  const key = pulseKey();
  if (!key) return json({ error: "not-ready" }, 503);
  return json(await readEvidence(key, body.url, body.claim, new Date()));
}
