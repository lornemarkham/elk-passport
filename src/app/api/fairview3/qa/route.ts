import {
  guardPublicPost,
  json,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import {
  isParticipantId,
  screenFeedback,
  screenName,
} from "@/lib/fairview3/sanitize";
import { QA_MAX_CHARS } from "@/lib/fairview3/show";

export const dynamic = "force-dynamic";

/**
 * Executive Hot Seat: a display name and a question, no account. Screened
 * here, hideable by the presenter, and never put on the stage by anyone but
 * the presenter. No part of this path calls a model: it works when AI is down.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body || !isParticipantId(body.participant))
    return json({ error: "bad-request" }, 400);
  const refused = guardPublicPost(request, "qa", body.participant);
  if (refused) return refused;
  const text = screenFeedback(body.body, QA_MAX_CHARS);
  if (!text.ok)
    return json({ ok: false, reason: "rejected", because: text.reason }, 422);
  const name = screenName(body.name);
  if (!name.ok)
    return json({ ok: false, reason: "rejected", because: name.reason }, 422);
  const { participant } = body;
  return withStore(async (store) => {
    const outcome = await store.ask(participant, name.body, text.body);
    if (outcome === "ok") return json({ ok: true });
    return json(
      {
        ok: false,
        reason: outcome,
        because:
          outcome === "too-many"
            ? "That's plenty from one phone. Upvote someone else's!"
            : "You've already asked that one.",
      },
      outcome === "too-many" ? 429 : 409,
    );
  });
}
