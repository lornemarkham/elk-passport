import { describe, expect, it } from "vitest";
import {
  VANCOUVER_PLACES,
  CONVENTION_CENTRE_WEST,
} from "@/domain/collections/vancouver";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { explore, shelfOf } from "./explore";

const candidate = (
  over: Partial<DiscoveryCandidate> & { at?: [number, number]; basis?: string },
): DiscoveryCandidate =>
  ({
    id: over.id ?? "atlas:x",
    kind: over.kind ?? "Place",
    name: over.name ?? "A place",
    subtype: over.subtype,
    description: "A real place. Second sentence.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    heroUrl: over.heroUrl,
    geography: over.at
      ? {
          coordinates: [over.at[1], over.at[0]],
          coordinatesBasis: over.basis ?? "observed",
        }
      : undefined,
  }) as unknown as DiscoveryCandidate;

describe("explore shelves", () => {
  it("puts places where Atlas's own subtype words say", () => {
    expect(shelfOf(candidate({ subtype: "Coffee shop" }))).toBe("coffee");
    expect(shelfOf(candidate({ subtype: "Brew pub" }))).toBe("drinks");
    expect(shelfOf(candidate({ subtype: "Restaurant" }))).toBe("restaurants");
    expect(shelfOf(candidate({ subtype: "Public park" }))).toBe("waterfront");
    expect(shelfOf(candidate({ subtype: "Heritage garden" }))).toBe(
      "waterfront",
    );
    expect(shelfOf(candidate({ subtype: "Amusement park" }))).toBeNull();
    expect(shelfOf(candidate({ subtype: "Museum" }))).toBe("sights");
    expect(
      shelfOf(candidate({ kind: "Activity", subtype: "Kayak tour" })),
    ).toBe("together");
    expect(shelfOf(candidate({ subtype: "Hotel" }))).toBeNull();
  });

  it("measures only observed positions, walks reach further, photographs lead", () => {
    const cc = CONVENTION_CENTRE_WEST.at;
    const out = explore(
      [
        candidate({
          id: "a",
          name: "Near, no photo",
          subtype: "Restaurant",
          at: [cc[0] + 0.002, cc[1]],
        }),
        candidate({
          id: "b",
          name: "Further, photo",
          subtype: "Restaurant",
          at: [cc[0] + 0.01, cc[1]],
          heroUrl: "https://x.test/p.jpg",
        }),
        candidate({
          id: "c",
          name: "Town point",
          subtype: "Restaurant",
          at: [cc[0], cc[1]],
          basis: "derived",
        }),
        candidate({
          id: "d",
          name: "Big park",
          subtype: "Urban park",
          at: [cc[0] + 0.035, cc[1]],
        }),
        candidate({
          id: "e",
          name: "Far cafe",
          subtype: "Cafe",
          at: [cc[0] + 0.035, cc[1]],
        }),
      ],
      VANCOUVER_PLACES,
      cc,
    );
    const names = out.restaurants
      .filter((p) => p.from === "atlas")
      .map((p) => p.name);
    expect(names.slice(0, 2)).toEqual(["Further, photo", "Near, no photo"]);
    expect(names).not.toContain("Town point");
    expect(out.waterfront.map((p) => p.name)).toContain("Big park"); // ~3.9 km
    expect(out.coffee).toEqual([]); // the same distance is too far for a coffee
    // Curated fills in where Atlas has nothing, and says so.
    expect(out.drinks.every((p) => p.from === "curated")).toBe(true);
    expect(out.drinks.length).toBeGreaterThan(0);
  });
});
