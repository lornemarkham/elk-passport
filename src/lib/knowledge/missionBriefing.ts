import "server-only";
import { loadRuns, loadRunEvents, type IngestionEvent } from "./runData";
import { computeVitals, type AttentionGroup } from "./heartbeat";
import { buildMissionControl, type RunWithEvents } from "./missionControl";

/**
 * **What Atlas did today, and what it could not decide.**
 *
 * The two facts a mission page needs before it recommends anything.
 *
 * ## The backlog is not recomputed here
 *
 * `buildMissionControl` already decides what counts as waiting on a human —
 * which runs are current, which events are superseded, how they group. This
 * module calls it and reads `attention`, so a mission page and Mission Control
 * can never disagree.
 *
 * That is not tidiness. A first attempt at this filtered events itself and
 * reported **2 decisions waiting** while Mission Control reported **119** on
 * the same data. Two pages disagreeing about how much work is waiting destroys
 * the trust that makes every other number on the page worth reading, and the
 * only durable fix is one implementation.
 *
 * Today's counts *are* computed here, because Mission Control has no notion of
 * "today" — but through `computeVitals`, the same function it uses for
 * lifetime totals.
 *
 * ## Corpus-wide, and it says so
 *
 * Runs carry no mission tag, so none of this can be attributed to one mission.
 * Every figure is labelled *all missions* wherever it is rendered. Matching
 * runs to a mission by label would produce a plausible number that is
 * sometimes wrong.
 *
 * ## Degrades to absent, never to zero
 *
 * Every failure path returns `null`. A zero here would read as *Atlas did
 * nothing today*, which is a claim rather than a missing value.
 *
 * ## Why the event reads are throttled
 *
 * `runData`'s admin fetch aborts at 3 seconds. Firing one request per run at
 * once put ~50 in flight, enough of them timed out to return empty, and two
 * consecutive loads of the same page reported **119 decisions** and then
 * **1**. A number that changes on refresh is worse than no number.
 *
 * So reads run `CONCURRENCY` at a time, and any run whose events could not be
 * read is counted in `runsUnread`. When that is above zero the caller must
 * present the totals as a floor rather than as a fact — a partial read that
 * looks complete is the failure this field exists to prevent.
 */

/** Small enough that a 3-second per-request budget is realistic. */
const CONCURRENCY = 6;

/** Runs a bounded number of promises at a time, preserving input order. */
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export interface MissionBriefing {
  /** Runs that started today, whatever their outcome. */
  readonly runsToday: number;
  readonly runsFailedToday: number;
  /** When Atlas last did anything. Absent if it never has. */
  readonly lastRunAt?: string;
  /** Counted from today's events. Zero means zero — the runs were read. */
  readonly today: {
    readonly entitiesCreated: number;
    readonly entitiesRecognised: number;
    readonly entitiesEnriched: number;
    readonly thingsLearned: number;
    readonly sourcesFetched: number;
    readonly sourcesVerified: number;
    readonly relationshipsCreated: number;
  };
  /** Straight from Mission Control's own model. Never recomputed. */
  readonly waiting: readonly AttentionGroup[];
  readonly waitingTotal: number;
  /**
   * **Every run with its events, exactly as read.**
   *
   * Exposed so a mission can attribute work to itself without a second pass
   * over the admin API. Runs carry no mission tag, but their events carry
   * `entityId` — and an entity belongs to a mission. `missionWork.ts` does
   * that join; this module deliberately does not, because "what did Atlas do
   * today" and "what did Atlas do to Recreation" are different questions and
   * only one of them can be answered corpus-wide.
   */
  readonly runs: readonly RunWithEvents[];
  /** Runs whose events could not be read. Above zero means every total is a floor. */
  readonly runsUnread: number;
  readonly runsTotal: number;
}

function isToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function loadMissionBriefing(
  now: Date,
): Promise<MissionBriefing | null> {
  let runs;
  try {
    runs = await loadRuns();
  } catch {
    return null;
  }

  // Same read Mission Control performs: every run, with its events. A run
  // whose events cannot be loaded is still a run — showing it without detail
  // is more honest than dropping it.
  let unread = 0;
  const withEvents: RunWithEvents[] = await mapLimit(
    runs,
    CONCURRENCY,
    async (run) => {
      try {
        return { run, events: await loadRunEvents(run.id) };
      } catch {
        unread += 1;
        return { run, events: [] as readonly IngestionEvent[] };
      }
    },
  );

  const model = buildMissionControl(withEvents, null);

  const todaysRuns = withEvents.filter((r) => isToday(r.run.startedAt, now));
  const vitals = computeVitals(todaysRuns.flatMap((r) => r.events));

  const lastRunAt = [...withEvents].sort(
    (a, b) =>
      new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime(),
  )[0]?.run.startedAt;

  return {
    runsToday: todaysRuns.length,
    runsFailedToday: todaysRuns.filter((r) => r.run.status === "failed").length,
    lastRunAt,
    today: {
      entitiesCreated: vitals.entitiesCreated,
      entitiesRecognised: vitals.entitiesRecognised,
      entitiesEnriched: vitals.entitiesEnriched,
      thingsLearned: vitals.thingsLearned,
      sourcesFetched: vitals.pagesFetched,
      sourcesVerified: vitals.sourcesVerified,
      relationshipsCreated: vitals.relationshipsCreated,
    },
    waiting: model.attention,
    waitingTotal: model.attention.reduce((sum, g) => sum + g.events.length, 0),
    runs: withEvents,
    runsUnread: unread,
    runsTotal: runs.length,
  };
}
