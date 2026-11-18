import { requireAdminApi } from "@/lib/admin/requireAdmin";
import { isPulseId } from "@/lib/pulse/model";
import { isModerationStatus } from "@/lib/pulse/service";
import { guardRequest, guarded, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** The moderation queue. Passport administrators only (the curator gate). */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return guarded(async (store) => json({ items: await store.reported() }));
}

/** Put a Pulse back on the air, hold it for review, or remove it. */
export async function POST(request: Request) {
  const refused = guardRequest(request, "vote");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return guarded(async (store) => {
    const body = await readBody(request);
    if (!isPulseId(body.id) || !isModerationStatus(body.status))
      return json({ error: "invalid" }, 400);
    const changed = await store.setStatus(body.id, body.status);
    console.info("pulse-moderation", {
      id: body.id,
      status: body.status,
      by: gate.admin.email,
    });
    return changed ? json({ ok: true }) : json({ error: "missing" }, 404);
  });
}
