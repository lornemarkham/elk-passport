import { describe, expect, it } from "vitest";
import {
  EMPTY,
  fromText,
  isEmpty,
  merge,
  subtract,
  toggle,
  weight,
  type DiscoveryIntent,
} from "./intent";
import { PHRASES } from "@/lib/labs/october/voice";
import { FILTERS } from "@/lib/labs/october/filters";

/**
 * **The claim: a chip, a phrase, a fork answer and a sentence all say the
 * same thing.**
 *
 * If that is true the four experiments really did collapse into one engine.
 * If it is not — if a phrase quietly means something a chip cannot express —
 * then there are still two filtering systems and they will drift. So the
 * first test here walks every October phrase and insists its meaning is
 * expressible in the generic vocabulary.
 */

describe("one vocabulary, several registers", () => {
  it("expresses every October phrase in the engine's own keys", () => {
    const keys = new Set(FILTERS.map((f) => f.id));
    for (const phrase of PHRASES) {
      const m = phrase.means;
      const named = [
        ...(m.when ?? []),
        ...(m.feel ?? []),
        ...(m.doing ?? []),
        ...(m.looking ?? []),
        ...(m.where ?? []),
      ];
      for (const key of named) {
        // A phrase may only mean something a filter chip can also mean.
        expect(keys.has(key), `${phrase.id} → ${key}`).toBe(true);
      }
      // ...or it is one of the two things a chip cannot say.
      if (named.length === 0) {
        expect(m.surprise === true || m.within !== undefined, phrase.id).toBe(
          true,
        );
      }
    }
  });

  it("gives 'get out of the house' and the Go out chip the same meaning", () => {
    const phrase = PHRASES.find((p) => p.id === "go-out")!;
    const chip = toggle(EMPTY, "feel", "go-out");
    expect(merge(EMPTY, phrase.means).feel).toEqual(chip.feel);
  });
});

describe("a wish accumulates rather than replaces", () => {
  it("adds a phrase on top of a live search", () => {
    const searching: DiscoveryIntent = { query: "haunted" };
    const next = merge(searching, { feel: ["go-out"] });
    expect(next.query).toBe("haunted");
    expect(next.feel).toEqual(["go-out"]);
  });

  it("unions rather than duplicating", () => {
    const once = merge(EMPTY, { feel: ["go-out"] });
    const twice = merge(once, { feel: ["go-out"], doing: ["watch"] });
    expect(twice.feel).toEqual(["go-out"]);
    expect(twice.doing).toEqual(["watch"]);
  });

  it("toggles a key off again", () => {
    const on = toggle(EMPTY, "looking", "scary");
    expect(toggle(on, "looking", "scary").looking).toEqual([]);
  });

  it("counts what was asked for, so a page can offer to clear it", () => {
    expect(weight(EMPTY)).toBe(0);
    expect(isEmpty(EMPTY)).toBe(true);
    expect(weight({ query: "x", doing: ["make"], on: "2026-10-03" })).toBe(3);
    expect(isEmpty({ when: [] })).toBe(true);
  });
});

/**
 * **The conversational seam.**
 *
 * `fromText` is the function a language model would replace. These tests pin
 * the *shape* it has to produce, not its cleverness — the point is that a
 * sentence needs no new machinery downstream, and that whatever produces this
 * object cannot reach past it into the world.
 */
describe("a sentence becomes the same object", () => {
  it("reads the brief's own example", () => {
    const intent = fromText(
      "Me and my daughter, couple of hours, don't want to drive far, rain is fine.",
    );
    expect(intent.looking).toContain("family");
    expect(intent.within).toBe(120);
  });

  it("reads a time of day", () => {
    expect(fromText("what can we do tonight").when).toContain("tonight");
    expect(fromText("anything on saturday").when).toContain("weekend");
  });

  it("reads a medium and a mood", () => {
    expect(fromText("I want to watch a scary movie").doing).toContain("watch");
    expect(fromText("I want to watch a scary movie").looking).toContain(
      "scary",
    );
  });

  it("reads an hour", () => {
    expect(fromText("we only have an hour").within).toBe(60);
    expect(fromText("90 minutes maybe").within).toBe(90);
  });

  it("falls through to a search rather than doing nothing", () => {
    // Nothing recognised, so the words still get used — as a query.
    expect(fromText("pumpkin").query).toBe("pumpkin");
    expect(fromText("pumpkin").doing).toBeUndefined();
  });

  it("produces only what the engine already understands", () => {
    // The seam's whole safety property: a producer cannot invent a field, and
    // therefore cannot invent a possibility.
    const intent = fromText("me and my kid outside tomorrow for an hour");
    expect(Object.keys(intent).sort()).toEqual(
      Object.keys(intent)
        .filter((k) =>
          [
            "query",
            "when",
            "on",
            "feel",
            "doing",
            "looking",
            "where",
            "within",
            "surprise",
          ].includes(k),
        )
        .sort(),
    );
  });
});

describe("taking one thing back off", () => {
  it("removes only what that phrase put on", () => {
    const phrase = PHRASES.find((p) => p.id === "make")!;
    const wish = merge({ query: "pumpkin", when: ["weekend"] }, phrase.means);
    const after = subtract(wish, phrase.means);
    expect(after.query).toBe("pumpkin");
    expect(after.when).toEqual(["weekend"]);
    expect(after.doing).toEqual([]);
  });

  it("clears a scalar the phrase set", () => {
    const hour = PHRASES.find((p) => p.id === "an-hour")!;
    const wish = merge({ feel: ["go-out"] }, hour.means);
    expect(subtract(wish, hour.means).within).toBeUndefined();
    expect(subtract(wish, hour.means).feel).toEqual(["go-out"]);
  });

  it("is the inverse of merge", () => {
    const base: DiscoveryIntent = { query: "haunted", looking: ["scary"] };
    const patch: DiscoveryIntent = { feel: ["go-out"], when: ["weekend"] };
    const round = subtract(merge(base, patch), patch);
    expect(round.feel).toEqual([]);
    expect(round.when).toEqual([]);
    expect(round.looking).toEqual(["scary"]);
    expect(round.query).toBe("haunted");
  });
});
