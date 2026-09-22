import { afterEach, describe, expect, it, vi } from "vitest";
import { newCode } from "./pairing";
import { pulse } from "./audio";
import { ACT_I, ACT_II, ACT_III, ACT_IV, ACT_V, DOOR } from "./script";

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
  it("reaches the first question in well under twenty seconds", () => {
    // v0 took 20.4 s to ask "Headphones?" and it read as broken on hardware.
    const toQuestion =
      ACT_I.before +
      ACT_I.lines.reduce((sum, l) => sum + l.hold, 0) +
      ACT_I.lines.length * ACT_I.gap +
      ACT_I.silenceAfter;
    expect(toQuestion).toBeLessThan(15_000);
    // And still keeps one real silence, after "You're not." — earned.
    expect(ACT_I.silenceAfter).toBeGreaterThanOrEqual(2000);
  });

  it("teaches the rule on both sides before breaking it", () => {
    const sides = ACT_II.lessons.map((l) => l.side);
    expect(sides).toContain(-1);
    expect(sides).toContain(1);
  });

  it("breaks the rule on the opposite side from the sound", () => {
    expect(ACT_III.effectSide).toBe(-ACT_III.soundSide);
  });

  it("lets the phone leave the room, but never long enough to lock", () => {
    // The screening overturned v0's 24 s: it read as a stalled program, and
    // the phone slept inside it. The dormancy must be long enough to stop
    // being the thing in the hand, and shorter than any iPhone auto-lock
    // (30 s minimum) so the wake can always land — with or without a lock.
    expect(ACT_IV.paired.dormancy).toBeGreaterThanOrEqual(6000);
    expect(ACT_IV.paired.dormancy).toBeLessThan(30_000);
    expect(ACT_IV.paired.secondDormancy).toBeLessThan(ACT_IV.paired.dormancy);
  });

  it("brings the eyes back with a sound, not a sentence", () => {
    // After the world changes behind the person, the desktop makes one small
    // sound. That is the hook. There is no line saying "look".
    expect(ACT_IV.paired.hookAfter).toBeGreaterThan(0);
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

describe("the door", () => {
  it("makes them wait between the latch and the slam", () => {
    // Anticipation is the whole mechanism. A latch followed instantly by a
    // slam is a sound effect; a latch followed by two and a half seconds of
    // nothing is a door.
    expect(DOOR.latchToSlam).toBeGreaterThanOrEqual(2000);
  });

  it("holds silence after the slam, then says one word", () => {
    expect(DOOR.silenceAfter).toBeGreaterThanOrEqual(1500);
    expect(DOOR.locked).toBe("Locked.");
  });

  it("does not leave them staring at trees afterwards", () => {
    // The surface arrives inside a couple of seconds of the word.
    expect(DOOR.lockedHold + DOOR.beforeSurface).toBeLessThan(4000);
  });
});
