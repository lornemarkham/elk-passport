import { describe, expect, it } from "vitest";
import {
  ENDING,
  NUMBERS,
  OVERLOOKED,
  ambiguousRecall,
  greets,
  onHearing,
  onNumber,
  plainRecall,
} from "./encounter";

describe("the encounter", () => {
  it("recalls the choice the visitor actually made", () => {
    // The whole illusion rests on this being exactly right. A recall that
    // drifts from what was pressed is the one bug nobody forgives.
    expect(plainRecall({ door: "LEAVE" })).toBe("You chose LEAVE.");
    expect(plainRecall({ door: "STAY" })).toBe("You chose STAY.");
  });

  it("never names a door that was not chosen", () => {
    expect(plainRecall({ door: "STAY" })).not.toContain("LEAVE");
    expect(plainRecall({ door: "LEAVE" })).not.toContain("STAY");
  });

  it("says nothing specific when nothing was chosen", () => {
    expect(plainRecall({})).toBe("You chose.");
  });

  it("claims a last time without ever describing one", () => {
    // Ambiguity is the point, so the line must not vary with whether there
    // genuinely was a last time — and must not invent a detail that a visitor
    // could catch her being wrong about.
    const line = ambiguousRecall();
    expect(line).toBe("That's what you chose last time.");
    expect(line).not.toContain("STAY");
    expect(line).not.toContain("LEAVE");
  });

  it("answers the hearing question differently, and kindly either way", () => {
    const no = onHearing("NO").map((l) => l.text);
    expect(no).toEqual(["That's okay.", "They couldn't either."]);

    const yes = onHearing("YES").map((l) => l.text);
    expect(yes).not.toEqual(no);
    expect(yes.join(" ")).not.toContain("couldn't");
  });

  it("gives every number an answer, and never explains itself", () => {
    for (const n of NUMBERS) {
      const said = onNumber(n);
      expect(said.length).toBeGreaterThan(0);
      expect(said.join(" ")).not.toMatch(/because|means|represents/i);
    }
    expect(onNumber("10")[0]).toBe("That one is me.");
  });

  it("earns the overlooked lines one at a time", () => {
    expect(OVERLOOKED.map((l) => l.text)).toEqual([
      "They didn't see me.",
      "They didn't hear me.",
      "They walked right by me.",
    ]);
    // Each needs room after it; the middle one is the uncomfortable one.
    for (const l of OVERLOOKED) expect(l.hold).toBeGreaterThanOrEqual(3000);
  });

  it("ends on the line the whole thing is for", () => {
    expect(ENDING.map((l) => l.text)).toEqual([
      "You found the way out.",
      "I couldn't.",
      "So I followed you.",
    ]);
    expect(ENDING[ENDING.length - 1]!.hold).toBeGreaterThan(5000);
  });

  it("only greets somebody it has genuinely met", () => {
    expect(greets(true)).toBe(true);
    expect(greets(false)).toBe(false);
  });
});
