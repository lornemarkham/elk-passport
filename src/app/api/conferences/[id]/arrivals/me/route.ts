import { errorResponse, gate, okResponse } from "@/lib/conference/request";
import { arrivalsDeps } from "@/lib/conference-arrivals/request";
import { removeMine, saveMine } from "@/lib/conference-arrivals/service";

type Ctx = { params: Promise<{ id: string }> };

/** `{flight, date, from?, shared, displayName?}`: your flight, and whether to share it. */
export async function PUT(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const result = await saveMine(
    arrivalsDeps(),
    g.identity,
    (await params).id,
    body,
  );
  if (!result.ok) return errorResponse(result.error, result.issues);
  return okResponse({});
}

/** Your flight, gone. Not hidden; gone. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const ok = await removeMine(arrivalsDeps(), g.identity, (await params).id);
  if (!ok) return errorResponse("not-found");
  return okResponse({});
}
