import {
  guardPost,
  guarded,
  json,
  playerCookie,
  readBody,
} from "@/lib/courtqueue/http";
import { vapidPublicKey } from "@/lib/courtqueue/push";
import { pushChange } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** The key a phone subscribes with; null when push can't work here. */
export async function GET() {
  return json({ publicKey: vapidPublicKey() });
}

/** Subscribe this phone, unsubscribe it, or send it a test. */
export async function POST(request: Request) {
  const cookie = await playerCookie();
  const refused = guardPost(request, "post", cookie);
  if (refused) return refused;
  const body = await readBody(request);
  return guarded(async () => {
    const out = await pushChange(cookie, body);
    return out.ok ? json({ ok: true }) : json(out, 409);
  });
}
