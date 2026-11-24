import { describe, expect, it } from "vitest";
import { seasonsBest } from "./best";
import type { Find } from "./discover";

const find = (themes: string[], free = false) =>
  ({
    reading: { themes, christmas: true, evidence: [] },
    free,
  }) as unknown as Find;

describe("the season's best", () => {
  it("counts each kind from what is placed near, and says none", () => {
    const best = seasonsBest(
      [
        find(["markets"]),
        find(["markets", "santa"], true),
        find(["festivals"]),
      ],
      3,
    );
    const by = Object.fromEntries(best.map((b) => [b.id, b]));
    expect(by.markets!.count).toBe(2);
    expect(by.santa!.count).toBe(1);
    expect(by.festivals!.count).toBe(1);
    expect(by.lights!.count).toBe(3); // the community's checked displays
    expect(by.shows!.count).toBe(0);
    expect(by.free!.count).toBe(1);
  });

  it("gives movies and a night in no count — they need no listing", () => {
    const best = seasonsBest([], 0);
    for (const id of ["movies", "home"]) {
      const b = best.find((x) => x.id === id)!;
      expect(b.count).toBeUndefined();
      expect(b.line).toBeTruthy();
    }
  });
});
