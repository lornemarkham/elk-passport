import {
  guardPublicPost,
  json,
  presenterKey,
  readJson,
  withStore,
} from "@/lib/fairview3/api";
import { parsePresenterAction } from "@/lib/fairview3/store";

export const dynamic = "force-dynamic";

/** The inbox: every feedback row with its status, for moderation. */
export async function GET() {
  const key = await presenterKey();
  if (!key) return json({ error: "forbidden" }, 403);
  return withStore(async (store) => {
    const inbox = await store.inbox(key);
    return inbox ? json(inbox) : json({ error: "forbidden" }, 403);
  });
}

/** One presenter action. The key is re-checked in the store on every call. */
export async function POST(request: Request) {
  const refused = guardPublicPost(request, "presenter");
  if (refused) return refused;
  const key = await presenterKey();
  if (!key) return json({ error: "forbidden" }, 403);
  const action = parsePresenterAction(await readJson(request));
  if (!action) return json({ error: "bad-request" }, 400);
  return withStore(async (store) => {
    const ok = await store.presenter(key, action);
    return ok ? json({ ok: true }) : json({ error: "forbidden" }, 403);
  });
}
