import { requireAdminApi } from "@/lib/admin/requireAdmin";
import { isPulseId } from "@/lib/pulse/model";
import {
  isDay,
  isModerationStatus,
  pulseDay,
  shelves,
} from "@/lib/pulse/service";
import { guardRequest, guarded, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** The moderation queue. Passport administrators only (the curator gate). */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return guarded(async (store) => {
    const now = new Date();
    const today = pulseDay(now);
    const [items, upcoming, listed] = await Promise.all([
      store.reported(),
      store.featured(today, 14),
      store.list(60),
    ]);
    return json({
      items,
      today,
      featured: upcoming.map(({ day, item }) => ({
        day,
        id: item.pulse.id,
        question: item.pulse.question,
        total: item.total,
      })),
      // Live Pulses an administrator can pick from: the most voted, then the newest.
      candidates: [
        ...new Map(
          [
            ...shelves(listed, now, 8).popular,
            ...shelves(listed, now, 8).recent,
          ].map((c) => [c.id, c]),
        ).values(),
      ],
    });
  });
}

/** Put a Pulse back on the air, hold it for review, or remove it. */
export async function POST(request: Request) {
  const refused = guardRequest(request, "vote");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return guarded(async (store) => {
    const body = await readBody(request);
    // Question of the Day: { day, id } features a Pulse on a day; { day, id: null } clears it.
    if ("day" in body) {
      const today = pulseDay(new Date());
      if (!isDay(body.day) || body.day < today)
        return json({ error: "invalid" }, 400);
      if (body.id !== null && !isPulseId(body.id))
        return json({ error: "invalid" }, 400);
      const done = await store.feature(body.day, body.id as string | null);
      console.info("pulse-featured", {
        day: body.day,
        id: body.id,
        by: gate.admin.email,
      });
      return done ? json({ ok: true }) : json({ error: "missing" }, 404);
    }
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
