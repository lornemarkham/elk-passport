import { describe, expect, it } from "vitest";
import { ArenaActionSchema } from "./arena-mode";
import {
  ARENA_AT,
  MAX_ACCURACY_M,
  gpsIsStale,
  hintFromReading,
  hintWords,
  metresBetween,
  presenceOf,
  summonTally,
  type Summon,
} from "./crew";

const at = (dLat: number, dLng = 0, accuracy = 30) => ({
  lat: ARENA_AT.lat + dLat,
  lng: ARENA_AT.lng + dLng,
  accuracy,
});

describe("GPS hint", () => {
  it("measures metres", () => {
    expect(metresBetween(ARENA_AT, ARENA_AT)).toBe(0);
    // 0.001° of latitude ≈ 111 m
    expect(metresBetween(ARENA_AT, at(0.001))).toBeGreaterThan(105);
    expect(metresBetween(ARENA_AT, at(0.001))).toBeLessThan(117);
  });

  it("sorts a reading into around / near / away", () => {
    expect(hintFromReading(at(0))?.zone).toBe("around");
    expect(hintFromReading(at(0.0015))?.zone).toBe("around"); // ~167 m
    expect(hintFromReading(at(0.004))?.zone).toBe("near"); // ~445 m
    expect(hintFromReading(at(0.05))?.zone).toBe("away"); // ~5.5 km
  });

  it("rounds, so the row cannot be used to rebuild a position", () => {
    const h = hintFromReading(at(0.00417, 0, 33))!;
    expect(h.distanceM % 50).toBe(0);
    expect(h.accuracyM % 10).toBe(0);
    expect(Object.keys(h).sort()).toEqual(["accuracyM", "distanceM", "zone"]);
  });

  it("refuses a reading too rough to say anything", () => {
    expect(hintFromReading(at(0, 0, MAX_ACCURACY_M + 1))).toBeUndefined();
    expect(hintFromReading(at(0, 0, MAX_ACCURACY_M))).toBeDefined();
  });

  it("never claims a level, section or 'here'", () => {
    for (const d of [0, 0.004, 0.05]) {
      const words = hintWords(hintFromReading(at(d))!);
      expect(words).toMatch(/^Phone is /);
      expect(words).not.toMatch(/section|level|here|inside|in the building/i);
      expect(words).toMatch(/±\d+ m/);
    }
  });

  it("goes stale after ten minutes", () => {
    const now = new Date("2026-10-24T20:00:00Z");
    expect(gpsIsStale("2026-10-24T19:55:00Z", now)).toBe(false);
    expect(gpsIsStale("2026-10-24T19:49:00Z", now)).toBe(true);
  });

  it("is accepted by the action schema only with a sane reading", () => {
    const ok = ArenaActionSchema.safeParse({
      type: "gpsShare",
      reading: at(0),
    });
    expect(ok.success).toBe(true);
    for (const reading of [
      { lat: 91, lng: 0, accuracy: 5 },
      { lat: 0, lng: 181, accuracy: 5 },
      { lat: 0, lng: 0, accuracy: -1 },
      { lat: "x", lng: 0, accuracy: 1 },
    ]) {
      expect(
        ArenaActionSchema.safeParse({ type: "gpsShare", reading }).success,
      ).toBe(false);
    }
  });
});

describe("presence: nobody is 'here' unless they said so", () => {
  const hint = { zone: "around", distanceM: 0, accuracyM: 20 } as const;
  it("needs a check-in inside the building", () => {
    expect(presenceOf({ place: "sec:112", inside: true })).toBe("in");
    expect(presenceOf({ place: "sec:112", inside: true, hint })).toBe("in");
  });
  it("a GPS hint alone is a hint", () => {
    expect(presenceOf({ hint })).toBe("hint");
  });
  it("on my way and outside are not present", () => {
    expect(presenceOf({ place: "out:coming", inside: false, hint })).toBe(
      "coming",
    );
    expect(presenceOf({ place: "out:outside", inside: false })).toBe("outside");
  });
  it("silence is quiet, not missing", () => {
    expect(presenceOf({})).toBe("quiet");
  });
});

describe("summon", () => {
  const s: Summon = {
    id: "s",
    from: "a",
    place: "sec:112",
    note: "",
    at: "2026-10-24T20:00:00Z",
    replies: [
      { user: "b", response: "coming", at: "x" },
      { user: "c", response: "busy", at: "x" },
      { user: "d", response: "where", at: "x" },
    ],
  };
  it("tallies who is coming, busy, asking and silent", () => {
    expect(summonTally(s, ["a", "b", "c", "d", "e"])).toEqual({
      coming: ["b"],
      busy: ["c"],
      where: ["d"],
      silent: ["e"],
    });
  });
  it("validates the three responses and nothing else", () => {
    const base = {
      type: "summonReply",
      summon: "7f9c24e8-3b12-4f3a-9c1d-1a2b3c4d5e6f",
    };
    for (const response of ["coming", "busy", "where"]) {
      expect(ArenaActionSchema.safeParse({ ...base, response }).success).toBe(
        true,
      );
    }
    expect(
      ArenaActionSchema.safeParse({ ...base, response: "maybe" }).success,
    ).toBe(false);
  });
});

describe("snack run", () => {
  it("takes a line of text and no money", () => {
    const run = "7f9c24e8-3b12-4f3a-9c1d-1a2b3c4d5e6f";
    expect(
      ArenaActionSchema.safeParse({
        type: "runRequest",
        run,
        item: "  two   dogs ",
      }),
    ).toMatchObject({ success: true, data: { item: "two dogs" } });
    expect(
      ArenaActionSchema.safeParse({ type: "runRequest", run, item: "" })
        .success,
    ).toBe(false);
    expect(
      ArenaActionSchema.safeParse({
        type: "runRequest",
        run,
        item: "x".repeat(61),
      }).success,
    ).toBe(false);
    // Extra keys such as a price are not part of the contract.
    const parsed = ArenaActionSchema.parse({
      type: "runRequest",
      run,
      item: "dog",
      price: 900,
    });
    expect(parsed).not.toHaveProperty("price");
  });
});
