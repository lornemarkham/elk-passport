import {
  guardPost,
  guarded,
  json,
  playerCookie,
  readBody,
} from "@/lib/courtqueue/http";
import { savePhoto } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** A small square picture, shrunk on the phone first. `null` removes it. */
export async function POST(request: Request) {
  const cookie = await playerCookie();
  const refused = guardPost(request, "post", cookie);
  if (refused) return refused;
  const body = await readBody(request);
  return guarded(async () => {
    const out = await savePhoto(cookie, body.dataUrl);
    return out.ok
      ? json({ ok: true })
      : json({ ok: false, error: out.error }, 400);
  });
}
