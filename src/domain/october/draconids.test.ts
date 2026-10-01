import { describe, expect, it } from "vitest";
import { beatsFor, type DraconidFact } from "./draconids";

/**
 * **The sequence is Atlas's facts, arranged — never Passport's inventions.**
 *
 * The risk in a thing like this is not a bug; it is a plausible sentence. A
 * beat that keeps its framing after its evidence disappears has quietly
 * become something Passport made up about the sky, so the rule is that the
 * beat goes with the fact.
 */
const ATLAS: DraconidFact[] = [
  { label: "Overall duration of shower", value: "October 6 through 10." },
  {
    label: "Radiant",
    value: "Highest in the sky in the evening hours. See chart below.",
  },
  {
    label: "Expected meteors at peak, under ideal conditions",
    value:
      "Under a dark sky with no moon, you might catch 10 Draconid meteors per hour.",
  },
  {
    label: "Nearest moon phase",
    value: "New moon is 15:50 UTC on October 10.",
  },
  {
    label: "When to watch",
    value:
      "The best time to watch the Draconids in 2026 is as darkness falls on the evening of October 8.",
  },
];
const WINDOW = {
  from: "2026-10-06T00:00:00.000Z",
  to: "2026-10-10T00:00:00.000Z",
};

describe("the sequence", () => {
  it("is short enough to be a quick experience", () => {
    const beats = beatsFor(ATLAS, WINDOW);
    expect(beats.length).toBeGreaterThanOrEqual(5);
    expect(beats.length).toBeLessThanOrEqual(8);
  });

  it("opens on the sky and ends on the person's own night", () => {
    const beats = beatsFor(ATLAS, WINDOW);
    expect(beats[0]!.id).toBe("open");
    expect(beats[beats.length - 1]!.id).toBe("yours");
  });

  it("leads with the fact nobody would notice in a table", () => {
    // "Highest in the evening" is the whole reason this is worth a sequence:
    // almost every other shower is a 3am proposition.
    const beats = beatsFor(ATLAS, WINDOW);
    const evening = beats.find((b) => b.id === "evening")!;
    expect(evening.fact?.label).toBe("Radiant");
    expect(evening.line).toMatch(/don't have to stay up/i);
  });

  it("sets expectations rather than overselling", () => {
    const beats = beatsFor(ATLAS, WINDOW);
    const scale = beats.find((b) => b.id === "scale")!;
    expect(scale.line).toMatch(/don't expect a storm/i);
    expect(scale.fact?.value).toContain("10 Draconid meteors per hour");
  });

  it("never promises anybody will see one", () => {
    for (const beat of beatsFor(ATLAS, WINDOW)) {
      const said = `${beat.line} ${beat.under ?? ""}`;
      expect(said).not.toMatch(
        /you will see|guaranteed|definitely|certain to/i,
      );
    }
  });
});

describe("every claim is Atlas's", () => {
  it("quotes facts verbatim, label and value", () => {
    const beats = beatsFor(ATLAS, WINDOW);
    for (const beat of beats) {
      if (!beat.fact) continue;
      const source = ATLAS.find((f) => f.label === beat.fact!.label);
      expect(source, beat.id).toBeDefined();
      expect(beat.fact.value).toBe(source!.value);
    }
  });

  it("drops a beat whose fact Atlas no longer carries", () => {
    const without = ATLAS.filter((f) => f.label !== "Radiant");
    const beats = beatsFor(without, WINDOW);
    expect(beats.find((b) => b.id === "evening")).toBeUndefined();
    // And the rest of the sequence still works.
    expect(beats.find((b) => b.id === "yours")).toBeDefined();
  });

  it("survives Atlas carrying nothing at all", () => {
    const beats = beatsFor([], WINDOW);
    // Only the beats that make no factual claim remain.
    expect(beats.map((b) => b.id)).toEqual(["open", "dragon", "yours"]);
    for (const beat of beats) expect(beat.fact).toBeUndefined();
  });

  it("falls back to the predicted peak when the best-night fact is gone", () => {
    const swapped: DraconidFact[] = [
      ...ATLAS.filter((f) => f.label !== "When to watch"),
      {
        label: "Predicted peak",
        value: "The peak is predicted for 1 UTC on October 9, 2026.",
      },
    ];
    const when = beatsFor(swapped, WINDOW).find((b) => b.id === "when")!;
    expect(when.fact?.label).toBe("Predicted peak");
  });
});
