import { describe, expect, it } from "vitest";
import { answerMemo } from "./answerMemo";

describe("answerMemo", () => {
  it("keeps an answer until it is older than its TTL", () => {
    let t = 0;
    const memo = answerMemo<string>({ ttlMs: 1000, now: () => t });
    memo.set("q", "a");
    t = 999;
    expect(memo.get("q")).toBe("a");
    t = 1000;
    expect(memo.get("q")).toBeUndefined();
  });

  it("forgets the oldest answer past its size", () => {
    const memo = answerMemo<number>({ max: 2 });
    memo.set("a", 1);
    memo.set("b", 2);
    memo.set("a", 3);
    memo.set("c", 4);
    expect(memo.get("b")).toBeUndefined();
    expect(memo.get("a")).toBe(3);
    expect(memo.get("c")).toBe(4);
  });

  it("forgets everything on clear", () => {
    const memo = answerMemo<number>();
    memo.set("a", 1);
    memo.clear();
    expect(memo.get("a")).toBeUndefined();
  });
});
