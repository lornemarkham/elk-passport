import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { skiAreasFrom } from "./atlas";

let n = 0;
const thing = (over: Partial<DiscoveryCandidate>) =>
  candidateToExperience({
    id: `t-${(n += 1)}`,
    kind: "Place",
    name: `Thing ${n}`,
    subtype: "park",
    description: "Somewhere.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...over,
  });
const doing = (...names: string[]) => ({
  knowledge: {
    affordances: names.map((name) => ({ name, basis: "offers" })),
  },
});

describe("ski areas from Atlas", () => {
  it("keeps what Atlas's own words put in skiing or snowboarding, and nothing else", () => {
    const pool = [
      thing({
        name: "Powder Peak",
        subtype: "ski resort",
        ...doing("Downhill skiing", "Snowboarding"),
      }),
      thing({ name: "Board Barn", ...doing("Snowboarding") }),
      thing({ name: "Nordic Loop", ...doing("Cross-country skiing") }),
      thing({ name: "Lake Beach", ...doing("Swimming") }),
    ].map((e) => e);
    expect(skiAreasFrom(pool).map((a) => a.name)).toEqual([
      "Powder Peak",
      "Board Barn",
    ]);
  });

  it("says nothing Atlas did not say: no conditions, prices or status fields", () => {
    const [area] = skiAreasFrom([
      thing({ name: "Powder Peak", subtype: "ski resort" }),
    ]);
    expect(Object.keys(area).sort()).toEqual([
      "description",
      "id",
      "latitude",
      "longitude",
      "name",
      "region",
    ]);
  });

  it("shows no picture unless Atlas says it depicts the thing itself", () => {
    const base = { name: "Powder Peak", subtype: "ski resort" } as const;
    const rep = thing({
      ...base,
      presentationImage: {
        url: "https://x/y.jpg",
        relationship: "representative",
        depictsEntity: false,
        confidence: "high",
        attribution: "Photo: Atlas",
      },
    });
    const exact = thing({
      ...base,
      name: "Exact Peak",
      presentationImage: {
        url: "https://x/z.jpg",
        relationship: "exact",
        depictsEntity: true,
        confidence: "high",
        attribution: "Photo: Atlas",
      },
    });
    const out = skiAreasFrom([rep, exact]);
    expect(out[0].image).toBeUndefined();
    expect(out[1].image).toBe("https://x/z.jpg");
  });
});
