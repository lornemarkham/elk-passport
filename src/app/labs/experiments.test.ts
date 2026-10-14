import { describe, expect, it } from "vitest";
import { labExperiments } from "./experiments";

const by = (env: Record<string, string | undefined>, isDev: boolean) =>
  Object.fromEntries(labExperiments(env, isDev).map((e) => [e.id, e]));

describe("Labs only links what can be played here", () => {
  it("never links a blocked experiment, in any environment", () => {
    for (const [env, dev] of [
      [{}, false],
      [{}, true],
      [{ ATLAS_API_URL: "http://atlas", CONFERENCE_STORE: "supabase" }, false],
    ] as const) {
      for (const e of labExperiments(env, dev)) {
        expect(e.status === "playable").toBe(Boolean(e.href));
      }
    }
  });

  it("closes the Atlas-made experiences when there is no Atlas", () => {
    const x = by({}, false);
    expect(x["go-have-a-day"].status).toBe("blocked");
    expect(x["vancouver-discovery"].status).toBe("blocked");
    expect(x["go-have-a-day"].note).toMatch(/Atlas/);
  });

  it("opens them when Atlas is configured", () => {
    const x = by({ ATLAS_API_URL: "http://atlas" }, false);
    expect(x["go-have-a-day"].href).toBe("/go");
    expect(x["vancouver-discovery"].href).toBe("/discovery");
  });

  it("keeps the browser-only experiments playable with no environment at all", () => {
    const x = by({}, false);
    expect(x["hockey-night"].href).toBe("/labs/experience/sycle-hockey-night");
    expect(x["experience-lab"].status).toBe("playable");
  });

  it("says why Conference is closed, rather than hiding it", () => {
    const c = by({}, false)["conference"];
    expect(c.status).toBe("blocked");
    expect(c.note).toContain("CONFERENCE_STORE");
  });

  it("never opens shared Hockey Night, whatever the environment", () => {
    for (const dev of [true, false]) {
      expect(
        by({ CONFERENCE_STORE: "supabase" }, dev)["hockey-shared"].status,
      ).toBe("blocked");
    }
  });

  it("keeps Arrivals closed outside development, and says it is memory-only inside", () => {
    expect(
      by(
        { CONFERENCE_STORE: "memory", CONFERENCE_SECRET: "x".repeat(40) },
        false,
      )["arrivals"].status,
    ).toBe("blocked");
    const dev = by({}, true)["arrivals"];
    expect(dev.status).toBe("playable");
    expect(dev.note).toMatch(/memory/);
  });

  it("does not put October in Labs: it belongs to iamoctober.com", () => {
    expect(
      labExperiments({}, true).some((e) => /october/i.test(e.id + e.title)),
    ).toBe(false);
  });
});
