import { isPulseId } from "@/lib/pulse/model";
import { castVote, snapshot } from "@/lib/pulse/service";
import {
  device,
  guardRequest,
  guarded,
  ipOf,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** One vote per browser; answers with the results it unlocks. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "vote");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return guarded(async (store, key) => {
    const body = await readBody(request);
    const me = await device();
    const now = new Date();
    const result = await castVote(store, key, id, body, {
      device: me,
      ip: ipOf(request),
      now,
    });
    if (!result.ok) {
      const status =
        result.outcome === "missing"
          ? 404
          : result.outcome === "limited"
            ? 429
            : result.outcome === "closed"
              ? 409
              : 400;
      return json({ error: result.outcome, message: result.message }, status);
    }
    const snap = await snapshot(store, key, id, me, now, true);
    return json({ outcome: result.outcome, ...snap });
  });
}
