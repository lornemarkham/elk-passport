import { describe, expect, it } from "vitest";
import { dreamEnabled } from "./flag";

describe("Dream is off in production unless turned on", () => {
  it("is a 404 in production by default", () => {
    expect(dreamEnabled({}, false)).toBe(false);
  });
  it("opens with GHAD_DREAM=on", () => {
    expect(dreamEnabled({ GHAD_DREAM: "on" }, false)).toBe(true);
  });
  it("is on in development unless turned off", () => {
    expect(dreamEnabled({}, true)).toBe(true);
    expect(dreamEnabled({ GHAD_DREAM: "off" }, true)).toBe(false);
  });
});
