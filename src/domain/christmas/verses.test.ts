import { describe, expect, it } from "vitest";
import { VERSES } from "./verses";

describe("the words by the fire", () => {
  it("opens on our own welcome", () => {
    expect(VERSES[0]).toEqual({ text: "Come on in. Stay awhile." });
  });

  it("takes turns: our own words, then a carol's, all the way round", () => {
    VERSES.forEach((verse, i) =>
      expect(Boolean(verse.carol)).toBe(i % 2 === 1),
    );
    expect(VERSES.length % 2).toBe(0);
  });

  it("keeps every line short enough for a phone", () => {
    for (const verse of VERSES) expect(verse.text.length).toBeLessThan(70);
  });

  it("asks nothing", () => {
    for (const verse of VERSES) expect(verse.text).not.toMatch(/\?/);
  });
});
