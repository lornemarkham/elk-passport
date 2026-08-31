import { describe, expect, test } from "vitest";
import type { WorkspaceCandidateSource } from "./workspaceData";
import type { IngestionEvent } from "./runData";
import type { EntityLike } from "./regionHealth";
import {
  buildLearningOpportunities,
  canonicalUrl,
  learningArea,
  ownedSourceRecordIds,
  readSourceUrls,
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

/**
 * **Work a mission owns is not also unowned work.**
 *
 * Measured on the live corpus 2026-08-30: ten Big White pages were read and
 * applied nothing. Mission 4 presented them as ten, in pages. The same ten
 * reads emitted **66** `needs-attention` events, and those were counted again
 * under *Not tied to a mission → Needs evidence* — a second backlog, in a
 * different unit, for the same work, with a contradictory next action.
 *
 * The join is by identifier, never by text: an event names the `SourceRecord`
 * its read wrote, and a mission's pages are candidate URLs. `canonicalUrl` is
 * the same join `buildLearningOpportunities` already uses to tell read from
 * unread, so the two answers cannot drift.
 */
describe("ownedSourceRecordIds", () => {
  const url = (id: string) => `https://www.bigwhite.com/${id}`;
  const record = (id: string, source: string) => ({ id, source });

  test("claims the source records produced by a mission's own reads", () => {
    const learning = build(
      [
        candidate({ id: "summer", url: url("summer") }),
        candidate({ id: "winter", url: url("winter") }),
      ],
      [],
      fetched(url("summer"), url("winter")),
    );
    const owned = ownedSourceRecordIds(learning, [
      record("sr-summer", url("summer")),
      record("sr-winter", url("winter")),
      record("sr-elsewhere", "https://www.silverstarbc.com/trails"),
    ]);
    expect(owned.has("sr-summer")).toBe(true);
    expect(owned.has("sr-winter")).toBe(true);
    // A page no mission discovered stays unowned, so its outcomes remain the
    // curator's to see.
    expect(owned.has("sr-elsewhere")).toBe(false);
  });

  test("many events from one read cannot inflate the backlog", () => {
    // The real shape: one page, one SourceRecord, several needs-attention
    // events. Ownership is per read, so the count a curator sees is pages.
    const learning = build(
      [candidate({ id: "food-dining", url: url("food-dining") })],
      [],
      fetched(url("food-dining")),
    );
    const owned = ownedSourceRecordIds(learning, [
      record("sr-food", url("food-dining")),
    ]);
    const eventsFromThatOneRead = Array.from({ length: 7 }, () => ({
      sourceRecordId: "sr-food",
    }));
    const stillUnowned = eventsFromThatOneRead.filter(
      (e) => !owned.has(e.sourceRecordId),
    );
    expect(owned.size).toBe(1);
    expect(stillUnowned).toEqual([]);
  });

  test("matches the URL the way Atlas stores it, not byte-for-byte", () => {
    const learning = build(
      [candidate({ id: "summer", url: "https://www.bigwhite.com/Summer/" })],
      [],
      fetched("https://www.bigwhite.com/Summer/"),
    );
    const owned = ownedSourceRecordIds(learning, [
      record("sr-summer", "https://bigwhite.com/summer"),
    ]);
    expect(owned.has("sr-summer")).toBe(true);
  });

  test("owns nothing when a domain's missions own no reads", () => {
    // The filter must be inert where it does not apply — a domain with no
    // discovered pages keeps every evidence gap it had.
    expect(ownedSourceRecordIds([], [record("sr-a", url("a"))]).size).toBe(0);
  });
});

/**
 * **A page Atlas has read is not a page waiting to be read.**
 *
 * Measured live 2026-08-31: all thirteen Big White candidates were
 * `status: "queued"` and all thirteen had been read. The evidence bucket asked
 * `status`, so it put eight of them on screen under *needs more evidence*,
 * each saying "Queued for reading. `npm run run-queue` reads it" and offering
 * *I do not want this*. Every word was false, and the only action offered
 * would have permanently closed a first-party page — `isAutomaticallyProcessable`
 * refuses `rejected` forever — over a pipeline limitation Atlas already knows
 * about.
 *
 * ADR 045: Atlas asks for a decision only once it has the evidence to make it
 * meaningful. A question whose premise Atlas can itself disprove is not a
 * decision.
 */
describe("readSourceUrls — what Atlas has already fetched", () => {
  const url = (id: string) => `https://www.bigwhite.com/${id}`;
  const record = (source: string) => ({ source });

  test("a queued candidate with a SourceRecord has been read", () => {
    const read = readSourceUrls([record(url("summer"))]);
    // The exact regression: status is still `queued`, and it is still read.
    expect(read.has(canonicalUrl(url("summer")))).toBe(true);
  });

  test("a queued candidate with no SourceRecord is genuinely unread", () => {
    // Stays a legitimate evidence gap, and stays actionable — abandoning it
    // before Atlas spends the fetch is a real decision.
    const read = readSourceUrls([record(url("summer"))]);
    expect(read.has(canonicalUrl(url("accommodation-directory")))).toBe(false);
  });

  test("matches the way Atlas stores URLs, not byte-for-byte", () => {
    const read = readSourceUrls([
      record("https://www.BigWhite.com/Explore/Food-Dining/"),
    ]);
    expect(
      read.has(canonicalUrl("http://bigwhite.com/explore/food-dining")),
    ).toBe(true);
  });

  test("an empty corpus of sources marks nothing as read", () => {
    // Absent evidence is not evidence of a read — every candidate stays a gap.
    expect(readSourceUrls([]).size).toBe(0);
  });

  test("agrees with the state the mission surface derives", () => {
    // One rule, two consumers. `stateOf` calls a fetched-but-open candidate
    // `read-not-applied`; the evidence bucket must therefore not call the same
    // candidate an unread gap.
    const opportunities = build(
      [
        candidate({ id: "read", url: url("read") }),
        candidate({ id: "unread", url: url("unread") }),
      ],
      [],
      fetched(url("read")),
    );
    const states = Object.fromEntries(
      opportunities[0]!.sources.map((s) => [s.id, s.state]),
    );
    expect(states).toEqual({ read: "read-not-applied", unread: "unread" });

    const read = readSourceUrls(fetched(url("read")));
    expect(read.has(canonicalUrl(url("read")))).toBe(true);
    expect(read.has(canonicalUrl(url("unread")))).toBe(false);
  });
});

/**
 * **What a read described and Atlas did not create.**
 *
 * Carried straight from Atlas's own durable snapshot. The distinction that
 * matters is between *recorded and empty* and *never recorded* — most Big
 * White pages were read before Atlas kept this, and claiming they withheld
 * nothing would be a fabricated zero.
 */
describe("withheld proposals in the read model", () => {
  const url = (id: string) => `https://www.bigwhite.com/${id}`;
  const attempt = (
    withheld: { kind: string; name: string }[],
    outcome: "applied" | "withheld" | "nothing-extracted" = "withheld",
  ) => ({
    at: "2026-08-31T12:00:00.000Z",
    sourceRecordId: "sr-1",
    targetEntityId: BIG_WHITE,
    outcome,
    withheld,
  });

  test("carries kind and name through from the candidate", () => {
    const result = build(
      [
        candidate({
          id: "food-dining",
          url: url("food-dining"),
          lastAttempt: attempt([
            { kind: "Organization", name: "On-Mountain Restaurants" },
            { kind: "Activity", name: "Horse Drawn Sleigh Dining Tours" },
          ]),
        }),
      ],
      [],
      fetched(url("food-dining")),
    );
    expect(result[0]!.sources[0]!.withheld).toEqual([
      { kind: "Organization", name: "On-Mountain Restaurants" },
      { kind: "Activity", name: "Horse Drawn Sleigh Dining Tours" },
    ]);
  });

  test("a recorded interpretation that found nothing is an empty list", () => {
    const result = build(
      [
        candidate({
          id: "summer",
          url: url("summer"),
          lastAttempt: attempt([], "nothing-extracted"),
        }),
      ],
      [],
      fetched(url("summer")),
    );
    expect(result[0]!.sources[0]!.withheld).toEqual([]);
  });

  test("a page Atlas never interpreted stays undefined, not zero", () => {
    // The legacy case, and the one a UI must not render as "0 withheld".
    const result = build(
      [candidate({ id: "legacy", url: url("legacy") })],
      [],
      fetched(url("legacy")),
    );
    expect(result[0]!.sources[0]!.withheld).toBeUndefined();
  });

  test("withheld evidence does not change the source's own state", () => {
    // Still `read-not-applied`, still not queue work. Recording what a read
    // found says nothing about whether the page is outstanding.
    const result = build(
      [
        candidate({
          id: "food-dining",
          url: url("food-dining"),
          lastAttempt: attempt([{ kind: "Activity", name: "Night Skiing" }]),
        }),
      ],
      [],
      fetched(url("food-dining")),
    );
    expect(result[0]!.sources[0]!.state).toBe("read-not-applied");
    expect(result[0]!.unread).toBe(0);
  });
});
