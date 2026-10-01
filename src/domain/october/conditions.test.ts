import { describe, expect, it } from "vitest";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import type { Environment, SkyCondition } from "@/domain/environment/types";
import { conditionsFor } from "./conditions";

/**
 * **Four kinds of thing, four different readings of the same evening.**
 *
 * The failure this replaces was one forecast sentence pasted onto whatever was
 * outdoors. The test for "is the interpretation subject-specific" is simply:
 * hold the weather still, change the subject, and watch the answer change.
 */
const vernon = OCTOBER_PLACES.find((p) => p.id === "vernon")!;
const NOW = new Date("2026-10-08T20:00:00Z");
const DAY = "2026-10-08";

function env(
  sky: SkyCondition,
  lowC: number,
  highC: number,
  pop: number,
): Environment {
  const hourly = [];
  for (let h = -6; h <= 30; h++) {
    const at = new Date(NOW.getTime() + h * 3_600_000);
    const localHour = Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Vancouver",
      }).format(at),
    );
    const daytime = localHour >= 9 && localHour < 18;
    hourly.push({
      at: at.toISOString(),
      sky,
      temperatureC: daytime ? highC : lowC,
      precipitationChance: pop,
    });
  }
  return {
    area: vernon,
    hourly,
    nights: [{ day: DAY, sky, lowC, precipitationChance: pop }],
    provenance: {
      source: "Environment Canada",
      stationName: "Vernon",
      issuedAt: NOW.toISOString(),
      fetchedAt: NOW.toISOString(),
    },
  };
}

const COLD_CLEAR = env("clear", 2, 11, 0);
const WET = env("precipitating", 9, 13, 85);
const MILD_DRY = env("clear", 8, 16, 0);

describe("the same night, four different things", () => {
  it("tells a haunt to bring a jacket", () => {
    const read = conditionsFor("outdoor-night", DAY, COLD_CLEAR, NOW)!;
    expect(read.line).toContain("Bring a jacket");
    expect(read.facts).toContain("2°C");
  });

  it("tells a meteor shower about the sky, not the temperature", () => {
    const read = conditionsFor("astronomy", DAY, COLD_CLEAR, NOW)!;
    expect(read.line).toMatch(/clear after dark/i);
    // The question a sky event asks is never "how warm".
    expect(read.line).not.toMatch(/jacket|warm|cold/i);
  });

  it("says nothing to a hockey game on the same night", () => {
    expect(conditionsFor("indoor", DAY, COLD_CLEAR, NOW)).toBeUndefined();
  });

  it("says nothing to an unclassified subject, ever", () => {
    expect(conditionsFor("unknown", DAY, COLD_CLEAR, NOW)).toBeUndefined();
    expect(conditionsFor("unknown", DAY, WET, NOW)).toBeUndefined();
  });

  it("judges a daytime thing on the daytime, not the night", () => {
    const read = conditionsFor("outdoor-day", DAY, COLD_CLEAR, NOW)!;
    // 11°C by day is the number it reads, not the 2°C overnight low.
    expect(read.facts).toContain("11°C");
    expect(read.facts).not.toContain("2°C");
  });

  it("calls a mild dry afternoon good for being outside", () => {
    const read = conditionsFor("outdoor-day", DAY, MILD_DRY, NOW)!;
    expect(read.weight).toBe("good");
    expect(read.line).toMatch(/good weather/i);
  });
});

describe("indoor restraint", () => {
  it("never speaks on a card, however miserable the evening", () => {
    expect(conditionsFor("indoor", DAY, WET, NOW)).toBeUndefined();
    expect(
      conditionsFor("indoor", DAY, WET, NOW, { surface: "card" }),
    ).toBeUndefined();
  });

  it("speaks once on a page, when being inside has become the point", () => {
    const read = conditionsFor("indoor", DAY, WET, NOW, { surface: "page" })!;
    expect(read.line).toMatch(/indoors/i);
    // And carries no forecast — it is a suggestion, not a weather report.
    expect(read.facts).toBeUndefined();
  });

  it("stays quiet on a page when the evening is ordinary", () => {
    expect(
      conditionsFor("indoor", DAY, MILD_DRY, NOW, { surface: "page" }),
    ).toBeUndefined();
  });
});

describe("the refusals, unchanged", () => {
  it("says nothing without a forecast", () => {
    for (const kind of [
      "astronomy",
      "outdoor-night",
      "outdoor-day",
      "indoor",
    ] as const) {
      expect(conditionsFor(kind, DAY, undefined, NOW)).toBeUndefined();
    }
  });

  it("treats a stale forecast as none", () => {
    const stale: Environment = {
      ...COLD_CLEAR,
      provenance: {
        ...COLD_CLEAR.provenance,
        issuedAt: "2026-10-05T02:00:00Z",
      },
    };
    expect(conditionsFor("outdoor-night", DAY, stale, NOW)).toBeUndefined();
  });

  it("says nothing about a day the forecast does not reach", () => {
    expect(
      conditionsFor("outdoor-night", "2026-10-25", COLD_CLEAR, NOW),
    ).toBeUndefined();
  });

  it("never claims an event is off, unsafe or cancelled", () => {
    for (const kind of ["astronomy", "outdoor-night", "outdoor-day"] as const) {
      const read = conditionsFor(kind, DAY, WET, NOW);
      if (!read) continue;
      expect(read.line).not.toMatch(
        /cancel|closed|unsafe|do not go|dangerous/i,
      );
    }
  });

  it("never promises a sighting", () => {
    const read = conditionsFor("astronomy", DAY, COLD_CLEAR, NOW)!;
    expect(read.line).not.toMatch(/you will see|guaranteed|definitely/i);
  });

  it("carries attribution on everything it says", () => {
    expect(conditionsFor("outdoor-night", DAY, WET, NOW)!.source).toBe(
      "Environment Canada",
    );
  });
});
