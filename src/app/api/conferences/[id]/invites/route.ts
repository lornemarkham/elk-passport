import {
  deps,
  errorResponse,
  gate,
  okResponse,
} from "@/lib/conference/request";
import { createInvite, revokeInvite } from "@/lib/conference/service";

type Ctx = { params: Promise<{ id: string }> };

/** A new shareable link. `{expiresInDays?, maxUses?}`. */
export async function POST(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => ({}))) as {
    expiresInDays?: unknown;
    maxUses?: unknown;
  };
  const result = await createInvite(
    deps(),
    g.identity,
    (await params).id,
    body,
  );
  if (!result.ok) return errorResponse(result.error, result.issues);
  return okResponse({ token: result.invite.token });
}

/** `{token}`: stop a link working. People already in stay in. */
export async function DELETE(request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  if (typeof body.token !== "string") return errorResponse("invalid");
  const result = await revokeInvite(
    deps(),
    g.identity,
    (await params).id,
    body.token,
  );
  if (!result.ok) return errorResponse(result.error);
  return okResponse({});
}
