import { describe, expect, it } from "vitest";
import {
  CATALOGUE,
  fearLevelsFor,
  FEAR_ORDER,
  shortlist,
  suitableFor,
  type Film,
} from "./catalogue";

/**
 * **The two axes are independent, and the catalogue is the proof.**
 *
 * These are the tests that stop somebody "simplifying" audience and fear into
 * one number, which is the single mistake that would make Movie Night unusable
 * for a five-year-old or insulting to an adult.
 */
describe("suitability and fear are separate", () => {
  it("has a film a child may watch that is genuinely creepy", () => {
    const coraline = CATALOGUE.find((f) => f.id === "coraline")!;
    expect(coraline.audience).toBe("kids");
    expect(coraline.fear).toBe("creepy");
  });

  it("has a higher-certificate film that is not scary at all", () => {
    const addams = CATALOGUE.find((f) => f.id === "addams-family")!;
    expect(addams.certification.code).toBe("PG-13");
    expect(addams.fear).toBe("cozy");
  });

  it("cannot be predicted one from the other", () => {
    // If fear were a function of audience, every audience would map to one
    // fear. Each of the three spans at least two.
    for (const audience of ["kids", "teens", "adults"] as const) {
      const fears = new Set(
        CATALOGUE.filter((f) => f.audience === audience).map((f) => f.fear),
      );
      expect(fears.size).toBeGreaterThan(1);
    }
  });

  it("names the board rather than implying a rating is universal", () => {
    for (const film of CATALOGUE) {
      expect(film.certification.system).toBe("MPA");
      expect(film.certification.code.length).toBeGreaterThan(0);
    }
  });
});

describe("filtering for the room", () => {
  it("never shows an adults film when there are kids here", () => {
    const forKids = suitableFor("kids");
    expect(forKids.length).toBeGreaterThan(0);
    expect(forKids.every((f) => f.audience === "kids")).toBe(true);
  });

  it("lets adults watch anything, including the gentle ones", () => {
    const forAdults = suitableFor("adults");
    expect(forAdults).toHaveLength(CATALOGUE.length);
  });

  it("offers a child's room the fear levels the catalogue can fill", () => {
    const levels = fearLevelsFor("kids");
    // Creepy is offered — Coraline exists. Nightmare is not, because we hold
    // no such film for that room, which is "we have nothing", not a claim
    // about children.
    expect(levels).toContain("creepy");
    expect(levels).not.toContain("nightmare");
  });

  it("offers adults every level", () => {
    expect(fearLevelsFor("adults")).toEqual(FEAR_ORDER);
  });
});

describe("the shortlist", () => {
  it("is three, not twenty", () => {
    expect(shortlist("adults", "nightmare")).toHaveLength(3);
  });

  it("is deterministic for the same evening", () => {
    expect(shortlist("teens", "creepy", { seed: 1 })).toEqual(
      shortlist("teens", "creepy", { seed: 1 }),
    );
  });

  it("moves on when they say none of these", () => {
    const first = shortlist("adults", "nightmare", { seed: 0 });
    const next = shortlist("adults", "nightmare", { seed: 3 });
    expect(next.map((f) => f.id)).not.toEqual(first.map((f) => f.id));
  });

  it("never returns a film outside the room", () => {
    for (const film of shortlist("kids", "creepy")) {
      expect(film.audience).toBe("kids");
    }
  });

  it("skips films they have already told us about", () => {
    const all = CATALOGUE.filter(
      (f: Film) => f.audience === "adults" && f.fear === "nightmare",
    );
    const exclude = new Set(all.slice(0, 2).map((f) => f.id));
    for (const film of shortlist("adults", "nightmare", { exclude })) {
      expect(exclude.has(film.id)).toBe(false);
    }
  });
});
