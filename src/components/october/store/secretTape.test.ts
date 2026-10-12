import { describe, expect, it } from "vitest";
import { ROWS } from "./shelfGeometry";
import { REFUSED_ID, SECRET_ID, WALL_TAPES } from "./wallTapes";

describe("the unlabeled tape", () => {
  const secret = WALL_TAPES.find((t) => t.id === SECRET_ID)!;

  it("is on the wall, in a cavity of its own, on the bottom shelf", () => {
    expect(secret).toBeDefined();
    expect(secret.row).toBe(ROWS.length - 1);
    const cells = WALL_TAPES.map((t) => `${t.row}:${t.col}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("is a made thing, not a film: handwritten, with nothing to rate", () => {
    expect(secret.cover.handwritten?.front.join(" ")).toMatch(/whoever/);
    expect(secret.cover.handwritten?.back.join(" ")).toMatch(/where/);
    expect(secret.film.certification).toBeUndefined();
    expect(secret.film.year).toBe(0);
  });

  it("does not stand beside the tape October refuses", () => {
    const refused = WALL_TAPES.find((t) => t.id === REFUSED_ID)!;
    expect(Math.abs(refused.row - secret.row)).toBeGreaterThan(1);
  });
});
