import { afterEach, describe, expect, it, vi } from "vitest";
import { newCode } from "./pairing";
import { pulse } from "./audio";
import { ACT_I, ACT_II, ACT_III, ACT_IV, ACT_V } from "./script";

/**
 * The night is mostly timing and feel, which a test cannot judge. What it can
 * pin are the promises the scene makes about restraint and honesty.
 */
describe("a pairing code", () => {
  it("is six characters a person could read aloud", () => {
    for (let i = 0; i < 200; i++) {
      const code = newCode();
      expect(code).toHaveLength(6);
      // No 0/O, 1/I/L — the ambiguous glyphs are deliberately absent.
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});

describe("the physical pulse", () => {
  const original = navigator.vibrate;
  afterEach(() => {
    Object.defineProperty(navigator, "vibrate", {
      value: original,
      configurable: true,
    });
  });

  it("reports honestly that it did nothing where the platform has no vibration", () => {
    // iOS Safari. The scene must never claim a pulse it could not deliver.
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      configurable: true,
    });
    expect(pulse()).toBe(false);
  });

  it("pulses once, briefly, where it can", () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
    });
    expect(pulse()).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    const [pattern] = vibrate.mock.calls[0] as unknown as [number[]];
    expect(pattern).toHaveLength(1);
    expect(pattern[0]).toBeLessThan(400);
  });
});

describe("the script's restraint", () => {
  it("opens with silence long enough to be noticed", () => {
    expect(ACT_I.silenceAfter).toBeGreaterThanOrEqual(4000);
  });

  it("teaches the rule on both sides before breaking it", () => {
    const sides = ACT_II.lessons.map((l) => l.side);
    expect(sides).toContain(-1);
    expect(sides).toContain(1);
  });

  it("breaks the rule on the opposite side from the sound", () => {
    expect(ACT_III.effectSide).toBe(-ACT_III.soundSide);
  });

  it("lets the phone leave the room before asking for it back", () => {
    // The trick only works if the phone has stopped being the focus. Twenty
    // seconds is the floor below which it is still in the hand.
    expect(ACT_IV.paired.quietBeforeWake).toBeGreaterThanOrEqual(20000);
    expect(ACT_IV.paired.quietBeforeSecondWake).toBeGreaterThanOrEqual(15000);
  });

  it("never explains the world changing", () => {
    // No line in the paired act mentions the tree, the lights or the moon.
    const lines = Object.values(ACT_IV.paired).filter(
      (v) => typeof v === "string",
    ) as string[];
    for (const line of lines) {
      expect(line.toLowerCase()).not.toMatch(
        /tree|light|moon|behind you|look back/,
      );
    }
  });

  it("offers a way out at the doorway", () => {
    expect(ACT_V.escape.label.length).toBeGreaterThan(0);
    expect(ACT_V.choices.length).toBeGreaterThanOrEqual(3);
  });
});
