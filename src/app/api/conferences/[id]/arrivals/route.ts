import { errorResponse, gate, okResponse } from "@/lib/conference/request";
import { arrivalsDeps } from "@/lib/conference-arrivals/request";
import { readArrivals } from "@/lib/conference-arrivals/service";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The board, for a member. Polled by the page; each poll may refresh the
 * flights that are due (see `tracker.ts`), never more often than that.
 */
export async function GET(_request: Request, { params }: Ctx) {
  const g = await gate("existing");
  if ("response" in g) return g.response;
  const view = await readArrivals(
    arrivalsDeps(),
    g.identity,
    (await params).id,
  );
  if (!view) return errorResponse("not-found");
  return okResponse({ view });
}
