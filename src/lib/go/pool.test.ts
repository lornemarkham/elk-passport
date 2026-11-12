import { describe, expect, it } from "vitest";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";
import { dayPool, forTheBrowser } from "./pool";

const VERNON = townById("vernon")!;

const place = (name: string, km: number): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: "park",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
    coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    evidence: [{ basis: "held-coordinate", record: "x".repeat(200) }],
  },
  presentationImage: {
    url: "https://upload.wikimedia.org/a-category-picture.jpg",
    relationship: "category",
    imageClass: "placeholder",
    rights: "licensed",
    depictsEntity: false,
    confidence: "low",
    attribution: "Illustrative picture. Not a photo of this place.",
  } as DiscoveryCandidate["presentationImage"],
  knowledge: {
    affordances: [{ name: "playground", basis: "stated-activity" }],
  },
});

const CANDIDATES = [
  place("Polson Park", 1),
  place("Kal Beach", 6),
  place("Ellison Park", 12),
  place("Lavington Park", 9),
];

describe("forTheBrowser", () => {
  it("drops the category picture and the geography evidence, and nothing the day reads", () => {
    const full = dayPool(CANDIDATES, []);
    const slim = forTheBrowser(full);

    expect(full[0]!.presentationImage).toBeDefined();
    expect(full[0]!.geography?.evidence).toBeDefined();
    for (const e of slim) {
      expect(e.presentationImage).toBeUndefined();
      expect(e.geography?.evidence).toBeUndefined();
      expect(e.geography?.coordinates).toBeDefined();
      expect(e.geography?.locality).toBe("Vernon");
      expect(e.knowledge?.affordances).toHaveLength(1);
    }
    expect(JSON.stringify(slim).length).toBeLessThan(
      JSON.stringify(full).length,
    );
  });

  it("builds the same day from the slim pool as from the full one", () => {
    const brief = readBrief("a park afternoon in Vernon");
    const full = dayPool(CANDIDATES, []);
    const ids = (pool: typeof full) =>
      buildDay({ pool, brief }).stops.map((s) => s.experience.id);

    expect(ids(full).length).toBeGreaterThan(0);
    expect(ids(forTheBrowser(full))).toEqual(ids(full));
  });
});
