import { describe, expect, it } from "vitest";
import { featuredAt, isOnNow, matchesFeatured, NONA_LIGHTS } from "./featured";

const ids = (l: readonly { id: string }[]) => l.map((e) => e.id);

describe("featuredAt", () => {
  it("at 10 AM on Nov 27 both evening events are Tonight, soonest first", () => {
    const f = featuredAt(new Date("2026-11-27T10:00:00-08:00"));
    expect(ids(f.tonight)).toEqual(["frostival-2026", "nohs-light-up-2026"]);
    expect(ids(f.soon)).toEqual([
      "nona-lights-2026",
      "silverstar-light-up-2026",
    ]);
    expect(f.star?.id).toBe("bethlehem-star-2026");
  });

  it("drops each event from Tonight once it has ended", () => {
    const after6 = featuredAt(new Date("2026-11-27T18:30:00-08:00"));
    expect(ids(after6.tonight)).toEqual(["frostival-2026"]);
    const after8 = featuredAt(new Date("2026-11-27T20:01:00-08:00"));
    expect(after8.tonight).toEqual([]);
  });

  it("uses the Pacific day, not UTC", () => {
    // 6 PM Pacific on Nov 27 is already Nov 28 in UTC.
    const f = featuredAt(new Date("2026-11-28T02:30:00Z"));
    expect(ids(f.tonight)).toEqual(["frostival-2026"]);
  });

  it("the next day shows neither evening event anywhere", () => {
    const f = featuredAt(new Date("2026-11-28T09:00:00-08:00"));
    const all = [...f.tonight, ...f.soon, ...(f.star ? [f.star] : [])];
    expect(ids(all)).not.toContain("frostival-2026");
    expect(ids(all)).not.toContain("nohs-light-up-2026");
  });

  it("SilverStar is Tonight on its day, and gone after; the tour runs on", () => {
    const day = featuredAt(new Date("2026-12-05T12:00:00-08:00"));
    expect(ids(day.tonight)).toContain("silverstar-light-up-2026");
    const late = featuredAt(new Date("2026-12-06T09:00:00-08:00"));
    expect(ids(late.soon)).toEqual(["nona-lights-2026"]);
    expect(isOnNow(NONA_LIGHTS, new Date("2026-12-06T09:00:00-08:00"))).toBe(
      true,
    );
  });

  it("the Bethlehem Star showcase ends with its last evening", () => {
    expect(
      featuredAt(new Date("2026-12-06T18:00:00-08:00")).star,
    ).toBeDefined();
    expect(
      featuredAt(new Date("2026-12-06T19:01:00-08:00")).star,
    ).toBeUndefined();
  });

  it("everything is gone after the season's run", () => {
    const f = featuredAt(new Date("2027-01-02T09:00:00-08:00"));
    expect([...f.tonight, ...f.soon]).toEqual([]);
  });
});

describe("matchesFeatured", () => {
  it("recognises the same events in the feed", () => {
    expect(matchesFeatured("Frostival 2026 Downtown Vernon")).toBe(true);
    expect(
      matchesFeatured("NOHS Holiday Light-Up and Lanterns of Legacy"),
    ).toBe(true);
    expect(matchesFeatured("Armstrong Santa Claus Parade")).toBe(false);
  });
});
