import { describe, expect, it } from "vitest";
import { mentioner } from "./mention";

const people = [
  { id: "a", name: "Alex" },
  { id: "d", name: "Danny" },
];

describe("somebody said your name", () => {
  it("finds the name as a word, any case, and says who", () => {
    expect(
      mentioner(
        [{ by: "a", text: "danny, your Canucks are cooked" }],
        { name: "Danny" },
        people,
      ),
    ).toBe("Alex");
    expect(
      mentioner(
        [{ by: "a", text: "Where's Danny?" }],
        { name: "Danny" },
        people,
      ),
    ).toBe("Alex");
  });
  it("is not fooled by a name inside another word", () => {
    expect(
      mentioner(
        [{ by: "a", text: "Dannyboy is here" }],
        { name: "Danny" },
        people,
      ),
    ).toBeNull();
    expect(
      mentioner([{ by: "a", text: "nice" }], { name: "Danny" }, people),
    ).toBeNull();
    expect(mentioner([], undefined, people)).toBeNull();
  });
});
