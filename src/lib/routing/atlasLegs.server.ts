import "server-only";
import {
  ATLAS_BASE_URL,
  AtlasUnavailableError,
  atlasAuthHeaders,
  describeAtlasFailure,
} from "@/lib/data/atlasAuth";
import { askedOnce } from "./answerMemo";
import { legsQuestions, readLegs, type LegsAnswer } from "./atlasLegs";
import { travelLegsQuery } from "@/lib/domains/travel/contracts";
import type { TravelMode } from "./journey";
import type { PlacedLeg } from "./legs";

/** As `atlasTravel.server`: a caption is worth less than the page under it. */
const LEGS_TIMEOUT_MS = 20_000;

/**
 * Every answer this instance has had in the last five minutes, by the exact
 * questions it sent. Atlas's provider allows 50 requests a day for the whole
 * key (travel-legs/1), so the same day asked twice must not cost two. A
 * failure is thrown and never kept; neither is a `temporary` answer.
 */
const answered = askedOnce<LegsAnswer>({
  max: 256,
  keep: (answer) => answer.state !== "ready" || !answer.temporary,
});

/** For tests: forget every answer this instance has kept. */
export const forgetTravelLegsAnswers = () => answered.clear();

/**
 * What Atlas will actually be asked, and where each answer lands: the key.
 * The start is already rounded to ~1 km by `travelLegsQuery`, and a leg's
 * own coordinates are not in it, because Atlas resolves stops by id.
 */
const askedKey = (legs: readonly PlacedLeg[], mode: TravelMode): string =>
  JSON.stringify([
    mode,
    legs.length,
    legsQuestions(legs, mode).map(({ question, at }) => [
      travelLegsQuery(question),
      at,
    ]),
  ]);

/**
 * **`readLegs`, bound to Passport's own Atlas identity**, and remembered.
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
  return answered.ask(askedKey(legs, mode), () =>
    askAtlas(legs, mode, timeoutMs),
  );
}

function askAtlas(
  legs: readonly PlacedLeg[],
  mode: TravelMode,
  timeoutMs: number,
): Promise<LegsAnswer> {
  return readLegs(
    async (pathAndQuery) => {
      let response: Response;
      try {
        response = await fetch(`${ATLAS_BASE_URL}${pathAndQuery}`, {
          method: "GET",
          headers: atlasAuthHeaders(),
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
