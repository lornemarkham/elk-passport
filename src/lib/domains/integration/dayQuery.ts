import type { DayBrief } from "@/domain/day/brief";
import type { DayPlanned } from "@/domain/day/build";
import { carryBrief } from "@/domain/day/carry";

/**
 * **The `/go/print` query is Passport's day interchange format.** Nobody chose
 * that; it happened. Measured 2026-10-11 across every lane:
 *
 * - `GoHaveADay` writes it, `/go/print` reads it (main);
 * - lane `analog`'s printable and lane `maps`' travel captions re-read it;
 * - lane `detox` copies the print page's reader to build an offline day
 *   (`src/lib/detox/resolve.ts`, keys in `DAY_QUERY_KEYS`);
 * - lane `boards` stores it, canonicalised, as a shared plan
 *   (`passport_board_plans.day_query`, keys in `DAY_KEYS`, uncommitted);
 * - this lane's `print.ts` encodes an Adventure into it.
 *
 * Three lanes extend it. A consumer that whitelists the original six keys
 * drops the extensions without a word — a shared plan loses the minutes the
 * person set and the rain plan they picked. This registry is the list every
 * reader and writer should agree on; it changes no URL.
 *
 * **Integration (M178): it is also the one codec.** `/go` writes with
 * `dayQueryFor` + `writeDayQuery`; `/go/print` and Go Offline read with
 * `readDayQuery` through one resolver (`lib/go/printDay.ts`); a hand-off
 * keeps every registered key with `keepDayQuery`. No reader keeps a list of
 * its own. The Adventure codec (`../adventure/print.ts`) still writes only
 * the six core keys — INT-6, not yet reconciled.
 */

export type DayQueryKey =
  | "stops"
  | "say"
  | "hours"
  | "age"
  | "at"
  | "on"
  | "b"
  | "mins"
  | "rain"
  | "by";

export interface DayQueryKeySpec {
  readonly key: DayQueryKey;
  readonly means: string;
  /** Where it is written today. `main` means merged. */
  readonly from: string;
}

export const DAY_QUERY: readonly DayQueryKeySpec[] = [
  {
    key: "stops",
    means: "Atlas subject ids, comma-separated, in order",
    from: "main",
  },
  { key: "say", means: "the sentence as typed", from: "main" },
  { key: "hours", means: "hours available, 0 < h ≤ 24", from: "main" },
  { key: "age", means: "one child's age, 0–17", from: "main" },
  { key: "at", means: "a DiscoveryTown id", from: "main" },
  { key: "on", means: "the day, YYYY-MM-DD", from: "main" },
  {
    key: "b",
    means: "the carried brief, JSON (party, start/home-by, avoid, cautions…)",
    from: "main (via lane/daybuilder dcdabbf, src/domain/day/carry.ts)",
  },
  {
    key: "mins",
    means: "minutes the person set, id:minutes,…",
    from: "main (via lane/daybuilder dcdabbf)",
  },
  {
    key: "rain",
    means: "chosen rain plans, id~altId,…",
    from: "main (via lane/daybuilder dcdabbf)",
  },
  {
    key: "by",
    means: "travel mode when not driving",
    from: "main (via lane/maps d62ba73)",
  },
];

/** Main's original six, which every lane already read. */
export const CORE_DAY_QUERY_KEYS: readonly DayQueryKey[] = [
  "stops",
  "say",
  "hours",
  "age",
  "at",
  "on",
];

/** Every key a day travels with. A hand-off keeps all of them. */
export const DAY_QUERY_KEYS: readonly DayQueryKey[] = DAY_QUERY.map(
  (k) => k.key,
);

/**
 * What a reader that keeps only `kept` would silently drop from this query.
 * Empty means the day survives the trip.
 */
export function dayQueryLosses(
  query: URLSearchParams,
  kept: readonly string[],
): DayQueryKeySpec[] {
  return DAY_QUERY.filter(
    (spec) => query.has(spec.key) && !kept.includes(spec.key),
  );
}

/** The day query, read. Nothing here is checked against Atlas yet. */
export interface DayQueryValues {
  /** Atlas subject ids, in the order the person saw them. */
  readonly stops: readonly string[];
  readonly say: string;
  readonly hours?: number;
  readonly age?: number;
  readonly at?: string;
  readonly on?: string;
  /** The carried brief, still encoded (`uncarryBrief` reads it). */
  readonly b?: string;
  /** Minutes the person set, by stop id. */
  readonly mins: Readonly<Record<string, number>>;
  /** Rain plans shown on screen: stop id → the alternative's id. */
  readonly rain: Readonly<Record<string, string>>;
  /** The travel mode, when not driving. Validated by whoever routes. */
  readonly by?: string;
}

type Query =
  URLSearchParams | string | Record<string, string | string[] | undefined>;

const getter = (query: Query) => {
  if (typeof query === "string" || query instanceof URLSearchParams) {
    const params = new URLSearchParams(query);
    return (key: string) => params.get(key) ?? undefined;
  }
  return (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : undefined;
  };
};

/** Read a day query. Malformed parts are dropped, never guessed at. */
export function readDayQuery(query: Query): DayQueryValues {
  const get = getter(query);
  const stops = (get("stops") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const hours = Number(get("hours"));
  const age = Number(get("age"));
  const on = get("on");
  const pairs = (raw: string | undefined, sep: string) =>
    (raw ?? "")
      .split(",")
      .map((pair) => pair.split(sep))
      .filter(([id, v]) => id && v && stops.includes(id));
  return {
    stops,
    say: get("say") ?? "",
    ...(get("hours") !== undefined && Number.isFinite(hours) && hours > 0
      ? { hours }
      : {}),
    ...(Number.isInteger(age) &&
    get("age") !== undefined &&
    age >= 0 &&
    age <= 17
      ? { age }
      : {}),
    ...(get("at") ? { at: get("at")! } : {}),
    ...(on && /^\d{4}-\d{2}-\d{2}$/.test(on) ? { on } : {}),
    ...(get("b") ? { b: get("b")! } : {}),
    mins: Object.fromEntries(
      pairs(get("mins"), ":")
        .filter(([, m]) => Number(m) > 0)
        .map(([id, m]) => [id!, Number(m)]),
    ),
    rain: Object.fromEntries(
      pairs(get("rain"), "~").map(([id, alt]) => [id!, alt!]),
    ),
    ...(get("by") ? { by: get("by")! } : {}),
  };
}

/** Write a day query. Key order is the registry's. */
export function writeDayQuery(v: DayQueryValues): string {
  const params = new URLSearchParams();
  params.set("stops", v.stops.join(","));
  params.set("say", v.say);
  if (v.hours !== undefined) params.set("hours", String(v.hours));
  if (v.age !== undefined) params.set("age", String(v.age));
  if (v.at) params.set("at", v.at);
  if (v.on) params.set("on", v.on);
  if (v.b) params.set("b", v.b);
  const mins = Object.entries(v.mins).map(([id, m]) => `${id}:${m}`);
  if (mins.length > 0) params.set("mins", mins.join(","));
  const rain = Object.entries(v.rain).map(([id, alt]) => `${id}~${alt}`);
  if (rain.length > 0) params.set("rain", rain.join(","));
  if (v.by && v.by !== "driving") params.set("by", v.by);
  return params.toString();
}

/**
 * **The day on screen, as a query.** Its stops in the order shown, the
 * minutes the person set by hand, and the rain plans they were shown — so the
 * paper and the phone in the glovebox are the day somebody looked at.
 */
export function dayQueryFor(
  brief: DayBrief,
  day: DayPlanned,
  by?: string,
): DayQueryValues {
  return {
    stops: day.stops.map((s) => s.experience.id),
    say: brief.said,
    ...(brief.hours !== undefined ? { hours: brief.hours } : {}),
    ...(brief.childAge !== undefined ? { age: brief.childAge } : {}),
    ...(brief.town ? { at: brief.town.id } : {}),
    ...(brief.on ? { on: brief.on } : {}),
    b: carryBrief(brief),
    mins: Object.fromEntries(
      day.stops
        .filter((s) => s.timeSet)
        .map((s) => [s.experience.id, s.minutes]),
    ),
    rain: Object.fromEntries(
      day.stops
        .filter((s) => s.rainPlan)
        .map((s) => [s.experience.id, s.rainPlan!.experience.id]),
    ),
    ...(by ? { by } : {}),
  };
}

/** Every registered key of a query, and nothing else, in registry order. */
export function keepDayQuery(query: Query): string {
  const get = getter(query);
  const kept = new URLSearchParams();
  for (const key of DAY_QUERY_KEYS) {
    const value = get(key);
    if (value) kept.set(key, value);
  }
  return kept.toString();
}
