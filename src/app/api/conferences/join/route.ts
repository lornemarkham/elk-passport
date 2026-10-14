import { codeBrake } from "@/lib/conference/rate";
import {
  clientAddress,
  deps,
  errorResponse,
  gate,
  okResponse,
  withGuestCookie,
} from "@/lib/conference/request";
import { joinWithCode, joinWithInvite } from "@/lib/conference/service";

/**
 * Join with `{code}` or `{token}`. Somebody with no identity yet gets a guest
 * cookie, but only when they actually got in: a wrong code mints nothing.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    code?: unknown;
    token?: unknown;
  };
  const g = await gate("issue");
  if ("response" in g) return g.response;

  const address = clientAddress(request);
  const brake = codeBrake();
  const byCode = body.token === undefined;
  if (byCode && brake.blocked(address)) return errorResponse("slow-down");

  const result = byCode
    ? await joinWithCode(deps(), g.identity, body.code)
    : await joinWithInvite(deps(), g.identity, body.token);
  if (!result.ok) {
    if (byCode) brake.fail(address);
    return errorResponse(result.error);
  }
  return withGuestCookie(
    okResponse({ conferenceId: result.conferenceId }),
    g.issued,
  );
}
