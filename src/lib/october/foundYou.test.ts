import { beforeEach, describe, expect, it } from "vitest";
import {
  NOTHING,
  forgetOctober,
  parseOctoberMemory,
  readOctoberMemory,
  rememberEncounter,
} from "./foundYou";

/**
 * The one thing that must never happen is October claiming to remember
 * somebody she has never met. Every unreadable, absent or malformed state
 * therefore has to resolve to "no".
 */
describe("what October keeps", () => {
  beforeEach(() => {
    forgetOctober();
  });

  it("does not remember a visitor it has never met", () => {
    expect(readOctoberMemory()).toEqual(NOTHING);
    expect(readOctoberMemory().found).toBe(false);
  });

  it("keeps the encounter, and the choices that were actually made", () => {
    rememberEncounter({ number: "12", door: "LEAVE", hearing: "NO" });
    expect(readOctoberMemory()).toEqual({
      found: true,
      number: "12",
      door: "LEAVE",
      hearing: "NO",
    });
  });

  it("forgets on request, and then claims nothing", () => {
    rememberEncounter({ door: "STAY" });
    expect(readOctoberMemory().found).toBe(true);
    forgetOctober();
    expect(readOctoberMemory().found).toBe(false);
  });

  it("treats anything it cannot read as never having happened", () => {
    expect(parseOctoberMemory(null)).toEqual(NOTHING);
    expect(parseOctoberMemory("")).toEqual(NOTHING);
    expect(parseOctoberMemory("not json at all")).toEqual(NOTHING);
    expect(parseOctoberMemory("{}")).toEqual(NOTHING);
    // Present, but not a completed encounter.
    expect(parseOctoberMemory('{"found":false,"door":"LEAVE"}')).toEqual(
      NOTHING,
    );
    // Somebody else's key shape.
    expect(parseOctoberMemory('{"found":"yes"}')).toEqual(NOTHING);
  });

  it("drops choices it does not recognise rather than repeating them back", () => {
    // A value we would never have written must not end up in a line October
    // says out loud.
    const m = parseOctoberMemory(
      '{"found":true,"number":"7","door":"RUN","hearing":"MAYBE"}',
    );
    expect(m.found).toBe(true);
    expect(m.number).toBeUndefined();
    expect(m.door).toBeUndefined();
    expect(m.hearing).toBeUndefined();
  });
});
