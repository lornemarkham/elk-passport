import { describe, expect, it } from "vitest";
import { arrivalTime, boardFor, type ArrivalRecord } from "./board";
import { readFlight } from "./flight";
import { NOT_STARTED } from "./tracking";

const YVR = {
  iata: "YVR",
  icao: "CYVR",
  lat: 49.1939,
  lon: -123.184,
  city: "Vancouver",
  name: "Vancouver International Airport",
};
const NOW = new Date("2026-10-20T20:00:00Z");

const record = (
  memberId: string,
  date: string,
  lands?: string,
): ArrivalRecord => ({
  conferenceId: "c",
  memberId,
  flight: { ident: readFlight("AC855")!, date, departure: null, lands },
  shared: true,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  tracking: NOT_STARTED,
});

const viewer = { memberId: "me", displayName: "Me", seen: true };
const named = new Map([
  ["ana", "Ana"],
  ["ben", "Ben"],
  ["cy", "Cy"],
]);

describe("the order of the board", () => {
  it("is by landing time, with untimed flights last on their day", () => {
    const board = boardFor(
      [
        record("ana", "2026-10-22"),
        record("ben", "2026-10-22", "2026-10-22T16:00"),
        record("cy", "2026-10-22", "2026-10-22T09:30"),
        record("me", "2026-10-21"),
      ],
      YVR,
      viewer,
      named,
      NOW,
    );
    expect(board.rows.map((r) => r.name)).toEqual(["Me", "Cy", "Ben", "Ana"]);
  });

  it("reads records saved before landing times were asked", () => {
    const old = record("ana", "2026-10-22");
    const flight: { -readonly [K in keyof ArrivalRecord["flight"]]?: unknown } =
      { ...old.flight };
    delete flight.lands;
    const board = boardFor(
      [{ ...old, flight: flight as ArrivalRecord["flight"] }],
      YVR,
      viewer,
      named,
      NOW,
    );
    expect(board.rows[0]?.lands).toBeNull();
    expect(arrivalTime(board.rows[0]!)).toBeNull();
  });
});

describe("an estimate is only ever made from a live aircraft", () => {
  const base = boardFor(
    [record("ana", "2026-10-20", "2026-10-20T14:00")],
    YVR,
    viewer,
    named,
    NOW,
  ).rows[0]!;
  const fix = {
    lat: YVR.lat,
    lon: YVR.lon + 3.7, // ~270 km east
    altitudeFt: 30000,
    groundSpeedKt: 450,
    trackDeg: 270,
    onGround: false,
    at: NOW.toISOString(),
  };

  it("distance over current ground speed, from the report's own time", () => {
    const t = arrivalTime({ ...base, phase: "airborne", position: fix });
    expect(t?.kind).toBe("estimated");
    const minutes =
      (Date.parse((t as { at: string }).at) - NOW.getTime()) / 60_000;
    expect(minutes).toBeGreaterThan(17);
    expect(minutes).toBeLessThan(22);
  });

  it("not from a stale, scheduled or on-the-ground row", () => {
    for (const row of [
      { ...base, phase: "lost" as const, position: fix },
      { ...base, phase: "scheduled" as const, position: null },
      {
        ...base,
        phase: "airborne" as const,
        position: { ...fix, onGround: true },
      },
      {
        ...base,
        phase: "airborne" as const,
        position: { ...fix, groundSpeedKt: null },
      },
    ])
      expect(arrivalTime(row)).toEqual({
        kind: "scheduled",
        local: "2026-10-20T14:00",
      });
  });
});
