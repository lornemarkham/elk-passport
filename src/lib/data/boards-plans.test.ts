import { describe, expect, it } from "vitest";
import {
  PLAN_STOPS_MAX,
  canonicalDayQuery,
  parsePlanRequest,
  planItemId,
  summarisePlans,
  type PlanRow,
} from "./boards-plans";

describe("canonicalDayQuery", () => {
  it("keeps exactly what /go/print reads, in a fixed order", () => {
    expect(
      canonicalDayQuery(
        "/go/print?on=2026-10-17&at=vancouver&utm=x&stops=a,b,c&say=four+hours&hours=4&age=5",
      ),
    ).toBe(
      "stops=a%2Cb%2Cc&say=four+hours&hours=4&age=5&at=vancouver&on=2026-10-17",
    );
  });

  it("accepts the full address bar of a print page, and a bare query", () => {
    expect(
      canonicalDayQuery("https://passport.example/go/print?stops=a,b"),
    ).toBe("stops=a%2Cb");
    expect(canonicalDayQuery("?stops=a")).toBe("stops=a");
  });

  it("gives the same text for the same day however it arrived", () => {
    expect(canonicalDayQuery("/go/print?at=vancouver&stops=a,b")).toBe(
      canonicalDayQuery("stops=a,b&at=vancouver"),
    );
  });

  it("refuses anything that is not a printed day", () => {
    expect(canonicalDayQuery("")).toBeNull();
    expect(canonicalDayQuery("/go?stops=a")).toBeNull();
    expect(canonicalDayQuery("https://evil.example/phish?stops=a")).toBeNull();
    expect(canonicalDayQuery("/go/print?say=hi")).toBeNull();
    expect(canonicalDayQuery("/go/print?stops=a,a")).toBeNull();
    const tooMany = Array.from(
      { length: PLAN_STOPS_MAX + 1 },
      (_, i) => `s${i}`,
    );
    expect(
      canonicalDayQuery(`/go/print?stops=${tooMany.join(",")}`),
    ).toBeNull();
  });

  it("drops context that is not real rather than carrying it", () => {
    expect(
      canonicalDayQuery(
        "/go/print?stops=a&on=2026-02-31&age=40&hours=-1&at=<script>",
      ),
    ).toBe("stops=a");
  });
});

describe("parsePlanRequest", () => {
  it("names nobody unless asked, and trims a title to a title", () => {
    const asked = parsePlanRequest({
      link: "/go/print?stops=a",
      title: `  ${"x".repeat(200)}  `,
    });
    expect(asked?.showName).toBe(false);
    expect(asked?.title).toHaveLength(80);
  });

  it("is null for anything else", () => {
    expect(parsePlanRequest(null)).toBeNull();
    expect(parsePlanRequest({ link: 7 })).toBeNull();
    expect(parsePlanRequest({ link: "/elsewhere" })).toBeNull();
  });
});

describe("summarisePlans", () => {
  const row = (over: Partial<PlanRow>): PlanRow => ({
    id: "p1",
    userId: "sam",
    title: null,
    dayQuery: "stops=a%2Cb&say=four+hours%2C+food&on=2026-10-17",
    shownAs: "Sam",
    createdAt: "2026-10-11T10:00:00Z",
    ...over,
  });
  const members = new Set(["me", "sam"]);

  it('carries no user ids, and an item id for "I\'m in"', () => {
    const [plan] = summarisePlans(
      [row({})],
      { id: "me", isOwner: false },
      members,
    );
    expect(plan).toMatchObject({
      itemId: planItemId("p1"),
      href: "/go/print?stops=a%2Cb&say=four+hours%2C+food&on=2026-10-17",
      stops: 2,
      on: "2026-10-17",
      title: "four hours, food",
      sharedBy: "Sam",
      yours: false,
      canWithdraw: false,
    });
    expect(JSON.stringify(plan)).not.toContain('"sam"');
  });

  it("names a sharer only if they chose it, and only while they are still on the board", () => {
    const viewer = { id: "me", isOwner: false };
    expect(
      summarisePlans([row({ shownAs: null })], viewer, members)[0]!.sharedBy,
    ).toBeNull();
    expect(
      summarisePlans([row({})], viewer, new Set(["me"]))[0]!.sharedBy,
    ).toBeNull();
  });

  it("lets the sharer and the owner take a day down, and nobody else", () => {
    expect(
      summarisePlans(
        [row({ userId: "me" })],
        { id: "me", isOwner: false },
        members,
      )[0]!.canWithdraw,
    ).toBe(true);
    expect(
      summarisePlans([row({})], { id: "me", isOwner: true }, members)[0]!
        .canWithdraw,
    ).toBe(true);
  });

  it("puts the newest day first", () => {
    const plans = summarisePlans(
      [
        row({ id: "old", createdAt: "2026-10-01T00:00:00Z" }),
        row({ id: "new", createdAt: "2026-10-10T00:00:00Z" }),
      ],
      { id: "me", isOwner: false },
      members,
    );
    expect(plans.map((p) => p.id)).toEqual(["new", "old"]);
  });
});
