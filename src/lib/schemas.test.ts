import { describe, expect, it } from "vitest";
import { planInputSchema, recommendationSchema } from "@/lib/schemas";

describe("planInputSchema", () => {
  it("accepts a well-formed plan input", () => {
    const result = planInputSchema.safeParse({
      intent: "Adventure",
      constraints: {
        timeAvailable: "All day",
        budget: "Treat me",
        location: "Near me",
      },
      dna: { traits: ["Loves water"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown intent", () => {
    const result = planInputSchema.safeParse({
      intent: "Skydiving",
      constraints: {
        timeAvailable: "All day",
        budget: "Treat me",
        location: "Near me",
      },
      dna: { traits: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty location", () => {
    const result = planInputSchema.safeParse({
      intent: "Relax",
      constraints: {
        timeAvailable: "All day",
        budget: "Treat me",
        location: "",
      },
      dna: { traits: [] },
    });
    expect(result.success).toBe(false);
  });
});

describe("recommendationSchema", () => {
  it("rejects a recommendation with no blocks", () => {
    const result = recommendationSchema.safeParse({
      title: "A Day Out",
      tagline: "Go do something.",
      blocks: [],
    });
    expect(result.success).toBe(false);
  });
});
