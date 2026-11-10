import {
  guardPost,
  guarded,
  json,
  playerCookie,
  readBody,
} from "@/lib/courtqueue/http";
import { chat, chatHistory, live } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** Earlier Clubhouse messages: `?before=<message id>`. Members only. */
export async function GET(request: Request) {
  const before = new URL(request.url).searchParams.get("before");
  return guarded(async () => {
    const page = await chatHistory(await playerCookie(), before);
    return page ? json(page) : json({ error: "Sign in first." }, 401);
  });
}

/**
 * One thing said or done in the Clubhouse — a message, a reaction, a report,
 * or an organizer's control — then the fresh view. There is no way to address
 * one person: a message goes to the whole club or it doesn't go.
 */
export async function POST(request: Request) {
  const cookie = await playerCookie();
  const refused = guardPost(request, "post", cookie);
  if (refused) return refused;
  const body = await readBody(request);
  return guarded(async () => {
    const out = await chat(cookie, body.cmd);
    const view = await live(cookie, null);
    return out.ok
      ? json({ ok: true, view })
      : json({ ok: false, error: out.error, view }, 409);
  });
}
