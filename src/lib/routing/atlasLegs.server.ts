import "server-only";
import {
  ATLAS_BASE_URL,
  AtlasUnavailableError,
  atlasAuthHeaders,
  describeAtlasFailure,
} from "@/lib/data/atlasAuth";
import { readLegs, type LegsAnswer } from "./atlasLegs";
import type { TravelMode } from "./journey";
import type { PlacedLeg } from "./legs";

/** As `atlasTravel.server`: a caption is worth less than the page under it. */
const LEGS_TIMEOUT_MS = 20_000;

/**
 * **`readLegs`, bound to Passport's own Atlas identity.**
 *
 * Failures arrive as the same `AtlasUnavailableError` every other Atlas read
 * throws. `timeoutMs` is shorter for a page that renders on the server and
 * should not wait twenty seconds for a caption — the printed guide.
 */
export function travelLegsFromAtlas(
  legs: readonly PlacedLeg[],
  mode: TravelMode,
  { timeoutMs = LEGS_TIMEOUT_MS }: { readonly timeoutMs?: number } = {},
): Promise<LegsAnswer> {
  return readLegs(
    async (path, body) => {
      let response: Response;
      try {
        response = await fetch(`${ATLAS_BASE_URL}${path}`, {
          method: "POST",
          headers: atlasAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (cause) {
        throw new AtlasUnavailableError("unreachable", undefined, { cause });
      }
      const failure = describeAtlasFailure(response.status);
      if (failure) throw failure;
      return response;
    },
    legs,
    mode,
  );
}
