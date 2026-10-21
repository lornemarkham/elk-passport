import { describe, expect, it } from "vitest";
import {
  ADVENTURE_KINDS,
  adventureKind,
  KIND_PATTERN,
  kindLabel,
} from "./kinds";

describe("adventure kinds", () => {
  it("cover the kinds the foundation was asked to carry", () => {
    expect(ADVENTURE_KINDS.map((k) => k.id)).toEqual([
      "hockey-night",
      "conference",
      "day",
      "birthday",
      "weekend",
    ]);
  });

  it("every declared id satisfies the database CHECK, and ids are unique", () => {
    for (const kind of ADVENTURE_KINDS)
      expect(KIND_PATTERN.test(kind.id)).toBe(true);
    expect(new Set(ADVENTURE_KINDS.map((k) => k.id)).size).toBe(
      ADVENTURE_KINDS.length,
    );
  });

  it("a conference lists people only if they choose; a night out lists them", () => {
    expect(adventureKind("conference")?.joinVisibility).toBe("hidden");
    expect(adventureKind("hockey-night")?.joinVisibility).toBe("members");
  });

  it("names a kind it does not know rather than refusing to render it", () => {
    expect(kindLabel("hockey-night")).toBe("Hockey Night");
    expect(kindLabel("ski-day")).toBe("Adventure");
  });
});
