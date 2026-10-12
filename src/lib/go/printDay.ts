import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { readBrief } from "@/domain/day/brief";
import { uncarryBrief } from "@/domain/day/carry";
import { buildDay, type DayPlanned } from "@/domain/day/build";
import { townById } from "@/domain/discovery/towns";
import { dayPool } from "./pool";
import {
  keepDayQuery,
  readDayQuery,
  type DayQueryValues,
} from "@/lib/domains/integration/dayQuery";

/**
 * **The day that was on screen, recovered from its query.** One resolver for
 * every surface that comes after planning — the paper (`/go/print`) and the
 * phone in the glovebox (Go Offline) — so they cannot disagree about which
 * stops, in which order, for how long.
 *
 * The stops arrive as **ids**, and the builder is re-run only to recover the
 * reasons, the rules and the rain plans: `keep` and `order` are the ids from
 * the URL, `minutes` and `rainPlans` replay what the person set and saw.
 * Re-planning here could hand somebody a different afternoon between pressing
 * print and the paper coming out.
 *
 * Atlas is asked for the same day the screen asked about (`on`), so a stated
 * "not on that day" reads the same on paper as it did on screen.
 */
export type PrintDay =
  | { readonly kind: "none"; readonly query: DayQueryValues }
  | { readonly kind: "unreachable"; readonly query: DayQueryValues }
  | {
      readonly kind: "day";
      readonly day: DayPlanned;
      readonly query: DayQueryValues;
      /** The query, reduced to every registered key — for a hand-off. */
      readonly carried: string;
    };

export async function resolvePrintDay(
  raw: Record<string, string | string[] | undefined>,
): Promise<PrintDay> {
  const query = readDayQuery(raw);
  // Nothing chosen means nothing to look up. A corpus read that can only be
  // thrown away is 6–7 seconds of somebody's time, and with Atlas down it
  // turns "build a day first" into an error page.
  if (query.stops.length === 0) return { kind: "none", query };

  let candidates;
  try {
    candidates = await listDiscoveryCandidates(query.age, query.on);
  } catch {
    return { kind: "unreachable", query };
  }
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const chosen = query.stops
    .map((id) => byId.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(candidateToExperience);
  const rainPlans = Object.fromEntries(
    Object.entries(query.rain).filter(([, alt]) => byId.has(alt)),
  );
  const shelters = Object.values(rainPlans).map((alt) =>
    candidateToExperience(byId.get(alt)!),
  );

  const town = townById(query.at);
  const read = readBrief(query.say, {
    ...(query.hours !== undefined ? { hours: query.hours } : {}),
    ...(query.age !== undefined ? { childAge: query.age } : {}),
    ...(town ? { town } : {}),
    ...(query.on ? { on: query.on } : {}),
  });
  // What a revision changed on screen, laid over the re-read sentence.
  const brief = { ...read, ...uncarryBrief(query.b) };

  const day = buildDay({
    pool: [...chosen, ...shelters],
    brief,
    keep: query.stops,
    order: query.stops,
    count: Math.max(1, chosen.length),
    minutes: query.mins,
    rainPlans,
    // What is missing is judged against what the screen chose from.
    catalogue: dayPool(candidates, query.stops),
  });
  return { kind: "day", day, query, carried: keepDayQuery(raw) };
}
