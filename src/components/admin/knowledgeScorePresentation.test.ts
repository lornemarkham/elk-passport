import { describe, expect, it } from "vitest";
import {
  SCORE_TIER_LEGEND,
  scoreBadgeClasses,
  scoreBarColor,
  scoreTextColor,
  scoreTier,
  scoreTierLabel,
} from "./knowledgeScorePresentation";

describe("scoreTier", () => {
  it("classifies 90 and above as excellent", () => {
    expect(scoreTier(90)).toBe("excellent");
    expect(scoreTier(100)).toBe("excellent");
  });

  it("classifies 70-89 as good", () => {
    expect(scoreTier(70)).toBe("good");
    expect(scoreTier(89)).toBe("good");
  });

  it("classifies 40-69 as needs-work", () => {
    expect(scoreTier(69)).toBe("needs-work");
    expect(scoreTier(40)).toBe("needs-work");
  });

  it("classifies below 40 as poor — Sprint 2 Refinement's 4th tier, so a near-empty entity (e.g. ~13%) doesn't read the same as one with real, partial gaps", () => {
    expect(scoreTier(39)).toBe("poor");
    expect(scoreTier(13)).toBe("poor");
    expect(scoreTier(0)).toBe("poor");
  });
});

describe("scoreTierLabel", () => {
  it("matches scoreTier's own thresholds, never disagreeing with it", () => {
    for (const percent of [0, 13, 39, 40, 42, 69, 70, 71, 89, 90, 100]) {
      const tier = scoreTier(percent);
      const label = scoreTierLabel(percent);
      const expected =
        tier === "excellent"
          ? "Excellent"
          : tier === "good"
            ? "Good"
            : tier === "needs-work"
              ? "Needs Work"
              : "Poor";
      expect(label).toBe(expected);
    }
  });

  it("never returns internal terminology like the word 'tier' itself", () => {
    for (const percent of [0, 13, 39, 40, 69, 70, 89, 90, 100]) {
      expect(scoreTierLabel(percent).toLowerCase()).not.toContain("tier");
    }
  });
});

describe("scoreTextColor / scoreBarColor / scoreBadgeClasses", () => {
  it("returns a neutral color for null (not-applicable), never a tier color", () => {
    expect(scoreTextColor(null)).toBe("text-foreground");
  });

  it("stays internally consistent across every presentation helper for the same percent", () => {
    for (const percent of [10, 55, 75, 95]) {
      const tier = scoreTier(percent);
      const expectedHue =
        tier === "excellent"
          ? "green"
          : tier === "good"
            ? "amber"
            : tier === "needs-work"
              ? "orange"
              : "red";
      expect(scoreTextColor(percent)).toContain(expectedHue);
      expect(scoreBarColor(percent)).toContain(expectedHue);
      expect(scoreBadgeClasses(percent)).toContain(expectedHue);
    }
  });
});

describe("SCORE_TIER_LEGEND", () => {
  it("names all four tiers in plain language, for inline display anywhere a bare tier label needs context", () => {
    expect(SCORE_TIER_LEGEND).toMatch(/Excellent/);
    expect(SCORE_TIER_LEGEND).toMatch(/Good/);
    expect(SCORE_TIER_LEGEND).toMatch(/Needs Work/);
    expect(SCORE_TIER_LEGEND).toMatch(/Poor/);
  });
});
