import {
  guardPublicPost,
  json,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import { isParticipantId } from "@/lib/fairview3/sanitize";
import { isQuestionId } from "@/lib/fairview3/show";

export const dynamic = "force-dynamic";

/** One vote per phone per question, changeable while the question is open. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    !isParticipantId(body.participant) ||
    !isQuestionId(body.question) ||
    typeof body.option !== "number"
  )
    return json({ error: "bad-request" }, 400);
  const refused = guardPublicPost(request, "participant", body.participant);
  if (refused) return refused;
  const { participant, question, option } = body;
  return withStore(async (store) => {
    const outcome = await store.vote(participant, question, option);
    return json(
      outcome === "ok" ? { ok: true } : { ok: false, reason: outcome },
      outcome === "ok" ? 200 : outcome === "closed" ? 409 : 400,
    );
  });
}
