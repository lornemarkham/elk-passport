import {
  DAY_QUERY_KEYS as REGISTERED_KEYS,
  keepDayQuery,
} from "@/lib/domains/integration/dayQuery";
import { z } from "zod";
import type { DayPlanned } from "@/domain/day/build";

/**
 * **The day, kept on the phone — the few facts worth having if the paper
 * blows away.**
 *
 * Go Offline is the end of GO HAVE A DAY's planning, not a second planner and
 * not a second guide. The paper (`/go/print`) carries everything: reasons,
 * hours, costs, rules, the per-stop challenges. This carries only what a
 * person would need with the paper gone and the phone back out for a minute:
 * which places, in what order, in which town. And the query that prints the
 * paper again, for when there is signal and a printer.
 *
 * It is a **snapshot of the day that was printed**, taken when the phones go
 * away, so it reads without a network. It is not the Adventure contract
 * (`src/lib/domains/adventure/` on `lane/domain`) and records no state against
 * a place — see `outing.ts`.
 */

/** Stops a day can hold. `buildDay` makes 2–5; a little headroom, no more. */
const MAX_STOPS = 8;

const stopSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  /** The town Atlas states. Absent where it states none — never guessed. */
  where: z.string().min(1).max(120).optional(),
  /** Planned minutes there, as the builder said. */
  minutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
});

export const offlineDaySchema = z.object({
  /** What the person asked for, in their words. */
  said: z.string().max(280),
  stops: z.array(stopSchema).min(1).max(MAX_STOPS),
  /** The `/go/print` query this day came from, so the paper can be reprinted. */
  print: z.string().max(2000),
});

export type OfflineDay = z.infer<typeof offlineDaySchema>;
export type OfflineStop = z.infer<typeof stopSchema>;

/**
 * The printed day, reduced to what fits in a pocket. `undefined` when the
 * day has no stops — there is nothing to keep, and an empty day is not a
 * plan anybody finished.
 */
export function snapshotDay(
  day: DayPlanned,
  print: string,
): OfflineDay | undefined {
  const stops = day.stops.slice(0, MAX_STOPS).map((stop): OfflineStop => {
    const where =
      stop.experience.geography?.locality ?? stop.experience.venue?.locality;
    return {
      id: stop.experience.id.slice(0, 120),
      name: stop.experience.title.slice(0, 200),
      ...(where ? { where: where.slice(0, 120) } : {}),
      minutes: Math.max(0, Math.min(24 * 60, Math.round(stop.minutes))),
    };
  });
  if (stops.length === 0) return undefined;
  return {
    said: day.brief.said.slice(0, 280),
    stops,
    print: print.slice(0, 2000),
  };
}

/** `unknown` from storage → a day, or nothing. Never throws. */
export function parseOfflineDay(raw: unknown): OfflineDay | undefined {
  const parsed = offlineDaySchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/**
 * The plan in one line, for the postcard: "Kalamalka Lake → Davison Orchards".
 * A fact about what was planned, not a claim about what was done.
 */
export function planLine(day: OfflineDay): string {
  return day.stops.map((stop) => stop.name).join(" → ");
}

/**
 * The keys `/go/print` reads — the registry's, all of them. Go Offline accepts
 * exactly the same query, so a day reaches it by the identical path it
 * reaches the paper, with the minutes, rain plans and mode it was shaped with.
 */
export const DAY_QUERY_KEYS = REGISTERED_KEYS;

/**
 * **The hand-off from planning.** `/go` links here with the same query it
 * gives `/go/print`.
 */
export function offlineHref(printQuery: string): string {
  const query = keepDayQuery(printQuery);
  return query ? `/detox?${query}` : "/detox";
}

/** Where the paper's "come back and tell us what happened" can point. */
export const RETURN_PATH = "/detox/back";

/** The query in a Next `searchParams` object, reduced to the day's keys. */
export function dayQuery(
  query: Record<string, string | string[] | undefined>,
): string {
  return keepDayQuery(query);
}
