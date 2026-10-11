import { journeyFromReading } from "./atlasTravel";
import type { Journey, TravelMode } from "./journey";
import type { PlacedLeg } from "./legs";

/**
 * **Travel time for each leg of a day, from Atlas, or the reason there is none.**
 *
 * ## ⚠ The wire is Passport's PROPOSAL, not Atlas's published contract
 *
 * Checked 2026-10-11: elk-atlas `main` (e5e9ed6, the only branch on GitHub)
 * has **no** `/travel/legs` endpoint and no document describing one. What
 * Atlas does publish is ADR 097 (proposed): the `TravelTimeReading` contract,
 * and a provider seam asking one origin, many destinations, one mode. This
 * file speaks that contract over the narrowest wire that carries it:
 *
 * ```
 * POST /travel/legs
 *   { mode: TravelMode,
 *     legs: [{ from: TravelDestination, to: TravelDestination }] }
 *   ← 200 { legs: TravelTimeReading[] }      one per leg, in order
 *   ← 404 / 405 / 501                        the endpoint is not there
 * ```
 *
 * `TravelDestination` (`{ id?, at: { lng, lat } }`) and `TravelTimeReading`
 * are ADR 097's types, verbatim. The **path, the method and the envelope are
 * Passport's guess**. They live only in `LEGS_PATH`, `legsBody()` and
 * `legsAnswerFrom()`, so agreeing Atlas's real shape changes this file and
 * nothing that renders a journey.
 *
 * ## Privacy is enforced here, not hoped for by callers
 *
 * `legsBody()` is the only thing that builds what leaves Passport. An end with
 * no Atlas `id` is a start point — a town centre, or a person — and is rounded
 * to two decimals (~1 km), as ADR 094 and ADR 097 round an origin. An Atlas
 * subject's own published point is sent to five, as ADR 097 keys a
 * destination. No name, no user, no session goes with it.
 *
 * ## "Not served" is not "no route", and neither is a failure
 *
 * A 404 means Atlas has no such endpoint: `not-served`, and every leg falls
 * back to a straight line, labelled. Any other non-2xx, or a body that does
 * not line up with the question, **throws**: a temporary failure, which the
 * caller reports and may retry. A single unreadable reading becomes `unknown`
 * for that leg alone, through the same validator the Discovery feed uses.
 */

export const LEGS_PATH = "/travel/legs";

/** ADR 097's `TravelDestination`. */
interface WireEnd {
  readonly id?: string;
  readonly at: { readonly lng: number; readonly lat: number };
}

export interface LegsBody {
  readonly mode: TravelMode;
  readonly legs: readonly { readonly from: WireEnd; readonly to: WireEnd }[];
}

export type LegsAnswer =
  | {
      readonly state: "ready";
      readonly mode: TravelMode;
      /** One per leg asked, in order. */
      readonly journeys: readonly Journey[];
    }
  | {
      readonly state: "not-served";
      readonly mode: TravelMode;
      readonly because: string;
    };

/** The one thing this adapter needs from the outside world. */
export type AtlasPost = (path: string, body: unknown) => Promise<Response>;

/** Statuses meaning "there is no such endpoint", not "it failed". */
const ABSENT = new Set([404, 405, 501]);

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

function wireEnd(end: PlacedLeg["from"]): WireEnd {
  // A start point is somebody's town or somebody's position. It leaves
  // Passport at ~1 km, whatever precision the caller had.
  const places = end.id ? 5 : 2;
  return {
    ...(end.id ? { id: end.id } : {}),
    at: {
      lng: round(end.at.longitude, places),
      lat: round(end.at.latitude, places),
    },
  };
}

/** What Passport sends Atlas for these legs. Nothing else leaves. */
export function legsBody(
  legs: readonly PlacedLeg[],
  mode: TravelMode,
): LegsBody {
  return {
    mode,
    legs: legs.map((leg) => ({ from: wireEnd(leg.from), to: wireEnd(leg.to) })),
  };
}

/**
 * Ask Atlas for these legs in one mode. Throws on a transport failure, an
 * HTTP failure that is not "absent", or an answer that does not line up.
 */
export async function readLegs(
  post: AtlasPost,
  legs: readonly PlacedLeg[],
  mode: TravelMode,
): Promise<LegsAnswer> {
  if (legs.length === 0) return { state: "ready", mode, journeys: [] };
  const response = await post(LEGS_PATH, legsBody(legs, mode));
  if (ABSENT.has(response.status)) {
    return {
      state: "not-served",
      mode,
      because: "Atlas does not serve travel times between places yet",
    };
  }
  if (!response.ok) {
    throw new Error(`Atlas travel legs failed: ${response.status}`);
  }
  return legsAnswerFrom(await response.json(), legs.length, mode);
}

/** The pure half of `readLegs`, so a fixture can exercise it directly. */
export function legsAnswerFrom(
  body: unknown,
  asked: number,
  mode: TravelMode,
): LegsAnswer {
  const readings = (body as { legs?: unknown } | null)?.legs;
  // One reading per leg, in order, or the answer cannot be matched to the
  // question at all — and a time on the wrong leg is worse than none.
  if (!Array.isArray(readings) || readings.length !== asked) {
    throw new Error("Atlas travel legs answer did not match the question");
  }
  return {
    state: "ready",
    mode,
    journeys: readings.map((reading) => journeyFromReading(reading, mode)),
  };
}
