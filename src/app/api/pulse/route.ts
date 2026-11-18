import { createPulse, shelves } from "@/lib/pulse/service";
import {
  device,
  guardRequest,
  guarded,
  ipOf,
  json,
  readBody,
} from "@/lib/pulse/http";

export const dynamic = "force-dynamic";

/** The Labs shelves: recent, popular, trending. */
export async function GET(request: Request) {
  const refused = guardRequest(request, "read");
  if (refused) return refused;
  return guarded(async (store) =>
    json(shelves(await store.list(120), new Date())),
  );
}

/** Ask a new question. */
export async function POST(request: Request) {
  const refused = guardRequest(request, "create");
  if (refused) return refused;
  return guarded(async (store, key) => {
    const body = await readBody(request);
    const result = await createPulse(store, key, body, {
      device: await device(),
      ip: ipOf(request),
      now: new Date(),
    });
    if (result.ok) return json({ id: result.pulse.id }, 201);
    return json(
      { error: result.error, field: result.field, message: result.message },
      result.error === "limited" ? 429 : 400,
    );
  });
}
