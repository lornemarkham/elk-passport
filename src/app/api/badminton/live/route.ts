import { guarded, json, playerCookie } from "@/lib/courtqueue/http";
import { live } from "@/lib/courtqueue/service";

export const dynamic = "force-dynamic";

/** Every phone polls this. `?v=` answers "unchanged" when nothing moved. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return guarded(async () =>
    json(await live(await playerCookie(), q.get("v"), q.get("org"))),
  );
}
