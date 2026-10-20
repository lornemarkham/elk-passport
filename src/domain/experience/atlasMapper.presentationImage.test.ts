import { describe, expect, it } from "vitest";
import { candidateToExperience } from "./atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

const candidate = (extra: Partial<DiscoveryCandidate>): DiscoveryCandidate =>
  ({
    id: "x",
    kind: "Organization",
    name: "Some Brewery",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...extra,
  }) as DiscoveryCandidate;

describe("Atlas's presentationImage (ADR 106)", () => {
  it("is carried through with its relationship and credit, URL unescaped", () => {
    const e = candidateToExperience(
      candidate({
        presentationImage: {
          url: "https://x.test/a.jpg?a=1&amp;b=2",
          relationship: "category",
          depictsEntity: false,
          confidence: "low",
          source: { host: "x.test", evidence: "licensed:CC0" },
          attribution:
            "Illustrative brewery photo. Not a photo of Some Brewery.",
          license: { name: "CC0", author: "A" },
        },
      }),
    );
    expect(e.presentationImage?.url).toBe("https://x.test/a.jpg?a=1&b=2");
    expect(e.presentationImage?.relationship).toBe("category");
    expect(e.presentationImage?.license?.author).toBe("A");
  });

  it("never becomes heroMedia: the strict lead stays the strict lead", () => {
    const e = candidateToExperience(
      candidate({
        presentationImage: {
          url: "https://x.test/a.jpg",
          relationship: "venue",
          depictsEntity: false,
          confidence: "high",
          source: { host: "x.test", evidence: "curator" },
          attribution: "x",
        },
      }),
    );
    expect(e.heroMedia).toBeUndefined();
  });
});
