import { describe, expect, it } from "vitest";
import { parseScreen } from "./ctx";

describe("Sesh Wars URLs", () => {
  it("map to screens, and nothing else does", () => {
    expect(parseScreen([])).toEqual({ k: "home" });
    expect(parseScreen(["m", "silverstar"])).toEqual({
      k: "mountain",
      id: "silverstar",
    });
    expect(parseScreen(["x", "5f0c2a8e-1111-4222-8333-944455556666"])).toEqual({
      k: "challenge",
      id: "5f0c2a8e-1111-4222-8333-944455556666",
    });
    expect(parseScreen(["answer", "dc-bait"])).toEqual({
      k: "answer",
      clip: "dc-bait",
    });
    expect(parseScreen(["feed"])).toEqual({ k: "feed", mountain: undefined });
    expect(parseScreen(["c"])).toEqual({ k: "missing" });
    expect(parseScreen(["c", "../../etc"])).toEqual({ k: "missing" });
    expect(parseScreen(["nope"])).toEqual({ k: "missing" });
  });
});
