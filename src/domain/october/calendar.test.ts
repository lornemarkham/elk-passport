import { describe, expect, it } from "vitest";
import {
  happeningThisWeekend,
  happeningTonight,
  happeningWithin,
  localDay,
  upcoming,
  weekendDays,
} from "./calendar";
import type { Experience } from "@/domain/experience/types";

const event = (id: string, startTime?: string, endTime?: string): Experience =>
  ({
    id,
    kind: "Event",
    slug: id,
    title: id,
    shortDescription: "",
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 3,
    priceLevel: 1,
    duration: { min: 60, max: 120 },
    startTime,
    endTime,
  }) as unknown as Experience;

/** Okanagan is UTC−7 in September, so 03:00Z is the previous evening there. */
describe("localDay", () => {
  it("reads an instant in the region's own zone, not the viewer's", () => {
    expect(localDay("2026-09-24T03:00:00Z")).toBe("2026-09-23");
    expect(localDay("2026-09-24T19:00:00Z")).toBe("2026-09-24");
  });

  it("has nothing to say about a broken date", () => {
    expect(localDay("not a date")).toBe("");
  });
});

describe("weekendDays", () => {
  it("from midweek, looks forward to Friday through Sunday", () => {
    // Wednesday 2026-09-23, mid-afternoon in the Okanagan.
    expect(weekendDays(new Date("2026-09-23T20:00:00Z"))).toEqual([
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("on a Saturday, the weekend is what is left of it", () => {
    expect(weekendDays(new Date("2026-09-26T20:00:00Z"))).toEqual([
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("on a Sunday, the weekend is today and does not run into next week", () => {
    expect(weekendDays(new Date("2026-09-27T20:00:00Z"))).toEqual([
      "2026-09-27",
    ]);
  });

  it("survives the daylight saving transition without losing or repeating a day", () => {
    // Clocks go back on 2026-11-01 in America/Vancouver.
    const days = weekendDays(new Date("2026-10-29T19:00:00Z"));
    expect(days).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(new Set(days).size).toBe(days.length);
  });
});

describe("happeningTonight", () => {
  const now = new Date("2026-09-23T20:00:00Z"); // 1pm Wednesday, Okanagan

  it("takes only things on today, soonest first", () => {
    const out = happeningTonight(
      [
        event("later-tonight", "2026-09-24T02:00:00Z"),
        event("tomorrow", "2026-09-25T02:00:00Z"),
        event("this-evening", "2026-09-24T01:00:00Z"),
      ],
      now,
    );
    expect(out.map((e) => e.id)).toEqual(["this-evening", "later-tonight"]);
  });

  it("drops what has already finished", () => {
    const out = happeningTonight(
      [event("this-morning", "2026-09-23T15:00:00Z", "2026-09-23T17:00:00Z")],
      now,
    );
    expect(out).toEqual([]);
  });

  it("ignores undated things entirely — a farm is not an event", () => {
    expect(happeningTonight([event("a-farm", undefined)], now)).toEqual([]);
  });

  it("is empty when nothing is on, rather than reaching further out", () => {
    expect(
      happeningTonight([event("next-month", "2026-10-20T02:00:00Z")], now),
    ).toEqual([]);
  });
});

describe("happeningThisWeekend", () => {
  const now = new Date("2026-09-23T20:00:00Z");

  it("takes the coming Friday to Sunday", () => {
    const out = happeningThisWeekend(
      [
        event("saturday", "2026-09-27T01:00:00Z"),
        event("next-week", "2026-10-02T01:00:00Z"),
        event("friday", "2026-09-26T01:00:00Z"),
      ],
      now,
    );
    expect(out.map((e) => e.id)).toEqual(["friday", "saturday"]);
  });

  it("leaves tonight to Tonight, so nothing appears in two places", () => {
    const out = happeningThisWeekend(
      [event("tonight", "2026-09-24T02:00:00Z")],
      now,
    );
    expect(out).toEqual([]);
  });
});

describe("upcoming", () => {
  it("is everything still ahead, soonest first", () => {
    const now = new Date("2026-09-23T20:00:00Z");
    const out = upcoming(
      [
        event("november", "2026-11-13T03:30:00Z"),
        event("gone", "2026-09-01T03:30:00Z"),
        event("october", "2026-10-03T17:00:00Z"),
      ],
      now,
    );
    expect(out.map((e) => e.id)).toEqual(["october", "november"]);
  });
});

/**
 * **A window used to be able to see only Events.**
 *
 * The two shapes Atlas actually serves, so the lanes are tested against the
 * evidence the corpus holds rather than against a convenient one:
 *
 * - the Black Mountain Haunted House's Evening Haunt — eight October 2026
 *   nights, named by a source, expanded by Atlas
 * - Caravan's *The Fall of the House of Usher* — Tuesday-to-Sunday showtimes on
 *   a page that prints no year, so Atlas names weekdays and no day at all
 */
const claimBearing = (
  id: string,
  availability: Experience["availability"],
): Experience =>
  ({
    id,
    kind: "Experience",
    slug: id,
    title: id,
    shortDescription: "",
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 3,
    priceLevel: 1,
    duration: { min: 60, max: 120 },
    availability,
  }) as unknown as Experience;

const EVENING_HAUNT = claimBearing("Evening Haunt", {
  basis: "stated-days",
  days: [
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
    "2026-10-30",
    "2026-10-31",
  ],
  unresolved: "time 18:00 is not in the passage",
});

const FAMILY_FUN = claimBearing("Family Fun Hours", {
  basis: "stated-days",
  days: [
    "2026-10-17",
    "2026-10-18",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
    "2026-10-31",
  ],
});

const USHER = claimBearing("The Fall of the House of Usher", {
  basis: "weekly-pattern",
  weekdays: [2, 3, 4, 5, 6, 7],
  timesOfDay: ["14:00", "16:00", "17:00", "19:00"],
  unresolved:
    "a opening-hours claim names no calendar days, so it cannot answer whether a given date is covered",
});

const A_PARK = claimBearing("A park", { basis: "unstated" });

const ALL = [EVENING_HAUNT, FAMILY_FUN, USHER, A_PARK];
const titles = (list: readonly Experience[]) => list.map((e) => e.title);

/** Saturday 17 October 2026, 18:00 in the Okanagan. */
const SATURDAY_THE_17TH = new Date("2026-10-18T01:00:00Z");

describe("a subject whose days a source named", () => {
  it("is on tonight when tonight is one of its days", () => {
    expect(localDay(SATURDAY_THE_17TH)).toBe("2026-10-17");
    expect(titles(happeningTonight(ALL, SATURDAY_THE_17TH))).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
  });

  it("is not on a day its source did not name", () => {
    // Monday 19 October: the haunt states eight nights and this is not one.
    const monday = new Date("2026-10-20T01:00:00Z");
    expect(localDay(monday)).toBe("2026-10-19");
    expect(titles(happeningTonight(ALL, monday))).toEqual([]);
    // Nor in July, which is the case a windowed feed used to get wrong.
    expect(
      titles(happeningTonight(ALL, new Date("2026-07-05T01:00:00Z"))),
    ).toEqual([]);
  });

  it("appears in the weekend it states, and today belongs to Tonight", () => {
    // Thursday 22 October looks forward to the 23rd, 24th and 25th.
    const thursday = new Date("2026-10-23T01:00:00Z");
    expect(titles(happeningThisWeekend(ALL, thursday))).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
    // On the Saturday itself, the 17th is Tonight's and the weekend is the 18th.
    expect(titles(happeningThisWeekend(ALL, SATURDAY_THE_17TH))).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
  });

  it("is upcoming while any of its days is still ahead, and not after the last one", () => {
    expect(titles(upcoming(ALL, new Date("2026-09-28T01:00:00Z")))).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
    expect(titles(upcoming(ALL, new Date("2026-11-02T01:00:00Z")))).toEqual([]);
  });

  it("appears in a whole-October window, once", () => {
    expect(titles(happeningWithin(ALL, "2026-10-01", "2026-10-31"))).toEqual([
      "Evening Haunt",
      "Family Fun Hours",
    ]);
    expect(titles(happeningWithin(ALL, "2026-11-01", "2026-11-30"))).toEqual(
      [],
    );
  });

  it("distinguishes the two modes by the days each one states", () => {
    // Opening night is an Evening Haunt night with no afternoon hours, and the
    // model says so rather than assuming the attraction is simply "open".
    const openingNight = new Date("2026-10-17T01:00:00Z");
    expect(localDay(openingNight)).toBe("2026-10-16");
    expect(titles(happeningTonight(ALL, openingNight))).toEqual([
      "Evening Haunt",
    ]);
  });
});

describe("a subject whose source stated a pattern and no year", () => {
  it("is never placed on a particular day", () => {
    for (const now of [
      SATURDAY_THE_17TH,
      new Date("2026-10-20T01:00:00Z"),
      new Date("2026-10-23T01:00:00Z"),
    ]) {
      expect(titles(happeningTonight(ALL, now))).not.toContain(USHER.title);
      expect(titles(happeningThisWeekend(ALL, now))).not.toContain(USHER.title);
      expect(titles(upcoming(ALL, now))).not.toContain(USHER.title);
    }
    expect(
      titles(happeningWithin(ALL, "2026-10-01", "2026-10-31")),
    ).not.toContain(USHER.title);
  });

  it("keeps the weekdays and times Atlas read, and no Monday among them", () => {
    expect(USHER.availability?.weekdays).not.toContain(1);
    expect(USHER.availability?.days).toBeUndefined();
    expect(USHER.startTime).toBeUndefined();
    expect(USHER.endTime).toBeUndefined();
  });
});

describe("a subject Atlas knows nothing temporal about", () => {
  it("is never on tonight, this weekend, or upcoming — and that is not a closure", () => {
    expect(titles(happeningTonight(ALL, SATURDAY_THE_17TH))).not.toContain(
      "A park",
    );
    expect(titles(happeningThisWeekend(ALL, SATURDAY_THE_17TH))).not.toContain(
      "A park",
    );
    expect(titles(upcoming(ALL, SATURDAY_THE_17TH))).not.toContain("A park");
    // It is still a candidate Atlas serves, with its silence stated as such.
    expect(A_PARK.availability?.basis).toBe("unstated");
  });
});

describe("Events keep the behaviour they had", () => {
  const festival = event(
    "A festival",
    "2026-10-17T02:00:00Z",
    "2026-10-17T05:00:00Z",
  );
  const later = event("Later", "2026-10-24T02:00:00Z", "2026-10-24T05:00:00Z");
  const mixed = [festival, later, ...ALL];

  it("still reads its own instants, and Events come first in a lane", () => {
    // 03:00Z is 20:00 on the 16th in the Okanagan — opening night, which is an
    // Evening Haunt night and has no afternoon hours.
    const openingNight = new Date("2026-10-17T03:00:00Z");
    expect(localDay(openingNight)).toBe("2026-10-16");
    expect(titles(happeningTonight(mixed, openingNight))).toEqual([
      "A festival",
      "Evening Haunt",
    ]);
  });

  it("still drops out of Tonight once it has finished", () => {
    expect(
      titles(happeningTonight([festival], new Date("2026-10-17T06:00:00Z"))),
    ).toEqual([]);
  });

  it("intersects a window with its whole interval, not only its first day", () => {
    const run = event(
      "A long run",
      "2026-09-30T02:00:00Z",
      "2026-11-03T05:00:00Z",
    );
    expect(titles(happeningWithin([run], "2026-10-01", "2026-10-31"))).toEqual([
      "A long run",
    ]);
  });
});
