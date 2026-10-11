import "server-only";
import {
  ATLAS_BASE_URL,
  AtlasUnavailableError,
  atlasAuthHeaders,
  describeAtlasFailure,
} from "@/lib/data/atlasAuth";
import { readTravelTimes, type Origin, type TravelAnswer } from "./atlasTravel";
import type { TravelMode } from "./journey";

/**
 * Shorter than the corpus read's two minutes: a travel time is a caption on a
 * page somebody is already looking at, and is worth less than the page.
 */
const TRAVEL_TIMEOUT_MS = 20_000;

/**
 * **`readTravelTimes`, bound to Passport's own Atlas identity.**
 *
 * Failures arrive as the same `AtlasUnavailableError` every other Atlas read
 * throws, so the route reports them the same way.
 */
export function travelTimesFromAtlas(
  origin: Origin,
  mode: TravelMode,
): Promise<TravelAnswer> {
  return readTravelTimes(
    async (path) => {
      let response: Response;
      try {
        response = await fetch(`${ATLAS_BASE_URL}${path}`, {
          headers: atlasAuthHeaders(),
          signal: AbortSignal.timeout(TRAVEL_TIMEOUT_MS),
        });
      } catch (cause) {
        throw new AtlasUnavailableError("unreachable", undefined, { cause });
      }
      const failure = describeAtlasFailure(response.status);
      if (failure) throw failure;
      return response;
    },
    origin,
    mode,
  );
}
