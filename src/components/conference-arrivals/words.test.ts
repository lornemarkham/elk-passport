import { describe, expect, it } from "vitest";
import type {
  ArrivalRow,
  ArrivalsBoard,
} from "@/domain/conference-arrivals/board";
import { headline, statusLine } from "./words";

const YVR = {
  iata: "YVR",
  icao: "CYVR",
  lat: 49.1939,
  lon: -123.184,
  city: "Vancouver",
  name: "Vancouver International Airport",
};
const NOW = new Date("2026-10-22T20:00:00Z");

const row = (over: Partial<ArrivalRow>): ArrivalRow => ({
  memberId: Math.random().toString(36),
  isYou: false,
  name: "Dave",
  flight: "AC123",
  airline: "Air Canada",
  date: "2026-10-22",
  from: {
    ...YVR,
    iata: "YYZ",
    icao: "CYYZ",
    city: "Toronto",
    lat: 43.68,
    lon: -79.63,
  },
  fromBasis: "stated",
  to: YVR,
  phase: "scheduled",
  aircraft: null,
  position: null,
  trail: [],
  lostBecause: null,
  landedAt: null,
  landedBasis: null,
  checkedAt: null,
  waiting: null,
  evidence: [],
  shared: null,
  ...over,
});
const at = (lat: number, lon: number) => ({
  lat,
  lon,
  altitudeFt: 30000,
  groundSpeedKt: 450,
  trackDeg: 270,
  onGround: false,
  at: NOW.toISOString(),
});
const board = (...rows: ArrivalRow[]): ArrivalsBoard => ({
  arrival: YVR,
  rows,
  counts: { airborne: 0, landed: 0, waiting: 0, total: rows.length },
});
const say = (b: ArrivalsBoard) => headline(b, "Vancouver", "conference", NOW);

describe("the headline", () => {
  it("is planning when nobody's flying", () => {
    expect(say(board()).big).toBe("The invasion is being planned.");
  });

  it("announces the first plane in the air", () => {
    expect(
      say(board(row({ phase: "airborne", position: at(50, -100) }))),
    ).toEqual({
      big: "THE INVASION HAS BEGUN.",
      small: "Dave is in the air.",
    });
  });

  it("counts a crowd", () => {
    const b = board(
      row({ phase: "airborne", position: at(50, -100) }),
      row({ name: "Sarah", phase: "airborne", position: at(45, -90) }),
      row({ name: "Raj", phase: "airborne", position: at(40, -80) }),
    );
    expect(say(b)).toEqual({
      big: "Three coworkers airborne.",
      small: "Productivity has left the building.",
    });
  });

  it("names whoever is closest once someone is approaching", () => {
    const b = board(
      row({ phase: "airborne", position: at(49.3, -122.5) }),
      row({ name: "Sarah", phase: "airborne", position: at(45, -90) }),
    );
    expect(say(b)).toEqual({
      big: "Dave is approaching Vancouver.",
      small: "This is not a drill.",
    });
  });

  it("says when somebody landed, and admits when that's inferred", () => {
    const landed = (basis: "ground" | "inferred") =>
      board(
        row({
          name: "Sarah",
          phase: "landed",
          landedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
          landedBasis: basis,
        }),
      );
    expect(say(landed("ground"))).toEqual({
      big: "Sarah has landed.",
      small: "Vancouver has been notified.",
    });
    expect(say(landed("inferred")).small).toMatch(/short final/);
  });

  it("speaks to you as you", () => {
    expect(
      say(
        board(row({ isYou: true, phase: "airborne", position: at(50, -100) })),
      ).small,
    ).toBe("You are in the air.");
  });
});

describe("the line under a name", () => {
  it("says exactly the mission's words while waiting, and names others", () => {
    expect(
      statusLine(
        row({ isYou: true, phase: "searching" }),
        NOW,
        "America/Vancouver",
      ),
    ).toBe("Waiting to identify your aircraft.");
    expect(
      statusLine(row({ phase: "searching" }), NOW, "America/Vancouver"),
    ).toBe("Waiting to identify Dave's aircraft.");
  });

  it("always gives a lost signal's age", () => {
    const lost = row({
      phase: "lost",
      position: {
        ...at(55, -140),
        at: new Date(NOW.getTime() - 14 * 60_000).toISOString(),
      },
    });
    expect(statusLine(lost, NOW, "America/Vancouver")).toBe(
      "Signal lost · last seen 14 min ago",
    );
  });
});
