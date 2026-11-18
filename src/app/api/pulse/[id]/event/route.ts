import { isPulseId } from "@/lib/pulse/model";
import { countEvent } from "@/lib/pulse/service";
import { isEvent } from "@/lib/pulse/store";
import { guardRequest, guarded, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/**
 * Count one share, results card or opened shared link — a number per day and
 * kind, nothing about who. Never sets a cookie and never fails loudly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "event");
  if (refused) return refused;
  const { id } = await params;
  const body = await readBody(request);
  if (!isPulseId(id) || !isEvent(body.event))
    return json({ error: "invalid" }, 400);
  return guarded(async (store) =>
    json({ counted: await countEvent(store, id, body.event as never) }),
  );
}
