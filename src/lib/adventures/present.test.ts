import { describe, expect, it } from "vitest";
import {
  adventureStatus,
  clockLabel,
  minutesLabel,
  momentLabel,
  nextAdventure,
  responsesLabel,
  usesLabel,
  weekdayLabel,
  whenLabel,
} from "./present";

describe("how an adventure reads", () => {
  it("says nothing about when if nobody has said", () => {
    expect(whenLabel(null, null)).toBeNull();
  });

  it("names a day without sliding across time zones", () => {
    expect(whenLabel("2026-10-25", null)).toBe("Sun, Oct 25");
    expect(whenLabel("2026-10-24", "2026-10-27")).toBe(
      "Sat, Oct 24 – Tue, Oct 27",
    );
    expect(whenLabel("2026-10-24", "2026-10-24")).toBe("Sat, Oct 24");
  });

  it("puts a moment in the adventure's own time zone", () => {
    expect(
      momentLabel("2026-10-26T02:00:00.000Z", "America/Vancouver"),
    ).toMatch(/Sun, Oct 25.*7:00.*p\.?m\.?.*PDT/i);
  });

  it("counts answers, and stays quiet when there are none", () => {
    expect(responsesLabel({ in: 2, maybe: 1, out: 0 })).toBe("2 in · 1 maybe");
    expect(responsesLabel({ in: 0, maybe: 0, out: 0 })).toBe("");
  });

  it("says what a link allows", () => {
    expect(usesLabel(1, 0)).toBe("One person");
    expect(usesLabel(1, 1)).toBe("Used");
    expect(usesLabel(null, 3)).toBe("Open link · 3 joined");
    expect(usesLabel(5, 2)).toBe("2 of 5 used");
  });
});

describe("where an adventure is", () => {
  const today = "2026-10-23";
  it("is on today, over, or coming — and says what is left to decide", () => {
    expect(
      adventureStatus(
        { startsOn: today, endsOn: "2026-10-24" },
        { stops: 3, undecided: 0 },
        today,
      ),
    ).toEqual({ stage: "today", label: "Today" });
    expect(
      adventureStatus(
        { startsOn: "2026-10-01", endsOn: null },
        { stops: 3, undecided: 0 },
        today,
      ).stage,
    ).toBe("done");
    expect(
      adventureStatus(
        { startsOn: "2026-10-24", endsOn: "2026-10-25" },
        { stops: 5, undecided: 2 },
        today,
      ),
    ).toEqual({ stage: "upcoming", label: "Tomorrow · 2 to decide" });
    expect(
      adventureStatus(
        { startsOn: "2026-10-30", endsOn: null },
        { stops: 0, undecided: 0 },
        today,
      ),
    ).toEqual({ stage: "draft", label: "In 7 days · Just ideas" });
    expect(
      adventureStatus(
        { startsOn: null, endsOn: null },
        { stops: 2, undecided: 0 },
        today,
      ).label,
    ).toBe("No date yet · Planned");
  });

  it("picks the soonest adventure that has not happened as the next one", () => {
    const list = [
      { id: "past", startsOn: "2026-10-01", endsOn: "2026-10-02" },
      { id: "later", startsOn: "2026-11-07", endsOn: null },
      { id: "undated", startsOn: null, endsOn: null },
      { id: "soon", startsOn: "2026-10-24", endsOn: "2026-10-25" },
    ];
    expect(nextAdventure(list, today)?.id).toBe("soon");
    expect(nextAdventure([list[0]!, list[2]!], today)?.id).toBe("undated");
    expect(nextAdventure([list[0]!], today)).toBeNull();
  });

  it("says durations and clocks the way a person reads them", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(90)).toBe("1 h 30");
    expect(minutesLabel(120)).toBe("2 h");
    expect(clockLabel(9 * 60 + 5)).toBe("9:05 am");
    expect(clockLabel(12 * 60 + 30)).toBe("12:30 pm");
    expect(weekdayLabel("2026-10-24")).toBe("Saturday");
  });
});
