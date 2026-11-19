import {
  act,
  isCode,
  joinNight,
  leaveNight,
  openNight,
} from "@/lib/date-night/connect/service";
import {
  giveToken,
  guard,
  json,
  readJson,
  takeToken,
  tokenFor,
  withStore,
} from "@/lib/date-night/connect/http";
import type { Action, Slot } from "@/domain/date-night/connect/session";

export const dynamic = "force-dynamic";

const slotOf = (v: unknown): Slot | undefined =>
  v === 1 || v === "1" ? 1 : v === 2 || v === "2" ? 2 : undefined;

type Ctx = { params: Promise<{ code: string }> };

/**
 * **What this person may see of the night.** The answer is decided by their
 * cookie: a stranger holding the link learns only the mode and the host's
 * name, and only while the second seat is open.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { code } = await params;
  if (!isCode(code)) return json({ status: "gone" }, 404);
  const refused = guard(request, "read", code);
  if (refused) return refused;
  const as = slotOf(new URL(request.url).searchParams.get("as"));
  return withStore(async (store) => {
    const gate = await openNight(store, code, await tokenFor(code), as);
    return json(gate, gate.status === "gone" ? 404 : 200);
  });
}

const ACTIONS = new Set([
  "answer",
  "next",
  "mode",
  "stage",
  "questions",
  "name",
]);

/**
 * **Everything a person does**: join, answer, next, change the mode or the
 * stage, edit their own questions, rename themselves, leave.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { code } = await params;
  if (!isCode(code)) return json({ error: "gone" }, 404);
  const refused = guard(request, "act", code);
  if (refused) return refused;
  const body = await readJson(request);
  if (!body || typeof body.type !== "string")
    return json({ error: "bad-request" }, 400);
  const as = slotOf(body.as);
  const type = body.type;

  return withStore(async (store) => {
    if (type === "join") {
      const joined = await joinNight(store, code, {
        name: body.name,
        questions: body.questions,
      });
      if (!joined.ok)
        return json(
          { error: joined.error },
          joined.error === "gone" ? 404 : 409,
        );
      await giveToken(code, joined.token);
      return json({ ok: true });
    }
    const token = await tokenFor(code);
    if (type === "leave") {
      const left = await leaveNight(store, code, token, as);
      if (!left) return json({ error: "gone" }, 404);
      await takeToken(code);
      return json({ ok: true });
    }
    if (!ACTIONS.has(type)) return json({ error: "bad-request" }, 400);
    const action = (
      type === "next"
        ? { type: "next", from: Number(body.from) }
        : { ...body, as: undefined }
    ) as Action;
    const result = await act(store, code, token, as, action);
    if (!result.ok) return json({ error: result.error }, result.status);
    return json(result.view);
  });
}
