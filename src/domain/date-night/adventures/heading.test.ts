import { describe, expect, it } from "vitest";
import { justUs, namesOf, whenSaid } from "./heading";

describe("the night's title follows the day and the leave time", () => {
  const on = "2026-11-02"; // a Monday

  it("an evening start today is tonight", () => {
    expect(justUs(on, on, 17 * 60)).toBe("Tonight, just us");
  });

  it("an afternoon start is never called a night", () => {
    expect(justUs(on, on, 14 * 60 + 15)).toBe("This afternoon, just us");
    expect(whenSaid(on, "2026-11-01", 14 * 60 + 15)).toBe("Tomorrow afternoon");
  });

  it("before anything is chosen it is just the day", () => {
    expect(whenSaid(on, on)).toBe("Today");
    expect(whenSaid(on, "2026-11-01")).toBe("Tomorrow");
    expect(whenSaid(on, "2026-10-30")).toBe("Monday");
    expect(whenSaid(on, "2026-10-30", 18 * 60)).toBe("Monday night");
  });

  it("afterwards it is remembered", () => {
    expect(whenSaid(on, "2026-11-03", 17 * 60)).toBe("That night");
    expect(whenSaid(on, "2026-11-03", 14 * 60)).toBe("That afternoon");
  });

  it("far ahead it doesn't pretend to know the week", () => {
    expect(whenSaid(on, "2026-10-01")).toBe("One day soon");
  });
});

describe("names", () => {
  it("joins the people who have names", () => {
    expect(namesOf(["Lorne", "Jess"])).toBe("Lorne & Jess");
    expect(namesOf(["Lorne", null, ""])).toBe("Lorne");
    expect(namesOf([null])).toBeNull();
  });
});
