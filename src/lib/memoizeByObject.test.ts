import { describe, expect, it } from "vitest";
import { memoizeByObject } from "./memoizeByObject";

describe("memoizeByObject", () => {
  it("reads an object once, and answers the same value afterwards", () => {
    let reads = 0;
    const length = memoizeByObject((o: { words: string[] }) => {
      reads++;
      return o.words.length;
    });
    const a = { words: ["a", "b"] };
    expect(length(a)).toBe(2);
    expect(length(a)).toBe(2);
    expect(reads).toBe(1);
    expect(length({ words: ["a", "b"] })).toBe(2);
    expect(reads).toBe(2);
  });

  it("remembers a falsy answer too", () => {
    let reads = 0;
    const empty = memoizeByObject((_o: object) => {
      reads++;
      return "";
    });
    const key = {};
    empty(key);
    empty(key);
    expect(reads).toBe(1);
  });
});
