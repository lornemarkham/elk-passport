import { describe, expect, it } from "vitest";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate, RainReading } from "@/lib/data/types";
import { weatherFor } from "./weather";
import { prepFor, printableFromDay } from "./printable";

// Fixtures, not Atlas.
const place = (
  name: string,
  rain?: { reading: RainReading; basis: "stated" | "derived"; text?: string },
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: name,
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...(rain
    ? {
        environment: {
          setting: "unknown",
          rain: { reading: rain.reading, basis: rain.basis },
          ...(rain.text
            ? {
                statements: [
                  { text: rain.text } as NonNullable<
                    NonNullable<DiscoveryCandidate["environment"]>["statements"]
                  >[number],
                ],
              }
            : {}),
        },
      }
    : {}),
});

const day = (pool: DiscoveryCandidate[], said = "Five hours") =>
  buildDay({ pool: pool.map(candidateToExperience), brief: readBrief(said) });

const POOL = [
  place("The Rink", { reading: "sheltered", basis: "stated" }),
  place("The Beach", { reading: "exposed", basis: "derived" }),
  place("The Gardens", {
    reading: "weather-dependent",
    basis: "stated",
    text: "Open daily, weather dependent",
  }),
  place("The Hall"),
];

describe("weatherFor", () => {
  it("files every stop by what Atlas says the rain does, and unknown as unknown", () => {
    const w = weatherFor(day(POOL));
    expect(w.covered).toEqual(["The Rink"]);
    expect(w.exposed).toEqual(["The Beach"]);
    expect(w.mayNotRun).toEqual(["The Gardens"]);
    expect(w.unknown).toEqual(["The Hall"]);
  });

  it("never writes a forecast it was not given", () => {
    expect(weatherFor(day(POOL)).forecast).toBeUndefined();
  });

  it("carries a forecast through untouched, source and all", () => {
    const forecast = {
      wet: true,
      chance: 70,
      description: "Showers",
      source: "Environment Canada",
      area: "Vernon",
      km: 2,
    };
    expect(weatherFor(day(POOL), forecast).forecast).toEqual(forecast);
  });

  it("only packs for weather conditionally, and for the child only when one was named", () => {
    const w = weatherFor(day(POOL, "Five hours with my 6-year-old"));
    expect(w.ifWet.join(" ")).toContain("6-year-old");
    expect(weatherFor(day(POOL)).ifWet.join(" ")).not.toMatch(/year-old/);
    // No sentence about what the weather will be.
    for (const line of [...w.ifWet, ...w.ifCold, ...w.ifHot]) {
      expect(line).not.toMatch(/will be|expected|usually|typically/i);
    }
  });
});

describe("rain on each stop", () => {
  it("says a derived reading less firmly, and quotes the source sentence", () => {
    const stops = printableFromDay(day(POOL)).stops;
    const by = (t: string) => stops.find((s) => s.title === t)!;
    expect(by("The Beach").rain?.line).toBe(
      "Out in the open, going by what we know",
    );
    expect(by("The Gardens").rain?.because).toBe(
      "Open daily, weather dependent",
    );
    expect(by("The Hall").rain).toBeUndefined();
  });
});

describe("the forecast line on the checklist", () => {
  it("names the source when a forecast came in, and offers the box when not", () => {
    const d = day(POOL);
    const without = prepFor(d).find((i) => i.id === "weather")!;
    expect(without.why).toMatch(/box to write it in/);
    const withIt = prepFor(d, {
      forecast: { wet: false, source: "Environment Canada" },
    }).find((i) => i.id === "weather")!;
    expect(withIt.why).toContain("Environment Canada");
    expect(withIt.basis).toBe("check");
  });
});
