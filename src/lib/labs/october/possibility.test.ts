import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { CATALOGUE } from "@/lib/movies/catalogue";
import { MAKING } from "@/lib/making/catalogue";
import {
  availabilityForAtlas,
  clockLabel,
  possibilityFromAtlas,
  possibilityFromDoing,
  possibilityFromFilm,
} from "./possibility";

/**
 * **The claim under test is that a person can read "when" without being told
 * "what kind of record".**
 *
 * So these are mostly about the temporal label, which is the one piece of
 * presentation every one of the three experiments depends on being right. The
 * rest check that flattening three very different bodies of evidence into one
 * shape did not quietly invent anything on the way through.
 */

const atlas = (over: Partial<Experience> = {}): Experience =>
  ({
    id: "e1",
    kind: "Event",
    slug: "e1",
    title: "Field of Screams",
    shortDescription: "",
    isActive: true,
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    ...over,
  }) as Experience;

describe("when, said the same way for everything", () => {
  it("names the weekday and the clock when a publisher stated both", () => {
    const a = availabilityForAtlas(
      atlas({ startTime: "2026-10-03T02:00:00Z", timePrecision: "minute" }),
      ["2026-10-02"],
      "2026-10-02",
    );
    expect(a.shape).toBe("fixed");
    expect(a.label).toBe("FRI · 7 PM");
    expect(a.tonight).toBe(true);
  });

  it("never prints a clock a publisher did not state", () => {
    const a = availabilityForAtlas(
      atlas({ startTime: "2026-10-03T00:00:00Z", timePrecision: "day" }),
      ["2026-10-03"],
      "2026-10-01",
    );
    expect(a.label).toBe("SAT OCT 3");
    expect(a.label).not.toMatch(/\d\s?(AM|PM)/);
    // And no hour is carried either — a date-only event read as an hour lands
    // at five in the afternoon the day before.
    expect(a.hour).toBeUndefined();
  });

  it("reads a run as its span", () => {
    const days = Array.from(
      { length: 31 },
      (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
    );
    const a = availabilityForAtlas(atlas(), days, "2026-10-05");
    expect(a.shape).toBe("window");
    expect(a.label).toBe("OCT 1–31");
    expect(a.tonight).toBe(true);
  });

  it("says nobody stated dates rather than guessing anytime", () => {
    const a = availabilityForAtlas(atlas(), [], "2026-10-05");
    expect(a.shape).toBe("unstated");
    expect(a.label).toBe("DATES NOT STATED");
    // Unknown is not yes. A surface asking for tonight must not get a maybe.
    expect(a.tonight).toBe(false);
  });

  it("writes a clock without stray periods or invisible spaces", () => {
    const label = clockLabel("2026-10-03T21:30:00Z");
    expect(label).toBe("2:30 PM");
    expect(label).not.toMatch(/[.  ]/);
  });
});

describe("three bodies of evidence, one shape", () => {
  it("makes a film available every night, for its runtime", () => {
    const film = CATALOGUE.find((f) => f.trailerId)!;
    const p = possibilityFromFilm(film);
    expect(p.availability.shape).toBe("anytime");
    expect(p.availability.tonight).toBe(true);
    // Hours and minutes, or just minutes — the catalogue holds a 25-minute
    // Charlie Brown special as well as two-hour films.
    expect(p.availability.label).toMatch(/^ANY NIGHT · (\d+H( \d+M)?|\d+M)$/);
    expect(p.keepAs).toBe("Movie");
    expect(p.image?.src).toContain(film.trailerId!);
  });

  it("gives a costume a deadline and a pumpkin any night", () => {
    const costume = MAKING.find((d) => d.shelf === "be-something")!;
    const pumpkin = MAKING.find((d) => d.shelf === "pumpkin-night")!;
    expect(possibilityFromDoing(costume).availability.label).toBe(
      "BEFORE HALLOWEEN",
    );
    expect(possibilityFromDoing(costume).availability.needsPlanning).toBe(true);
    expect(possibilityFromDoing(pumpkin).availability.shape).toBe("anytime");
  });

  it("carries a Doing's own photograph with its credit, or no image", () => {
    for (const doing of MAKING) {
      const p = possibilityFromDoing(doing);
      if (doing.image) {
        expect(p.image?.credit).toContain(doing.image.credit);
      } else {
        expect(p.image).toBeUndefined();
      }
    }
  });

  it("invents nothing for an Atlas subject that states nothing", () => {
    const p = possibilityFromAtlas(atlas({ description: undefined }), {
      days: [],
      setting: "unknown",
      today: "2026-10-01",
    });
    expect(p.line).toBeUndefined();
    expect(p.locality).toBeUndefined();
    expect(p.image).toBeUndefined();
    expect(p.scare).toBeUndefined();
    expect(p.setting).toBe("unknown");
  });

  it("keeps every source addressable by the table that stores it", () => {
    expect(possibilityFromFilm(CATALOGUE[0]).keepAs).toBe("Movie");
    expect(possibilityFromDoing(MAKING[0]).keepAs).toBe("Doing");
    expect(
      possibilityFromAtlas(atlas({ kind: "Experience" }), {
        days: [],
        setting: "unknown",
        today: "2026-10-01",
      }).keepAs,
    ).toBe("Experience");
  });

  it("indexes what is written, not only the title", () => {
    const p = possibilityFromAtlas(
      atlas({ description: "A pumpkin patch and a corn maze." }),
      { days: [], setting: "outdoor-day", today: "2026-10-01" },
    );
    expect(p.text).toContain("pumpkin");
    expect(p.title.toLowerCase()).not.toContain("pumpkin");
  });
});

describe("a run that crosses years", () => {
  it("says the years, rather than reading as a bug", () => {
    // Atlas holds Halloween Trick or Treat Trail as one span from 2023 to
    // 2026. Without the years this printed "OCT 31–OCT 31".
    const a = availabilityForAtlas(
      atlas(),
      ["2023-10-31", "2024-10-31", "2025-10-31", "2026-10-31"],
      "2026-10-01",
    );
    expect(a.label).toBe("OCT 31 2023–OCT 31 2026");
  });

  it("leaves an ordinary October run alone", () => {
    const a = availabilityForAtlas(
      atlas(),
      ["2026-10-01", "2026-10-10", "2026-10-25"],
      "2026-10-01",
    );
    expect(a.label).toBe("OCT 1–25");
  });
});
