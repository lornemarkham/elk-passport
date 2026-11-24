import { describe, expect, it } from "vitest";
import { STARTERS, presetFrom } from "./templates";

describe("starter questions", () => {
  it("fill the create form's question, for a plain Pulse only", () => {
    expect(presetFrom({ q: "  Is a hot dog   a sandwich? " }).prefix).toBe(
      "Is a hot dog a sandwich?",
    );
    expect(presetFrom({ kind: "decide", q: "Should I?" }).prefix).toBe("");
    expect(presetFrom({ q: 42 }).prefix).toBe("");
    expect(presetFrom({ q: "x".repeat(500) }).prefix).toHaveLength(140);
  });

  it("are questions, short enough to carry", () => {
    for (const q of STARTERS) {
      expect(q.endsWith("?")).toBe(true);
      expect(q.length).toBeLessThanOrEqual(140);
    }
  });
});
