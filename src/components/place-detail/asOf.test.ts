import { describe, expect, it } from "vitest";
import { asOfCaption } from "./asOf";

describe("asOfCaption", () => {
  const temporal = {
    policyVersion: 1,
    asOf: { hours: "2026-09-08T16:20:00.000Z" },
    claims: [],
    withheld: 0,
  };
  it("names the date Atlas observed a value it kept", () => {
    expect(asOfCaption(temporal, "hours")).toBe("as of Sep 8, 2026");
  });
  it("says nothing for a field Atlas gave no date for, or an older Atlas that sent no temporal view", () => {
    expect(asOfCaption(temporal, "feeRequired")).toBe("");
    expect(asOfCaption(undefined, "hours")).toBe("");
  });
  it("never decides currency itself: a stale value is Atlas's to withhold, not Passport's to caption", () => {
    expect(
      asOfCaption({ ...temporal, asOf: { hours: "not a date" } }, "hours"),
    ).toBe("");
  });
});
