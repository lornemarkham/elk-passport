import { describe, expect, it } from "vitest";
import {
  adventureSchema,
  availableMinutes,
  companionSchema,
  parseAdventure,
  remixProblems,
  timeWindowSchema,
  type Adventure,
} from "./contracts";
import { anAdventure, subjectMoment } from "./fixtures";

describe("adventureSchema", () => {
  it("accepts a well-formed adventure and survives a JSON round trip", () => {
    const adventure = anAdventure();
    const saved = JSON.parse(JSON.stringify(adventure));
    const read = parseAdventure(saved);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.adventure).toEqual(adventure);
  });

  it("fills defaults a minimal saved adventure leaves out", () => {
    const minimal: Record<string, unknown> = { ...anAdventure() };
    delete minimal.unknowns;
    const parsed = adventureSchema.parse({ ...minimal, constraints: {} });
    expect(parsed.constraints.time).toEqual({});
    expect(parsed.constraints.party).toEqual({ companions: [], needs: [] });
    expect(parsed.unknowns).toEqual([]);
  });

  it("rejects an unknown version rather than guessing at it", () => {
    expect(parseAdventure({ ...anAdventure(), version: 2 }).ok).toBe(false);
  });

  it("rejects an adventure with no moments", () => {
    expect(parseAdventure({ ...anAdventure(), moments: [] }).ok).toBe(false);
  });

  it("rejects duplicate moment ids", () => {
    const m = subjectMoment("polson-park");
    expect(parseAdventure({ ...anAdventure(), moments: [m, m] }).ok).toBe(
      false,
    );
  });

  it("rejects an adventure that remixes itself", () => {
    const a = anAdventure();
    expect(parseAdventure({ ...a, remixOf: a.id }).ok).toBe(false);
  });

  it("requires a subject moment to spell silence as unknown", () => {
    const noOpen: Record<string, unknown> = { ...subjectMoment("polson-park") };
    delete noOpen.open;
    expect(parseAdventure({ ...anAdventure(), moments: [noOpen] }).ok).toBe(
      false,
    );
  });

  it("refuses a free moment that carries a place", () => {
    const parsed = adventureSchema.parse({
      ...anAdventure(),
      moments: [
        {
          kind: "free",
          id: "lunch",
          label: "Lunch, wherever",
          minutes: 45,
          point: { state: "known", value: { latitude: 50, longitude: -119 } },
        },
      ],
    });
    // Zod strips unknown keys: a free moment cannot come back with a point.
    expect(parsed.moments[0]).not.toHaveProperty("point");
  });

  it("refuses an unsourced known reading", () => {
    const m = {
      ...subjectMoment("polson-park"),
      cost: { state: "known", value: { text: "Free" } },
    };
    expect(parseAdventure({ ...anAdventure(), moments: [m] }).ok).toBe(false);
  });
});

describe("time window", () => {
  it("rejects a home-by before leaving", () => {
    expect(
      timeWindowSchema.safeParse({ startAt: "14:00", homeBy: "09:00" }).success,
    ).toBe(false);
    expect(timeWindowSchema.safeParse({ startAt: "25:00" }).success).toBe(
      false,
    );
    expect(timeWindowSchema.safeParse({ on: "Saturday" }).success).toBe(false);
  });

  it("takes the tighter of hours and the clock", () => {
    expect(availableMinutes({ hours: 4 })).toBe(240);
    expect(availableMinutes({ startAt: "08:40", homeBy: "12:50" })).toBe(250);
    expect(
      availableMinutes({ hours: 5, startAt: "08:40", homeBy: "12:50" }),
    ).toBe(250);
    expect(availableMinutes({})).toBeUndefined();
  });
});

describe("companions", () => {
  it("keeps a child a child", () => {
    expect(companionSchema.safeParse({ role: "child", age: 5 }).success).toBe(
      true,
    );
    expect(companionSchema.safeParse({ role: "child", age: 30 }).success).toBe(
      false,
    );
    expect(companionSchema.safeParse({ role: "child" }).success).toBe(true);
  });
});

describe("remixProblems", () => {
  const parent: Adventure = anAdventure({
    moments: [
      { ...subjectMoment("polson-park"), pinned: true },
      subjectMoment("kal-beach"),
    ],
  });

  it("accepts a remix that leaves pinned moments alone", () => {
    const child = anAdventure({
      id: "b",
      remixOf: parent.id,
      moments: [parent.moments[0]!, subjectMoment("ellison-park")],
    });
    expect(remixProblems(parent, child)).toEqual([]);
  });

  it("names a removed or retimed pinned moment, and a lost parent", () => {
    const removed = anAdventure({
      id: "b",
      remixOf: parent.id,
      moments: [subjectMoment("kal-beach")],
    });
    expect(remixProblems(parent, removed)).toEqual([
      'Pinned moment "polson-park" was removed',
    ]);

    const retimed = anAdventure({
      id: "c",
      moments: [{ ...parent.moments[0]!, minutes: 15 }],
    });
    expect(remixProblems(parent, retimed)).toEqual([
      'remixOf is "", not "a"',
      'Pinned moment "polson-park" changed its time',
    ]);
  });
});
