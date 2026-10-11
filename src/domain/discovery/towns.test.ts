import { describe, expect, it } from "vitest";
import { DISCOVERY_TOWNS, TOWN_GROUPS, homeArea, townById } from "./towns";
import { OCTOBER_PLACES } from "@/domain/environment/places";

/**
 * **Vancouver was unreachable, and the page said so without meaning to.**
 *
 * Measured on production on 2026-10-11: every town in the picker was an
 * Okanagan one, so a reader in Vancouver could not say where they were; the
 * page then suppressed the thirty-four Metro Vancouver subjects as
 * *elsewhere* and told them they were looking at "2,189 ideas in Okanagan".
 *
 * Metro Vancouver is a launch region, not a future phase. These pin the two
 * things that were in the way.
 */
describe("somewhere to say you are", () => {
  it("offers Metro Vancouver's municipalities, not only the valley", () => {
    const names = DISCOVERY_TOWNS.map((t) => t.name);
    for (const city of [
      "Vancouver, BC",
      "Burnaby, BC",
      "Richmond, BC",
      "Surrey, BC",
      "North Vancouver, BC",
    ]) {
      expect(names).toContain(city);
    }
  });

  it("keeps every October town, by the same id", () => {
    // `?at=vernon` is in people's history and in saved explorations.
    for (const place of OCTOBER_PLACES) {
      const town = townById(place.id);
      expect(town, place.id).toBeTruthy();
      expect(town!.latitude).toBe(place.latitude);
      expect(town!.longitude).toBe(place.longitude);
    }
  });

  it("groups them, because the two regions are four hours apart", () => {
    expect(TOWN_GROUPS.map((g) => g.area)).toEqual([
      "Okanagan",
      "Metro Vancouver",
    ]);
  });

  it("never guesses at an id it does not hold", () => {
    expect(townById("atlantis")).toBeUndefined();
    expect(townById(undefined)).toBeUndefined();
  });

  it("holds coordinates inside British Columbia, at town-centre precision", () => {
    for (const town of DISCOVERY_TOWNS) {
      expect(town.latitude).toBeGreaterThan(48);
      expect(town.latitude).toBeLessThan(55);
      expect(town.longitude).toBeGreaterThan(-124);
      expect(town.longitude).toBeLessThan(-115);
    }
  });
});

describe("which area the page is about", () => {
  it("is the reader's, once they have said where they are", () => {
    expect(homeArea("vancouver", "Okanagan")).toBe("Metro Vancouver");
    expect(homeArea("burnaby", "Okanagan")).toBe("Metro Vancouver");
    expect(homeArea("vernon", "Okanagan")).toBe("Okanagan");
  });

  it("falls back to the corpus only when nobody has said", () => {
    // A fact about Atlas, which was being used as though it were a fact about
    // the person reading.
    expect(homeArea(undefined, "Okanagan")).toBe("Okanagan");
    expect(homeArea(undefined, undefined)).toBeUndefined();
  });

  it("is not decided by an id Passport does not hold", () => {
    expect(homeArea("atlantis", "Okanagan")).toBe("Okanagan");
  });
});
