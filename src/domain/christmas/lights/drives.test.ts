import { describe, expect, it } from "vitest";
import { SEED } from "./seed";
import { visible, EMPTY } from "./model";
import { suggestedDrives, drivingFromHere } from "./drives";

const NOW = new Date("2026-11-19T20:00:00Z");
const pins = visible(
  { pins: [...EMPTY.pins, ...SEED] },
  { key: null, reviewer: false },
  NOW,
);

describe("suggestedDrives", () => {
  it("builds each drive only from displays confirmed lit that night", () => {
    const drives = suggestedDrives(pins, "2026-11-19");
    for (const d of drives) {
      expect(d.stops.length).toBeGreaterThanOrEqual(2);
      for (const s of d.stops) {
        const p = pins.find((x) => x.id === s.id)!;
        expect(p.season).toBe("lit");
        expect(p.status).toBe("approved");
      }
    }
  });
  it("never offers the same set of stops twice", () => {
    const drives = suggestedDrives(pins, "2026-11-19");
    const keys = drives.map((d) =>
      d.stops
        .map((s) => s.id)
        .sort()
        .join("|"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("offers nothing rather than padding when nothing is confirmed", () => {
    expect(suggestedDrives([], "2026-11-19")).toEqual([]);
  });
  it("directions start from the phone, not from a town centre", () => {
    const url = new URL(
      drivingFromHere([
        { lat: 50.26, lng: -119.27 },
        { lat: 50.27, lng: -119.28 },
      ]),
    );
    expect(url.searchParams.has("origin")).toBe(false);
    expect(url.searchParams.get("destination")).toBe("50.27,-119.28");
    expect(url.searchParams.get("waypoints")).toBe("50.26,-119.27");
  });
});
