import {
  guardPublicPost,
  json,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import { isParticipantId } from "@/lib/fairview3/sanitize";

export const dynamic = "force-dynamic";

/** "I'm in the room." Idempotent; a reconnecting phone sends it again. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || !isParticipantId(body.participant))
    return json({ error: "bad-request" }, 400);
  const refused = guardPublicPost(request, "participant", body.participant);
  if (refused) return refused;
  const id = body.participant;
  return withStore(async (store) => {
    await store.presence(id);
    return json({ ok: true });
  });
}
