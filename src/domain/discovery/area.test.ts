import { describe, expect, it } from "vitest";
import {
  areaOf,
  countElsewhere,
  elsewhere,
  otherAreas,
  withoutElsewhere,
} from "./area";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **The fix has to remove Vancouver without removing Vernon.**
 *
 * 1,818 of 2,683 candidates have no stated area. If silence counted as
 * distance, this would clear thirty-four Vancouver records and two thirds of
 * the corpus with them. These pin that it does not.
 */
const candidate = (name: string, area?: string): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...(area
    ? {
        geography: {
          state: "observed" as const,
          area: { id: area, name: area },
        },
      }
    : {}),
});

const pool = [
  candidate("Ellison Park", "Okanagan"),
  candidate("Kalamoir Park", "Okanagan"),
  candidate("Canyon Frights", "Metro Vancouver"),
  candidate("UBC Museum of Anthropology", "Metro Vancouver"),
  candidate("Kitsilano Farmers Market", "Vancouver Island"),
  // Atlas states nothing about where this is — 1,818 of the corpus.
  candidate("Jump2it Indoor Playground"),
].map(candidateToExperience);

describe("what Atlas states about where something is", () => {
  it("reads the area Atlas states and never infers one", () => {
    expect(areaOf(pool[0]!)).toBe("Okanagan");
    expect(areaOf(pool[5]!)).toBeUndefined();
  });

  it("calls a stated, different area elsewhere", () => {
    expect(elsewhere(pool[2]!, "Okanagan")).toBe(true);
  });

  it("never calls silence elsewhere", () => {
    // The whole fix turns on this one.
    expect(elsewhere(pool[5]!, "Okanagan")).toBe(false);
  });

  it("calls nothing elsewhere when there is nowhere to be else than", () => {
    for (const experience of pool) {
      expect(elsewhere(experience, undefined)).toBe(false);
    }
  });
});

describe("the ordinary local page", () => {
  it("drops what Atlas places somewhere else", () => {
    const names = withoutElsewhere(pool, "Okanagan").map((e) => e.title);
    expect(names).not.toContain("Canyon Frights");
    expect(names).not.toContain("UBC Museum of Anthropology");
    expect(names).not.toContain("Kitsilano Farmers Market");
  });

  it("keeps everything Atlas has not placed", () => {
    const names = withoutElsewhere(pool, "Okanagan").map((e) => e.title);
    expect(names).toContain("Jump2it Indoor Playground");
    expect(names).toContain("Ellison Park");
    expect(names).toContain("Kalamoir Park");
  });

  it("changes nothing at all without a home area", () => {
    expect(withoutElsewhere(pool, undefined)).toHaveLength(pool.length);
  });

  it("says how many it is holding back, so the offer can be honest", () => {
    expect(countElsewhere(pool, "Okanagan")).toBe(3);
    expect(countElsewhere(pool, undefined)).toBe(0);
  });

  it("names the other areas, most-stated first", () => {
    expect(otherAreas(pool, "Okanagan")).toEqual([
      "Metro Vancouver",
      "Vancouver Island",
    ]);
  });
});
