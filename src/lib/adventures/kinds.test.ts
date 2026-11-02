import { describe, expect, it } from "vitest";
import {
  ADVENTURE_KINDS,
  adventureHref,
  adventureKind,
  KIND_PATTERN,
  kindLabel,
  PLANNING_KINDS,
  STARTABLE_KINDS,
} from "./kinds";

describe("adventure kinds", () => {
  it("cover the kinds the foundation was asked to carry", () => {
    expect(ADVENTURE_KINDS.map((k) => k.id)).toEqual([
      "hockey-night",
      "conference",
      "day",
      "birthday",
      "weekend",
      "trip",
      "christmas",
      "date-night",
    ]);
  });

  it("opens an adventure at its Experience's home, else the generic page", () => {
    expect(adventureHref("christmas", "abc")).toBe("/christmas/adventure/abc");
    expect(adventureHref("weekend", "abc")).toBe("/adventures/abc");
    expect(adventureHref("ski-day", "a b")).toBe("/adventures/a%20b");
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

  it("Saved plans days, weekends and trips — not games or conferences", () => {
    expect(PLANNING_KINDS).toEqual(["day", "weekend", "trip"]);
    for (const id of PLANNING_KINDS) expect(adventureKind(id)).toBeDefined();
  });

  it("Date Night is made by its own setup, not offered in the start menu", () => {
    expect(adventureKind("date-night")?.label).toBe("Date Night");
    expect(STARTABLE_KINDS.map((k) => k.id)).not.toContain("date-night");
  });

  it("names a kind it does not know rather than refusing to render it", () => {
    expect(kindLabel("hockey-night")).toBe("Hockey Night");
    expect(kindLabel("ski-day")).toBe("Adventure");
  });
});
