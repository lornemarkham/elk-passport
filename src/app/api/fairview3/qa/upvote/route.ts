import {
  guardPublicPost,
  json,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import { isParticipantId } from "@/lib/fairview3/sanitize";

export const dynamic = "force-dynamic";

/** One upvote per phone per question; `on: false` takes it back. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    !isParticipantId(body.participant) ||
    typeof body.id !== "string" ||
    body.id.length > 64 ||
    typeof body.on !== "boolean"
  )
    return json({ error: "bad-request" }, 400);
  const refused = guardPublicPost(request, "participant", body.participant);
  if (refused) return refused;
  const { participant, id, on } = body;
  return withStore(async (store) => {
    const outcome = await store.upvote(participant, id, on);
    return outcome === "ok"
      ? json({ ok: true })
      : json({ ok: false, reason: outcome }, 404);
  });
}
