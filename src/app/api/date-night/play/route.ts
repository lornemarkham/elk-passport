import { createNight } from "@/lib/date-night/connect/service";
import {
  giveToken,
  guard,
  json,
  readJson,
  withStore,
} from "@/lib/date-night/connect/http";

export const dynamic = "force-dynamic";

/**
 * **Start a Connect & Play night.** No account: the person who starts it gets
 * a cookie for that night alone, and the link they share carries nothing but
 * an unguessable code.
 */
export async function POST(request: Request) {
  const refused = guard(request, "make");
  if (refused) return refused;
  const body = await readJson(request);
  if (!body) return json({ error: "bad-request" }, 400);
  return withStore(async (store) => {
    const made = await createNight(store, {
      mode: body.mode,
      stage: body.stage,
      phones: body.phones,
      name: body.name,
      guestName: body.guestName,
      questions: body.questions,
      guestQuestions: body.guestQuestions,
    });
    if (!made.ok) return json({ error: made.error }, 400);
    await giveToken(made.code, made.token);
    return json({ code: made.code }, 201);
  });
}
