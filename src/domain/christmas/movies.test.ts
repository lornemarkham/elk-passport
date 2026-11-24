import { describe, expect, it } from "vitest";
import { FILMS, KINDS, WATCHING, shelf, suits, threeFor } from "./movies";

describe("Christmas movies", () => {
  it("has every shelf the brief names, each with films", () => {
    for (const k of ["family", "comedy", "romance", "classic", "animated"])
      expect(shelf(k as (typeof KINDS)[number]["id"]).length).toBeGreaterThan(
        2,
      );
  });

  it("reuses October's entry for The Nightmare Before Christmas", () => {
    const n = FILMS.find((f) => f.id === "nightmare-before-christmas");
    expect(n?.year).toBe(1993);
    expect(n?.trailerId).toBeTruthy();
  });

  it("states no streaming service, price or showtime anywhere", () => {
    const text = JSON.stringify(FILMS);
    expect(text).not.toMatch(
      /netflix|disney\+|prime video|crave|apple tv|\$\d|showtime/i,
    );
  });

  it("ids are unique and certifications are only MPA codes", () => {
    expect(new Set(FILMS.map((f) => f.id)).size).toBe(FILMS.length);
    for (const f of FILMS)
      if (f.certification)
        expect(["G", "PG", "PG-13", "R"]).toContain(f.certification.code);
  });

  it("never offers an R or PG-13 film to little ones or the whole family", () => {
    for (const who of ["little", "family"] as const)
      for (const f of FILMS.filter((x) => suits(x, who)))
        expect(["PG-13", "R"]).not.toContain(f.certification?.code);
  });

  it("gives three for tonight, moves on, and wraps", () => {
    for (const w of WATCHING) {
      const a = threeFor(w.id, undefined, 0);
      expect(a.films.length).toBe(3);
      const b = threeFor(w.id, undefined, 1);
      expect(b.films.map((f) => f.id)).not.toEqual(a.films.map((f) => f.id));
      // Far rounds still answer.
      expect(threeFor(w.id, undefined, 99).films.length).toBe(3);
    }
    // A date leads with romance.
    expect(
      threeFor("date", undefined).films.every((f) =>
        f.kinds.includes("romance"),
      ),
    ).toBe(true);
    expect(
      threeFor("date", "romance").films.every((f) =>
        f.kinds.includes("romance"),
      ),
    ).toBe(true);
  });
});
