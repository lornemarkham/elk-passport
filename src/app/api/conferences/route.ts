import { isGuest } from "@/lib/conference/identity";
import {
  deps,
  errorResponse,
  gate,
  okResponse,
  withGuestCookie,
} from "@/lib/conference/request";
import { createConference } from "@/lib/conference/service";

/**
 * Start a conference. The creator becomes its organiser. A guest may only do
 * this where `CONFERENCE_GUEST_ORGANISERS` allows it (ARCHITECTURE.md §4).
 */
export async function POST(request: Request) {
  const g = await gate("issue");
  if ("response" in g) return g.response;
  if (isGuest(g.identity) && !g.config.allowGuestOrganisers)
    return errorResponse("signed-out");

  const body = await request.json().catch(() => null);
  const result = await createConference(deps(), g.identity, body);
  if (!result.ok) return errorResponse(result.error, result.issues);
  return withGuestCookie(
    okResponse({ conference: result.conference }),
    g.issued,
  );
}
