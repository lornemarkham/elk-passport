import { describe, expect, it } from "vitest";
import {
  EXPLICIT,
  defaultPreferences,
  preferencesFromRows,
  PREFERENCES,
  validateChange,
} from "./vocabulary";

/**
 * **The line between what somebody said and what Passport noticed.**
 *
 * The database refuses to store a learned signal here (`source = 'explicit'`).
 * These pin the other half: the vocabulary refuses to *name* one, so there is
 * no key a future intelligence layer could quietly borrow.
 */
describe("what a person can state", () => {
  it("works completely for someone who has never opened settings", () => {
    const defaults = defaultPreferences();

    // No undefined anywhere: every consumer gets a real answer, which is why
    // there is no onboarding step and no "please finish your profile" nag.
    for (const value of Object.values(defaults)) {
      expect(value).toBeDefined();
    }
    expect(defaults.interests).toEqual([]);
    expect(defaults.contentComfort).toBe("no restrictions");
  });

  it("accepts a declared setting", () => {
    expect(validateChange("contentComfort", "family-friendly")).toEqual({
      storageKey: "content_comfort",
      value: "family-friendly",
    });
  });

  it("refuses a setting nobody declared", () => {
    // The important case. If this ever returns a value, the preference store
    // has become a bucket and "explicit" has stopped meaning anything.
    expect(validateChange("saves_lots_of_hiking", true)).toBeUndefined();
    expect(validateChange("inferredMood", "adventurous")).toBeUndefined();
    expect(validateChange("__proto__", {})).toBeUndefined();
  });

  it("refuses a declared setting with a value outside its vocabulary", () => {
    expect(validateChange("contentComfort", "anything goes")).toBeUndefined();
    expect(validateChange("pace", 3)).toBeUndefined();
    expect(validateChange("interests", ["hiking", "arson"])).toBeUndefined();
    expect(validateChange("maxDriveKm", -5)).toBeUndefined();
    expect(validateChange("reduceMotion", "yes")).toBeUndefined();
  });

  it("accepts an interest list drawn entirely from the offered options", () => {
    expect(validateChange("interests", ["hiking", "astronomy"])).toEqual({
      storageKey: "interests",
      value: ["hiking", "astronomy"],
    });
  });
});

describe("reading back what was stored", () => {
  it("fills the gaps with defaults", () => {
    const result = preferencesFromRows([
      { key: "content_comfort", value: "family-friendly" },
    ]);

    expect(result.contentComfort).toBe("family-friendly");
    expect(result.pace).toBe("mixed");
  });

  it("ignores a key the vocabulary no longer declares", () => {
    const result = preferencesFromRows([
      { key: "a_setting_that_was_removed", value: "whatever" },
    ]);

    expect(result).toEqual(defaultPreferences());
  });

  it("falls back rather than throwing on a value that no longer parses", () => {
    // A renamed option, or a hand-edited row. Settings is precisely the page
    // somebody would use to fix this, so it must not be the page that breaks.
    const result = preferencesFromRows([
      { key: "pace", value: "leisurely" },
      { key: "interests", value: "hiking" },
    ]);

    expect(result.pace).toBe("mixed");
    expect(result.interests).toEqual([]);
  });
});

describe("the vocabulary itself", () => {
  it("stays small", () => {
    // Not a style rule. An interest list long enough to describe anybody is one
    // nobody fills in, and this is the test that argues back when it grows.
    expect(Object.keys(PREFERENCES).length).toBeLessThanOrEqual(8);
  });

  it("gives every setting a person-readable label and a reason", () => {
    for (const definition of Object.values(PREFERENCES)) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.help.length).toBeGreaterThan(0);
    }
  });
});

describe("the explicit/learned boundary", () => {
  it("names its provenance once, so the reader and writer cannot drift", () => {
    // The service filters reads on this and stamps writes with it. Two string
    // literals would be one refactor away from a read that quietly picks up
    // rows nobody stated.
    expect(EXPLICIT).toBe("explicit");
  });

  it("has no provenance protection of its own — that is the read's job", () => {
    // Worth pinning honestly rather than asserting something comforting.
    // `preferencesFromRows` takes the last valid row for a key and knows
    // nothing about where a row came from. So the protection lives entirely in
    // the query that feeds it, which filters on source — see the service test.
    // If that filter is ever dropped, this is the behaviour that silently
    // lets an observation answer "what did they say?".
    const stated = { key: "content_comfort", value: "family-friendly" };
    const observed = { key: "content_comfort", value: "no restrictions" };

    expect(preferencesFromRows([stated, observed]).contentComfort).toBe(
      "no restrictions",
    );
  });
});
