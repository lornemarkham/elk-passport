import { afterEach, describe, expect, it } from "vitest";
import { rememberEncounter } from "./foundYou";
import {
  REMEMBERS_NOTHING,
  describe as describeMemory,
  forgetEverything,
  parseNightMemory,
  readNightMemory,
  rememberNight,
  whatOctoberRemembers,
} from "./remembers";

describe("what October remembers", () => {
  afterEach(() => forgetEverything());

  it("remembers nothing about a fresh browser, and says nothing", () => {
    expect(whatOctoberRemembers()).toEqual(REMEMBERS_NOTHING);
    expect(describeMemory(whatOctoberRemembers())).toEqual([]);
  });

  it("keeps how the last night ended, and only a real ending", () => {
    rememberNight("outside");
    expect(readNightMemory()).toEqual({ ended: "outside" });
    rememberNight("story");
    expect(readNightMemory()).toEqual({ ended: "story" });
    expect(parseNightMemory('{"ended":"possessed"}')).toEqual({});
    expect(parseNightMemory("not json")).toEqual({});
    expect(parseNightMemory(null)).toEqual({});
  });

  it("reads the Found You record that already existed, unchanged", () => {
    // Nobody she already knows is forgotten by the foundation existing.
    window.localStorage.setItem(
      "elk-passport:october:found-you",
      JSON.stringify({ found: true, number: "31", door: "STAY" }),
    );
    expect(whatOctoberRemembers().foundYou).toEqual({
      found: true,
      number: "31",
      door: "STAY",
      hearing: undefined,
    });
  });

  it("describes only what was recorded", () => {
    rememberEncounter({ door: "LEAVE" });
    rememberNight("surprise");
    const said = describeMemory(whatOctoberRemembers());
    expect(said).toEqual([
      "That you found her, and found the way out.",
      "That you chose LEAVE.",
      "That you asked her to surprise you, the last night.",
    ]);
    // No number and no hearing were kept, so neither is mentioned.
    expect(said.join(" ")).not.toMatch(/picked|hear/);
  });

  it("forgets all of it at once", () => {
    rememberEncounter({ number: "10", door: "STAY", hearing: "YES" });
    rememberNight("inside");
    forgetEverything();
    expect(whatOctoberRemembers()).toEqual(REMEMBERS_NOTHING);
    expect(
      window.localStorage.getItem("elk-passport:october:found-you"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("elk-passport:october:witching-hour"),
    ).toBeNull();
  });

  it("keeps nothing that could identify anybody", () => {
    rememberEncounter({ number: "12", door: "STAY", hearing: "NO" });
    rememberNight("escape");
    const stored = [
      window.localStorage.getItem("elk-passport:october:found-you"),
      window.localStorage.getItem("elk-passport:october:witching-hour"),
    ].join(" ");
    // Choices only: no time, no place, no device, no id.
    expect(stored).not.toMatch(/\d{4}-\d{2}|T\d{2}:|lat|lon|agent|id"/i);
  });

  it("says what the store and the room kept, and forgets it with the rest", () => {
    window.localStorage.setItem(
      "october:passage:v1",
      JSON.stringify({ refused: 1, tape: 2, escaped: 3, played: 4 }),
    );
    expect(describeMemory(whatOctoberRemembers())).toEqual([
      "That she took a tape back from you.",
      "That you took the tape nobody catalogued.",
      "That you opened the door in the room.",
      "That you played the tape where it was made.",
    ]);
    forgetEverything();
    expect(window.localStorage.getItem("october:passage:v1")).toBeNull();
    expect(whatOctoberRemembers()).toEqual(REMEMBERS_NOTHING);
  });
});
