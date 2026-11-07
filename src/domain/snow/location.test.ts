import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_MINUTES,
  SHARE_MINUTES,
  ageWords,
  describeFrom,
  distanceWords,
  labelFor,
  metresBetween,
  parseShare,
  pointOf,
  remainingWords,
  round4,
  type CrewPosition,
} from "./location";

const base = { lat: 50.0, lng: -123.0, accuracyM: 5 };
const at = (dLat: number, dLng: number) => ({
  lat: base.lat + dLat,
  lng: base.lng + dLng,
  accuracyM: 5,
});
const pos = (f: ReturnType<typeof at>, updatedAt: string): CrewPosition => ({
  ...f,
  memberId: "m1",
  updatedAt,
  expiresAt: "2026-12-12T20:00:00Z",
});

describe("share rules", () => {
  it("never lasts longer than four hours", () => {
    expect(Math.max(...SHARE_MINUTES)).toBe(MAX_SHARE_MINUTES);
    expect(MAX_SHARE_MINUTES).toBe(240);
  });

  it("rounds to about 11 m before anything leaves the phone", () => {
    expect(round4(50.123456789)).toBe(50.1235);
    const p = parseShare({ lat: 50.123456, lng: -123.987654, minutes: 60 })!;
    expect(p.fix).toMatchObject({ lat: 50.1235, lng: -123.9877 });
    expect(p.minutes).toBe(60);
  });

  it.each([
    [null],
    ["x"],
    [{ lat: "50", lng: 1 }],
    [{ lat: 91, lng: 0 }],
    [{ lat: 0, lng: 181 }],
    [{ lat: NaN, lng: 0 }],
    [{ lat: 1, lng: 1, minutes: 9999 }],
    [{ lat: 1, lng: 1, minutes: 241 }],
  ])("refuses %j", (raw) => {
    expect(parseShare(raw)).toBeNull();
  });

  it("allows an update with no duration (it never extends a share)", () => {
    expect(parseShare({ lat: 1, lng: 2 })!.minutes).toBeNull();
  });
});

describe("where is everyone, in words", () => {
  it("measures and points", () => {
    // ~0.002 deg of latitude is ~222 m north
    const north = at(0.002, 0);
    expect(Math.round(metresBetween(base, north))).toBeGreaterThan(200);
    expect(pointOf(base, north)).toBe("north");
    expect(pointOf(base, at(-0.002, 0))).toBe("south");
    expect(pointOf(base, at(0, 0.003))).toBe("east");
    expect(pointOf(base, at(0.002, -0.003))).toBe("north-west");
  });

  it("says right here when close, and metres/km otherwise", () => {
    expect(distanceWords(12)).toBe("right here");
    expect(distanceWords(240)).toBe("about 240 m");
    expect(distanceWords(1540)).toBe("about 1.5 km");
  });

  it("describes a fresh position and marks an old one as last seen", () => {
    const now = new Date("2026-12-12T15:00:00Z");
    const fresh = pos(at(0.002, 0), "2026-12-12T14:59:00Z");
    expect(describeFrom(base, fresh, now)).toMatch(
      /^about 220 m north of you · 1 min ago$/,
    );
    const old = pos(at(0.002, 0), "2026-12-12T14:50:00Z");
    expect(describeFrom(base, old, now)).toMatch(
      /^last seen about 220 m north of you, 10 min ago$/,
    );
  });

  it("counts the time left", () => {
    const now = new Date("2026-12-12T15:00:00Z");
    expect(remainingWords("2026-12-12T15:20:00Z", now)).toBe("20 min left");
    expect(remainingWords("2026-12-12T17:05:00Z", now)).toBe("2 h 05 min left");
    expect(remainingWords("2026-12-12T14:59:00Z", now)).toBe("ending");
    expect(ageWords("2026-12-12T14:59:50Z", now)).toBe("just now");
    expect(labelFor(30)).toBe("30 min");
    expect(labelFor(60)).toBe("1 hour");
    expect(labelFor(240)).toBe("4 hours");
  });
});
