import {
  deps,
  errorResponse,
  gate,
  okResponse,
} from "@/lib/conference/request";
import { leave, updateMe } from "@/lib/conference/service";

type Ctx = { params: Promise<{ id: string }> };

/** `{displayName, visibility}`: how you appear here, and to whom. */
export async function PATCH(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => ({}))) as {
    displayName?: unknown;
    visibility?: unknown;
  };
  const result = await updateMe(deps(), g.identity, (await params).id, body);
  if (!result.ok) return errorResponse(result.error, result.issues);
  return okResponse({ you: result.you });
}

/** Leave, and be forgotten by every module. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const result = await leave(deps(), g.identity, (await params).id);
  if (!result.ok) return errorResponse(result.error);
  return okResponse({});
}
