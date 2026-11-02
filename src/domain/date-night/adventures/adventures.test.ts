import { describe, expect, it } from "vitest";
import { nightConfig, pickMystery } from ".";

describe("night configs", () => {
  const markham = nightConfig("markham")!;

  it("holds the brief's six activities and seven packing items", () => {
    expect(markham.activities.map((a) => a.id)).toHaveLength(6);
    expect(markham.packing).toHaveLength(7);
    expect(markham.invitation[0]).toContain("questionable adventure");
  });

  it("claims no Atlas place it has not verified", () => {
    // King Eddie is not in Atlas (corpus check, see markham.ts).
    expect(
      markham.activities.find((a) => a.id === "king-eddie")?.atlasRef,
    ).toBeUndefined();
    for (const a of markham.activities)
      if (a.atlasRef) expect(a.atlasRef).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("puts a caution on anything with cold water, hunting, fire or snow", () => {
    for (const id of [
      "king-eddie",
      "grouse-and-backroads",
      "fire-and-food",
      "snowmobile-scouting",
    ])
      expect(markham.activities.find((a) => a.id === id)?.caution).toBeTruthy();
  });

  it("draws a mystery from places not already held", () => {
    const [first, ...rest] = markham.mysteryAtlasIds;
    expect(pickMystery(markham, new Set(rest), () => 0)).toBe(first);
    expect(pickMystery(markham, new Set(markham.mysteryAtlasIds))).toBeNull();
  });
});
