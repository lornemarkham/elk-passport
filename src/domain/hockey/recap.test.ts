import { describe, expect, it } from "vitest";
import type { Standing } from "@/experience-lab/core/scoring";
import { recapText } from "./recap";

const row = (name: string, points: number, rank: number): Standing =>
  ({
    participant: { id: name, name, hue: 0, emoji: "" },
    points,
    exactCount: 0,
    answered: 0,
    lines: [],
    rank,
  }) as unknown as Standing;

describe("recapText", () => {
  it("says nothing when nobody scored", () => {
    expect(
      recapText({
        title: "Hockey Night",
        standings: [row("Ana", 0, 1)],
        awards: [],
      }),
    ).toBeNull();
  });

  it("names the winner, the table, the result and the link", () => {
    const text = recapText({
      title: "Hockey Night",
      result: "Canucks 3–2 Wild",
      standings: [row("Ana", 9, 1), row("Ben", 4, 2)],
      awards: [],
      url: "https://x.test/hockey/abc",
    });
    expect(text).toContain("Ana won Hockey Night");
    expect(text).toContain("🏒 Canucks 3–2 Wild");
    expect(text).toContain("2. Ben — 4");
    expect(text?.endsWith("https://x.test/hockey/abc")).toBe(true);
  });

  it("shares a tied win instead of crowning one", () => {
    const text = recapText({
      title: "Hockey Night",
      standings: [row("Ana", 5, 1), row("Ben", 5, 1)],
      awards: [],
    });
    expect(text).toContain("Ana and Ben share Hockey Night");
  });

  it("says so when calls are still open", () => {
    const text = recapText({
      title: "Hockey Night",
      standings: [row("Ana", 5, 1)],
      awards: [],
      settled: false,
    });
    expect(text).toContain("Ana leads Hockey Night");
  });
});
