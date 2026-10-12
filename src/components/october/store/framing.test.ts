import { describe, expect, it } from "vitest";
import { caseInView, framing, inView } from "./framing";
import { WALL_TAPES } from "./wallTapes";

/**
 * **Every tape on the wall can be reached from a phone.**
 *
 * The audit found Ghostbusters — the tape October refuses, the whole joke of
 * the store — off the left edge of a 390px screen with no way to get to it.
 * These pin the arithmetic: what the screen sees, where the head starts, and
 * that turning it reaches every tape.
 */
const tape = (id: string) => WALL_TAPES.find((t) => t.id === id)!;

describe("framing the wall", () => {
  it("leaves a desktop exactly as it was", () => {
    const f = framing(1440, 900);
    expect(f.pan).toBe(false);
    expect(f.reach).toBeLessThanOrEqual(14);
    expect(f.first).toBe(0);
  });

  it("on a 390px phone, sees only a slice of the shelving", () => {
    const f = framing(390, 844);
    expect(f.pan).toBe(true);
    expect(f.visible).toBeLessThan(230);
    // What used to happen: the head square, and Ghostbusters off the edge.
    expect(caseInView(f, 0, tape("ghostbusters"))).toBe(false);
  });

  it("starts facing Ghostbusters and the tape October offers instead", () => {
    const f = framing(390, 844);
    expect(caseInView(f, f.first, tape("ghostbusters"))).toBe(true);
    expect(caseInView(f, f.first, tape("lost-boys"))).toBe(true);
  });

  it("can turn to every tape on the wall, and no further than the plate", () => {
    for (const [w, h] of [
      [390, 844],
      [360, 740],
      [430, 932],
    ] as const) {
      const f = framing(w, h);
      const [left] = inView(f, f.reach);
      const [, right] = inView(f, -f.reach);
      expect(left).toBeGreaterThanOrEqual(-0.001);
      expect(right).toBeLessThanOrEqual(854.001);
      for (const t of WALL_TAPES) {
        const somewhere = [
          -f.reach,
          -f.reach / 2,
          0,
          f.first,
          f.reach / 2,
          f.reach,
        ].some((d) => caseInView(f, d, t));
        expect(somewhere, `${t.id} at ${w}×${h}`).toBe(true);
      }
    }
  });
});
