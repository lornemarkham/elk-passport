import { describe, expect, it } from "vitest";
import { carryBrief, uncarryBrief } from "./carry";
import { readBrief, reviseBrief } from "./brief";

describe("a revised brief reaches the paper intact", () => {
  it("survives the round trip where re-reading the sentence would not", () => {
    let brief = readBrief("four hours, $40, with friends near Vernon");
    brief = reviseBrief(brief, "longer");
    brief = reviseBrief(brief, "we have $80 now");
    brief = reviseBrief(brief, "actually just me");
    // Re-reading the accumulated sentence gets the first answers back.
    const reread = readBrief(brief.said);
    expect(reread.budget).toBe(40);
    expect(reread.hours).toBe(4);
    // Carrying it does not.
    const carried = uncarryBrief(carryBrief(brief));
    expect(carried.budget).toBe(80);
    expect(carried.hours).toBe(5);
    expect(carried.party).toBe("solo");
  });

  it("drops anything malformed rather than trusting a URL", () => {
    expect(uncarryBrief("not json")).toEqual({});
    expect(
      uncarryBrief(
        JSON.stringify({
          hours: -3,
          party: "everyone",
          shelter: "cave",
          budget: "lots",
        }),
      ),
    ).toEqual({});
  });
});
