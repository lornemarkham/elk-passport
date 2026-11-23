import { describe, expect, it } from "vitest";
import { TOWNS, TOWN_AT, TOWN_LABEL, inArea } from "./model";
import { nearestTown, parseSubmission } from "./actions";
import { AREAS, areaById, pinInArea, placeLabel, townOf } from "./areas";
import { suggestedDrives } from "./drives";
import { SEED } from "./seed";

/**
 * **Silver Star and Lake Country are towns of the map** (2026-11-23): each
 * has its own chip, centre and zoom, and a pin standing in one is read under
 * it, whatever town it was filed under.
 */
describe("the map's towns", () => {
  it("lists the eight places the owner named, each choosable on the map", () => {
    const onMap = AREAS.filter((a) => a.onMap).map((a) => a.label);
    for (const label of [
      "Vernon",
      "East Hill",
      "Coldstream",
      "Lumby",
      "Silver Star",
      "Armstrong",
      "Lake Country",
      "Kelowna",
    ])
      expect(onMap).toContain(label);
  });

  it("gives every town a label, a centre inside the map's box, and an area", () => {
    for (const t of TOWNS) {
      expect(TOWN_LABEL[t]).toBeTruthy();
      expect(inArea(TOWN_AT[t])).toBe(true);
      expect(areaById(t)?.at).toEqual(TOWN_AT[t]);
    }
  });

  it("files a pin dropped in Silver Star village under Silver Star, not Lumby", () => {
    const village = { lat: 50.3584, lng: -119.0644 };
    // Lumby's centre is nearer than Vernon's or Armstrong's — the old default.
    expect(nearestTown(village)).toBe("silverstar");
    expect(
      parseSubmission({ kind: "public-display", lat: 50.36, lng: -119.06 })
        .town,
    ).toBe("silverstar");
  });

  it("files a pin dropped in Lake Country under Lake Country, not Kelowna", () => {
    expect(nearestTown({ lat: 50.0833, lng: -119.414 })).toBe("lake-country");
    expect(nearestTown({ lat: 50.115, lng: -119.375 })).toBe("lake-country");
    expect(nearestTown({ lat: 49.8801, lng: -119.4436 })).toBe("kelowna");
  });

  it("reads a Silver Star pin filed under Lumby or Vernon as Silver Star", () => {
    for (const town of ["lumby", "vernon"] as const) {
      const pin = { town, at: { lat: 50.3601, lng: -119.0612 } };
      expect(townOf(pin)).toBe("silverstar");
      expect(pinInArea(areaById("silverstar")!, pin)).toBe(true);
      expect(placeLabel({ ...pin, town: townOf(pin) })).toBe("Silver Star");
    }
  });

  it("leaves every other pin under the town it was filed under", () => {
    expect(townOf({ town: "lumby", at: TOWN_AT.lumby })).toBe("lumby");
    expect(townOf({ town: "vernon", at: { lat: 50.2665, lng: -119.27 } })).toBe(
      "vernon",
    );
    // Lavington is Coldstream's although it is far from Coldstream's centre.
    expect(
      townOf({ town: "coldstream", at: { lat: 50.233, lng: -119.108 } }),
    ).toBe("coldstream");
    expect(townOf({ town: "kelowna", at: TOWN_AT.kelowna })).toBe("kelowna");
  });

  it("keeps Silver Star out of Vernon's and Lumby's circles", () => {
    const at = TOWN_AT.silverstar;
    for (const id of ["vernon", "lumby", "armstrong", "coldstream"])
      expect(pinInArea(areaById(id)!, { at, town: "silverstar" })).toBe(false);
  });

  it("puts the researched Silver Star light-up under Silver Star", () => {
    const up = SEED.find((s) => s.id === "seed-silverstar-light-up")!;
    expect(up.town).toBe("silverstar");
    expect(townOf(up)).toBe("silverstar");
  });

  it("offers no drive through lights that don't exist", () => {
    expect(suggestedDrives([], "2026-12-05")).toEqual([]);
  });
});
