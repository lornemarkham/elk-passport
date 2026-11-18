import { requireAdminApi } from "@/lib/admin/requireAdmin";
import { correctCheck } from "@/lib/pulse/checkService";
import { isPulseId } from "@/lib/pulse/model";
import { checkGuarded, guardRequest, json, readBody } from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

const POST_STATUSES = ["live", "hidden", "removed"] as const;

/** Pulse Check moderation: reported posts, recent checks, visit and share counts. */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return checkGuarded(async ({ checks }) => {
    const [posts, recent, usage] = await Promise.all([
      checks.reportedPosts(),
      checks.list(30),
      checks.usage(30).catch(() => []),
    ]);
    return json({ posts, recent, usage });
  });
}

/**
 * `{ post, status }` shows, hides or removes a post. `{ check, note,
 * assessment? }` adds a moderator's correction, which is shown on the check
 * as the moderator's.
 */
export async function POST(request: Request) {
  const refused = guardRequest(request, "vote");
  if (refused) return refused;
  const gate = await requireAdminApi();
  if ("response" in gate) return gate.response;
  return checkGuarded(async (stores, key) => {
    const body = await readBody(request);
    if ("post" in body) {
      const status = POST_STATUSES.find((s) => s === body.status);
      if (!isPulseId(body.post) || !status)
        return json({ error: "invalid" }, 400);
      const done = await stores.checks.setPostStatus(body.post, status);
      console.info("pulse-check-post-moderation", {
        post: body.post,
        status,
        by: gate.admin.email,
      });
      return done ? json({ ok: true }) : json({ error: "missing" }, 404);
    }
    if (!isPulseId(body.check)) return json({ error: "invalid" }, 400);
    const result = await correctCheck(
      stores,
      key,
      body.check,
      { note: body.note, assessment: body.assessment },
      "moderator",
      new Date(),
    );
    console.info("pulse-check-moderator-correction", {
      check: body.check,
      result: result.ok ? "ok" : result.error,
      by: gate.admin.email,
    });
    return result.ok
      ? json({ ok: true })
      : json({ error: result.error, message: result.message }, 400);
  });
}
