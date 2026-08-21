import { describe, expect, test } from "vitest";
import type { WorkspaceCandidateSource } from "./workspaceData";
import type { IngestionEvent } from "./runData";
import type { EntityLike } from "./regionHealth";
import {
  buildLearningOpportunities,
  learningArea,
  publisherOf,
  targetsOfCandidate,
  unattributedCandidates,
} from "./learningOpportunities";

/**
 * Grouping discovered pages by the entity they teach. The acceptance case is
 * the live one: thirteen Big White pages are **one** piece of work, not
 * thirteen, and nothing about any individual page is thrown away to say so.
 */

const BIG_WHITE = "238661eb-big-white";
const SILVER_STAR = "aa126ace-silver-star";

const byId: ReadonlyMap<string, EntityLike> = new Map([
  [BIG_WHITE, { id: BIG_WHITE, kind: "Place", name: "Big White Ski Resort" }],
  [
    SILVER_STAR,
    { id: SILVER_STAR, kind: "Place", name: "Silver Star Mountain Resort" },
  ],
]);
const ids = new Set([BIG_WHITE, SILVER_STAR]);

const candidate = (
  over: Partial<WorkspaceCandidateSource> & { id: string },
): WorkspaceCandidateSource => ({
  url: `https://www.bigwhite.com/${over.id}`,
  sourceType: "official-website",
  status: "queued",
  expectedTargets: [BIG_WHITE],
  discoveredFromSourceRecordId: "src-1",
  reason: "Summer operation — the season Atlas knows least about.",
  discoveredAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

const failedEvent = (candidateSourceId: string, message: string) =>
  ({
    id: `evt-${candidateSourceId}`,
    runId: "run-1",
    sequence: 1,
    stage: "source-fetched",
    outcome: "failed",
    at: "2026-08-01T00:00:00.000Z",
    subject: "Big White Ski Resort",
    message,
    candidateSourceId,
  }) as IngestionEvent;

const build = (
  candidates: WorkspaceCandidateSource[],
  events: IngestionEvent[] = [],
) => buildLearningOpportunities(candidates, events, ids, byId);

describe("targetsOfCandidate", () => {
  test("reads expectedTargets — the field the reversibility gate reads", () => {
    expect(targetsOfCandidate({ expectedTargets: ["a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  test("falls back to the removed one-page-one-entity field only when empty", () => {
    expect(targetsOfCandidate({ aboutEntityId: "a" })).toEqual(["a"]);
    expect(
      targetsOfCandidate({ expectedTargets: ["a"], aboutEntityId: "b" }),
    ).toEqual(["a"]);
  });

  test("returns nothing rather than guessing when Atlas named no target", () => {
    expect(targetsOfCandidate({})).toEqual([]);
    expect(targetsOfCandidate({ expectedTargets: [] })).toEqual([]);
  });
});

describe("publisherOf", () => {
  test("names the publisher a reader would name", () => {
    expect(publisherOf("https://www.bigwhite.com/summer")).toBe("bigwhite.com");
  });

  test("returns the input rather than inventing a host it cannot parse", () => {
    expect(publisherOf("not a url")).toBe("not a url");
  });
});

describe("learningArea", () => {
  test("takes the subject clause, not the justification after the dash", () => {
    expect(
      learningArea("Summer operation — the season Atlas knows least about."),
    ).toBe("Summer operation");
  });

  test("stops at the first sentence when there is no dash", () => {
    expect(learningArea("Lodging categories. Useful for stays.")).toBe(
      "Lodging categories",
    );
  });

  test("says so rather than rendering an empty label", () => {
    expect(learningArea("   ")).toBe("Unstated");
  });
});

describe("grouping by entity", () => {
  test("thirteen pages about one entity are one work item", () => {
    // The acceptance case, and the whole point.
    const thirteen = Array.from({ length: 13 }, (_, i) =>
      candidate({ id: `p${i}` }),
    );
    const result = build(thirteen);
    expect(result).toHaveLength(1);
    expect(result[0]!.entityName).toBe("Big White Ski Resort");
    expect(result[0]!.queued).toBe(13);
    expect(result[0]!.sources).toHaveLength(13);
  });

  test("keeps every URL, reason and status — grouping is hierarchy, not deletion", () => {
    const result = build([
      candidate({ id: "summer", url: "https://www.bigwhite.com/summer" }),
      candidate({
        id: "lodging",
        url: "https://www.bigwhite.com/plan-your-trip/accommodation",
        reason: "Lodging categories.",
      }),
    ]);
    const urls = result[0]!.sources.map((s) => s.url);
    expect(urls).toEqual([
      "https://www.bigwhite.com/summer",
      "https://www.bigwhite.com/plan-your-trip/accommodation",
    ]);
    expect(result[0]!.sources.map((s) => s.reason)).toContain(
      "Lodging categories.",
    );
    expect(result[0]!.sources.every((s) => s.status === "queued")).toBe(true);
  });

  test("never mixes another entity's pages into a group", () => {
    const result = build([
      candidate({ id: "a" }),
      candidate({ id: "b", expectedTargets: [SILVER_STAR] }),
    ]);
    expect(result).toHaveLength(2);
    const bigWhite = result.find((r) => r.entityId === BIG_WHITE)!;
    expect(bigWhite.sources).toHaveLength(1);
  });

  test("excludes a page teaching an entity outside this domain", () => {
    const result = build([
      candidate({ id: "a", expectedTargets: ["stranger"] }),
    ]);
    expect(result).toEqual([]);
  });

  test("a page teaching two entities appears under both, and says so", () => {
    // One read, not two. Counting it as two pages would overstate the work.
    const result = build([
      candidate({ id: "shared", expectedTargets: [BIG_WHITE, SILVER_STAR] }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.sources[0]!.alsoTeaches === 1)).toBe(true);
  });

  test("orders the entity with the most outstanding pages first", () => {
    const result = build([
      candidate({ id: "a", expectedTargets: [SILVER_STAR] }),
      candidate({ id: "b" }),
      candidate({ id: "c" }),
    ]);
    expect(result[0]!.entityId).toBe(BIG_WHITE);
  });

  test("names the publishers once each, not once per page", () => {
    const result = build([
      candidate({ id: "a", url: "https://www.bigwhite.com/one" }),
      candidate({ id: "b", url: "https://bigwhite.com/two" }),
    ]);
    expect(result[0]!.publishers).toEqual(["bigwhite.com"]);
  });
});

describe("status aggregation", () => {
  test("counts read, rejected and queued separately", () => {
    const result = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b", status: "rejected" }),
      candidate({ id: "c", status: "queued" }),
    ]);
    const bw = result[0]!;
    expect([bw.read, bw.rejected, bw.queued]).toEqual([1, 1, 1]);
  });

  test("a failed fetch is its own state, not a quiet queued page", () => {
    // Atlas has no `failed` candidate status — a broken fetch leaves the row
    // queued and reports itself as an event. Counting it as queued would hide
    // the one page that needs a person.
    const result = build(
      [candidate({ id: "a" }), candidate({ id: "b" })],
      [failedEvent("b", "Fetch failed: 503")],
    );
    const bw = result[0]!;
    expect(bw.queued).toBe(1);
    expect(bw.failed).toBe(1);
    expect(bw.sources.find((s) => s.id === "b")!.failure).toBe(
      "Fetch failed: 503",
    );
  });

  test("joins a failure by candidate id, never by name or URL", () => {
    const result = build(
      [candidate({ id: "a" })],
      [failedEvent("someone-else", "Not this one")],
    );
    expect(result[0]!.failed).toBe(0);
  });

  test("is complete only when nothing queued and nothing failed remains", () => {
    const done = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b", status: "rejected" }),
    ]);
    expect(done[0]!.complete).toBe(true);

    const stillQueued = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b" }),
    ]);
    expect(stillQueued[0]!.complete).toBe(false);
  });

  test("one failure does not let the pass read as complete", () => {
    // 7 of 8 processed is not done, and collapsing it into done would report
    // a finish on the strength of a broken fetch.
    const result = build(
      [
        ...Array.from({ length: 7 }, (_, i) =>
          candidate({ id: `ok${i}`, status: "ingested" }),
        ),
        candidate({ id: "broken" }),
      ],
      [failedEvent("broken", "Fetch failed")],
    );
    expect(result[0]!.complete).toBe(false);
    expect(result[0]!.read).toBe(7);
    expect(result[0]!.failed).toBe(1);
  });

  test("lists learning areas only for what is still outstanding", () => {
    const result = build([
      candidate({ id: "a", status: "ingested", reason: "Already read." }),
      candidate({ id: "b", reason: "Dining directory — still waiting." }),
    ]);
    expect(result[0]!.learningAreas).toEqual(["Dining directory"]);
  });

  test("does not repeat a learning area two pages share", () => {
    const result = build([
      candidate({ id: "a", reason: "Parking — one page." }),
      candidate({ id: "b", reason: "Parking — another page." }),
    ]);
    expect(result[0]!.learningAreas).toEqual(["Parking"]);
  });
});

describe("unattributed pages", () => {
  test("are the open ones Atlas could not assign to any entity", () => {
    const result = unattributedCandidates([
      candidate({ id: "a", expectedTargets: [] }),
      candidate({ id: "b" }),
      candidate({ id: "c", expectedTargets: [], status: "ingested" }),
    ]);
    expect(result.map((c) => c.id)).toEqual(["a"]);
  });

  test("never appear inside an entity's group", () => {
    const grouped = build([candidate({ id: "a", expectedTargets: [] })]);
    expect(grouped).toEqual([]);
  });
});
