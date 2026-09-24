import { describe, expect, it } from "vitest";
import { simulateRejection, type Beat } from "./rejection";

const R = simulateRejection();
const during = (beat: Beat) => R.moments.filter((m) => m.beat === beat);
const span = (beat: Beat) => {
  const b = during(beat);
  return { first: b[0]!, last: b.at(-1)!, ms: (b.at(-1)!.t - b[0]!.t) * 1000 };
};

describe("October refusing you a tape", () => {
  it("plays the six beats in order and only once each", () => {
    const order = R.moments
      .map((m) => m.beat)
      .filter((b, i, a) => b !== a[i - 1]);
    expect(order).toEqual([
      "pull",
      "pause",
      "hauled",
      "straining",
      "snap",
      "impact",
      "still",
    ]);
  });

  it("takes it out of the cubby but nowhere near your hand", () => {
    const out = span("pull").last.s;
    expect(out).toBeGreaterThan(0.18);
    expect(out).toBeLessThan(0.34);
    // And it never gets close to the held position at any point.
    expect(Math.max(...R.moments.map((m) => m.s))).toBeLessThan(0.55);
  });

  it("stops dead, without shaking", () => {
    const held = during("pause");
    expect(held.length).toBeGreaterThan(20);
    const s = held.map((m) => m.s);
    expect(Math.max(...s) - Math.min(...s)).toBe(0);
  });

  it("gives ground back, visibly", () => {
    const hauled = span("hauled");
    expect(hauled.first.s - hauled.last.s).toBeGreaterThan(0.12);
    // Back toward the cubby, but not home.
    expect(hauled.last.s).toBeGreaterThan(0.05);
  });

  it("lets you win it back, slowly, and for the longest beat", () => {
    const strain = span("straining");
    expect(strain.last.s).toBeGreaterThan(span("hauled").last.s + 0.25);
    for (const beat of ["pull", "pause", "hauled", "snap"] as const) {
      expect(strain.ms).toBeGreaterThan(span(beat).ms);
    }
  });

  it("then takes it, an order of magnitude faster than you were winning", () => {
    const strain = span("straining");
    const snap = span("snap");
    const winning = (strain.last.s - strain.first.s) / strain.ms;
    const losing = (snap.first.s - snap.last.s) / snap.ms;
    expect(losing / winning).toBeGreaterThan(10);
    expect(snap.ms).toBeLessThan(120);
    // Sampled at 8ms, so the last frame of the snap is a hair short of the
    // cavity and the impact begins in it.
    expect(snap.last.s).toBeLessThan(0.03);
    expect(during("impact")[0]!.s).toBe(0);
  });

  it("never teleports or reverses on the way home", () => {
    const home = [...during("snap"), ...during("impact")];
    for (let i = 1; i < home.length; i += 1) {
      expect(home[i]!.s).toBeLessThanOrEqual(home[i - 1]!.s);
      expect(home[i - 1]!.s - home[i]!.s).toBeLessThan(0.12);
    }
  });

  it("holds together across every boundary", () => {
    for (let i = 1; i < R.moments.length; i += 1) {
      const a = R.moments[i - 1]!;
      const b = R.moments[i]!;
      expect(Math.abs(b.twist - a.twist)).toBeLessThan(1.2);
      expect(Math.abs(b.strain - a.strain)).toBeLessThan(0.4);
      expect(Math.abs(b.bite - a.bite)).toBeLessThan(1.2);
      expect(Math.abs(b.s - a.s)).toBeLessThan(0.12);
    }
  });

  it("gives once when it lands, and settles to nothing", () => {
    const bite = during("impact").map((m) => m.bite);
    const peak = bite.indexOf(Math.max(...bite));
    expect(peak).toBeGreaterThan(0);
    expect(bite[peak]!).toBeGreaterThan(2);
    for (let i = peak + 1; i < bite.length; i += 1) {
      expect(bite[i]!).toBeLessThanOrEqual(bite[i - 1]! + 1e-9);
    }
    expect(Math.min(...bite)).toBeGreaterThanOrEqual(0);
    expect(R.moments.at(-1)!.bite).toBe(0);
    expect(R.moments.at(-1)!.twist).toBe(0);
  });

  it("is the same refusal every time", () => {
    expect(simulateRejection().moments).toEqual(R.moments);
  });
});
