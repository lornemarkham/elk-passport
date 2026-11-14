import { describe, expect, it } from "vitest";
import { directionsTo } from "./PlaceHero";
import { toPhraseList } from "./content";

describe("getting to a place (mission 845)", () => {
  it("goes to the stated point when Atlas holds one", () => {
    expect(
      directionsTo("Knox Mountain Park", undefined, {
        type: "Point",
        coordinates: [-119.459, 49.915],
      }),
    ).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=49.915,-119.459",
    );
  });

  it("goes to the name and address without a point", () => {
    expect(directionsTo("Big White", "5315 Big White Road", undefined)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Big%20White%2C%205315%20Big%20White%20Road",
    );
  });

  it("makes no link from nothing", () => {
    expect(directionsTo("Somewhere", undefined, undefined)).toBeUndefined();
  });
});

describe("saying a list of activities", () => {
  it("says each once, whatever Atlas's capitals", () => {
    expect(toPhraseList(["Hiking", "hiking", "Biking"])).toBe(
      "hiking and biking",
    );
  });
});
