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
 *   ← 404 { code: "unknown-stops", unknownStops } a stop Atlas no longer holds
 *   ← 404 { error: "Not found" }                 an Atlas without the route
 * ```
 *
 * Atlas resolves every point **from its own ids**; Passport sends ids in
 * order, a mode, and at most a start rounded to ~1 km. The shape, its limits
 * (2–10 stops, no repeats; or one stop after an origin) and the reading of
 * each HTTP outcome live in `lib/domains/travel/contracts.ts` (lane domain,
 * checked against Atlas's travel-legs/1 fixture). This file only cuts a day's legs into
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
 * A 404 without a code is `not-served`: every leg falls back to a straight
 * line, labelled. A 404 naming `unknown-stops` is about the day, not the
 * route: the legs that touch a stop Atlas no longer holds say so, the rest of
 * that question stay straight lines (Atlas answered none of it), and every
 * other question's legs are kept. `unknownStops` names the ids.
 *
 * A provider failure (a top-level `failure`) keeps every leg Atlas answered;
 * the ones it could not reach read "could not answer just now", and the
 * answer is marked `temporary` so nobody keeps it. A 429/5xx from Atlas
 * itself does the same to its own question's legs. Only when **nothing** was
 * answered — or the question was refused, or the token was — does this
 * **throw**: a failure the caller reports and may retry after a minute. One
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
      /** Stop ids Atlas said it does not hold (404 `unknown-stops`). */
      readonly unknownStops?: readonly string[];
      /**
       * Some legs could not be answered just now (the provider or Atlas
       * failed). Shown, never kept: a later ask may do better.
       */
      readonly temporary?: true;
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

/** What a leg says when Atlas no longer holds one of its ends. */
export const UNKNOWN_STOP_BECAUSE =
  "Atlas no longer holds this stop as a place to go (it may have been merged or retired), so it cannot route to it";

/** What a leg says when Atlas, or its provider, did not answer just now. */
export const NOT_JUST_NOW_BECAUSE =
  "Atlas could not get this travel time just now; this may change";

/**
 * Ask Atlas for these legs in one mode. Throws on a transport failure, a
 * refused question or token, an answer that does not line up — or when no
 * question at all was answered.
 */
export async function readLegs(
  get: AtlasGet,
  legs: readonly PlacedLeg[],
  mode: TravelMode,
): Promise<LegsAnswer> {
  const journeys: (Journey | undefined)[] = legs.map(() => undefined);
  const unknownStops: string[] = [];
  let asked = 0;
  let failed = 0;
  let temporary = false;
  for (const { question, at } of legsQuestions(legs, mode)) {
    if (travelLegsQuestionProblems(question).length > 0) continue;
    asked += 1;
    const response = await get(`${LEGS_PATH}?${travelLegsQuery(question)}`);
    // A 404 has a body worth reading: it may name the stops it does not know.
    const body: unknown =
      response.status === 200 || response.status === 404
        ? await response.json().catch(() => null)
        : null;
    const answer = readTravelLegsAnswer(response.status, body, question);
    switch (answer.state) {
      case "ready":
        if (answer.temporary) temporary = true;
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
      case "unknown-stops": {
        // Atlas answered none of this question. Only the legs that touch a
        // stop it does not hold are about that stop; the others stay
        // straight lines rather than spend another provider request.
        const gone = new Set(answer.unknownStops);
        for (const id of answer.unknownStops)
          if (!unknownStops.includes(id)) unknownStops.push(id);
        for (const i of at) {
          const leg = legs[i]!;
          if (
            (leg.from.id && gone.has(leg.from.id)) ||
            (leg.to.id && gone.has(leg.to.id))
          ) {
            journeys[i] = { kind: "unknown", because: UNKNOWN_STOP_BECAUSE };
          }
        }
        break;
      }
      case "not-found":
        return { state: "not-served", mode, because: answer.because };
      case "temporarily-unavailable":
        failed += 1;
        temporary = true;
        for (const i of at)
          journeys[i] = { kind: "unknown", because: NOT_JUST_NOW_BECAUSE };
        break;
      default:
        throw new Error(`Atlas travel legs: ${answer.state}`);
    }
  }
  // Nothing answered at all: a failure, not a day of unknowns.
  if (asked > 0 && failed === asked) {
    throw new Error("Atlas travel legs: temporarily-unavailable");
  }
  return {
    state: "ready",
    mode,
    journeys,
    ...(unknownStops.length > 0 ? { unknownStops } : {}),
    ...(temporary ? { temporary: true as const } : {}),
  };
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
