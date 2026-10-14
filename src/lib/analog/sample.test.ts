import { describe, expect, it } from "vitest";
import { SAMPLE_POOL, sampleAdventure } from "./sample";

describe("sampleAdventure", () => {
  const sample = sampleAdventure();

  it("is marked as a sample", () => {
    expect(sample.sample).toBe(true);
  });

  it("is built only from the sample pool, by the real planner", () => {
    const ids = new Set(SAMPLE_POOL.map((c) => c.id));
    expect(sample.stops.length).toBeGreaterThanOrEqual(2);
    for (const stop of sample.stops) expect(ids.has(stop.id)).toBe(true);
  });

  it("reads the sentence the way /go does", () => {
    expect(sample.time.statedHours).toBe(5);
    expect(sample.budget.statedBudget).toBe(80);
    expect(sample.childAge).toBe(7);
  });

  it("claims no distance, opening hours or price it does not have", () => {
    for (const stop of sample.stops) {
      expect(stop.km).toBeUndefined();
      expect(stop.open).toBeUndefined();
      expect(stop.cost).toBeUndefined();
    }
    expect(sample.time.measuredKm).toBeUndefined();
    expect(sample.budget.published).toEqual([]);
  });

  it("carries no coordinates that would print as a measurement", () => {
    for (const c of SAMPLE_POOL) {
      expect(c.geography?.coordinates).toBeUndefined();
    }
  });

  it("still gives every stop a way to find it", () => {
    for (const stop of sample.stops) {
      expect(stop.directions).toMatch(/^https:\/\/www\.google\.com\/maps/);
    }
  });

  it("has something to do, something to check, and somewhere to write", () => {
    expect(sample.prep.some((i) => i.basis === "check")).toBe(true);
    expect(sample.sideQuests.length).toBeGreaterThan(0);
    expect(sample.memoryPrompts.length).toBeGreaterThan(0);
  });
});
