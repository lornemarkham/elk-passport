import { describe, expect, it } from "vitest";
import { CATALOGUE, type Film } from "@/lib/movies/catalogue";
import {
  cardFactsFor,
  commitmentOf,
  factsFor,
  formatRuntime,
} from "./whyWatch";

/**
 * **Every word on a film card traces back to a field somebody authored.**
 *
 * The risk this file exists for is not a wrong label — it is a *plausible*
 * one. A generated sentence about a film reads exactly like an authored one,
 * and the only way to keep them apart is to prove that nothing here produces
 * prose at all: the one derived value is a bucket of `runtimeMinutes`, and
 * everything else is a restatement or a verbatim copy.
 */
const film = (over: Partial<Film> = {}): Film => ({
  id: "test-film",
  title: "A Film",
  year: 1985,
  runtimeMinutes: 96,
  certification: { system: "MPA", code: "PG" },
  audience: "teens",
  fear: "spooky",
  mechanisms: ["dread"],
  line: "An authored sentence about this film.",
  ...over,
});

describe("formatRuntime", () => {
  it("says short films in minutes", () => {
    expect(formatRuntime(25)).toBe("25 min");
    expect(formatRuntime(59)).toBe("59 min");
  });

  it("says long films in hours and minutes", () => {
    expect(formatRuntime(96)).toBe("1h 36m");
    expect(formatRuntime(146)).toBe("2h 26m");
  });

  it("drops the minutes on the hour", () => {
    expect(formatRuntime(120)).toBe("2h");
  });
});

describe("commitmentOf", () => {
  it("buckets by runtime alone", () => {
    expect(commitmentOf(25)).toBe("Under an hour");
    expect(commitmentOf(96)).toBe("Easy weeknight");
    expect(commitmentOf(110)).toBe("A proper sit-down");
    expect(commitmentOf(146)).toBe("A long one");
  });

  it("is the same answer for the same number, whatever the film", () => {
    // The only derived value on the page, and it must not have picked up a
    // second input by accident.
    const cozyKid = factsFor(
      film({ runtimeMinutes: 96, audience: "kids", fear: "cozy" }),
    );
    const scaryAdult = factsFor(
      film({ runtimeMinutes: 96, audience: "adults", fear: "nightmare" }),
    );
    expect(cozyKid.commitment).toBe(scaryAdult.commitment);
  });
});

describe("factsFor", () => {
  it("copies the authored line verbatim, and invents no other prose", () => {
    const f = factsFor(film({ line: "Exactly this, unchanged." }));
    expect(f.line).toBe("Exactly this, unchanged.");
  });

  it("copies the authored mechanisms verbatim", () => {
    const f = factsFor(film({ mechanisms: ["dread", "the unseen"] }));
    expect(f.mechanisms).toEqual(["dread", "the unseen"]);
  });

  it("names the board on the certification, because they disagree", () => {
    expect(factsFor(film()).certification).toBe("PG · MPA");
  });

  it("never derives fear from the certification", () => {
    // Coraline's real shape: a PG film that is genuinely creepy.
    const coraline = factsFor(
      film({ certification: { system: "MPA", code: "PG" }, fear: "creepy" }),
    );
    // The Addams Family's real shape: PG-13 and cozy.
    const addams = factsFor(
      film({ certification: { system: "MPA", code: "PG-13" }, fear: "cozy" }),
    );
    expect(coraline.fear).toBe("Gets under your skin");
    expect(addams.fear).toBe("Not trying to scare you");
  });

  it("never derives audience from fear", () => {
    const kidsButCreepy = factsFor(film({ audience: "kids", fear: "creepy" }));
    expect(kidsButCreepy.audience).toBe("Fine with kids");
    expect(kidsButCreepy.fear).toBe("Gets under your skin");
  });
});

describe("the real catalogue", () => {
  it("gives every film a complete set of facts", () => {
    for (const f of CATALOGUE) {
      const facts = factsFor(f);
      expect(facts.runtime, f.id).toMatch(/\d/);
      expect(facts.commitment, f.id).not.toBe("");
      expect(facts.fear, f.id).not.toBe("");
      expect(facts.audience, f.id).not.toBe("");
      expect(facts.line, f.id).toBe(f.line);
    }
  });

  it("puts three facts on a card and keeps reference off it", () => {
    const facts = cardFactsFor(CATALOGUE[0]!);
    expect(facts).toHaveLength(3);
    // The certification is evidence for the detail page, not a chip.
    expect(facts.join(" ")).not.toContain("MPA");
  });
});
