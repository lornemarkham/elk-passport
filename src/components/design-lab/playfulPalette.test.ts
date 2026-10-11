import { describe, expect, it } from "vitest";
import { PALETTE, colourOf } from "./playfulPalette";

/**
 * The playful direction colour-codes what you can do. The obvious way is a map
 * of verb → colour, which is a taxonomy: it has to be maintained, and it
 * silently drops any verb nobody listed. Atlas's affordance vocabulary is open
 * — `Hiking`, `mountain biking`, `Spotting koi in the pond` — so the hue comes
 * from the string instead.
 */
describe("colour from the word itself", () => {
  it("gives the same verb the same colour every time", () => {
    expect(colourOf("Swimming")).toBe(colourOf("Swimming"));
  });

  it("ignores the casing Atlas happens to use", () => {
    // Atlas states both `Playground` and `playground`.
    expect(colourOf("Playground")).toBe(colourOf("playground"));
  });

  it("has a colour for a verb nobody listed", () => {
    for (const odd of [
      "Spotting koi in the pond",
      "Treetops Adventure",
      "first nations pow-wow",
      "",
    ]) {
      expect(PALETTE).toContain(colourOf(odd));
    }
  });

  it("does not put everything in one bucket", () => {
    const verbs = ["Hiking", "Swimming", "Playground", "Skating", "Fishing"];
    expect(new Set(verbs.map((v) => colourOf(v).bg)).size).toBeGreaterThan(1);
  });
});
