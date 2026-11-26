import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { dayPool } from "@/lib/go/pool";
import { forDiscoveryPool, zoneDay } from "@/domain/discovery/hygiene";
import { memoizeByObject } from "@/lib/memoizeByObject";

/**
 * **What Dream chooses from: the same pool, from the same cached read, as
 * `/go`.**
 *
 * `listDiscoveryCandidates(age, today)` is the very cache entry `/go` and
 * Christmas warm (`discovery/candidates?on=<today>`), so a Dream answer
 * normally costs no Atlas round trip at all. The pool is mapped once per
 * read (`memoizeByObject`) — 7,000 candidates is ~30 ms — then each answer is
 * a few milliseconds of arithmetic on the server and a few kilobytes on the
 * wire. Nothing the size of `/go`'s 19 MB pool reaches a phone.
 *
 * Atlas's `schedule.onDate` answers *today*. When the person asks about
 * another day it is removed rather than misapplied: "Atlas says it's open
 * that day" must be about that day.
 */
const poolOf = memoizeByObject((rows: DiscoveryCandidate[]) =>
  forDiscoveryPool(dayPool(rows, []), new Date()),
);

const otherDay = memoizeByObject((pool: Experience[]) =>
  pool.map((e) => {
    if (!e.schedule?.onDate) return e;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { onDate, ...schedule } = e.schedule;
    return { ...e, schedule };
  }),
);

export type DreamPool =
  | {
      readonly atlas: "ok";
      readonly pool: readonly Experience[];
      readonly today: string;
    }
  | { readonly atlas: "unreachable"; readonly today: string };

export async function dreamPool(
  on?: string,
  childAge?: number,
): Promise<DreamPool> {
  const today = zoneDay(new Date());
  try {
    const rows = await listDiscoveryCandidates(childAge, today);
    const pool = poolOf(rows);
    return {
      atlas: "ok",
      pool: on && on !== today ? otherDay(pool) : pool,
      today,
    };
  } catch (error) {
    console.error(
      `[atlas] dream could not read the corpus: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return { atlas: "unreachable", today };
  }
}
