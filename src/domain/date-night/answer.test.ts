import { describe, expect, it } from "vitest";
import { LIMITS, parseAnswer } from "./answer";
import { LORNE_AND_JESS as night } from "./nights/lorne-and-jess";

const viewpoint = night.ideas.find((i) => i.id === "viewpoint")!.atlasIds![0]!;

describe("a Date Night answer", () => {
  it("keeps exactly what was chosen and said", () => {
    const parsed = parseAnswer(
      {
        picks: { "cold-plunge": "yes", sunset: "maybe", "bird-hunting": "no" },
        ownIdeas: ["  Hot springs,   then pie "],
        placeIds: [viewpoint],
        places: ["That lake with the dock"],
        adventurous: 4,
        food: ["Hot chocolate", "Wine"],
        foodNote: "No mushrooms",
        message: "Can't wait!\n\n\n\nxo",
      },
      night,
    );
    expect(parsed).toEqual({
      ok: true,
      answer: {
        picks: { "cold-plunge": "yes", sunset: "maybe", "bird-hunting": "no" },
        ownIdeas: ["Hot springs, then pie"],
        placeIds: [viewpoint],
        places: ["That lake with the dock"],
        adventurous: 4,
        food: ["Hot chocolate", "Wine"],
        foodNote: "No mushrooms",
        message: "Can't wait!\n\nxo",
      },
    });
  });

  it("refuses anything the night did not offer", () => {
    expect(parseAnswer({ picks: { heliskiing: "yes" } }, night).ok).toBe(false);
    expect(parseAnswer({ picks: { sunset: "definitely" } }, night).ok).toBe(
      false,
    );
    expect(parseAnswer({ placeIds: ["not-an-offered-id"] }, night).ok).toBe(
      false,
    );
    expect(parseAnswer({ food: ["Caviar"] }, night).ok).toBe(false);
    expect(parseAnswer({ adventurous: 9 }, night).ok).toBe(false);
  });

  it("refuses text over its limit rather than cutting it", () => {
    expect(
      parseAnswer({ message: "x".repeat(LIMITS.message + 1) }, night).ok,
    ).toBe(false);
    expect(
      parseAnswer(
        {
          ownIdeas: Array.from(
            { length: LIMITS.ownIdeas + 1 },
            (_, i) => `idea ${i}`,
          ),
        },
        night,
      ).ok,
    ).toBe(false);
    expect(parseAnswer({ message: "x".repeat(LIMITS.message) }, night).ok).toBe(
      true,
    );
  });

  it("refuses an empty answer and things that are not answers", () => {
    expect(parseAnswer({}, night)).toEqual({ ok: false, reason: "empty" });
    expect(parseAnswer({ message: "   " }, night)).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(parseAnswer(null, night).ok).toBe(false);
    expect(parseAnswer([], night).ok).toBe(false);
    expect(parseAnswer("hello", night).ok).toBe(false);
  });

  it("a message alone is an answer", () => {
    expect(parseAnswer({ message: "Surprise me" }, night)).toMatchObject({
      ok: true,
      answer: { message: "Surprise me" },
    });
  });
});
