import { isTravelMode, type Journey, type TravelMode } from "./journey";

/**
 * **Travel times from Atlas, or the honest reason there are none.**
 *
 * ## The state of the other side (2026-10-11)
 *
 * Atlas ADR 097 is **proposed**. Its contract and cache exist
 * (`src/application/travel/travelTime.ts`); no routing provider is configured
 * and nothing is served. So this file is a boundary built ahead of its
 * backend, and it has to be right about the day the backend is still absent.
 *
 * ## The wire, as Passport proposes it
 *
 * ADR 097 recommends serving `travel` beside `distance` on
 * `/discovery/candidates`. Passport asks:
 *
 * ```
 * GET /discovery/candidates?lat=&lng=&unplaced=drop&travel=<mode>
 *   ← { candidates: [{ id, travel?: TravelTimeReading, … }] }
 * ```
 *
 * `travel` is Atlas's `TravelTimeReading`, verbatim. The **query parameter
 * name is Passport's proposal**, not yet Atlas's decision — it lives only in
 * `travelQuery()` so agreeing a different one is a one-line change.
 *
 * ## "Not served" is not "no route"
 *
 * Atlas reads only the query parameters it knows (`api/discoveryScope.ts`),
 * so today `travel=` is ignored and the feed comes back with no `travel` on
 * any candidate. ADR 097 says an unrouted candidate carries a reading saying
 * so, never an absence — so a non-empty feed where **no** candidate carries
 * `travel` means the capability is not there, and is reported as `not-served`.
 * Rendering that as "no route" for every place would blame the places.
 *
 * A reading Passport cannot validate is dropped to `unknown`, not repaired: a
 * half-parsed duration is a fabricated one.
 */

export interface Origin {
  readonly latitude: number;
  readonly longitude: number;
}

export type TravelAnswer =
  | {
      readonly state: "ready";
      readonly mode: TravelMode;
      /** By Atlas candidate id. Ids Atlas did not return are simply absent. */
      readonly journeys: Readonly<Record<string, Journey>>;
      /** The provider did not answer for some places; not to be kept. */
      readonly temporary?: true;
    }
  | {
      /** Atlas answered, and has no travel times to give. Not an error. */
      readonly state: "not-served";
      readonly mode: TravelMode;
      readonly because: string;
    };

/** The one thing this adapter needs from the outside world. */
export type AtlasGet = (path: string) => Promise<Response>;

/** Rounded to ~1 km, as ADR 094 and ADR 097 both round an origin. */
export function travelQuery(origin: Origin, mode: TravelMode): string {
  const lat = Math.round(origin.latitude * 100) / 100;
  const lng = Math.round(origin.longitude * 100) / 100;
  return `lat=${lat}&lng=${lng}&unplaced=drop&travel=${mode}`;
}

/**
 * Ask Atlas for travel times from one origin in one mode.
 *
 * A transport or HTTP failure **throws** — the caller decides what an
 * unreachable Atlas looks like, exactly as `listDiscoveryDistances` does. An
 * answer without travel times **returns** `not-served`.
 */
export async function readTravelTimes(
  get: AtlasGet,
  origin: Origin,
  mode: TravelMode,
): Promise<TravelAnswer> {
  const response = await get(
    `/discovery/candidates?${travelQuery(origin, mode)}`,
  );
  if (!response.ok) {
    throw new Error(`Atlas travel request failed: ${response.status}`);
  }
  const body: unknown = await response.json();
  const candidates = (body as { candidates?: unknown } | null)?.candidates;
  if (!Array.isArray(candidates)) {
    throw new Error("Atlas travel answer had no candidates");
  }
  return answerFrom(candidates, mode);
}

/** The pure half of `readTravelTimes`, so fixtures can exercise it directly. */
export function answerFrom(
  candidates: readonly unknown[],
  mode: TravelMode,
): TravelAnswer {
  const journeys: Record<string, Journey> = {};
  let carried = 0;
  let temporary = false;
  for (const candidate of candidates) {
    const id = (candidate as { id?: unknown } | null)?.id;
    if (typeof id !== "string") continue;
    if (!("travel" in (candidate as object))) continue;
    carried += 1;
    const travel = (candidate as { travel: unknown }).travel;
    if ((travel as { transient?: unknown } | null)?.transient === true)
      temporary = true;
    journeys[id] = journeyFromReading(travel, mode);
  }
  if (candidates.length > 0 && carried === 0) {
    return {
      state: "not-served",
      mode,
      because: "Atlas does not serve travel times yet",
    };
  }
  return {
    state: "ready",
    mode,
    journeys,
    ...(temporary ? { temporary: true as const } : {}),
  };
}

const isString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;
const isKm = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * **One `TravelTimeReading` into a `Journey`, or `unknown` if it is not one.**
 *
 * Every field ADR 097 promises is checked, including the ones that are only
 * caveats: an estimate that arrives without its provider or its limitations
 * has lost the part that made it honest. A reading for a different mode than
 * was asked is refused too — a drive time must never be shown as a walk.
 */
export function journeyFromReading(
  reading: unknown,
  asked: TravelMode,
): Journey {
  const r = reading as Record<string, unknown> | null;
  const malformed: Journey = {
    kind: "unknown",
    because: "Atlas sent a travel reading Passport could not read",
  };
  if (!r || typeof r !== "object") return malformed;
  // Atlas M144: these two are about the place or the question, not a route,
  // and may arrive without a mode.
  if (r.state === "unrouted")
    return {
      kind: "unknown",
      because:
        "Atlas holds no point of its own for this place, so it cannot route to it",
    };
  if (r.state === "beyond")
    return { kind: "unknown", because: "Past the distance asked about" };
  if (!isTravelMode(r.mode)) return malformed;
  if (r.mode !== asked) return malformed;
  const mode = r.mode;

  switch (r.state) {
    case "estimated": {
      const { minutes, routeKm, straightKm, provider, calculatedAt } = r;
      const limitations = r.limitations;
      if (
        typeof minutes !== "number" ||
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        !isKm(routeKm) ||
        !isKm(straightKm) ||
        !isString(provider) ||
        !isString(calculatedAt) ||
        Number.isNaN(Date.parse(calculatedAt)) ||
        !Array.isArray(limitations) ||
        !limitations.every(isString)
      ) {
        return malformed;
      }
      return {
        kind: "routed",
        mode,
        minutes,
        roadKm: routeKm,
        straightKm,
        provider,
        calculatedAt,
        limitations,
        ...(isString(r.accessCaution)
          ? { accessCaution: r.accessCaution }
          : {}),
        // travel-legs/1: a point inside an area, not its way in. Kept as the
        // flag it is, so nothing downstream has to read the caution's prose.
        ...(r.areaPoint === true ? { areaPoint: true as const } : {}),
      };
    }
    case "unavailable":
      if (!isString(r.provider) || !isString(r.because)) return malformed;
      // M144: the provider failed or ran out of quota. The answer may change,
      // and the place is not to blame — so it is never shown as "no route".
      if (r.transient === true)
        return {
          kind: "unknown",
          because: `${r.provider} could not answer just now; this may change`,
        };
      return {
        kind: "no-route",
        mode,
        provider: r.provider,
        because: r.because,
      };
    case "unsupported":
      if (!isString(r.provider) || !isString(r.because)) return malformed;
      return {
        kind: "unsupported",
        mode,
        provider: r.provider,
        because: r.because,
      };
    default:
      return malformed;
  }
}
