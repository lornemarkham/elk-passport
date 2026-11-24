import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { readChristmas } from "./themes";

/**
 * **The CPKC Holiday Train, the moment Atlas holds it** (owner brief M1064).
 * On 2026-11-23 no Holiday Train stop was in production Atlas (Atlas
 * missions 1063 and 1065 are adding them). This says what Passport does when
 * one arrives: an M1042 record re-titled as a stop, so the shape is Atlas's
 * own, not invented.
 */
const base = (
  JSON.parse(
    readFileSync(
      "e2e/fixtures/christmas-events/m1042-as-published.json",
      "utf8",
    ),
  ) as { candidates: DiscoveryCandidate[] }
).candidates[0]!;

// Frostival's own description mentions the holidays; a stop's name must be
// enough on its own, so the description says nothing seasonal.
const stop = (name: string) =>
  candidateToExperience({
    ...base,
    name,
    subtype: "Event",
    description:
      "A free show from the train. Bring a donation for the food bank.",
  } as DiscoveryCandidate);

describe("CPKC Holiday Train", () => {
  it("is a Christmas find and a winter festival, by its name alone", () => {
    for (const title of [
      "CPKC Holiday Train",
      "CPKC Holiday Train — Salmon Arm",
      "Holiday Train in Revelstoke",
    ]) {
      const r = readChristmas(stop(title));
      expect(r?.christmas, title).toBe(true);
      expect(r?.themes, title).toContain("festivals");
    }
  });
});
