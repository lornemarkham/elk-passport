import { guarded, json, playerCookie } from "@/lib/courtqueue/http";
import { stats } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** My history, and the public board (everyone's, for the organizer). */
export async function GET() {
  return guarded(async () => {
    const out = await stats(await playerCookie());
    return out ? json(out) : json({ error: "Sign in first." }, 401);
  });
}
