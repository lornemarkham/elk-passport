import { isPulseId } from "@/lib/pulse/model";
import { reportPulse } from "@/lib/pulse/service";
import {
  device,
  guardRequest,
  guarded,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** Flag a Pulse. Three different browsers take it off the air for review. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "report");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return guarded(async (store, key) => {
    const outcome = await reportPulse(
      store,
      key,
      id,
      await readBody(request),
      await device(),
    );
    if (outcome === "invalid") return json({ error: "invalid" }, 400);
    if (outcome === "missing") return json({ error: "missing" }, 404);
    return json({ outcome });
  });
}
