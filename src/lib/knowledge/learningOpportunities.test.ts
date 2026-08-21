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

/** A SourceRecord exists because Atlas fetched that URL. That is the whole signal. */
const fetched = (...urls: string[]) => urls.map((source) => ({ source }));

const build = (
  candidates: WorkspaceCandidateSource[],
  events: IngestionEvent[] = [],
  sources: { source: string }[] = [],
) => buildLearningOpportunities(candidates, events, ids, byId, sources);

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
    expect(result[0]!.unread).toBe(13);
    expect(result[0]!.discovered).toBe(13);
    expect(result[0]!.processed).toBe(0);
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
  test("counts applied, rejected and unread separately", () => {
    const result = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b", status: "rejected" }),
      candidate({ id: "c", status: "queued" }),
    ]);
    const bw = result[0]!;
    expect([bw.applied, bw.rejected, bw.unread]).toEqual([1, 1, 1]);
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
    expect(bw.unread).toBe(1);
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

  test("is complete only when nothing unattempted and nothing failed remains", () => {
    const done = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b", status: "rejected" }),
    ]);
    expect(done[0]!.complete).toBe(true);

    const stillUnread = build([
      candidate({ id: "a", status: "ingested" }),
      candidate({ id: "b" }),
    ]);
    expect(stillUnread[0]!.complete).toBe(false);
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
    expect(result[0]!.applied).toBe(7);
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

/**
 * **A page Atlas has already read is not waiting to be read.**
 *
 * The state-model defect this file exists to pin. `ProcessCandidateSourceService`
 * calls `resolveCandidate` on three paths only — already-current, proposed,
 * enriched — so a page that was fetched, extracted, and could not be attributed
 * stays `status: "queued"` forever. On the live corpus ten of Big White's
 * thirteen pages had a SourceRecord while all thirteen claimed to be waiting.
 */
describe("attempted is derived from evidence, not from status", () => {
  const url = (id: string) => `https://www.bigwhite.com/${id}`;

  test("a still-queued candidate whose page was fetched reads as processed", () => {
    const result = build(
      [candidate({ id: "summer", url: url("summer") })],
      [],
      fetched(url("summer")),
    );
    const bw = result[0]!;
    expect(bw.sources[0]!.state).toBe("read-not-applied");
    expect(bw.unread).toBe(0);
    expect(bw.processed).toBe(1);
    expect(bw.readNotApplied).toBe(1);
  });

  test("and no longer holds the mission open, because re-running reads nothing new", () => {
    const result = build(
      [candidate({ id: "summer", url: url("summer") })],
      [],
      fetched(url("summer")),
    );
    expect(result[0]!.complete).toBe(true);
    expect(result[0]!.learnedNothing).toBe(true);
  });

  test("a candidate with no SourceRecord is genuinely unattempted", () => {
    const result = build([candidate({ id: "a", url: url("a") })], [], []);
    expect(result[0]!.sources[0]!.state).toBe("unread");
    expect(result[0]!.complete).toBe(false);
    expect(result[0]!.processed).toBe(0);
  });

  test("reproduces the live split — ten read, three never attempted", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) =>
      candidate({ id: `p${i}`, url: url(`p${i}`) }),
    );
    const result = build(
      thirteen,
      [],
      fetched(...Array.from({ length: 10 }, (_, i) => url(`p${i}`))),
    );
    const bw = result[0]!;
    expect(bw.discovered).toBe(13);
    expect(bw.processed).toBe(10);
    expect(bw.readNotApplied).toBe(10);
    expect(bw.unread).toBe(3);
    // Three genuinely unattempted pages keep it open — and only three.
    expect(bw.complete).toBe(false);
  });

  test("matches the SourceRecord on canonical URL, not on the raw string", () => {
    // Atlas canonicalizes on save; www and a trailing slash are not identity.
    const result = build(
      [candidate({ id: "a", url: "https://www.bigwhite.com/summer/" })],
      [],
      fetched("https://bigwhite.com/summer"),
    );
    expect(result[0]!.sources[0]!.state).toBe("read-not-applied");
  });

  test("does not treat another page's SourceRecord as this page's attempt", () => {
    const result = build(
      [candidate({ id: "a", url: url("a") })],
      [],
      fetched(url("something-else")),
    );
    expect(result[0]!.sources[0]!.state).toBe("unread");
  });

  test("an applied candidate outranks the derivation", () => {
    // `ingested` is a settled fact Atlas wrote; it is not re-derived.
    const result = build(
      [candidate({ id: "a", url: url("a"), status: "ingested" })],
      [],
      fetched(url("a")),
    );
    expect(result[0]!.sources[0]!.state).toBe("applied");
    expect(result[0]!.learnedNothing).toBe(false);
  });

  test("a broken fetch outranks an older SourceRecord for the same URL", () => {
    // Atlas holds a record from a previous run, and this run's attempt broke.
    // The recent failure is the actionable fact.
    const result = build(
      [candidate({ id: "a", url: url("a") })],
      [failedEvent("a", "Fetch failed: 503")],
      fetched(url("a")),
    );
    expect(result[0]!.sources[0]!.state).toBe("failed");
    expect(result[0]!.complete).toBe(false);
  });

  test("learnedNothing is false when something was applied alongside", () => {
    // A mixed pass is not "Atlas learned nothing" — it learned something.
    const result = build(
      [
        candidate({ id: "a", url: url("a"), status: "ingested" }),
        candidate({ id: "b", url: url("b") }),
      ],
      [],
      fetched(url("a"), url("b")),
    );
    expect(result[0]!.applied).toBe(1);
    expect(result[0]!.readNotApplied).toBe(1);
    expect(result[0]!.learnedNothing).toBe(false);
  });

  test("offers to teach only what a run would actually reach", () => {
    // Listing what an already-read page "can teach" is a promise the operation
    // cannot keep — running the queue will not fetch it again.
    const result = build(
      [
        candidate({ id: "a", url: url("a"), reason: "Already read — dining." }),
        candidate({ id: "b", url: url("b"), reason: "Parking — never tried." }),
      ],
      [],
      fetched(url("a")),
    );
    expect(result[0]!.learningAreas).toEqual(["Parking"]);
  });

  test("counts a rejection apart from what Atlas attempted", () => {
    // A curator's outcome, not Atlas's. It settles the page without being an
    // attempt, so it must not inflate "processed".
    const result = build(
      [candidate({ id: "a", url: url("a"), status: "rejected" })],
      [],
      [],
    );
    expect(result[0]!.processed).toBe(0);
    expect(result[0]!.rejected).toBe(1);
    expect(result[0]!.complete).toBe(true);
  });
});
