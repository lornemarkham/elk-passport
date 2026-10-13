import { describe, expect, it } from "vitest";
import { ROOM_OPENS, answerToKnock, doorLine, thresholdOn } from "./threshold";

describe("the Room's threshold", () => {
  it("opens on Halloween, which is the bible's last beat, and stays open", () => {
    expect(ROOM_OPENS).toBe("2026-10-31");
    expect(thresholdOn("2026-10-31", {})).toEqual({ kind: "open" });
    expect(thresholdOn("2026-11-02", {})).toEqual({ kind: "open" });
    expect(thresholdOn("2027-10-13", {})).toEqual({ kind: "open" });
  });

  it("walks the bible's sequence: not yet, a light, then the count", () => {
    expect(thresholdOn("2026-10-13", {}).kind).toBe("not-yet");
    expect(thresholdOn("2026-10-19", {}).kind).toBe("not-yet");
    expect(thresholdOn("2026-10-20", {})).toEqual({
      kind: "light",
      nights: 11,
    });
    expect(thresholdOn("2026-10-24", {})).toEqual({ kind: "light", nights: 7 });
    expect(thresholdOn("2026-10-25", {})).toEqual({
      kind: "counting",
      nights: 6,
    });
    expect(thresholdOn("2026-10-30", {})).toEqual({
      kind: "counting",
      nights: 1,
    });
  });

  it("says only the true count, in October's words", () => {
    expect(doorLine(thresholdOn("2026-10-25", {}))).toBe("Six nights.");
    expect(doorLine(thresholdOn("2026-10-28", {}))).toBe("Three nights.");
    expect(doorLine(thresholdOn("2026-10-30", {}))).toBe("One night.");
    expect(doorLine(thresholdOn("2026-10-14", {}))).toBe("Not yet.");
    expect(doorLine(thresholdOn("2026-10-22", {}))).toBe("Not yet.");
    expect(doorLine(thresholdOn("2026-10-31", {}))).toBeNull();
  });

  it("never shuts out anyone the door has already opened for", () => {
    for (const key of ["entered", "escaped", "tape", "played"] as const) {
      expect(thresholdOn("2026-10-13", { [key]: 1 })).toEqual({ kind: "open" });
    }
    // Having been *refused* in the store is not having been inside the room.
    expect(thresholdOn("2026-10-13", { refused: 1 }).kind).toBe("not-yet");
  });

  it("treats a day it cannot read as an open door, not a locked one", () => {
    expect(thresholdOn("", {})).toEqual({ kind: "open" });
    expect(thresholdOn("tomorrow", {})).toEqual({ kind: "open" });
  });

  it("counts calendar days, so a clock change cannot move a night", () => {
    // 2026-11-01 is the end of daylight time; October 25 is still six nights.
    expect(thresholdOn("2026-10-25", {})).toEqual({
      kind: "counting",
      nights: 6,
    });
  });

  it("answers every knock, and not the same thing twice running", () => {
    for (const day of [
      "2026-10-14",
      "2026-10-22",
      "2026-10-27",
      "2026-10-30",
    ]) {
      const t = thresholdOn(day, {});
      let last = "";
      for (let k = 1; k <= 8; k += 1) {
        const a = answerToKnock(t, k);
        expect(a.length).toBeGreaterThan(0);
        expect(a).not.toBe(last);
        last = a;
      }
    }
  });
});
