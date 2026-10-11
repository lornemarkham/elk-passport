import { describe, expect, it } from "vitest";
import {
  kindredColleagues,
  parseInterestRequest,
  shownAsFor,
  summariseInterest,
  type InterestRow,
} from "./boards-interest";

const HOCKEY = "g:hockey";
const HIKE = "atlas-hike";

const row = (
  userId: string,
  itemId: string,
  shownAs: string | null = null,
): InterestRow => ({ userId, itemId, shownAs });

const members = (...ids: string[]) => new Set(ids);

describe("summarising interest for one viewer", () => {
  it("counts everybody, and names only those who chose to be named", () => {
    const rows = [
      row("me", HOCKEY),
      row("sam", HOCKEY, "Sam"),
      row("ana", HOCKEY, "Ana"),
      row("quiet", HOCKEY),
    ];
    const s = summariseInterest(
      rows,
      "me",
      members("me", "sam", "ana", "quiet"),
    );
    expect(s[HOCKEY]).toEqual({
      count: 4,
      youAreIn: true,
      youShowName: false,
      names: ["Ana", "Sam"],
      unnamed: 1,
    });
  });

  it("never lists the viewer among the names, even when they show theirs", () => {
    const s = summariseInterest([row("me", HOCKEY, "Me")], "me", members("me"));
    expect(s[HOCKEY]!.names).toEqual([]);
    expect(s[HOCKEY]!.youShowName).toBe(true);
  });

  it("counts nobody who has left the board", () => {
    const s = summariseInterest(
      [row("gone", HOCKEY, "Gone"), row("sam", HOCKEY)],
      "me",
      members("me", "sam"),
    );
    expect(s[HOCKEY]).toMatchObject({ count: 1, names: [], unnamed: 1 });
  });

  it("treats a blank name as no name", () => {
    const s = summariseInterest(
      [row("sam", HOCKEY, "  ")],
      "me",
      members("sam"),
    );
    expect(s[HOCKEY]).toMatchObject({ names: [], unnamed: 1 });
  });

  it("reports nothing for items nobody marked — absence, not a zero row", () => {
    expect(summariseInterest([], "me", members("me"))).toEqual({});
  });

  it("never carries a user id to the browser", () => {
    const rows = [row("uuid-sam", HOCKEY, "Sam"), row("uuid-quiet", HIKE)];
    const memberIds = members("me", "uuid-sam", "uuid-quiet");
    const out = JSON.stringify([
      summariseInterest(rows, "me", memberIds),
      kindredColleagues(
        [...rows, row("me", HOCKEY), row("me", HIKE)],
        "me",
        memberIds,
      ),
    ]);
    expect(out).not.toContain("uuid-");
  });
});

describe("colleagues into the same things", () => {
  const everyone = members("me", "sam", "ana", "lee");

  it("lists named colleagues who share the viewer's interests, most shared first", () => {
    const rows = [
      row("me", HOCKEY),
      row("me", HIKE),
      row("sam", HOCKEY, "Sam"),
      row("ana", HOCKEY, "Ana"),
      row("ana", HIKE, "Ana"),
    ];
    expect(kindredColleagues(rows, "me", everyone)).toEqual([
      { name: "Ana", shared: [HOCKEY, HIKE] },
      { name: "Sam", shared: [HOCKEY] },
    ]);
  });

  it("never undoes anonymity on one item with a name shown on another", () => {
    const rows = [
      row("me", HOCKEY),
      row("me", HIKE),
      row("sam", HOCKEY, "Sam"),
      row("sam", HIKE, null),
    ];
    expect(kindredColleagues(rows, "me", everyone)).toEqual([
      { name: "Sam", shared: [HOCKEY] },
    ]);
  });

  it("is empty for somebody interested in nothing", () => {
    expect(
      kindredColleagues([row("sam", HOCKEY, "Sam")], "me", everyone),
    ).toEqual([]);
  });

  it("ignores interests the viewer does not share", () => {
    const rows = [row("me", HOCKEY), row("lee", HIKE, "Lee")];
    expect(kindredColleagues(rows, "me", everyone)).toEqual([]);
  });
});

describe("what the browser may send", () => {
  it("needs an item id, and showing a name is opt-in", () => {
    expect(parseInterestRequest({ itemId: " a " })).toEqual({
      itemId: "a",
      showName: false,
    });
    expect(parseInterestRequest({ itemId: "a", showName: "yes" })).toEqual({
      itemId: "a",
      showName: false,
    });
    expect(parseInterestRequest({ itemId: "a", showName: true })).toEqual({
      itemId: "a",
      showName: true,
    });
  });

  it("refuses anything else", () => {
    expect(parseInterestRequest(null)).toBeNull();
    expect(parseInterestRequest({})).toBeNull();
    expect(parseInterestRequest({ itemId: "" })).toBeNull();
    expect(parseInterestRequest({ itemId: 4 })).toBeNull();
    expect(parseInterestRequest({ itemId: "x".repeat(201) })).toBeNull();
  });

  it("stores a name only when asked to, and only a short one", () => {
    expect(shownAsFor("Lorne", false)).toBeNull();
    expect(shownAsFor("Lorne", true)).toBe("Lorne");
    expect(shownAsFor("   ", true)).toBeNull();
    expect(shownAsFor("x".repeat(100), true)).toHaveLength(60);
  });
});
