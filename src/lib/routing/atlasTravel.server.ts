import "server-only";
import {
  ATLAS_BASE_URL,
  AtlasUnavailableError,
  atlasAuthHeaders,
  describeAtlasFailure,
} from "@/lib/data/atlasAuth";
import { askedOnce } from "./answerMemo";
import {
  readTravelTimes,
  travelQuery,
  type Origin,
  type TravelAnswer,
} from "./atlasTravel";
import type { TravelMode } from "./journey";

/**
 * Shorter than the corpus read's two minutes: a travel time is a caption on a
 * page somebody is already looking at, and is worth less than the page.
 */
const TRAVEL_TIMEOUT_MS = 20_000;

/**
 * This instance's answers for five minutes, keyed by the query Atlas is sent
 * (the origin's ~1 km cell and the mode). A whole feed's journeys are large,
 * so fewer are held than for a day's legs. A failure is never kept, nor an
 * answer in which the provider did not answer for some places.
 */
const answered = askedOnce<TravelAnswer>({
  max: 32,
  keep: (answer) => answer.state !== "ready" || !answer.temporary,
});

/** For tests: forget every answer this instance has kept. */
export const forgetTravelTimesAnswers = () => answered.clear();

/**
 * **`readTravelTimes`, bound to Passport's own Atlas identity**, and
 * remembered.
 *
 * Failures arrive as the same `AtlasUnavailableError` every other Atlas read
 * throws, so the route reports them the same way.
 */
export function travelTimesFromAtlas(
  origin: Origin,
  mode: TravelMode,
): Promise<TravelAnswer> {
  return answered.ask(travelQuery(origin, mode), () => askAtlas(origin, mode));
}

function askAtlas(origin: Origin, mode: TravelMode): Promise<TravelAnswer> {
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
