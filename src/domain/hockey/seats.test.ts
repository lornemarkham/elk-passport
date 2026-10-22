import { describe, expect, it } from "vitest";
import {
  MeetupSchema,
  SeatInputSchema,
  clockLabel,
  meetupOf,
  seatFacts,
  seatLine,
  seatNumbers,
  seatingPicture,
  type Seat,
} from "./seats";

const seat = (userId: string | null, s: Partial<Seat>): Seat => ({
  userId,
  section: "309",
  shared: true,
  updatedAt: "2026-10-22T00:00:00Z",
  ...s,
});
const people = [
  { id: "a", name: "Ana", emoji: "🐋" },
  { id: "b", name: "Bo", emoji: "🌲" },
  { id: "c", name: "Cy", emoji: "🔥" },
  { id: "d", name: "Di", emoji: "⭐" },
];
const uuid = "6f1c6c3e-8a51-4c3b-9d3c-2f0e1d1a2b3c";

describe("SeatInputSchema", () => {
  it("takes a seat and tidies it", () => {
    const r = SeatInputSchema.parse({
      for: uuid,
      section: "  309 ",
      row: "12",
      seats: "3-4",
      gate: "10",
    });
    expect(r).toMatchObject({
      section: "309",
      row: "12",
      seats: "3-4",
      gate: "10",
      shared: true,
    });
  });
  it("refuses a gate the arena's map does not have", () => {
    expect(
      SeatInputSchema.safeParse({ for: "group", section: "1", gate: "9" })
        .success,
    ).toBe(false);
  });
  it("needs a section, and a member id or the group", () => {
    expect(SeatInputSchema.safeParse({ for: uuid, section: " " }).success).toBe(
      false,
    );
    expect(
      SeatInputSchema.safeParse({ for: "someone", section: "309" }).success,
    ).toBe(false);
  });
});

describe("seatLine", () => {
  it("says a range as seats and one seat as a seat", () => {
    expect(seatLine({ section: "309", row: "12", seats: "3-4" })).toBe(
      "Section 309 · Row 12 · Seats 3–4",
    );
    expect(seatLine({ section: "101", seats: "7" })).toBe(
      "Section 101 · Seat 7",
    );
  });
});

describe("seatNumbers", () => {
  it("reads numbers, ranges and lists, and nothing else", () => {
    expect(seatNumbers("7")).toEqual([7]);
    expect(seatNumbers("3-5")).toEqual([3, 4, 5]);
    expect(seatNumbers("3, 4")).toEqual([3, 4]);
    expect(seatNumbers("aisle")).toEqual([]);
    expect(seatNumbers("9-3")).toEqual([]);
  });
});

describe("seatingPicture", () => {
  it("puts the same row with touching seats side by side", () => {
    const p = seatingPicture(
      [
        seat("a", { row: "12", seats: "3" }),
        seat("b", { row: "12", seats: "4-5" }),
      ],
      people.slice(0, 2),
    );
    expect(p.together).toHaveLength(1);
    expect(p.together[0]).toMatchObject({
      where: "Section 309 · Row 12",
      sideBySide: true,
    });
  });
  it("same section, different rows: together, not side by side", () => {
    const p = seatingPicture(
      [
        seat("a", { row: "12", seats: "3" }),
        seat("b", { row: "14", seats: "3" }),
      ],
      people.slice(0, 2),
    );
    expect(p.together[0]).toMatchObject({
      where: "Section 309",
      sideBySide: false,
    });
  });
  it("does not call a gap side by side, nor two people in one seat", () => {
    expect(
      seatingPicture(
        [
          seat("a", { row: "1", seats: "3" }),
          seat("b", { row: "1", seats: "6" }),
        ],
        people.slice(0, 2),
      ).together[0].sideBySide,
    ).toBe(false);
    expect(
      seatingPicture(
        [
          seat("a", { row: "1", seats: "3" }),
          seat("b", { row: "1", seats: "3" }),
        ],
        people.slice(0, 2),
      ).together[0].sideBySide,
    ).toBe(false);
  });
  it("never assumes someone without a seat is in the group block", () => {
    const p = seatingPicture(
      [seat(null, { row: "12", seats: "1-8" }), seat("a", { section: "101" })],
      people,
    );
    expect(p.unknown.map((x) => x.name)).toEqual(["Bo", "Cy", "Di"]);
    expect(p.apart.map((x) => x.name)).toEqual(["Ana"]);
    expect(p.together).toEqual([]);
  });
  it("shows members only", () => {
    const p = seatingPicture(
      [seat("gone", {}), seat("a", {})],
      people.slice(0, 1),
    );
    expect(p.apart).toHaveLength(1);
    expect(p.together).toEqual([]);
  });
});

describe("seatFacts", () => {
  it("says the level from the arena's numbering and flags an unknown gate", () => {
    expect(seatFacts({ section: "309" })).toEqual({
      level: "Level 300",
      sectionKnown: true,
      gateUnknown: true,
    });
    expect(seatFacts({ section: "112", gate: "16" })).toMatchObject({
      level: "Plaza Level 100",
      gate: "Gate 16",
      gateUnknown: false,
    });
    expect(seatFacts({ section: "FLOOR" })).toEqual({
      sectionKnown: false,
      gateUnknown: true,
    });
  });
});

describe("meeting point", () => {
  it("needs a gate or a spot, and a real time", () => {
    expect(MeetupSchema.safeParse({ gate: "", spot: "" }).success).toBe(false);
    expect(MeetupSchema.safeParse({ gate: "10", time: "18:15" }).success).toBe(
      true,
    );
    expect(
      MeetupSchema.safeParse({ spot: "Big screen", time: "6pm" }).success,
    ).toBe(false);
    expect(
      MeetupSchema.parse({ spot: "Big screen", time: "" }).time,
    ).toBeUndefined();
  });
  it("reads a stored one defensively", () => {
    expect(
      meetupOf({ gate: "10", spot: "Doors", time: "18:15", setBy: "u" }),
    ).toEqual({ gate: "10", spot: "Doors", time: "18:15", setBy: "u" });
    expect(meetupOf({ gate: "99" })).toBeUndefined();
    expect(meetupOf("nope")).toBeUndefined();
    expect(meetupOf({ spot: "x".repeat(500) })).toBeUndefined();
  });
  it("says a time the Vancouver way", () => {
    expect(clockLabel("18:15")).toBe("6:15pm");
    expect(clockLabel("00:05")).toBe("12:05am");
    expect(clockLabel("12:00")).toBe("12:00pm");
  });
});
