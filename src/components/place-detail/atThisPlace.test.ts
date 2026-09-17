import { describe, expect, it } from "vitest";
import type { PlaceLocatedHere } from "@/lib/data/types";
import { atThisPlace } from "./atThisPlace";

/**
 * The composition says only what Atlas's `locatedHere` payload carries: an
 * Organization is here because Atlas asserted `located_at`, and it offers an
 * Activity because Atlas holds an `offers` edge to it. Nothing is inferred
 * from a name or a type.
 */

const kalavida: PlaceLocatedHere = {
  id: "kalavida",
  name: "Kalavida Surf Shop",
  organizationType: "surf shop",
  description:
    "A shop offering SUP and kayak rentals at Kalamalka Lake and organizing Wahine Wednesdays, a women's SUP 'n Social paddle night.",
  address: "13908 Kalamalka Rd, Coldstream BC V1B 1Y9, Canada",
  imageUrl: "https://example.test/kalavida.jpg",
  offers: [
    { id: "paddle", kind: "Activity", name: "Paddleboard", subtype: "unknown" },
  ],
};

describe("atThisPlace", () => {
  it("renders an Organization Atlas asserts is located here, with the Activities it holds offers edges for", () => {
    expect(atThisPlace([kalavida])).toEqual([
      {
        id: "kalavida",
        name: "Kalavida Surf Shop",
        description: kalavida.description,
        imageUrl: kalavida.imageUrl,
        offers: ["Paddleboard"],
      },
    ]);
  });

  it("lists no offering when no offers edge is held — a surf shop's name implies nothing", () => {
    expect(atThisPlace([{ ...kalavida, offers: [] }])[0]!.offers).toEqual([]);
  });

  it("ignores an offers entry that is not an Activity", () => {
    const withPlace = {
      ...kalavida,
      offers: [{ id: "x", kind: "Place" as const, name: "Kal Beach" }],
    };
    expect(atThisPlace([withPlace])[0]!.offers).toEqual([]);
  });

  it("adds the Organization's type only when the name does not already say it", () => {
    expect(atThisPlace([kalavida])[0]!.kindLabel).toBeUndefined();
    const clubhouse = {
      ...kalavida,
      id: "lakers",
      name: "Lakers Clubhouse",
      organizationType: "event venue",
    };
    expect(atThisPlace([clubhouse])[0]!.kindLabel).toBe("event venue");
    expect(
      atThisPlace([{ ...clubhouse, organizationType: "unknown" }])[0]!
        .kindLabel,
    ).toBeUndefined();
  });

  it("renders one card per Organization and orders by name, whatever the payload order", () => {
    const b = { ...kalavida, id: "b", name: "Beta" };
    const a = { ...kalavida, id: "a", name: "Alpha" };
    expect(atThisPlace([b, a, b]).map((c) => c.name)).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("renders nothing for an Atlas that sends no locatedHere", () => {
    expect(atThisPlace(undefined)).toEqual([]);
    expect(atThisPlace([])).toEqual([]);
  });
});
