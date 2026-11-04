import { describe, expect, it } from "vitest";
import { driveOf, nightMoods } from "./soundtrack";

describe("Date Night's music", () => {
  it("is a romantic drive and the sunset on any night", () => {
    expect(nightMoods(new Set(), 10)).toEqual(["romantic-drive", "sunset"]);
  });

  it("goes up the backroads for a grouse hunt, with time to sing", () => {
    expect(nightMoods(new Set(["hunt", "lake", "fire"]), 80)).toEqual([
      "romantic-drive",
      "country-backroads",
      "mountain",
      "sunset",
      "road-trip",
    ]);
  });

  it("adds every drive in the plan", () => {
    expect(driveOf([{ travel: 40 }, { travel: 10 }, { travel: 0 }])).toBe(50);
    expect(driveOf([])).toBe(0);
  });
});
