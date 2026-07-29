import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalRecommendation } from "@/lib/ai/local-recommender";
import { TODAYS_INTENTS, type PlanInput } from "@/lib/schemas";

function inputFor(intent: PlanInput["intent"]): PlanInput {
  return {
    intent,
    constraints: {
      timeAvailable: "Half a day",
      budget: "Some spending money",
      location: "Kelowna",
    },
    dna: { traits: ["Foodie"] },
  };
}

// getLocalRecommendation now calls the real Atlas API (see
// src/lib/ai/local-recommender.ts) — fetch is mocked here so this stays a
// fast, offline unit test rather than requiring a live Atlas server.
const fakePlace = {
  kind: "Place",
  id: "place-1",
  name: "Kelowna",
  description: "A real Atlas place used for testing.",
};
const fakeActivity = {
  kind: "Activity",
  id: "activity-1",
  name: "Hiking",
  description: "A real Atlas activity used for testing.",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      if (path.startsWith("/search") || path === "/places") {
        return { ok: true, json: async () => [fakePlace] } as Response;
      }
      if (path === "/activities") {
        return { ok: true, json: async () => [fakeActivity] } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getLocalRecommendation", () => {
  it.each(TODAYS_INTENTS)(
    "returns a valid recommendation for intent %s",
    async (intent) => {
      const recommendation = await getLocalRecommendation(inputFor(intent));
      expect(recommendation.title).toBeTruthy();
      expect(recommendation.tagline).toBeTruthy();
      expect(recommendation.blocks.length).toBeGreaterThanOrEqual(2);
    },
  );

  it("mentions the stated location in the tagline", async () => {
    const recommendation = await getLocalRecommendation(inputFor("Relax"));
    expect(recommendation.tagline).toContain("Kelowna");
  });
});
