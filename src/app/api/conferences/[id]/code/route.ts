import {
  deps,
  errorResponse,
  gate,
  okResponse,
} from "@/lib/conference/request";
import { setAccessCode } from "@/lib/conference/service";

/** `{action: "new"}` issues a fresh code; `{action: "off"}` turns codes off. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== "new" && body.action !== "off")
    return errorResponse("invalid", [
      { path: "action", message: "new or off." },
    ]);
  const result = await setAccessCode(
    deps(),
    g.identity,
    (await params).id,
    body.action,
  );
  if (!result.ok) return errorResponse(result.error);
  return okResponse({ accessCode: result.accessCode });
}
