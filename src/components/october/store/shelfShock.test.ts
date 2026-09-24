import { describe, expect, it } from "vitest";
import { kickFor, SHOCK_RADIUS } from "./shelfShock";
import { carvedWord, SCRATCH_EXTENT } from "./scratches";
import { WALL_TAPES, REFUSED_ID } from "./wallTapes";

const hit = WALL_TAPES.find((t) => t.id === REFUSED_ID)!;

describe("the shove travelling through the shelf", () => {
  it("does not move the tape that was struck", () => {
    expect(kickFor(hit, hit).angle).toBe(0);
  });

  it("falls off with distance", () => {
    const near = kickFor(
      { ...hit, id: "a", row: hit.row, col: hit.col + 1 },
      hit,
    );
    const far = kickFor(
      { ...hit, id: "b", row: hit.row, col: hit.col + 2 },
      hit,
    );
    expect(Math.abs(near.angle)).toBeGreaterThan(Math.abs(far.angle));
  });

  it("stops entirely past the radius", () => {
    const beyond = kickFor(
      { ...hit, id: "c", row: hit.row + SHOCK_RADIUS + 1, col: hit.col },
      hit,
    );
    expect(beyond).toEqual({ angle: 0, depth: 0, ms: 0 });
  });

  it("leaves most of the wall alone", () => {
    const moved = WALL_TAPES.filter((t) => kickFor(t, hit).angle !== 0);
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.length).toBeLessThan(WALL_TAPES.length / 2);
  });

  it("knocks its neighbours back into their holes as well as sideways", () => {
    const near = kickFor(
      { ...hit, id: "a", row: hit.row, col: hit.col + 1 },
      hit,
    );
    const far = kickFor(
      { ...hit, id: "b", row: hit.row, col: hit.col + 2 },
      hit,
    );
    expect(near.depth).toBeGreaterThan(far.depth);
    expect(far.depth).toBeGreaterThanOrEqual(0);
  });

  it("does not move the survivors as a group", () => {
    const moved = WALL_TAPES.map((t) => kickFor(t, hit)).filter(
      (k) => k.angle !== 0,
    );
    expect(new Set(moved.map((k) => Math.sign(k.angle))).size).toBe(2);
    expect(new Set(moved.map((k) => k.ms)).size).toBe(moved.length);
  });
});

describe("the carving", () => {
  it("is strokes, and enough of them to be a hand at work", () => {
    const strokes = carvedWord();
    expect(strokes.length).toBeGreaterThan(24);
    for (const s of strokes) expect(s.points.length).toBeGreaterThanOrEqual(2);
  });

  it("stays on the fascia it is being cut into", () => {
    for (const { points } of carvedWord()) {
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(-2);
        expect(x).toBeLessThanOrEqual(SCRATCH_EXTENT.width + 2);
        expect(y).toBeGreaterThanOrEqual(-2);
        expect(y).toBeLessThanOrEqual(SCRATCH_EXTENT.height + 2);
      }
    }
  });
});
