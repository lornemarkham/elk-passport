import { describe, expect, it } from "vitest";
import { answerMemo, askedOnce } from "./answerMemo";

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

describe("askedOnce (the server's memo)", () => {
  it("asks once for the same question, in flight or kept", async () => {
    const asked = askedOnce<string>();
    let calls = 0;
    const ask = async () => {
      calls += 1;
      return "answer";
    };
    const [a, b] = await Promise.all([
      asked.ask("q", ask),
      asked.ask("q", ask),
    ]);
    expect([a, b]).toEqual(["answer", "answer"]);
    expect(await asked.ask("q", ask)).toBe("answer");
    expect(calls).toBe(1);
    await asked.ask("other", ask);
    expect(calls).toBe(2);
  });

  it("keeps no failure and nothing `keep` refuses", async () => {
    const asked = askedOnce<{ temporary?: boolean }>({
      keep: (a) => !a.temporary,
    });
    await expect(
      asked.ask("q", async () => {
        throw new Error("Atlas down");
      }),
    ).rejects.toThrow("Atlas down");
    let calls = 0;
    const temporary = async () => {
      calls += 1;
      return { temporary: true };
    };
    await asked.ask("q", temporary);
    await asked.ask("q", temporary);
    expect(calls).toBe(2);
  });

  it("forgets after its TTL", async () => {
    let t = 0;
    const asked = askedOnce<number>({ ttlMs: 1000, now: () => t });
    let calls = 0;
    const ask = async () => ++calls;
    await asked.ask("q", ask);
    t = 999;
    expect(await asked.ask("q", ask)).toBe(1);
    t = 1000;
    expect(await asked.ask("q", ask)).toBe(2);
  });
});
