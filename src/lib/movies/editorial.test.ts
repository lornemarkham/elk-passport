import { describe, expect, it } from "vitest";
import { CATALOGUE, filmById } from "./catalogue";
import {
  ANGLES,
  ANGLE_ORDER,
  OCTOBER_PICKS,
  angleOf,
  filmsOnShelf,
} from "./editorial";

/**
 * **The catalogue has to have taste, and taste is checkable in a few ways.**
 *
 * Not whether the opinions are *right* — that is Lorne's to judge. But a
 * catalogue that claims a point of view can be held to some things: every film
 * placed on a shelf, the picks pointing at real films, and the set not being
 * the first page of a search for "halloween movies", which is what it was.
 */
describe("every film has an angle", () => {
  it("places all of them, so no card renders a missing badge", () => {
    const unplaced = CATALOGUE.filter((f) => !angleOf(f.id));
    expect(unplaced.map((f) => f.id)).toEqual([]);
  });

  it("uses only angles the voice table knows", () => {
    for (const film of CATALOGUE) {
      expect(ANGLE_ORDER).toContain(angleOf(film.id));
    }
  });

  it("fills every shelf — an empty heading is a broken promise", () => {
    for (const angle of ANGLE_ORDER) {
      expect(filmsOnShelf(angle).length, angle).toBeGreaterThan(0);
    }
  });

  it("leads with the strange shelves, not the canon", () => {
    // The whole argument of the page: a search can give somebody the canon.
    expect(ANGLE_ORDER[0]).toBe("what-the-hell");
    expect(ANGLE_ORDER[ANGLE_ORDER.length - 1]).toBe("october-classic");
  });

  it("gives every angle a heading and a line", () => {
    for (const angle of ANGLE_ORDER) {
      expect(ANGLES[angle].label.length).toBeGreaterThan(0);
      expect(ANGLES[angle].heading.length).toBeGreaterThan(0);
      expect(ANGLES[angle].line.length).toBeGreaterThan(0);
    }
  });
});

describe("October Picks", () => {
  it("is small, because a recommendation is worth less the more there are", () => {
    expect(OCTOBER_PICKS.length).toBeGreaterThanOrEqual(3);
    expect(OCTOBER_PICKS.length).toBeLessThanOrEqual(5);
  });

  it("points only at films that exist", () => {
    for (const pick of OCTOBER_PICKS) {
      expect(filmById(pick.filmId), pick.filmId).toBeDefined();
    }
  });

  it("demonstrates range rather than five of the same thing", () => {
    const angles = OCTOBER_PICKS.map((p) => angleOf(p.filmId));
    expect(new Set(angles).size).toBe(OCTOBER_PICKS.length);
  });

  it("gives each one a real paragraph in October's voice", () => {
    for (const pick of OCTOBER_PICKS) {
      expect(pick.note.length, pick.filmId).toBeGreaterThan(120);
    }
  });
});

describe("the catalogue is no longer a search result", () => {
  it("holds films from outside the United States", () => {
    const origins = new Set(
      CATALOGUE.map((f) => f.origin).filter(Boolean) as string[],
    );
    expect(origins.has("Canada")).toBe(true);
    expect(origins.size).toBeGreaterThanOrEqual(4);
  });

  it("holds a real Canadian shelf, for a product built in the Okanagan", () => {
    const canadian = CATALOGUE.filter((f) => f.origin === "Canada");
    expect(canadian.length).toBeGreaterThanOrEqual(4);
  });

  it("is mostly not the canon", () => {
    const canon = filmsOnShelf("october-classic").length;
    expect(canon).toBeLessThan(CATALOGUE.length / 2);
  });

  it("spans five decades", () => {
    const decades = new Set(CATALOGUE.map((f) => Math.floor(f.year / 10)));
    expect(decades.size).toBeGreaterThanOrEqual(5);
  });
});

describe("trailers are verified, never guessed", () => {
  it("gives almost every film a trailer id", () => {
    const withTrailer = CATALOGUE.filter((f) => f.trailerId);
    expect(withTrailer.length).toBeGreaterThan(CATALOGUE.length * 0.9);
  });

  it("holds only well-formed YouTube ids", () => {
    for (const film of CATALOGUE) {
      if (!film.trailerId) continue;
      expect(film.trailerId, film.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });

  it("never reuses one id for two films", () => {
    const ids = CATALOGUE.map((f) => f.trailerId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
