import { describe, expect, it } from "vitest";
import {
  ROGERS_ARENA_GATES,
  SOURCES,
  gateById,
  gatesDrawnOn,
  readSection,
} from "./arena";

describe("Rogers Arena", () => {
  it("offers exactly the eight gates on the arena's 2026 map", () => {
    expect(ROGERS_ARENA_GATES.map((g) => g.id)).toEqual([
      "1",
      "2",
      "3",
      "6",
      "7",
      "8",
      "10",
      "16",
    ]);
    expect(gateById("9")).toBeUndefined();
  });
  it("has no unverified gate coordinates", () => {
    // A point is added only when it is checked; see SEATS-AND-ARENA.md.
    expect(ROGERS_ARENA_GATES.filter((g) => g.at)).toEqual([]);
  });
  it("cites every gate to a source it names", () => {
    for (const g of ROGERS_ARENA_GATES) {
      expect(g.source.length).toBeGreaterThan(0);
      for (const s of g.source)
        expect(SOURCES[s].url).toMatch(/^https:\/\/rogersarena\.com\//);
    }
  });
  it("says what the map draws per level, not a mapping", () => {
    expect(gatesDrawnOn("300").map((g) => g.id)).toEqual(["1", "2", "8"]);
    expect(gatesDrawnOn("100").map((g) => g.id)).toEqual([
      "3",
      "6",
      "7",
      "10",
      "16",
    ]);
  });
  it("reads sections by the map's numbering", () => {
    expect(readSection("101").levelName).toBe("Plaza Level 100");
    expect(readSection("Section 330").level).toBe("300");
    expect(readSection("wc311").level).toBe("300");
    expect(readSection("123").known).toBe(false);
    expect(readSection("200").known).toBe(false);
  });
  it("marks the entrances the arena says are not accessible", () => {
    expect(
      ROGERS_ARENA_GATES.filter((g) => !g.accessible).map((g) => g.id),
    ).toEqual(["3", "7"]);
  });
});
