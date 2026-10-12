import {
  deps,
  errorResponse,
  gate,
  okResponse,
} from "@/lib/conference/request";
import { deleteConference, updateConference } from "@/lib/conference/service";

type Ctx = { params: Promise<{ id: string }> };

/** Replace the details. Organisers only. */
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = await request.json().catch(() => null);
  const result = await updateConference(
    deps(),
    g.identity,
    (await params).id,
    body,
  );
  if (!result.ok) return errorResponse(result.error, result.issues);
  return okResponse({ conference: result.conference });
}

/** Delete it, and everything every module holds about it. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const result = await deleteConference(deps(), g.identity, (await params).id);
  if (!result.ok) return errorResponse(result.error);
  return okResponse({});
}
