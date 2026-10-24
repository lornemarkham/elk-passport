import { describe, expect, it } from "vitest";
import { cardFor, linesDone, SQUARES } from "./bingo";

describe("bingo", () => {
  it("deals nine different squares, the same card for the same person", () => {
    const a = cardFor("member-a");
    expect(new Set(a).size).toBe(9);
    expect(a.every((i) => i >= 0 && i < SQUARES.length)).toBe(true);
    expect(cardFor("member-a")).toEqual(a);
    expect(cardFor("member-b")).not.toEqual(a);
  });
  it("counts lines, rows, columns and diagonals", () => {
    expect(linesDone(new Set())).toBe(0);
    expect(linesDone(new Set([0, 1, 2]))).toBe(1);
    expect(linesDone(new Set([0, 4, 8, 2, 6]))).toBe(2);
    expect(linesDone(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe(8);
  });
  it("asks for nothing sensitive", () => {
    for (const s of SQUARES)
      expect(s).not.toMatch(
        /phone|email|address|room|salary|\bage\b|religio|health/i,
      );
  });
});
