import { describe, expect, it } from "vitest";
import { planOf, type Vote } from "./plan";

const v = (
  id: string,
  yours: Vote["yours"],
  theirs: Vote["theirs"],
  confirmed = false,
): Vote => ({ id, yours, theirs, confirmed });

describe("planOf", () => {
  it("puts what you both love first, and drops any Nope", () => {
    const plan = planOf([
      v("a", "in", "in"),
      v("b", "in", "out"),
      v("c", "out", "in"),
      v("d", "in", null),
      v("e", "maybe", "maybe"),
    ]);
    expect(plan.bothIn).toEqual(["a"]);
    expect(plan.leaning).toEqual(["d"]);
    expect(plan.locked).toEqual([]);
  });

  it("keeps a locked idea even if somebody later said Nope", () => {
    expect(planOf([v("a", "out", "in", true)]).locked).toEqual(["a"]);
  });
});
