import { describe, expect, it } from "vitest";
import {
  GATHERINGS,
  activityFacts,
  confirmedDay,
  dayDoors,
  gatheringBoardId,
  gatheringBySlug,
  gatheringForBoard,
  staffActivities,
  type Gathering,
  type StaffActivity,
} from "./boards-gatherings";

const sycle = gatheringBySlug("sycle-vancouver-2026")!;

const hockey = (over: Partial<StaffActivity> = {}): StaffActivity => ({
  id: "x:hockey",
  title: "Staff hockey game",
  shortDescription: "A game.",
  ...over,
});

describe("the Sycle gathering", () => {
  it("features the staff hockey game, in Vancouver", () => {
    expect(sycle.featured.title).toBe("Staff hockey game");
    expect(sycle.townId).toBe("vancouver");
  });

  /**
   * The mission's hardest rule: no hockey detail is invented. If somebody
   * fills one of these in, this fails until they also say who confirmed it.
   */
  it("states no hockey detail nobody has confirmed", () => {
    const { featured } = sycle;
    if (!featured.confirmedBy) {
      expect(featured.startTime).toBeUndefined();
      expect(featured.endTime).toBeUndefined();
      expect(featured.venue).toBeUndefined();
      expect(featured.participation).toBeUndefined();
    }
    expect(sycle.days).toBeUndefined();
  });

  it("shows every hockey fact as awaiting confirmation", () => {
    const facts = activityFacts(sycle.featured);
    expect(facts.map((f) => f.label)).toEqual([
      "Date",
      "Time",
      "Venue",
      "Taking part",
    ]);
    expect(facts.every((f) => f.value === undefined)).toBe(true);
  });

  it("claims no other staff activities", () => {
    expect(sycle.activities).toEqual([]);
    expect(staffActivities(sycle)).toEqual([sycle.featured]);
  });

  it("has unique activity ids across every gathering", () => {
    const ids = GATHERINGS.flatMap((g) => staffActivities(g).map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("activity facts", () => {
  it("are not shown as confirmed without a source, even when present", () => {
    const facts = activityFacts(
      hockey({
        startTime: "2026-10-23T02:00:00.000Z",
        timePrecision: "minute",
        venue: { name: "Some Arena", basis: "stated-venue" },
        participation: { details: "Bring skates." },
      }),
    );
    expect(facts.every((f) => f.value === undefined)).toBe(true);
  });

  it("read a stated clock time in Vancouver", () => {
    const facts = activityFacts(
      hockey({
        startTime: "2026-10-23T02:00:00.000Z",
        endTime: "2026-10-23T03:30:00.000Z",
        timePrecision: "minute",
        venue: { name: "Rink", locality: "Vancouver", basis: "stated-venue" },
        participation: { details: "All skill levels." },
        confirmedBy: "the organiser",
      }),
    );
    const value = (label: string) =>
      facts.find((f) => f.label === label)?.value;
    expect(value("Date")).toMatch(/Thursday, October 22, 2026/);
    expect(value("Time")).toMatch(/7:00.*8:30/);
    expect(value("Venue")).toBe("Rink, Vancouver");
    expect(value("Taking part")).toBe("All skill levels.");
  });

  it("never move a date-only start into the previous evening, nor print a time", () => {
    const activity = hockey({
      startTime: "2026-10-24T00:00:00.000Z",
      timePrecision: "day",
      confirmedBy: "the organiser",
    });
    const facts = activityFacts(activity);
    expect(facts.find((f) => f.label === "Date")?.value).toMatch(
      /Saturday, October 24, 2026/,
    );
    expect(facts.find((f) => f.label === "Time")?.value).toBeUndefined();
    expect(confirmedDay(activity)).toBe("2026-10-24");
  });

  it("treat unknown precision as no clock time", () => {
    const facts = activityFacts(
      hockey({ startTime: "2026-10-24T19:00:00.000Z", confirmedBy: "x" }),
    );
    expect(facts.find((f) => f.label === "Time")?.value).toBeUndefined();
  });
});

describe("which board a gathering is", () => {
  it("comes from the environment, and unset means not opened yet", () => {
    expect(gatheringBoardId(sycle, {})).toBeUndefined();
    expect(gatheringBoardId(sycle, { [sycle.boardEnv]: "  " })).toBeUndefined();
    expect(gatheringBoardId(sycle, { [sycle.boardEnv]: "b-1" })).toBe("b-1");
  });

  it("is found from the board id, and only that one", () => {
    const env = { [sycle.boardEnv]: "b-1" };
    expect(gatheringForBoard("b-1", env)).toBe(sycle);
    expect(gatheringForBoard("b-2", env)).toBeUndefined();
    expect(gatheringForBoard("b-1", {})).toBeUndefined();
  });
});

describe("doors into Go Have A Day", () => {
  it("all start from the gathering's town and name no place", () => {
    const { free, gameDay } = dayDoors(sycle);
    expect(gameDay).toBeUndefined();
    expect(free.length).toBeGreaterThan(0);
    for (const door of free) {
      const url = new URL(door.href, "http://x");
      expect(url.pathname).toBe("/go");
      expect(url.searchParams.get("at")).toBe("vancouver");
      expect(url.searchParams.get("on")).toBeNull();
    }
  });

  it("offer game day only once the game's date is confirmed", () => {
    const confirmed: Gathering = {
      ...sycle,
      featured: hockey({
        startTime: "2026-10-24T00:00:00.000Z",
        timePrecision: "day",
        confirmedBy: "the organiser",
      }),
    };
    const url = new URL(dayDoors(confirmed).gameDay!.href, "http://x");
    expect(url.searchParams.get("on")).toBe("2026-10-24");
    expect(url.searchParams.get("at")).toBe("vancouver");
  });
});
