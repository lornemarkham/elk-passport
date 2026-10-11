import {
  ATLAS_TRAVEL_LEGS,
  readTravelLegsAnswer,
  travelLegsQuestionProblems,
  travelLegsQuery,
  type TravelLegsQuestion,
} from "@/lib/domains/travel/contracts";
import { journeyFromReading } from "./atlasTravel";
import type { Journey, TravelMode } from "./journey";
import type { PlacedLeg } from "./legs";

/**
 * **Travel time for each leg of a day, from Atlas, or the reason there is none.**
 *
 * ## The wire is Atlas's `GET /travel/legs` (M144), not a Passport proposal
 *
 * ```
 * GET /travel/legs?stops=<id>,<id>…&mode=…[&lat&lng]
 *   ← 200 { legs: [{ travel: TravelTimeReading, … }], total?, failure? }
 *   ← 200 { state: "unsupported", legs: [] }     the whole mode
 *   ← 404   an unknown stop — or an Atlas without the route (ambiguous)
 * ```
 *
 * Atlas resolves every point **from its own ids**; Passport sends ids in
 * order, a mode, and at most a start rounded to ~1 km. The shape, its limits
 * (2–10 stops, no repeats; or one stop after an origin) and the reading of
 * each HTTP outcome live in `lib/domains/travel/contracts.ts` (lane domain,
 * from the M144/M145/M147 reports). This file only cuts a day's legs into
 * questions Atlas takes, and turns its readings into `Journey`s.
 *
 * Lane `maps` first built against a `POST /travel/legs` Passport proposed
 * before Atlas had one. That wire is superseded (`PASSPORT_PROPOSED_LEGS`).
 *
 * ## What cannot be asked is not asked
 *
 * A leg whose far end has no Atlas id — the way home to a town centre — is
 * not a question Atlas takes (an origin can only start a day). It stays
 * `undefined`, and the screen draws it as a straight line, labelled.
 *
 * ## "Not served" is not "no route", and neither is a failure
 *
 * A 404 is `not-served`: every leg falls back to a straight line, labelled.
 * A provider failure, 429/5xx, a refused question or a refused token
 * **throws**: a temporary failure the caller reports and may retry. One
 * unreadable reading becomes `unknown` for that leg alone.
 */

export const LEGS_PATH = ATLAS_TRAVEL_LEGS.path;

export type LegsAnswer =
  | {
      readonly state: "ready";
      readonly mode: TravelMode;
      /**
       * One per leg asked, in order. `undefined` where Atlas cannot be asked
       * (it arrives as `null` through JSON): drawn as a straight line.
       */
      readonly journeys: readonly (Journey | undefined)[];
    }
  | {
      readonly state: "not-served";
      readonly mode: TravelMode;
      readonly because: string;
    };

/** The one thing this adapter needs from the outside world. */
export type AtlasGet = (pathAndQuery: string) => Promise<Response>;

/** A run of legs Atlas can answer in one question, and where they sit. */
interface Chain {
  readonly question: TravelLegsQuestion;
  /** Index in the legs asked, for each leg Atlas will answer, in order. */
  readonly at: readonly number[];
}

/**
 * **Cut a day's legs into the questions Atlas takes.** Consecutive legs that
 * continue from the last stop share one question; a start with no id opens
 * one as its origin. Usually a whole day is one request.
 */
export function legsQuestions(
  legs: readonly PlacedLeg[],
  mode: TravelMode,
): Chain[] {
  const chains: {
    stops: string[];
    origin?: { lat: number; lng: number };
    at: number[];
  }[] = [];
  legs.forEach((leg, index) => {
    const to = leg.to.id;
    if (!to) return; // the way home to a town centre: not askable
    const open = chains[chains.length - 1];
    const continues =
      open !== undefined &&
      leg.from.id !== undefined &&
      open.stops[open.stops.length - 1] === leg.from.id &&
      !open.stops.includes(to) &&
      open.stops.length < ATLAS_TRAVEL_LEGS.maxStops;
    if (continues) {
      open.stops.push(to);
      open.at.push(index);
    } else if (leg.from.id) {
      chains.push({ stops: [leg.from.id, to], at: [index] });
    } else {
      chains.push({
        stops: [to],
        origin: { lat: leg.from.at.latitude, lng: leg.from.at.longitude },
        at: [index],
      });
    }
  });
  return chains.map(({ stops, origin, at }) => ({
    question: { stops, mode, ...(origin ? { origin } : {}) },
    at,
  }));
}

/**
 * Ask Atlas for these legs in one mode. Throws on a transport failure, a
 * temporary or refused answer, or an answer that does not line up.
 */
export async function readLegs(
  get: AtlasGet,
  legs: readonly PlacedLeg[],
  mode: TravelMode,
): Promise<LegsAnswer> {
  const journeys: (Journey | undefined)[] = legs.map(() => undefined);
  for (const { question, at } of legsQuestions(legs, mode)) {
    if (travelLegsQuestionProblems(question).length > 0) continue;
    const response = await get(`${LEGS_PATH}?${travelLegsQuery(question)}`);
    const body: unknown =
      response.status === 200 ? await response.json().catch(() => null) : null;
    const answer = readTravelLegsAnswer(response.status, body, question);
    switch (answer.state) {
      case "ready":
        answer.legs.forEach((leg, k) => {
          journeys[at[k]!] = leg.ok
            ? journeyFromReading(leg.reading, mode)
            : { kind: "unknown", because: leg.because };
        });
        break;
      case "unsupported":
        for (const i of at)
          journeys[i] = {
            kind: "unsupported",
            mode,
            provider: "Atlas",
            because: answer.because,
          };
        break;
      case "not-found":
        return { state: "not-served", mode, because: answer.because };
      default:
        throw new Error(`Atlas travel legs: ${answer.state}`);
    }
  }
  return { state: "ready", mode, journeys };
}

/**
 * **Readings in order, as one answer** — for fixtures and tests that hold a
 * list of `TravelTimeReading`s rather than an Atlas response.
 */
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
