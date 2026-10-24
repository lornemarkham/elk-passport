import { z } from "zod";

/**
 * **Travel between places: what Atlas answers, and how Passport asks.**
 *
 * The authority is Atlas's. Two Atlas versions matter, and they are not the
 * same thing:
 *
 * - **elk-atlas `e5e9ed6`** (GitHub `main`, the read-only reference clone
 *   beside this repo). ADR 097's `TravelTimeReading` — `estimated`,
 *   `unavailable`, `unsupported` — in `src/application/travel/travelTime.ts`.
 *   No travel route is served. `contracts.atlas.test.ts` runs that code
 *   against the schema below.
 * - **Atlas M144 `32da743`**, merged into local Atlas main by M145
 *   (`202592b`, `889170e`). **Not deployed, not on GitHub, not in the
 *   reference clone.** It serves `GET /travel/legs` and adds the reading
 *   states `unrouted` and `beyond`, and `transient` on `unavailable`. Its
 *   shape was first taken from the M144, M145 and M147 mission reports.
 * - **Atlas `release/routing-rc` `37f5aa4`** — `travel-legs/1`, the route's
 *   first machine-readable contract. **On Atlas's release branch, not
 *   deployed.** Its fixture is copied beside this file
 *   (`__fixtures__/travel-legs-1.json`) and its bodies are replayed through the
 *   readers in `legs.test.ts`. It names the 404 for an unknown stop
 *   (`code: "unknown-stops"`), flags a route to an area's interior point
 *   (`areaPoint`), and says the provider quota is 50 requests a day for the
 *   whole key, shared by every caller.
 *
 * Lane `maps` (`d62ba73`) built against a `POST /travel/legs` that Passport
 * proposed before M144 existed. That proposal is recorded in
 * `PASSPORT_PROPOSED_LEGS` as **superseded**: the real route asks by Atlas
 * stop id, not by coordinates.
 *
 * Nothing here turns kilometres into minutes.
 *
 * See `docs/domain/integration-contracts.md` §3.
 */

// ---------------------------------------------------------------------------
// The reading — ADR 097, plus the states M144 added
// ---------------------------------------------------------------------------

export const TRAVEL_MODES = [
  "driving",
  "walking",
  "cycling",
  "transit",
] as const;
export const travelModeSchema = z.enum(TRAVEL_MODES);
export type TravelMode = z.infer<typeof travelModeSchema>;

const text = z.string().min(1);
const km = z.number().finite().min(0);
const calculatedAt = z.iso.datetime({ offset: true });

/**
 * Atlas's `TravelTimeReading`. Every caveat ADR 097 promises is required: an
 * estimate that arrives without its provider or its limitations has lost the
 * part that made it honest. The limitations carry the routing provider's
 * attribution (ORS and OpenStreetMap), which its free plan requires shown.
 */
export const travelTimeReadingSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("estimated"),
    mode: travelModeSchema,
    /** Whole minutes, rounded up by Atlas. */
    minutes: z.number().int().min(0),
    routeKm: km,
    /** For comparison only. Never a substitute for `routeKm`. */
    straightKm: km,
    provider: text,
    calculatedAt,
    limitations: z.array(text),
    accessCaution: text.optional(),
    /**
     * travel-legs/1: Atlas holds no entrance, parking or trailhead for this
     * park, beach or trail, so the route goes to a point inside it (often its
     * map centroid). The minutes are not the time to the way in. Atlas sends
     * `accessCaution` with it; this is the flag, so nothing has to read prose.
     */
    areaPoint: z.literal(true).optional(),
  }),
  z.object({
    state: z.literal("unavailable"),
    mode: travelModeSchema,
    provider: text,
    calculatedAt,
    because: text,
    /**
     * M144: the provider failed or ran out of quota, so the answer may change.
     * **Not** "there is no route". ORS's free plan allows 50 requests a day
     * (M147); this will happen.
     */
    transient: z.literal(true).optional(),
  }),
  z.object({
    state: z.literal("unsupported"),
    mode: travelModeSchema,
    provider: text,
    because: text,
  }),
  /** M144: Atlas holds no point of its own for this place. Not a routing answer. */
  z.object({
    state: z.literal("unrouted"),
    mode: travelModeSchema.optional(),
    because: text.optional(),
  }),
  /** M144: past the scope asked about, by a bound that cannot be beaten. */
  z.object({
    state: z.literal("beyond"),
    mode: travelModeSchema.optional(),
    because: text.optional(),
  }),
]);
export type TravelTimeReading = z.infer<typeof travelTimeReadingSchema>;

// `AREA_POINT_NOTE` lives in `./areaPointNote`: it is read by browser code that
// must not carry this file's validation library with it. Re-exported so every
// existing import keeps working.
export { AREA_POINT_NOTE } from "./areaPointNote";

// ---------------------------------------------------------------------------
// GET /travel/legs — Atlas M144
// ---------------------------------------------------------------------------

export const ATLAS_TRAVEL_LEGS = {
  method: "GET",
  path: "/travel/legs",
  /** On Atlas's release branch; not deployed; not in the reference clone. */
  status: "release-candidate-not-deployed",
  atlasCommit:
    "37f5aa4 (travel-legs/1) on release/routing-rc; first M144 32da743",
  source:
    "Atlas docs/lanes/contracts/travel-legs-1.json (copied as __fixtures__/travel-legs-1.json)",
  /** 2–10 stops, no repeats; or one stop and an origin. */
  minStops: 2,
  maxStops: 10,
} as const;

/** Lane `maps`' wire, written before M144. Superseded; kept so nobody re-proposes it. */
export const PASSPORT_PROPOSED_LEGS = {
  method: "POST",
  path: "/travel/legs",
  status: "superseded",
  proposedBy: "passport lane/maps d62ba73, src/lib/routing/atlasLegs.ts",
  supersededBy: "Atlas M144 GET /travel/legs",
} as const;

/** What Passport asks: Atlas ids in order, a mode, and a start rounded to ~1 km. */
export interface TravelLegsQuestion {
  readonly stops: readonly string[];
  readonly mode: TravelMode;
  readonly origin?: { readonly lat: number; readonly lng: number };
}

/** A person's start leaves Passport at ~1 km (ADR 094, ADR 097). */
export const ORIGIN_DECIMALS = 2;

const roundTo = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** Why Atlas would refuse this question (its 400), or nothing. */
export function travelLegsQuestionProblems(q: TravelLegsQuestion): string[] {
  const problems: string[] = [];
  const min = q.origin ? 1 : ATLAS_TRAVEL_LEGS.minStops;
  if (q.stops.length < min) {
    problems.push(
      q.origin
        ? "Atlas needs at least one stop after the origin."
        : "Atlas needs two stops, or one stop and an origin.",
    );
  }
  if (q.stops.length > ATLAS_TRAVEL_LEGS.maxStops) {
    problems.push(
      `Atlas routes at most ${ATLAS_TRAVEL_LEGS.maxStops} stops; this day has ${q.stops.length}.`,
    );
  }
  if (new Set(q.stops).size !== q.stops.length) {
    problems.push("Atlas refuses a stop repeated in one day.");
  }
  if (q.stops.some((id) => id.trim() === "" || id.includes(","))) {
    problems.push("A stop id is empty or contains a comma.");
  }
  return problems;
}

/**
 * The query string. The origin is rounded **here**, whatever precision the
 * caller had, so no caller can send a person's exact position by accident.
 */
export function travelLegsQuery(q: TravelLegsQuestion): string {
  const params = new URLSearchParams();
  params.set("stops", q.stops.join(","));
  params.set("mode", q.mode);
  if (q.origin) {
    params.set("lat", String(roundTo(q.origin.lat, ORIGIN_DECIMALS)));
    params.set("lng", String(roundTo(q.origin.lng, ORIGIN_DECIMALS)));
  }
  return params.toString();
}

/** One leg's reading, or the reason Passport could not use it. */
export type LegReading =
  | { readonly ok: true; readonly reading: TravelTimeReading }
  | { readonly ok: false; readonly because: string };

/**
 * **Atlas's answer, by HTTP status, read without guessing.**
 *
 * - `ready` — one reading per leg, in order. `total` is passed through only
 *   when Atlas says it is `estimated`: a total is never summed here.
 *   `temporary` says Atlas's provider did not answer for some legs (a
 *   top-level `failure`): those legs read `unavailable` + `transient`, and
 *   every leg it did answer is kept. Back off at least 60 s (travel-legs/1).
 * - `unsupported` — the whole mode is not served (transit, today).
 * - `temporarily-unavailable` — Atlas itself failed (429 / 5xx); try later.
 *   The places are not to blame.
 * - `unknown-stops` — 404 with `code: "unknown-stops"`: a stop id that is not
 *   (or no longer) a Discovery candidate — merged, retired, or wrong. The
 *   whole question failed; the ids are named. Not retryable.
 * - `not-found` — a 404 **without** that code: Atlas does not serve the path.
 * - `refused` — 400: Passport asked a question Atlas does not take. A bug.
 * - `unauthorized` — 401 / 403: the service token, not the day.
 */
export type TravelLegsAnswer =
  | {
      readonly state: "ready";
      readonly legs: readonly LegReading[];
      readonly total?: {
        readonly minutes?: number;
        readonly basis?: string;
        /** How many legs in Atlas's sum route to a point inside an area. */
        readonly areaPoints?: number;
      };
      /** The provider did not answer for some legs; their answer may change. */
      readonly temporary?: true;
    }
  | { readonly state: "unsupported"; readonly because: string }
  | { readonly state: "temporarily-unavailable"; readonly because: string }
  | {
      readonly state: "unknown-stops";
      readonly unknownStops: readonly string[];
      readonly because: string;
    }
  | { readonly state: "not-found"; readonly because: string }
  | { readonly state: "refused"; readonly because: string }
  | { readonly state: "unauthorized"; readonly because: string };

const answerBodySchema = z.object({
  state: z.string().optional(),
  failure: z.unknown().optional(),
  legs: z.array(z.object({ travel: z.unknown() }).loose()),
  total: z
    .object({
      state: z.string(),
      minutes: z.number().int().min(0).optional(),
      basis: z.string().optional(),
      areaPoints: z.number().int().min(1).optional(),
    })
    .loose()
    .optional(),
});

/** travel-legs/1's one 404 about the question rather than the path. */
const unknownStopsBodySchema = z.object({
  code: z.literal("unknown-stops"),
  unknownStops: z.array(text).min(1),
});

/** How many legs a question has: one per stop after the origin, else one fewer. */
export const legsAsked = (q: TravelLegsQuestion): number =>
  q.origin ? q.stops.length : Math.max(0, q.stops.length - 1);

export function readTravelLegsAnswer(
  status: number,
  body: unknown,
  q: TravelLegsQuestion,
): TravelLegsAnswer {
  if (status === 401 || status === 403) {
    return {
      state: "unauthorized",
      because: "Atlas refused Passport's service token.",
    };
  }
  if (status === 404) {
    // travel-legs/1 names the one 404 that is about the day: a stop id that
    // is not (or is no longer) a Discovery candidate. A 404 without that code
    // is a path Atlas does not serve.
    const unknown = unknownStopsBodySchema.safeParse(body);
    if (unknown.success) {
      const ids = unknown.data.unknownStops;
      return {
        state: "unknown-stops",
        unknownStops: ids,
        because: `Atlas no longer holds ${ids.length === 1 ? "this stop" : "these stops"} as a place to go: ${ids.join(", ")}.`,
      };
    }
    return {
      state: "not-found",
      because:
        "Atlas answered 404 without naming a stop: it does not serve /travel/legs.",
    };
  }
  if (status === 400) {
    return { state: "refused", because: "Atlas would not take this question." };
  }
  if (status === 429 || status >= 500) {
    return {
      state: "temporarily-unavailable",
      because: "Atlas could not get travel times just now.",
    };
  }
  const parsed = answerBodySchema.safeParse(body);
  if (status !== 200 || !parsed.success) {
    throw new Error(
      `Atlas /travel/legs answered ${status} with a body Passport cannot read`,
    );
  }
  const answer = parsed.data;
  if (answer.state === "unsupported") {
    return {
      state: "unsupported",
      because: `Atlas does not route by ${q.mode}.`,
    };
  }
  const failed = answer.failure !== undefined && answer.failure !== null;
  // A time on the wrong leg is worse than none.
  if (answer.legs.length !== legsAsked(q)) {
    // A failure that also broke the legs is still only a failure.
    if (failed) {
      return {
        state: "temporarily-unavailable",
        because: "Atlas's routing provider failed; the answer may change.",
      };
    }
    throw new Error(
      `Atlas answered ${answer.legs.length} legs for a question with ${legsAsked(q)}`,
    );
  }
  const legs = answer.legs.map(({ travel }): LegReading => {
    const reading = travelTimeReadingSchema.safeParse(travel);
    if (!reading.success) {
      return {
        ok: false,
        because: "Atlas sent a travel reading Passport could not read.",
      };
    }
    const mode = reading.data.mode;
    if (mode !== undefined && mode !== q.mode) {
      return {
        ok: false,
        because: `Atlas answered ${mode} for a ${q.mode} question.`,
      };
    }
    return { ok: true, reading: reading.data };
  });
  const total =
    answer.total?.state === "estimated"
      ? {
          ...(answer.total.minutes !== undefined
            ? { minutes: answer.total.minutes }
            : {}),
          ...(answer.total.basis ? { basis: answer.total.basis } : {}),
          ...(answer.total.areaPoints !== undefined
            ? { areaPoints: answer.total.areaPoints }
            : {}),
        }
      : undefined;
  // A provider failure keeps every leg Atlas did answer (an unrouted stop, a
  // cached estimate); the ones it did not arrive `unavailable` + `transient`.
  return {
    state: "ready",
    legs,
    ...(total ? { total } : {}),
    ...(failed ? { temporary: true as const } : {}),
  };
}
