import { isPulseId } from "@/lib/pulse/model";
import { snapshot } from "@/lib/pulse/service";
import { device, guardRequest, guarded, json } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/**
 * One Pulse as this browser sees it: the question, its own vote and referral
 * code, and — once it has voted, or asks with `?see=1` — the results.
 * Phones poll this while the page is open.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const { id } = await params;
  if (!isPulseId(id)) return json({ error: "missing" }, 404);
  return guarded(async (store, key) => {
    const reveal = new URL(request.url).searchParams.get("see") === "1";
    const snap = await snapshot(
      store,
      key,
      id,
      await device(),
      new Date(),
      reveal,
    );
    return snap ? json(snap) : json({ error: "missing" }, 404);
  });
}
