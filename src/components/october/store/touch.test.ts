import { describe, expect, it } from "vitest";
import { handled, UNTOUCHED } from "./touch";
import { WALL_TAPES } from "./wallTapes";

const times = (id: string, n: number) => {
  let t = UNTOUCHED;
  for (let i = 0; i < n; i += 1) t = handled(id, t);
  return t;
};

describe("the world remembering your touch", () => {
  it("leaves nothing until something is handled", () => {
    expect(UNTOUCHED).toEqual({ dx: 0, da: 0, dz: 0, times: 0 });
  });

  it("moves a tape the first time it is put back", () => {
    for (const tape of WALL_TAPES) {
      const once = handled(tape.id);
      expect(Math.abs(once.dx) + Math.abs(once.da) + once.dz).toBeGreaterThan(
        0,
      );
    }
  });

  it("is memory, not wobble: the same tape always settles the same way", () => {
    for (const tape of WALL_TAPES) {
      expect(times(tape.id, 5)).toEqual(times(tape.id, 5));
    }
  });

  it("gives different tapes different histories", () => {
    const poses = WALL_TAPES.map((t) => JSON.stringify(times(t.id, 3)));
    expect(new Set(poses).size).toBe(WALL_TAPES.length);
  });

  it("never accumulates into absurdity, however long the day is", () => {
    for (const tape of WALL_TAPES) {
      const worn = times(tape.id, 200);
      expect(Math.abs(worn.dx)).toBeLessThanOrEqual(2.3);
      expect(Math.abs(worn.da)).toBeLessThanOrEqual(1.9);
      expect(worn.dz).toBeGreaterThanOrEqual(0);
      expect(worn.dz).toBeLessThanOrEqual(3.6);
    }
  });

  it("settles down: the twentieth handling moves less than the first", () => {
    for (const tape of WALL_TAPES) {
      const first = handled(tape.id);
      const twentieth = handled(tape.id, times(tape.id, 19));
      const step = (a: typeof first, b: typeof first) =>
        Math.abs(a.dx - b.dx) + Math.abs(a.da - b.da) + Math.abs(a.dz - b.dz);
      expect(step(first, UNTOUCHED)).toBeGreaterThan(
        step(twentieth, times(tape.id, 19)),
      );
    }
  });

  it("only ever pushes a tape further in, never proud of the shelf", () => {
    for (const tape of WALL_TAPES) {
      let prior = UNTOUCHED;
      for (let i = 0; i < 12; i += 1) {
        const next = handled(tape.id, prior);
        expect(next.dz).toBeGreaterThanOrEqual(prior.dz);
        prior = next;
      }
    }
  });
});
