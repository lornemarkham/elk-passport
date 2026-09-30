import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { anticipate, bySoonestAnticipated } from "./anticipation";

/**
 * **How close is it, and does the answer come from evidence?**
 *
 * Every fixture here is the shape a real October subject actually has, read
 * off the live corpus on 2026-09-30 rather than imagined:
 *
 * ```
 * Draconids        Event, Oct 6 → Oct 10, timePrecision "day"
 * Top 3 Comedy     Event, Oct 9 only, timePrecision "day"
 * Sagebrush trail  Event, Oct 3 → Oct 31, timePrecision "minute"
 * Field of Screams Experience, 38 *stated days*, Sep 25 → Nov 1
 * Black Mountain   Experience, availability "unstated" — nothing at all
 * a film           no date of any kind
 * ```
 *
 * `now` is supplied everywhere. A module that read the clock itself could not
 * be asked what it says on the 8th of October.
 */
const at = (iso: string) => new Date(iso);

/** Midday in Vancouver, so no test sits on a midnight boundary by accident. */
const noonOn = (day: string) => at(`${day}T19:00:00.000Z`);

const event = (over: Partial<Experience>): Experience =>
  ({
    id: "e",
    kind: "Event",
    title: "An event",
    shortDescription: "",
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  }) as Experience;

const DRACONIDS = event({
  id: "draconids",
  title: "Draconid meteor shower 2026",
  startTime: "2026-10-06T00:00:00.000Z",
  endTime: "2026-10-10T00:00:00.000Z",
  timePrecision: "day",
});

const TOP_3 = event({
  id: "top-3",
  title: "Top 3 Comedy Night",
  startTime: "2026-10-09T00:00:00.000Z",
  endTime: "2026-10-09T00:00:00.000Z",
  timePrecision: "day",
});

/** 38 nights, and they are a list rather than a span. */
const FIELD_OF_SCREAMS = event({
  id: "fos",
  kind: "Experience",
  title: "Field of Screams",
  availability: {
    basis: "stated-days",
    days: [
      "2026-09-25",
      "2026-09-26",
      "2026-10-02",
      "2026-10-03",
      "2026-10-09",
      "2026-10-10",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ],
  },
});

const BLACK_MOUNTAIN = event({
  id: "bmhh",
  kind: "Experience",
  title: "The Black Mountain Haunted House",
  availability: { basis: "unstated" },
});

const none = { startsAt: null };

describe("something still to come", () => {
  it("counts the days when it is inside the fortnight", () => {
    const a = anticipate(none, DRACONIDS, noonOn("2026-10-01"));
    expect(a.nearness).toBe("soon");
    expect(a.label).toBe("In 5 days");
    expect(a.day).toBe("2026-10-06");
  });

  it("names the date when it is further out than that", () => {
    const a = anticipate(none, TOP_3, noonOn("2026-09-20"));
    expect(a.nearness).toBe("dated");
    expect(a.label).toBe("Oct 9");
  });

  it("says tomorrow when it is tomorrow", () => {
    const a = anticipate(none, DRACONIDS, noonOn("2026-10-05"));
    expect(a.nearness).toBe("tomorrow");
    expect(a.label).toBe("Tomorrow");
  });

  it("says this weekend in October's own words", () => {
    // 2026-10-09 is a Friday; from the Monday before, that is the weekend.
    const a = anticipate(none, TOP_3, noonOn("2026-10-05"));
    expect(a.nearness).toBe("weekend");
    expect(a.label).toBe("This weekend");
  });

  it("prefers tomorrow to the weekend when both are true", () => {
    // Thursday, looking at Friday: tomorrow is the more useful of two facts.
    const a = anticipate(none, TOP_3, noonOn("2026-10-08"));
    expect(a.label).toBe("Tomorrow");
  });
});

describe("something on today", () => {
  it("says Tonight when today is all of it", () => {
    const a = anticipate(none, TOP_3, noonOn("2026-10-09"));
    expect(a.nearness).toBe("tonight");
    expect(a.label).toBe("Tonight");
    expect(a.lastChance).toBeUndefined();
  });

  it("says it is on now when it runs past today", () => {
    const a = anticipate(none, DRACONIDS, noonOn("2026-10-07"));
    expect(a.nearness).toBe("running");
    expect(a.label).toBe("On now");
    expect(a.day).toBe("2026-10-07");
  });

  it("marks the last of a run as a last chance", () => {
    const a = anticipate(none, DRACONIDS, noonOn("2026-10-10"));
    expect(a.nearness).toBe("tonight");
    expect(a.lastChance).toBe(true);
  });

  it("does not call a one-night thing a last chance", () => {
    // There was never a second night to miss.
    expect(anticipate(none, TOP_3, noonOn("2026-10-09")).lastChance).toBe(
      undefined,
    );
  });
});

describe("a list of nights is not a span", () => {
  it("counts the nights it was actually given", () => {
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-09-24"));
    expect(a.nights).toBe(9);
  });

  it("looks past a gap to the next night that is really on", () => {
    // The 4th to the 8th are not in the list. Nothing may claim they are, so
    // the next night is the 9th and not the 5th. (That is a Friday, so the
    // label is the weekend's — the point here is which day was chosen.)
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-10-05"));
    expect(a.day).toBe("2026-10-09");
    expect(a.nearness).not.toBe("running");
    expect(a.nearness).not.toBe("tonight");
  });

  it("counts the days to the next real night, not to the end of the gap", () => {
    // From the Thursday, the next night is the 30th — eleven of the list's
    // days are behind us and the 11th to the 29th are not in it at all.
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-10-22"));
    expect(a.day).toBe("2026-10-30");
    expect(a.nearness).toBe("soon");
    expect(a.label).toBe("In 8 days");
  });

  it("is running, not finished, in the middle of its run", () => {
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-10-09"));
    expect(a.nearness).toBe("running");
    expect(a.lastChance).toBeUndefined();
  });

  it("is a last chance only on the final night", () => {
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-11-01"));
    expect(a.nearness).toBe("tonight");
    expect(a.lastChance).toBe(true);
  });

  it("is not passed on a day between two of its nights", () => {
    // 2026-10-04 is a gap day. The run is not over.
    const a = anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-10-04"));
    expect(a.nearness).not.toBe("passed");
  });
});

describe("when the calendar has gone past it", () => {
  it("says so, and says nothing about whether anybody went", () => {
    const a = anticipate(none, TOP_3, noonOn("2026-10-20"));
    expect(a.nearness).toBe("passed");
    expect(a.label).toBe("Passed");
    // Nothing in this module can produce a lived state, and nothing should.
    expect(JSON.stringify(a)).not.toMatch(/lived/i);
  });

  it("waits until every night is behind us", () => {
    expect(
      anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-10-31")).nearness,
    ).toBe("running");
    expect(
      anticipate(none, FIELD_OF_SCREAMS, noonOn("2026-11-02")).nearness,
    ).toBe("passed");
  });
});

describe("when there is nothing to go on", () => {
  it("invents no urgency for a subject whose record states no day", () => {
    // Black Mountain's nights live on its modes; its own record says nothing.
    const a = anticipate(none, BLACK_MOUNTAIN, noonOn("2026-10-20"));
    expect(a.nearness).toBe("unknown");
    expect(a.label).toBe("");
    expect(a.day).toBeUndefined();
  });

  it("invents none for a film either", () => {
    const a = anticipate(none, undefined, noonOn("2026-10-20"));
    expect(a.nearness).toBe("unknown");
  });

  it("never guesses from when it was saved", () => {
    const a = anticipate(
      { startsAt: null },
      BLACK_MOUNTAIN,
      noonOn("2026-10-20"),
    );
    expect(a.nearness).toBe("unknown");
  });
});

describe("when Atlas no longer returns the subject", () => {
  it("falls back to the day the row itself remembered", () => {
    const a = anticipate(
      { startsAt: "2026-10-09T02:00:00.000Z" },
      undefined,
      noonOn("2026-10-08"),
    );
    expect(a.nearness).toBe("tonight");
    expect(a.day).toBe("2026-10-08");
  });
});

describe("timezone and midnight", () => {
  it("reads a date-only Event as the date its publisher printed", () => {
    // Stored at UTC midnight. Read as an instant in Vancouver it would be the
    // 5th; it is the 6th, because the publisher wrote a date.
    expect(anticipate(none, DRACONIDS, noonOn("2026-10-06")).day).toBe(
      "2026-10-06",
    );
  });

  it("is the same answer a minute either side of local midnight", () => {
    // 2026-10-09 07:01Z is 00:01 in Vancouver on the 9th.
    const justAfter = anticipate(none, TOP_3, at("2026-10-09T07:01:00.000Z"));
    const midday = anticipate(none, TOP_3, noonOn("2026-10-09"));
    expect(justAfter.nearness).toBe(midday.nearness);

    // A minute earlier is still the 8th, and so is the answer.
    const justBefore = anticipate(none, TOP_3, at("2026-10-09T06:59:00.000Z"));
    expect(justBefore.label).toBe("Tomorrow");
  });

  it("counts days across a daylight-saving boundary without drifting", () => {
    // Vancouver leaves DST on 2026-11-01. Ten days is ten days.
    const a = anticipate(
      { startsAt: null },
      event({
        startTime: "2026-11-05T00:00:00.000Z",
        endTime: "2026-11-05T00:00:00.000Z",
        timePrecision: "day",
      }),
      noonOn("2026-10-26"),
    );
    expect(a.label).toBe("In 10 days");
  });
});

describe("the order Ahead is read in", () => {
  const row = (
    name: string,
    experience: Experience | undefined,
    wantedAt: string,
    startsAt: string | null = null,
  ) => ({ name, experience, wantedAt, startsAt });

  const order = (rows: ReturnType<typeof row>[], now: Date) =>
    [...rows]
      .sort(
        bySoonestAnticipated((r) => ({
          anticipation: anticipate(r, r.experience, now),
          startsAt: r.startsAt,
          name: r.name,
          wantedAt: r.wantedAt,
        })),
      )
      .map((r) => r.name);

  it("puts the sooner thing before the much later one", () => {
    const now = noonOn("2026-10-01");
    expect(
      order(
        [
          row("later", TOP_3, "2026-09-01T00:00:00Z"),
          row("sooner", DRACONIDS, "2026-09-02T00:00:00Z"),
        ],
        now,
      ),
    ).toEqual(["sooner", "later"]);
  });

  it("puts a run that is on tonight above a concert three weeks out", () => {
    // The order the old `startsAt`-only sort got wrong: Field of Screams has
    // no timestamp at all, so it sorted below everything dated.
    const now = noonOn("2026-10-09");
    expect(
      order(
        [
          row(
            "concert",
            event({ startTime: "2026-10-30T02:00:00.000Z" }),
            "2026-09-01T00:00:00Z",
            "2026-10-30T02:00:00.000Z",
          ),
          row("field of screams", FIELD_OF_SCREAMS, "2026-09-02T00:00:00Z"),
        ],
        now,
      ),
    ).toEqual(["field of screams", "concert"]);
  });

  it("puts undated things after dated ones, newest intention first", () => {
    const now = noonOn("2026-10-01");
    expect(
      order(
        [
          row("a film", undefined, "2026-09-01T00:00:00Z"),
          row("a later film", undefined, "2026-09-20T00:00:00Z"),
          row("dated", DRACONIDS, "2026-08-01T00:00:00Z"),
        ],
        now,
      ),
    ).toEqual(["dated", "a later film", "a film"]);
  });

  it("puts what the calendar has gone past at the very bottom", () => {
    const now = noonOn("2026-10-20");
    expect(
      order(
        [
          row("gone", TOP_3, "2026-09-01T00:00:00Z"),
          row("a film", undefined, "2026-09-02T00:00:00Z"),
          row(
            "still ahead",
            event({ startTime: "2026-10-30T02:00:00.000Z" }),
            "2026-09-03T00:00:00Z",
            "2026-10-30T02:00:00.000Z",
          ),
        ],
        now,
      ),
    ).toEqual(["still ahead", "a film", "gone"]);
  });

  it("does not shuffle between two renders", () => {
    const now = noonOn("2026-10-01");
    const rows = [
      row("b", TOP_3, "2026-09-01T00:00:00Z"),
      row("a", TOP_3, "2026-09-01T00:00:00Z"),
      row("c", TOP_3, "2026-09-01T00:00:00Z"),
    ];
    expect(order(rows, now)).toEqual(order(rows, now));
    expect(order(rows, now)).toEqual(["a", "b", "c"]);
  });
});
