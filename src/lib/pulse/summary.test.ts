import { describe, expect, it } from "vitest";
import type { Reasons } from "./modes";
import { summariseReasons } from "./summary";

const reasons = (quotes: string[][]): Reasons => ({
  counted: 10,
  total: 10,
  circle: null,
  groups: ["Yes", "No", "Not yet"].map((label, i) => ({
    optionId: `o${i + 1}`,
    label,
    written: quotes[i]?.length ?? 0,
    quotes: quotes[i] ?? [],
    words: [],
  })),
});

describe("AI summary of reasons", () => {
  it("is not asked for with fewer than five reasons", async () => {
    let called = false;
    const r = await summariseReasons(
      "Should I?",
      reasons([["a", "b"], ["c"]]),
      async () => {
        called = true;
        return "";
      },
    );
    expect(r).toBeNull();
    expect(called).toBe(false);
  });

  it("sends only the shown reasons, and keeps only lines about real answers", async () => {
    let sent = "";
    const r = await summariseReasons(
      "Should I quit my job?",
      reasons([
        ["Life is short", "You hate it"],
        ["Bonus first"],
        ["Find a job first", "Save up"],
      ]),
      async (_system, user) => {
        sent = user;
        return JSON.stringify({
          lines: [
            { answer: "Yes", summary: "Most said life is too short." },
            { answer: "Maybe", summary: "Invented." },
          ],
        });
      },
    );
    expect(sent).toContain("- Bonus first");
    expect(r).toEqual({
      lines: [{ answer: "Yes", summary: "Most said life is too short." }],
      basedOn: 5,
    });
  });

  it("gives nothing rather than guessing when the reply isn't JSON", async () => {
    const r = await summariseReasons(
      "q",
      reasons([
        ["a", "b", "c"],
        ["d", "e"],
      ]),
      async () => "Sure! Here's a summary",
    );
    expect(r).toBeNull();
  });
});
