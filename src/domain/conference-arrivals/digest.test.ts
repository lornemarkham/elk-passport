import { describe, expect, it } from "vitest";
import type { ArrivalRow, ArrivalsBoard } from "./board";
import { digest } from "./digest";

const YVR = {
  icao: "CYVR",
  iata: "YVR",
  name: "Vancouver International",
  lat: 49.1939,
  lon: -123.1844,
};

const row = (over: Partial<ArrivalRow>): ArrivalRow =>
  ({
    memberId: "m",
    isYou: false,
    name: "Someone",
    flight: "AC123",
    airline: null,
    date: "2026-10-25",
    lands: null,
    from: null,
    fromBasis: null,
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
  }) as ArrivalRow;

const board = (rows: ArrivalRow[]): ArrivalsBoard =>
  ({
    arrival: YVR,
    rows,
    counts: { airborne: 0, landed: 0, waiting: 0, total: rows.length },
  }) as unknown as ArrivalsBoard;

const TZ = "America/Vancouver";

describe("arrivals digest", () => {
  it("says who has landed, who's next, and keeps every time's kind", () => {
    const d = digest(
      board([
        row({
          memberId: "a",
          name: "Ana",
          phase: "landed",
          landedAt: "2026-10-25T20:05:00Z",
          landedBasis: "ground",
        }),
        row({ memberId: "b", name: "Ben", lands: "2026-10-25T14:20" }),
        row({ memberId: "c", name: "Cy", lands: "2026-10-25T14:50" }),
        row({ memberId: "d", name: "Di", date: "2026-10-26" }),
      ] as ArrivalRow[]),
      new Date("2026-10-25T20:10:00Z"),
      TZ,
    );
    expect(d.landed.map((e) => e.name)).toEqual(["Ana"]);
    expect(d.next).toMatchObject({
      name: "Ben",
      kind: "scheduled",
      at: "2026-10-25T21:20:00.000Z",
    });
    expect(
      d.timeline.map((t) => [t.day, t.entries.map((e) => e.name)]),
    ).toEqual([
      ["2026-10-25", ["Ana", "Ben", "Cy"]],
      ["2026-10-26", ["Di"]],
    ]);
    expect(d.timeline[1]!.entries[0]!.kind).toBe("unknown");
  });

  it("groups people landing within 45 minutes of each other", () => {
    const d = digest(
      board([
        row({ memberId: "b", name: "Ben", lands: "2026-10-25T14:20" }),
        row({ memberId: "c", name: "Cy", lands: "2026-10-25T14:50" }),
        row({ memberId: "e", name: "Ed", lands: "2026-10-25T18:00" }),
      ] as ArrivalRow[]),
      new Date("2026-10-25T18:00:00Z"),
      TZ,
    );
    expect(d.together.map((g) => g.people.map((p) => p.name))).toEqual([
      ["Ben", "Cy"],
    ]);
  });

  it("leaves out your own flight when you haven't shared it", () => {
    const d = digest(
      board([
        row({
          memberId: "y",
          isYou: true,
          name: null,
          shared: false,
          lands: "2026-10-25T14:20",
        }),
      ]),
      new Date("2026-10-25T18:00:00Z"),
      TZ,
    );
    expect(d.timeline).toEqual([]);
  });
});
