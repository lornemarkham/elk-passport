import { describe, expect, it } from "vitest";
import {
  happeningThisWeekend,
  happeningTonight,
  happeningWithin,
  upcoming,
} from "./calendar";
import type { Experience } from "@/domain/experience/types";

/**
 * **The buckets, against the instants Atlas actually holds.**
 *
 * Every fixture below is a real October 2026 candidate, copied from
 * `GET /discovery/candidates` — instant and precision both. The point is that a
 * date-only Event lands on the day its publisher stated, and that nothing about
 * a stated clock or an unknown precision moved.
 */

const event = (
  title: string,
  startTime: string,
  endTime: string,
  timePrecision?: "day" | "minute",
): Experience =>
  ({
    id: title,
    kind: "Event",
    slug: title,
    title,
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
    timePrecision,
  }) as unknown as Experience;

// --- real Atlas records -----------------------------------------------------
const HORRORFEST = event(
  "HorrorFest XVII",
  "2026-10-24T00:00:00.000Z",
  "2026-10-24T00:00:00.000Z",
  "day",
);
const CRAFT_SWAP = event(
  "Craft Supply Swap",
  "2026-10-10T00:00:00.000Z",
  "2026-10-10T00:00:00.000Z",
  "day",
);
const WALK_OF_TERROR = event(
  "The Walk of Terror",
  "2026-10-24T00:00:00.000Z",
  "2026-10-24T00:00:00.000Z",
  "day",
);
const JUNIE_B = event(
  "Junie B. Jones The Musical",
  "2026-09-26T00:00:00.000Z",
  "2026-10-04T00:00:00.000Z",
  "day",
);
/** Minute precision: 02:30Z is 7:30 p.m. the previous evening in the Okanagan. */
const WIDE_MOUTH_MASON = event(
  "Default with Wide Mouth Mason",
  "2026-10-03T02:30:00.000Z",
  "2026-10-03T04:30:00.000Z",
  "minute",
);
const OKIFF = event(
  "Okanagan International Film Festival and Forum Opening Night",
  "2026-10-16T01:00:00.000Z",
  "2026-10-16T01:00:00.000Z",
  "minute",
);
/** One of the 11 legacy Events Atlas has no precision for. Must not change. */
const ARETHA = event(
  "Aretha Tillotson Quartet at the Vernon Jazz Club",
  "2026-10-18T02:30:00.000Z",
  "2026-10-18T05:30:00.000Z",
);

const dayOf = (e: Experience, from: string, to: string): string[] =>
  happeningWithin([e], from, to).length > 0 ? [from] : [];

describe("a stated date lands on the day its publisher stated", () => {
  it("HorrorFest XVII is on Oct 24, not Oct 23", () => {
    expect(dayOf(HORRORFEST, "2026-10-24", "2026-10-24")).toEqual([
      "2026-10-24",
    ]);
    expect(happeningWithin([HORRORFEST], "2026-10-23", "2026-10-23")).toEqual(
      [],
    );
  });

  it("Craft Supply Swap is on Oct 10, not Oct 9", () => {
    expect(dayOf(CRAFT_SWAP, "2026-10-10", "2026-10-10")).toEqual([
      "2026-10-10",
    ]);
    expect(happeningWithin([CRAFT_SWAP], "2026-10-09", "2026-10-09")).toEqual(
      [],
    );
  });

  it("The Walk of Terror is on Oct 24, so it is in the Oct 23–25 weekend", () => {
    expect(
      happeningWithin([WALK_OF_TERROR], "2026-10-23", "2026-10-25"),
    ).toHaveLength(1);
    // And not in the weekend before it, which is where it used to fall.
    expect(
      happeningWithin([WALK_OF_TERROR], "2026-10-16", "2026-10-18"),
    ).toEqual([]);
  });

  it("a day-precision run keeps both of its stated dates", () => {
    // Sep 26 → Oct 4 as printed. Under localisation this was Sep 25 → Oct 3,
    // which lost the Oct 4 matinée from October entirely.
    expect(happeningWithin([JUNIE_B], "2026-10-04", "2026-10-04")).toHaveLength(
      1,
    );
    expect(happeningWithin([JUNIE_B], "2026-09-25", "2026-09-25")).toEqual([]);
  });

  it("Tonight and This weekend agree with the month window", () => {
    // Saturday 2026-10-24, mid-morning in the Okanagan.
    const now = new Date("2026-10-24T17:00:00Z");
    expect(happeningTonight([HORRORFEST], now).map((e) => e.title)).toEqual([
      "HorrorFest XVII",
    ]);
    // A day earlier it is still ahead, not on.
    const dayBefore = new Date("2026-10-23T17:00:00Z");
    expect(happeningTonight([HORRORFEST], dayBefore)).toEqual([]);
    expect(upcoming([HORRORFEST], dayBefore).map((e) => e.title)).toEqual([
      "HorrorFest XVII",
    ]);
    expect(
      happeningThisWeekend([HORRORFEST], dayBefore).map((e) => e.title),
    ).toEqual(["HorrorFest XVII"]);
  });
});

describe("a stated clock still behaves as an instant", () => {
  it("Default with Wide Mouth Mason is the evening of Oct 2, not Oct 3", () => {
    expect(
      happeningWithin([WIDE_MOUTH_MASON], "2026-10-02", "2026-10-02"),
    ).toHaveLength(1);
    expect(
      happeningWithin([WIDE_MOUTH_MASON], "2026-10-03", "2026-10-03"),
    ).toEqual([]);
  });

  it("OKIFF's opening night is the evening of Oct 15", () => {
    expect(happeningWithin([OKIFF], "2026-10-15", "2026-10-15")).toHaveLength(
      1,
    );
  });

  it("an evening event is on tonight until it finishes, and not after", () => {
    // 02:30Z–04:30Z on Oct 3 is 7:30–9:30 p.m. on Oct 2 locally.
    expect(
      happeningTonight([WIDE_MOUTH_MASON], new Date("2026-10-03T03:00:00Z"))
        .length,
    ).toBe(1);
    expect(
      happeningTonight([WIDE_MOUTH_MASON], new Date("2026-10-03T05:00:00Z")),
    ).toEqual([]);
  });
});

describe("an unknown precision is untouched", () => {
  it("the Aretha Tillotson Quartet still reads as the instant it always did", () => {
    // 02:30Z on Oct 18 is the evening of Oct 17 locally, and that is exactly
    // where it fell before `timePrecision` existed.
    expect(happeningWithin([ARETHA], "2026-10-17", "2026-10-17")).toHaveLength(
      1,
    );
    expect(happeningWithin([ARETHA], "2026-10-18", "2026-10-18")).toEqual([]);
  });

  it("a midnight instant with no precision is not promoted to a stated date", () => {
    const legacy = event(
      "Culture Days",
      "2026-09-18T00:00:00.000Z",
      "2026-10-04T00:00:00.000Z",
    );
    // Localised, as always: Sep 17 → Oct 3. If this ever reads Oct 4, something
    // has started inferring day precision from a midnight timestamp.
    expect(happeningWithin([legacy], "2026-10-04", "2026-10-04")).toEqual([]);
    expect(happeningWithin([legacy], "2026-10-03", "2026-10-03")).toHaveLength(
      1,
    );
  });
});
