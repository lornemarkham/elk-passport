import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateOccurrence } from "@/lib/data/types";
import {
  hasPattern,
  recurrenceLine,
  ruledOutOn,
  weekdayOf,
} from "./recurrence";

/**
 * **A run is not a recurrence.**
 *
 * **Osoyoos Farmers' Market 2026 Season** holds a 161-day interval and
 * `weekdays: ["saturday"]`. Reading only the interval put it under *Happening
 * today* on a Tuesday — and on the Wednesday, and the Thursday. It is open 23
 * days out of 161, and Passport claimed all 161.
 *
 * Every fixture is a real production `candidate-occurrence/2` block.
 */

const dated = (title: string, occurrence?: CandidateOccurrence): Experience =>
  ({
    id: title,
    title,
    kind: "Event",
    ...(occurrence ? { occurrence } : {}),
  }) as Experience;

const MARKET = dated("Osoyoos Farmers' Market 2026 Season", {
  reading: "recurring-in-run",
  actionable: true,
  weekdays: ["saturday"],
  because: "161 days, with a weekday pattern stated",
});

const HAUNTED = dated("Black Mountain Haunted House", {
  reading: "recurring-in-run",
  actionable: true,
  weekdays: ["friday", "saturday", "sunday"],
});

const PUPPETS = dated("Halloween Puppet Show", {
  reading: "separate-occurrences",
  actionable: false,
  days: ["2026-10-29", "2026-10-30", "2026-10-31"],
});

/** A schedule and a weekday pattern together. The schedule is the stronger. */
const TRIVIA = dated("Trivia Thursday at the Barley Mill", {
  reading: "recurring-in-run",
  actionable: true,
  weekdays: ["thursday"],
  days: ["2026-10-08", "2026-10-15", "2026-10-22"],
});

/** 349 of the 365 dated candidates look like this. */
const PLAIN = dated("A concert", { reading: "occurrence", actionable: true });
const NO_CONTRACT = dated("Something older");

describe("which day a date falls on", () => {
  it("reads the weekday at noon, not at midnight", () => {
    // 2026-10-10 is a Saturday in Vancouver. Parsed as UTC midnight it is
    // Friday evening there, which is how a Saturday market gets advertised on
    // a Friday.
    expect(weekdayOf("2026-10-10")).toBe("saturday");
    expect(weekdayOf("2026-10-13")).toBe("tuesday");
  });

  it("says nothing about a date it cannot read", () => {
    expect(weekdayOf("not-a-day")).toBeUndefined();
  });
});

describe("whether a stated pattern rules today out", () => {
  it("keeps the Saturday market on a Saturday", () => {
    expect(ruledOutOn(MARKET, "2026-10-10")).toBe(false);
  });

  it("takes it off every other day of its 161", () => {
    for (const weekday of ["2026-10-12", "2026-10-13", "2026-10-14"]) {
      expect(ruledOutOn(MARKET, weekday)).toBe(true);
    }
  });

  it("handles a pattern of several weekdays", () => {
    expect(ruledOutOn(HAUNTED, "2026-10-16")).toBe(false); // Friday
    expect(ruledOutOn(HAUNTED, "2026-10-18")).toBe(false); // Sunday
    expect(ruledOutOn(HAUNTED, "2026-10-19")).toBe(true); // Monday
  });

  it("prefers an explicit schedule over a weekday pattern", () => {
    // Trivia states Thursdays *and* lists its open days. The list is what
    // Atlas actually knows; the pattern is how it reads.
    expect(ruledOutOn(TRIVIA, "2026-10-15")).toBe(false); // listed
    expect(ruledOutOn(TRIVIA, "2026-10-29")).toBe(true); // a Thursday, not listed
  });

  it("rules nothing out where Atlas states no pattern", () => {
    // Silence is not a schedule. 349 of 365 dated candidates rely on this.
    expect(ruledOutOn(PLAIN, "2026-10-13")).toBe(false);
    expect(ruledOutOn(NO_CONTRACT, "2026-10-13")).toBe(false);
  });

  it("rules nothing out on a day it cannot read", () => {
    expect(ruledOutOn(MARKET, "nonsense")).toBe(false);
  });
});

describe("what a card may say about when it recurs", () => {
  it("uses Atlas's own weekday names", () => {
    expect(recurrenceLine(MARKET)).toBe("Saturdays");
    expect(recurrenceLine(HAUNTED)).toBe("Friday, Saturday, Sunday");
  });

  it("counts an explicit schedule rather than listing it", () => {
    expect(recurrenceLine(PUPPETS)).toBe("3 dates");
  });

  it("says nothing where Atlas states no pattern", () => {
    // However much a 161-day interval looks like a season.
    expect(recurrenceLine(PLAIN)).toBeUndefined();
    expect(recurrenceLine(NO_CONTRACT)).toBeUndefined();
    expect(hasPattern(PLAIN)).toBe(false);
    expect(hasPattern(MARKET)).toBe(true);
  });
});
