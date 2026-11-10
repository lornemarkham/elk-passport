import {
  guardPost,
  guarded,
  json,
  playerCookie,
  readBody,
} from "@/lib/courtqueue/http";
import { act, live } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** One action — PLAY, START GAME, a challenge, an organizer fix — then the fresh view. */
export async function POST(request: Request) {
  const cookie = await playerCookie();
  const refused = guardPost(request, "post", cookie);
  if (refused) return refused;
  const body = await readBody(request);
  return guarded(async () => {
    const out = await act(cookie, body);
    const focus = new URL(request.url).searchParams.get("org");
    const view = await live(cookie, null, focus);
    return out.ok
      ? json({ ok: true, view })
      : json({ ok: false, error: out.error, view }, 409);
  });
}
