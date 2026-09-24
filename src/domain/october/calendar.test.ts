import { describe, expect, it } from "vitest";
import {
  happeningThisWeekend,
  happeningTonight,
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
