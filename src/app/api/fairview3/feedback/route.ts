import {
  guardPublicPost,
  json,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import { isParticipantId, screenFeedback } from "@/lib/fairview3/sanitize";
import { isFeedbackPromptId } from "@/lib/fairview3/show";

export const dynamic = "force-dynamic";

/** Anonymous, screened, moderated before anyone else sees it. */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (
    !body ||
    !isParticipantId(body.participant) ||
    !isFeedbackPromptId(body.prompt)
  )
    return json({ error: "bad-request" }, 400);
  const refused = guardPublicPost(request, "feedback", body.participant);
  if (refused) return refused;
  const screened = screenFeedback(body.body);
  if (!screened.ok)
    return json(
      { ok: false, reason: "rejected", because: screened.reason },
      422,
    );
  const { participant, prompt } = body;
  return withStore(async (store) => {
    const outcome = await store.feedback(participant, prompt, screened.body);
    if (outcome === "ok") return json({ ok: true });
    return json(
      {
        ok: false,
        reason: outcome,
        because:
          outcome === "too-many"
            ? "That's plenty from one phone — thank you!"
            : "You've already sent that one.",
      },
      outcome === "too-many" ? 429 : 409,
    );
  });
}
